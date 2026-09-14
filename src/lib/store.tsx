// Application state.
//
// Every collection is loaded from the API and every mutator writes back to it.
// The mutators stay synchronous — a screen calls addLead() and gets an id, as
// it always did — because the alternative was making twelve screens await
// things they have no decision to make about.
//
// So writes are optimistic: the local change lands immediately, the request
// goes out behind it, and a failure puts the screen back to what the server
// actually holds and says so. That is the honest trade. What it must never do
// is fail silently, which is why every call goes through sync().
//
// Ids: a created record has a local id until the server answers with the real
// one, and screens hold the local id in their own state. Rather than swapping
// it underneath them — which would dangle their selection — the local id
// stays, and remoteId() translates it for every subsequent request.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Staff } from './types'
import { StoreContext } from './storeContext'
import { useAuth } from './authContext'
import { apiErrorMessage } from './api'
import type {
  ContentPatch,
  DealPatch,
  LeadPatch,
  NewContentInput,
  NewShootInput,
  NewStaffInput,
  NewTargetInput,
  ShootPatch,
  StaffPatch,
  TargetPatch,
  NewDealInput,
  NewLeadInput,
  NewPropertyInput,
  NewTaskInput,
  PersistedData,
  PropertyPatch,
  StoreValue,
  TaskPatch,
} from './storeContext'
import type {
  DealStage,
  DocumentType,
  LeadStatus,
  ListingStatus,
  PartnerStatus,
  PropertyDoc,
  ShootStage,
  ThreadSubject,
} from './types'
import { ALL_STAFF_CHANNEL_ID, DERIVED_OPS_KINDS } from './types'
import type { StaffIndex } from '../api/map'
import {
  orEmpty,
  channelsApi,
  dealsApi,
  leadsApi,
  logsApi,
  opsApi,
  partnersApi,
  productionApi,
  propertiesApi,
  staffApi,
  targetsApi,
  threadsApi,
} from '../api/collections'

const EMPTY: PersistedData = {
  deals: [],
  properties: [],
  leads: [],
  shoots: [],
  content: [],
  ops: [],
  threads: [],
  targets: [],
  logs: [],
  channels: [],
  staff: [],
  partners: [],
}

const EMPTY_INDEX: StaffIndex = { staffId: new Map(), userId: new Map() }

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<PersistedData>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { account } = useAuth()

  // Not state: changing it must not re-render, and every mutator needs the
  // current value without being rebuilt when it moves.
  const indexRef = useRef<StaffIndex>(EMPTY_INDEX)
  const aliases = useRef(new Map<string, string>())

  /** The server's id for a record, which for a fresh one may not exist yet. */
  const remoteId = useCallback(
    (id: string) => aliases.current.get(id) ?? id,
    [],
  )

  const signedIn = Boolean(account?.staffProfile)
  // A string, not the array: a fresh array per render would rebuild fetchAll
  // and re-run the load effect on every render.
  const grantKey = (account?.staffProfile?.permissions ?? []).join(',')

  /**
   * Read everything. No state is touched in here — the caller decides whether
   * the answer still matters, which is what keeps a slow response from an old
   * account overwriting a newer one.
   */
  const fetchAll = useCallback(async () => {
      const grants = new Set(grantKey.split(','))
      /**
       * Only ask for what this person may read. Asking anyway and swallowing
       * the 403 would work, but it spends the office's shared rate limit on
       * requests known to fail, and it hides the policy in error handling
       * rather than stating it here.
       */
      const readIf = <T,>(permission: string, call: () => Promise<T[]>) =>
        grants.has(permission)
          ? orEmpty(call(), [] as T[])
          : Promise.resolve([] as T[])

      // Staff first and alone: threads and channels are keyed by user id, and
      // the index that maps those to staff ids is built from this response.
      const { staff, index } = await staffApi.list()

      const [
        deals,
        properties,
        leads,
        shoots,
        content,
        ops,
        targets,
        logs,
        threads,
        channels,
        partners,
      ] = await Promise.all([
        readIf('MANAGE_DEALS', dealsApi.list),
        readIf('MANAGE_PROPERTIES', propertiesApi.list),
        readIf('MANAGE_LEADS', leadsApi.list),
        readIf('MANAGE_CONTENT', productionApi.listShoots),
        readIf('MANAGE_CONTENT', productionApi.listContent),
        readIf('HANDLE_OPS', opsApi.list),
        // Everyone has targets and logs; managers see the whole team's.
        grants.has('VIEW_ALL_TARGETS') ? targetsApi.list() : targetsApi.mine(),
        logsApi.recent(grants.has('VIEW_ALL_LOGS')),
        threadsApi.list(index),
        channelsApi.list(index),
        readIf('MANAGE_PARTNERS', partnersApi.list),
      ])

      return {
        index,
        data: {
          staff,
          deals,
          properties,
          leads,
          shoots,
          content,
          ops,
          targets,
          logs,
          threads,
          channels,
          partners,
        } satisfies PersistedData,
      }
  }, [grantKey])

  const apply = useCallback(
    (next: { index: StaffIndex; data: PersistedData }) => {
      indexRef.current = next.index
      aliases.current.clear()
      setData(next.data)
      setError(null)
    },
    [],
  )

  /** Re-read everything. Used by the error banner and after a failed write. */
  const load = useCallback(async () => {
    if (!signedIn) return
    setLoading(true)
    try {
      apply(await fetchAll())
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not load the portal'))
    } finally {
      setLoading(false)
    }
  }, [signedIn, fetchAll, apply])

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        // Always awaited, signed in or not, so nothing is set synchronously
        // inside the effect.
        const next = await (signedIn
          ? fetchAll()
          : Promise.resolve({ index: EMPTY_INDEX, data: EMPTY }))
        if (alive) apply(next)
      } catch (e) {
        if (alive) setError(apiErrorMessage(e, 'Could not load the portal'))
      } finally {
        if (alive) setLoading(false)
      }
    })()
    // Signing out mid-flight, or switching accounts, must not let the older
    // response land on top of the newer one.
    return () => {
      alive = false
    }
  }, [signedIn, fetchAll, apply])

  /**
   * Run a write, and if it fails say so and reload.
   *
   * Reloading rather than reversing the single change: by the time a request
   * fails the local state may have moved on, and the server's version is the
   * only one that is definitely true.
   */
  const sync = useCallback(
    <T,>(run: () => Promise<T>, onDone?: (result: T) => void) => {
      run()
        .then((result) => onDone?.(result))
        .catch((e: unknown) => {
          setError(apiErrorMessage(e, 'That change could not be saved'))
          void load()
        })
    },
    [load],
  )

  /** Remember the server's id for a record created locally. */
  const linkId = useCallback((localId: string, serverId: string) => {
    if (localId !== serverId) aliases.current.set(localId, serverId)
  }, [])

  /**
   * The signed-in staff member.
   *
   * Straight from the API now — identity, position and permissions all come
   * from the same StaffProfile the server authorises against, so what the
   * portal shows and what the API allows cannot drift apart.
   */
  const currentUser = useMemo<Staff | null>(() => {
    const profile = account?.staffProfile
    if (!account || !profile) return null
    return (
      data.staff.find((s) => s.id === profile.id) ?? {
        id: profile.id,
        letter: profile.letter,
        name: account.name,
        role: profile.staffRole,
        chapter: profile.chapter,
        ...(profile.secondaryChapter && {
          secondaryChapter: profile.secondaryChapter,
        }),
        email: account.email,
        reportsTo: null,
        active: profile.active,
        permissions: profile.permissions,
      }
    )
  }, [account, data.staff])

  const currentUserId = currentUser?.id ?? null

  const staffById = useCallback(
    (id: string | null) =>
      id ? (data.staff.find((s) => s.id === id) ?? null) : null,
    [data.staff],
  )
  const propertyById = useCallback(
    (id: string | null) =>
      id ? (data.properties.find((p) => p.id === id) ?? null) : null,
    [data.properties],
  )
  const dealById = useCallback(
    (id: string | null) => (id ? (data.deals.find((d) => d.id === id) ?? null) : null),
    [data.deals],
  )
  const leadById = useCallback(
    (id: string | null) => (id ? (data.leads.find((l) => l.id === id) ?? null) : null),
    [data.leads],
  )
  const shootById = useCallback(
    (id: string | null) => (id ? (data.shoots.find((s) => s.id === id) ?? null) : null),
    [data.shoots],
  )

  /* ─── Creating records ─────────────────────────────────────────────── */

  const addProperty = useCallback(
    (input: NewPropertyInput) => {
      const id = `prop-${Date.now()}`
      const now = new Date().toISOString()
      const types: DocumentType[] = [
        'C_OF_O',
        'SURVEY_PLAN',
        'BUILDING_PERMIT',
        'RECEIPT',
      ]
      // A document that has just arrived is present but NOT verified — somebody
      // still has to look at it. Creating one pre-verified would let a listing
      // walk straight through the gate the whole screen exists to enforce.
      const documents: PropertyDoc[] = types.map((type) => ({
        type,
        present: input.documentsPresent.includes(type),
        verified: false,
      }))

      setData((prev) => ({
        ...prev,
        properties: [
          {
            id,
            title: input.title,
            location: input.location,
            chapter: input.chapter,
            type: input.type,
            priceNaira: input.priceNaira,
            developer: input.developer,
            dealId: input.dealId,
            status: 'PENDING_REVIEW',
            verified: false,
            photoCount: input.photoCount,
            hasVideo: false,
            documents,
            // Attribution is taken from who is signed in, never chosen from a
            // dropdown — that is what makes the acquisition figure a fact.
            sourcedById: currentUserId ?? '',
            submittedAt: now,
            publishedAt: null,
            units: input.units,
            unitsSold: 0,
          },
          ...prev.properties,
        ],
      }))
      sync(
        () => propertiesApi.create(input),
        (saved) => linkId(id, saved.id),
      )
      return id
    },
    [currentUserId, sync, linkId],
  )

  const addLead = useCallback(
    (input: NewLeadInput) => {
      const id = `lead-${Date.now()}`
      const now = new Date().toISOString()
      setData((prev) => ({
        ...prev,
        leads: [
          {
            id,
            name: input.name,
            phone: input.phone,
            source: input.source,
            // An offline lead is logged after the conversation has happened, so
            // it starts CONTACTED with the SLA clock already stopped. Filing it
            // as NEW would show a phantom unanswered enquiry.
            status: 'CONTACTED',
            qualified: false,
            propertyId: input.propertyId,
            budgetNaira: input.budgetNaira,
            ownerId: input.ownerId,
            createdAt: now,
            lastContactAt: now,
            firstResponseMins: 0,
            notes: input.notes,
          },
          ...prev.leads,
        ],
      }))
      sync(
        async () => {
          const saved = await leadsApi.create(input)
          // The record is created NEW; moving it to CONTACTED is a second call
          // because that transition is what stamps the response time.
          await leadsApi.setStatus(saved.id, 'CONTACTED')
          return saved
        },
        (saved) => linkId(id, saved.id),
      )
      return id
    },
    [sync, linkId],
  )

  const addDeal = useCallback(
    (input: NewDealInput) => {
      const id = `deal-${Date.now()}`
      const now = new Date().toISOString()
      const nextActionAt =
        input.nextActionInDays === null
          ? null
          : new Date(Date.now() + input.nextActionInDays * 86_400_000).toISOString()

      setData((prev) => ({
        ...prev,
        deals: [
          {
            id,
            company: input.company,
            contactName: input.contactName,
            contactPhone: input.contactPhone,
            kind: input.kind,
            stage: 'IDENTIFIED',
            mandate: input.mandate,
            valueNaira: input.valueNaira,
            expectedUnits: input.expectedUnits,
            ownerId: input.ownerId,
            chapter: input.chapter,
            createdAt: now,
            lastActivityAt: now,
            nextActionAt,
            nextAction: input.nextAction,
            notes: input.notes,
          },
          ...prev.deals,
        ],
      }))
      sync(
        () => dealsApi.create(input),
        (saved) => linkId(id, saved.id),
      )
      return id
    },
    [sync, linkId],
  )

  const addTask = useCallback(
    (input: NewTaskInput) => {
      // Guard, not decoration: DERIVED_OPS_KINDS are projections of backend
      // records, and this is the one place an ops row can be born. Keeping the
      // check here means a future caller cannot quietly create a phantom payout.
      if ((DERIVED_OPS_KINDS as string[]).includes('TASK')) {
        throw new Error('TASK must not be listed as a derived ops kind')
      }
      const id = `ops-${Date.now()}`
      setData((prev) => ({
        ...prev,
        ops: [
          {
            id,
            kind: 'TASK',
            subject: input.subject,
            // Only a WithdrawalRequest carries money. A hand-made task never does.
            amountNaira: null,
            openedAt: new Date().toISOString(),
            assigneeId: input.assigneeId,
            resolved: false,
            urgent: input.urgent,
          },
          ...prev.ops,
        ],
      }))
      sync(
        () => opsApi.createTask(input),
        (saved) => linkId(id, saved.id),
      )
      return id
    },
    [sync, linkId],
  )

  /* ─── Editing ──────────────────────────────────────────────────────── */

  const updateProperty = useCallback(
    (id: string, patch: PropertyPatch) => {
      setData((prev) => ({
        ...prev,
        properties: prev.properties.map((p) => {
          if (p.id !== id) return p
          const { documentsPresent, ...rest } = patch
          let documents = p.documents
          if (documentsPresent) {
            documents = p.documents.map((d) => {
              const present = documentsPresent.includes(d.type)
              return {
                ...d,
                present,
                // Un-ticking a document takes its verification with it — a
                // document that is no longer on file cannot stay "checked".
                verified: present ? d.verified : false,
              }
            })
          }
          const next = { ...p, ...rest, documents }
          // Keep the verified flag consistent with the documents, exactly as
          // toggleDocVerified does, so the two paths cannot disagree.
          return { ...next, verified: documents.every((d) => d.present && d.verified) }
        }),
      }))
      sync(() => propertiesApi.update(remoteId(id), patch))
    },
    [sync, remoteId],
  )

  const updateLead = useCallback(
    (id: string, patch: LeadPatch) => {
      setData((prev) => ({
        ...prev,
        leads: prev.leads.map((l) => (l.id === id ? { ...l, ...patch } : l)),
      }))
      sync(() => leadsApi.update(remoteId(id), patch))
    },
    [sync, remoteId],
  )

  const updateDeal = useCallback(
    (id: string, patch: DealPatch) => {
      setData((prev) => ({
        ...prev,
        deals: prev.deals.map((d) => {
          if (d.id !== id) return d
          const { nextActionInDays, ...rest } = patch
          const nextActionAt =
            nextActionInDays === undefined
              ? d.nextActionAt
              : nextActionInDays === null
                ? null
                : new Date(Date.now() + nextActionInDays * 86_400_000).toISOString()
          return {
            ...d,
            ...rest,
            nextActionAt,
            lastActivityAt: new Date().toISOString(),
          }
        }),
      }))
      sync(() => dealsApi.update(remoteId(id), patch))
    },
    [sync, remoteId],
  )

  const updateTask = useCallback(
    (id: string, patch: TaskPatch) => {
      setData((prev) => ({
        ...prev,
        ops: prev.ops.map((o) => (o.id === id ? { ...o, ...patch } : o)),
      }))
      sync(() => opsApi.updateTask(remoteId(id), patch))
    },
    [sync, remoteId],
  )

  /* ─── Deleting ─────────────────────────────────────────────────────── */
  // Every delete cleans up after itself. Leaving a lead pointing at a
  // property id that no longer exists would render as a blank cell and quietly
  // corrupt the counts, so references are cleared in the same update. The API
  // cascades the same way at the database level.

  const deleteProperty = useCallback(
    (id: string) => {
      setData((prev) => ({
        ...prev,
        properties: prev.properties.filter((p) => p.id !== id),
        leads: prev.leads.map((l) =>
          l.propertyId === id ? { ...l, propertyId: null } : l,
        ),
        shoots: prev.shoots.map((s) =>
          s.propertyId === id ? { ...s, propertyId: null } : s,
        ),
        threads: prev.threads.filter(
          (t) => !(t.subject.kind === 'PROPERTY' && t.subject.id === id),
        ),
      }))
      sync(() => propertiesApi.remove(remoteId(id)))
    },
    [sync, remoteId],
  )

  const deleteDeal = useCallback(
    (id: string) => {
      setData((prev) => ({
        ...prev,
        deals: prev.deals.filter((d) => d.id !== id),
        properties: prev.properties.map((p) =>
          p.dealId === id ? { ...p, dealId: null } : p,
        ),
        threads: prev.threads.filter(
          (t) => !(t.subject.kind === 'DEAL' && t.subject.id === id),
        ),
      }))
      sync(() => dealsApi.remove(remoteId(id)))
    },
    [sync, remoteId],
  )

  const deleteLead = useCallback(
    (id: string) => {
      setData((prev) => ({
        ...prev,
        leads: prev.leads.filter((l) => l.id !== id),
        threads: prev.threads.filter(
          (t) => !(t.subject.kind === 'LEAD' && t.subject.id === id),
        ),
      }))
      sync(() => leadsApi.remove(remoteId(id)))
    },
    [sync, remoteId],
  )

  const deleteOpsItem = useCallback(
    (id: string) => {
      setData((prev) => ({ ...prev, ops: prev.ops.filter((o) => o.id !== id) }))
      sync(() => opsApi.removeTask(remoteId(id)))
    },
    [sync, remoteId],
  )

  /* ─── Shoots ───────────────────────────────────────────────────────── */

  const addShoot = useCallback(
    (input: NewShootInput) => {
      const id = `shoot-${Date.now()}`
      setData((prev) => ({
        ...prev,
        shoots: [
          {
            id,
            propertyId: input.propertyId,
            title: input.title,
            location: input.location,
            // Nothing is booked until a date exists, which is what the
            // Secretary's 24-hour prep rule is measured against.
            stage: input.scheduledInDays === null ? 'REQUESTED' : 'SCHEDULED',
            scheduledFor:
              input.scheduledInDays === null
                ? null
                : new Date(
                    Date.now() + input.scheduledInDays * 86_400_000,
                  ).toISOString(),
            prepCompleteAt: null,
            presenterId: input.presenterId,
            secretaryId: input.secretaryId,
            reshoot: false,
            engagementRate: null,
            publishedAt: null,
          },
          ...prev.shoots,
        ],
      }))
      sync(
        () => productionApi.createShoot(input),
        (saved) => linkId(id, saved.id),
      )
      return id
    },
    [sync, linkId],
  )

  const updateShoot = useCallback(
    (id: string, patch: ShootPatch) => {
      setData((prev) => ({
        ...prev,
        shoots: prev.shoots.map((sh) => {
          if (sh.id !== id) return sh
          const { scheduledInDays, ...rest } = patch
          const scheduledFor =
            scheduledInDays === undefined
              ? sh.scheduledFor
              : scheduledInDays === null
                ? null
                : new Date(Date.now() + scheduledInDays * 86_400_000).toISOString()
          const next = { ...sh, ...rest, scheduledFor }
          // Un-booking a shoot cannot leave it claiming to be scheduled.
          return scheduledFor === null && next.stage === 'SCHEDULED'
            ? { ...next, stage: 'REQUESTED' as const }
            : next
        }),
      }))
      sync(() => productionApi.updateShoot(remoteId(id), patch))
    },
    [sync, remoteId],
  )

  const deleteShoot = useCallback(
    (id: string) => {
      setData((prev) => ({
        ...prev,
        shoots: prev.shoots.filter((sh) => sh.id !== id),
        threads: prev.threads.filter(
          (t) => !(t.subject.kind === 'SHOOT' && t.subject.id === id),
        ),
      }))
      sync(() => productionApi.removeShoot(remoteId(id)))
    },
    [sync, remoteId],
  )

  /* ─── Content ──────────────────────────────────────────────────────── */

  const addContent = useCallback(
    (input: NewContentInput) => {
      const id = `content-${Date.now()}`
      const now = new Date().toISOString()
      setData((prev) => ({
        ...prev,
        content: [
          {
            id,
            title: input.title,
            channel: input.channel,
            kind: input.kind,
            publishedAt: input.scheduledInDays === null ? now : null,
            scheduledFor:
              input.scheduledInDays === null
                ? null
                : new Date(
                    Date.now() + input.scheduledInDays * 86_400_000,
                  ).toISOString(),
            // Engagement comes from each platform's own analytics, so it starts
            // empty rather than pretending to a number nobody has read yet.
            engagementRate: null,
            leadsGenerated: 0,
            ownerId: input.ownerId,
          },
          ...prev.content,
        ],
      }))
      sync(
        () => productionApi.createContent(input),
        (saved) => linkId(id, saved.id),
      )
      return id
    },
    [sync, linkId],
  )

  const updateContent = useCallback(
    (id: string, patch: ContentPatch) => {
      setData((prev) => ({
        ...prev,
        content: prev.content.map((c) => {
          if (c.id !== id) return c
          const { scheduledInDays, publishNow, ...rest } = patch
          const scheduledFor =
            scheduledInDays === undefined
              ? c.scheduledFor
              : scheduledInDays === null
                ? null
                : new Date(Date.now() + scheduledInDays * 86_400_000).toISOString()
          return {
            ...c,
            ...rest,
            scheduledFor: publishNow ? null : scheduledFor,
            publishedAt: publishNow
              ? (c.publishedAt ?? new Date().toISOString())
              : c.publishedAt,
          }
        }),
      }))
      sync(() => productionApi.updateContent(remoteId(id), patch))
    },
    [sync, remoteId],
  )

  const deleteContent = useCallback(
    (id: string) => {
      setData((prev) => ({ ...prev, content: prev.content.filter((c) => c.id !== id) }))
      sync(() => productionApi.removeContent(remoteId(id)))
    },
    [sync, remoteId],
  )

  /* ─── Targets ──────────────────────────────────────────────────────── */

  const updateTarget = useCallback(
    (id: string, patch: TargetPatch) => {
      setData((prev) => ({
        ...prev,
        targets: prev.targets.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      }))
      sync(() => targetsApi.update(remoteId(id), patch))
    },
    [sync, remoteId],
  )

  const addTarget = useCallback(
    (input: NewTargetInput) => {
      const id = `t-${Date.now()}`
      setData((prev) => ({
        ...prev,
        targets: [
          ...prev.targets,
          {
            id,
            staffId: input.staffId,
            label: input.label,
            min: input.min,
            max: Math.max(input.min, input.max),
            actual: 0,
            unit: input.unit,
            ceiling: input.ceiling,
            // A target invented here has no query behind it yet. Saying so is
            // the point of the provenance column.
            provenance: 'MANUAL',
          },
        ],
      }))
      sync(
        () => targetsApi.create(input),
        (saved) => linkId(id, saved.id),
      )
      return id
    },
    [sync, linkId],
  )

  const deleteTarget = useCallback(
    (id: string) => {
      setData((prev) => ({ ...prev, targets: prev.targets.filter((t) => t.id !== id) }))
      sync(() => targetsApi.remove(remoteId(id)))
    },
    [sync, remoteId],
  )

  /* ─── Agent partners ───────────────────────────────────────────────── */

  const setPartnerStatus = useCallback(
    (id: string, status: PartnerStatus) => {
      setData((prev) => ({
        ...prev,
        partners: prev.partners.map((p) =>
          p.id === id
            ? {
                ...p,
                status,
                // Moving someone past NEW means somebody spoke to them, so the
                // contact clock stops here rather than needing a second click.
                lastContactAt:
                  status !== 'NEW' && !p.lastContactAt
                    ? new Date().toISOString()
                    : p.lastContactAt,
              }
            : p,
        ),
      }))
      sync(() => partnersApi.setStatus(remoteId(id), status))
    },
    [sync, remoteId],
  )

  const assignPartner = useCallback(
    (id: string, staffId: string | null) => {
      setData((prev) => ({
        ...prev,
        partners: prev.partners.map((p) =>
          p.id === id ? { ...p, ownerId: staffId } : p,
        ),
      }))
      sync(() => partnersApi.assign(remoteId(id), staffId))
    },
    [sync, remoteId],
  )

  const logPartnerContact = useCallback(
    (id: string) => {
      setData((prev) => ({
        ...prev,
        partners: prev.partners.map((p) =>
          p.id === id
            ? {
                ...p,
                lastContactAt: new Date().toISOString(),
                status: p.status === 'NEW' ? 'CONTACTED' : p.status,
              }
            : p,
        ),
      }))
      sync(() => partnersApi.logContact(remoteId(id)))
    },
    [sync, remoteId],
  )

  const setPartnerNotes = useCallback(
    (id: string, notes: string) => {
      setData((prev) => ({
        ...prev,
        partners: prev.partners.map((p) => (p.id === id ? { ...p, notes } : p)),
      }))
      sync(() => partnersApi.setNotes(remoteId(id), notes))
    },
    [sync, remoteId],
  )

  /* ─── Staff ────────────────────────────────────────────────────────── */
  // No delete. Staff ids are stamped on properties, deals, leads, logs and
  // every message ever sent; removing one would orphan all of it. Deactivating
  // keeps the history readable and is what the org document means by a
  // position being vacant.

  const addStaff = useCallback(
    (input: NewStaffInput) => {
      const id = `staff-${Date.now()}`
      setData((prev) => ({
        ...prev,
        staff: [
          ...prev.staff,
          {
            id,
            ...input,
            active: true,
            // Left empty rather than guessed from the position: permissions are
            // issued by the server per person, and the real set arrives with
            // the created record.
            permissions: [],
          },
        ],
        // A new colleague joins the all-staff channel immediately, or they
        // cannot see anything the team has agreed.
        channels: prev.channels.map((c) =>
          c.id === ALL_STAFF_CHANNEL_ID
            ? { ...c, memberIds: [...c.memberIds, id] }
            : c,
        ),
      }))
      sync(
        () => staffApi.create(input),
        (saved) => {
          linkId(id, saved.id)
          // Swapped in full here rather than aliased: a staff record carries
          // the permissions every screen reads, and the placeholder above has
          // none of them.
          setData((prev) => ({
            ...prev,
            staff: prev.staff.map((s) => (s.id === id ? saved : s)),
          }))
        },
      )
      return id
    },
    [sync, linkId],
  )

  const updateStaff = useCallback(
    (id: string, patch: StaffPatch) => {
      setData((prev) => ({
        ...prev,
        staff: prev.staff.map((sm) => (sm.id === id ? { ...sm, ...patch } : sm)),
      }))
      sync(() => staffApi.update(remoteId(id), patch))
    },
    [sync, remoteId],
  )

  const setStaffActive = useCallback(
    (id: string, active: boolean) => {
      setData((prev) => ({
        ...prev,
        staff: prev.staff.map((sm) => (sm.id === id ? { ...sm, active } : sm)),
      }))
      sync(() => staffApi.setActive(remoteId(id), active))
    },
    [sync, remoteId],
  )

  const moveDeal = useCallback(
    (dealId: string, stage: DealStage) => {
      setData((prev) => ({
        ...prev,
        deals: prev.deals.map((d) =>
          d.id === dealId
            ? {
                ...d,
                stage,
                lastActivityAt: new Date().toISOString(),
                // Reaching a mandate stage without a mandate type recorded is
                // the most common data gap, so default it rather than leave
                // the pipeline reporting an exclusive that nobody signed.
                mandate:
                  stage === 'MANDATE_SIGNED' && d.mandate === 'NONE'
                    ? 'OPEN'
                    : d.mandate,
              }
            : d,
        ),
      }))
      sync(() => dealsApi.setStage(remoteId(dealId), stage))
    },
    [sync, remoteId],
  )

  const setPropertyStatus = useCallback(
    (propertyId: string, status: ListingStatus) => {
      setData((prev) => ({
        ...prev,
        properties: prev.properties.map((p) =>
          p.id === propertyId
            ? {
                ...p,
                status,
                publishedAt:
                  status === 'ACTIVE' && !p.publishedAt
                    ? new Date().toISOString()
                    : p.publishedAt,
              }
            : p,
        ),
      }))
      sync(() => propertiesApi.setStatus(remoteId(propertyId), status))
    },
    [sync, remoteId],
  )

  const toggleDocVerified = useCallback(
    (propertyId: string, docType: string) => {
      let nextVerified = false
      setData((prev) => ({
        ...prev,
        properties: prev.properties.map((p) => {
          if (p.id !== propertyId) return p
          const documents = p.documents.map((d) => {
            if (d.type !== docType || !d.present) return d
            nextVerified = !d.verified
            return { ...d, verified: nextVerified }
          })
          // A property counts as verified only when every document it holds
          // has been checked — and it must hold all four.
          const verified = documents.every((d) => d.present && d.verified)
          return { ...p, documents, verified }
        }),
      }))
      sync(() =>
        propertiesApi.setDocumentVerified(
          remoteId(propertyId),
          docType as DocumentType,
          nextVerified,
        ),
      )
    },
    [sync, remoteId],
  )

  const setLeadStatus = useCallback(
    (leadId: string, status: LeadStatus) => {
      setData((prev) => ({
        ...prev,
        leads: prev.leads.map((l) =>
          l.id === leadId
            ? {
                ...l,
                status,
                lastContactAt: new Date().toISOString(),
                // First touch stops the SLA clock.
                firstResponseMins:
                  l.firstResponseMins ??
                  Math.max(
                    1,
                    Math.round(
                      (Date.now() - new Date(l.createdAt).getTime()) / 60000,
                    ),
                  ),
              }
            : l,
        ),
      }))
      sync(() => leadsApi.setStatus(remoteId(leadId), status))
    },
    [sync, remoteId],
  )

  const toggleLeadQualified = useCallback(
    (leadId: string) => {
      let next = false
      setData((prev) => ({
        ...prev,
        leads: prev.leads.map((l) => {
          if (l.id !== leadId) return l
          next = !l.qualified
          return { ...l, qualified: next }
        }),
      }))
      sync(() => leadsApi.setQualified(remoteId(leadId), next))
    },
    [sync, remoteId],
  )

  const setShootStage = useCallback(
    (shootId: string, stage: ShootStage) => {
      setData((prev) => ({
        ...prev,
        shoots: prev.shoots.map((s) =>
          s.id === shootId
            ? {
                ...s,
                stage,
                publishedAt:
                  stage === 'PUBLISHED' && !s.publishedAt
                    ? new Date().toISOString()
                    : s.publishedAt,
              }
            : s,
        ),
      }))
      sync(() => productionApi.setShootStage(remoteId(shootId), stage))
    },
    [sync, remoteId],
  )

  const markShootPrepped = useCallback(
    (shootId: string) => {
      setData((prev) => ({
        ...prev,
        shoots: prev.shoots.map((s) =>
          s.id === shootId
            ? {
                ...s,
                prepCompleteAt: new Date().toISOString(),
                stage: s.stage === 'SCHEDULED' ? 'PREPPED' : s.stage,
              }
            : s,
        ),
      }))
      sync(() => productionApi.markPrepped(remoteId(shootId)))
    },
    [sync, remoteId],
  )

  const assignOps = useCallback(
    (opsId: string, staffId: string | null) => {
      const item = data.ops.find((o) => o.id === opsId)
      setData((prev) => ({
        ...prev,
        ops: prev.ops.map((o) => (o.id === opsId ? { ...o, assigneeId: staffId } : o)),
      }))
      // Only a hand-made task is a row this API owns. The rest are projections
      // of KYC submissions, payouts and disputes, which are assigned where
      // they live — attempting it here would 404.
      if (item?.kind === 'TASK') {
        sync(() => opsApi.updateTask(remoteId(opsId), { assigneeId: staffId }))
      }
    },
    [sync, remoteId, data.ops],
  )

  const resolveOps = useCallback(
    (opsId: string) => {
      const item = data.ops.find((o) => o.id === opsId)
      setData((prev) => ({
        ...prev,
        ops: prev.ops.map((o) =>
          o.id === opsId ? { ...o, resolved: !o.resolved } : o,
        ),
      }))
      if (item?.kind === 'TASK') {
        sync(() =>
          opsApi.updateTask(remoteId(opsId), { resolved: !item.resolved }),
        )
      }
    },
    [sync, remoteId, data.ops],
  )

  const postMessage = useCallback(
    (threadId: string, text: string) => {
      if (!currentUserId || !text.trim()) return
      setData((prev) => ({
        ...prev,
        threads: prev.threads.map((t) =>
          t.id === threadId
            ? {
                ...t,
                messages: [
                  ...t.messages,
                  {
                    id: `tm-${Date.now()}`,
                    authorId: currentUserId,
                    text: text.trim(),
                    createdAt: new Date().toISOString(),
                  },
                ],
              }
            : t,
        ),
      }))
      sync(() =>
        threadsApi.postMessage(indexRef.current, remoteId(threadId), text.trim()),
      )
    },
    [currentUserId, sync, remoteId],
  )

  const createThread = useCallback(
    (
      title: string,
      subject: ThreadSubject,
      participantIds: string[],
      firstMessage: string,
    ) => {
      const id = `thread-${Date.now()}`
      const now = new Date().toISOString()
      const author = currentUserId
      setData((prev) => ({
        ...prev,
        threads: [
          {
            id,
            title,
            subject,
            participantIds,
            resolved: false,
            createdAt: now,
            messages:
              author && firstMessage.trim()
                ? [
                    {
                      id: `tm-${Date.now()}`,
                      authorId: author,
                      text: firstMessage.trim(),
                      createdAt: now,
                    },
                  ]
                : [],
          },
          ...prev.threads,
        ],
      }))
      sync(
        () =>
          threadsApi.create(
            indexRef.current,
            title,
            // A thread pinned to a record only just created locally must point
            // at the id the server knows it by.
            subject.id
              ? { ...subject, id: remoteId(subject.id) }
              : subject,
            participantIds,
            firstMessage.trim(),
          ),
        (saved) => linkId(id, saved.id),
      )
      return id
    },
    [currentUserId, sync, linkId, remoteId],
  )

  const toggleThreadResolved = useCallback(
    (threadId: string) => {
      let next = false
      setData((prev) => ({
        ...prev,
        threads: prev.threads.map((t) => {
          if (t.id !== threadId) return t
          next = !t.resolved
          return { ...t, resolved: next }
        }),
      }))
      sync(() =>
        threadsApi.setResolved(indexRef.current, remoteId(threadId), next),
      )
    },
    [sync, remoteId],
  )

  /* ─── Daily logs ───────────────────────────────────────────────────── */

  const logFor = useCallback(
    (staffId: string, date: string) =>
      data.logs.find((l) => l.staffId === staffId && l.date === date) ?? null,
    [data.logs],
  )

  const saveLog = useCallback(
    (
      date: string,
      fields: { summary: string; blockers: string; plan: string },
    ) => {
      if (!currentUserId) return
      const now = new Date().toISOString()
      setData((prev) => {
        const existing = prev.logs.find(
          (l) => l.staffId === currentUserId && l.date === date,
        )
        if (existing) {
          return {
            ...prev,
            logs: prev.logs.map((l) =>
              l.id === existing.id ? { ...l, ...fields, updatedAt: now } : l,
            ),
          }
        }
        return {
          ...prev,
          logs: [
            {
              id: `log-${currentUserId}-${date}`,
              staffId: currentUserId,
              date,
              ...fields,
              submittedAt: now,
              updatedAt: now,
            },
            ...prev.logs,
          ],
        }
      })
      // Keyed by day rather than by id, so one call both creates and updates.
      sync(() => logsApi.save(date, fields))
    },
    [currentUserId, sync],
  )

  /* ─── Messaging ────────────────────────────────────────────────────── */

  const openDirect = useCallback(
    (otherStaffId: string) => {
      if (!currentUserId) return ALL_STAFF_CHANNEL_ID
      const existing = data.channels.find(
        (c) =>
          c.kind === 'DIRECT' &&
          c.memberIds.length === 2 &&
          c.memberIds.includes(currentUserId) &&
          c.memberIds.includes(otherStaffId),
      )
      if (existing) return existing.id

      // Sorted ids keep the generated id stable whichever side opens it first.
      const pair = [currentUserId, otherStaffId].sort()
      const id = `channel-dm-${pair[0]}-${pair[1]}`
      setData((prev) =>
        prev.channels.some((c) => c.id === id)
          ? prev
          : {
              ...prev,
              channels: [
                ...prev.channels,
                {
                  id,
                  kind: 'DIRECT',
                  name: null,
                  memberIds: pair,
                  messages: [],
                  lastReadAt: {},
                  createdAt: new Date().toISOString(),
                },
              ],
            },
      )
      sync(
        () => channelsApi.openDirect(indexRef.current, otherStaffId),
        (channel) => linkId(id, channel.id),
      )
      return id
    },
    [currentUserId, data.channels, sync, linkId],
  )

  const sendMessage = useCallback(
    (channelId: string, text: string) => {
      if (!currentUserId || !text.trim()) return
      const now = new Date().toISOString()
      setData((prev) => ({
        ...prev,
        channels: prev.channels.map((c) =>
          c.id === channelId
            ? {
                ...c,
                messages: [
                  ...c.messages,
                  {
                    id: `cm-${Date.now()}`,
                    authorId: currentUserId,
                    text: text.trim(),
                    createdAt: now,
                  },
                ],
                // Sending is also reading — otherwise your own message would
                // come back to you as unread.
                lastReadAt: { ...c.lastReadAt, [currentUserId]: now },
              }
            : c,
        ),
      }))
      sync(() =>
        channelsApi.send(indexRef.current, remoteId(channelId), text.trim()),
      )
    },
    [currentUserId, sync, remoteId],
  )

  const markChannelRead = useCallback(
    (channelId: string) => {
      if (!currentUserId) return
      const now = new Date().toISOString()
      setData((prev) => ({
        ...prev,
        channels: prev.channels.map((c) =>
          c.id === channelId
            ? { ...c, lastReadAt: { ...c.lastReadAt, [currentUserId]: now } }
            : c,
        ),
      }))
      sync(() => channelsApi.markRead(remoteId(channelId)))
    },
    [currentUserId, sync, remoteId],
  )

  /** Reload everything from the API. Also what the error banner retries. */
  const resetData = useCallback(() => {
    void load()
  }, [load])

  const value: StoreValue = {
    ...data,
    currentUser,
    loading,
    error,
    dismissError: () => setError(null),
    refresh: resetData,
    staffById,
    addProperty,
    addLead,
    addDeal,
    addTask,
    updateProperty,
    updateLead,
    updateDeal,
    updateTask,
    deleteProperty,
    deleteLead,
    deleteDeal,
    deleteOpsItem,
    addShoot,
    updateShoot,
    deleteShoot,
    addContent,
    updateContent,
    deleteContent,
    updateTarget,
    addTarget,
    deleteTarget,
    setPartnerStatus,
    assignPartner,
    logPartnerContact,
    setPartnerNotes,
    addStaff,
    updateStaff,
    setStaffActive,
    propertyById,
    dealById,
    leadById,
    shootById,
    moveDeal,
    setPropertyStatus,
    toggleDocVerified,
    setLeadStatus,
    toggleLeadQualified,
    setShootStage,
    markShootPrepped,
    assignOps,
    resolveOps,
    postMessage,
    createThread,
    toggleThreadResolved,
    saveLog,
    logFor,
    openDirect,
    sendMessage,
    markChannelRead,
    resetData,
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
