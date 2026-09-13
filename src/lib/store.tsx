// Application state.
//
// This is deliberately a plain Context over in-memory arrays seeded from
// lib/seed.ts and persisted to localStorage. It is the seam where the real
// API goes: every mutator below is the shape of one HTTP call, so replacing
// this file with an axios service layer should not require touching a single
// screen.
//
// The signed-in staff member is chosen from a list rather than authenticated.
// There is no password here and no session — this is a frontend shell.

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Staff } from './types'
import { ROLE_PERMISSIONS } from './permissions'
import { StoreContext } from './storeContext'
import { useAuth } from './authContext'
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
import {
  CONTENT,
  DEALS,
  LEADS,
  OPS,
  PROPERTIES,
  SHOOTS,
  STAFF,
  TARGETS,
  THREADS,
} from './seed'
import { CHANNELS, DAILY_LOGS } from './seedCollab'
import { PARTNERS } from './seedPartners'
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

const DATA_KEY = 'pl-team.data'

function freshData(): PersistedData {
  // Structured clones so the seed arrays are never mutated in place — a
  // reset must always return to the same starting point.
  return structuredClone({
    deals: DEALS,
    properties: PROPERTIES,
    leads: LEADS,
    shoots: SHOOTS,
    content: CONTENT,
    ops: OPS,
    threads: THREADS,
    targets: TARGETS,
    logs: DAILY_LOGS,
    channels: CHANNELS,
    staff: STAFF,
    partners: PARTNERS,
  })
}

function loadData(): PersistedData {
  try {
    const raw = localStorage.getItem(DATA_KEY)
    if (!raw) return freshData()
    const parsed = JSON.parse(raw) as Partial<PersistedData>
    const base = freshData()
    // Merge rather than trust: a schema change between sessions should not
    // leave the portal with a missing collection.
    return {
      deals: parsed.deals ?? base.deals,
      properties: parsed.properties ?? base.properties,
      leads: parsed.leads ?? base.leads,
      shoots: parsed.shoots ?? base.shoots,
      content: parsed.content ?? base.content,
      ops: parsed.ops ?? base.ops,
      threads: parsed.threads ?? base.threads,
      targets: parsed.targets ?? base.targets,
      logs: parsed.logs ?? base.logs,
      channels: parsed.channels ?? base.channels,
      staff: parsed.staff ?? base.staff,
      partners: parsed.partners ?? base.partners,
    }
  } catch {
    // Private windows and cleared site data both land here.
    return freshData()
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<PersistedData>(loadData)
  const { account } = useAuth()

  useEffect(() => {
    try {
      localStorage.setItem(DATA_KEY, JSON.stringify(data))
    } catch {
      // Storage full or blocked — the portal keeps working in memory.
    }
  }, [data])

  /**
   * The signed-in staff member.
   *
   * Identity, position and permissions come from the API. The id is bridged
   * onto a seeded staff record of the same position so the sample workload
   * ("your queue", "your targets") still resolves — the records below are
   * still fixtures, and a real cuid matches none of them. When the pages are
   * wired to live endpoints this mapping goes and account.staffProfile.id is
   * used directly.
   */
  const currentUser = useMemo<Staff | null>(() => {
    const profile = account?.staffProfile
    if (!account || !profile) return null

    const sample =
      data.staff.find(
        (s) => s.role === profile.staffRole && s.chapter === profile.chapter,
      ) ?? data.staff.find((s) => s.role === profile.staffRole)

    return {
      id: sample?.id ?? profile.id,
      letter: profile.letter,
      name: account.name,
      role: profile.staffRole,
      chapter: profile.chapter,
      ...(profile.secondaryChapter && {
        secondaryChapter: profile.secondaryChapter,
      }),
      email: account.email,
      reportsTo: sample?.reportsTo ?? null,
      active: profile.active,
      // Server-issued, so a grant or revoke on one person is honoured here
      // rather than being re-derived from their position.
      permissions: profile.permissions,
    }
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
            sourcedById: currentUserId ?? 'staff-b',
            submittedAt: now,
            publishedAt: null,
            units: input.units,
            unitsSold: 0,
          },
          ...prev.properties,
        ],
      }))
      return id
    },
    [currentUserId],
  )

  const addLead = useCallback((input: NewLeadInput) => {
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
    return id
  }, [])

  const addDeal = useCallback((input: NewDealInput) => {
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
    return id
  }, [])

  const addTask = useCallback((input: NewTaskInput) => {
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
    return id
  }, [])

  /* ─── Editing ──────────────────────────────────────────────────────── */

  const updateProperty = useCallback((id: string, patch: PropertyPatch) => {
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
  }, [])

  const updateLead = useCallback((id: string, patch: LeadPatch) => {
    setData((prev) => ({
      ...prev,
      leads: prev.leads.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }))
  }, [])

  const updateDeal = useCallback((id: string, patch: DealPatch) => {
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
  }, [])

  const updateTask = useCallback((id: string, patch: TaskPatch) => {
    setData((prev) => ({
      ...prev,
      ops: prev.ops.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    }))
  }, [])

  /* ─── Deleting ─────────────────────────────────────────────────────── */
  // Every delete cleans up after itself. Leaving a lead pointing at a
  // property id that no longer exists would render as a blank cell and quietly
  // corrupt the counts, so references are cleared in the same update.

  const deleteProperty = useCallback((id: string) => {
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
  }, [])

  const deleteDeal = useCallback((id: string) => {
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
  }, [])

  const deleteLead = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      leads: prev.leads.filter((l) => l.id !== id),
      threads: prev.threads.filter(
        (t) => !(t.subject.kind === 'LEAD' && t.subject.id === id),
      ),
    }))
  }, [])

  const deleteOpsItem = useCallback((id: string) => {
    setData((prev) => ({ ...prev, ops: prev.ops.filter((o) => o.id !== id) }))
  }, [])

  /* ─── Shoots ───────────────────────────────────────────────────────── */

  const addShoot = useCallback((input: NewShootInput) => {
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
    return id
  }, [])

  const updateShoot = useCallback((id: string, patch: ShootPatch) => {
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
  }, [])

  const deleteShoot = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      shoots: prev.shoots.filter((sh) => sh.id !== id),
      threads: prev.threads.filter(
        (t) => !(t.subject.kind === 'SHOOT' && t.subject.id === id),
      ),
    }))
  }, [])

  /* ─── Content ──────────────────────────────────────────────────────── */

  const addContent = useCallback((input: NewContentInput) => {
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
    return id
  }, [])

  const updateContent = useCallback((id: string, patch: ContentPatch) => {
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
  }, [])

  const deleteContent = useCallback((id: string) => {
    setData((prev) => ({ ...prev, content: prev.content.filter((c) => c.id !== id) }))
  }, [])

  /* ─── Targets ──────────────────────────────────────────────────────── */

  const updateTarget = useCallback((id: string, patch: TargetPatch) => {
    setData((prev) => ({
      ...prev,
      targets: prev.targets.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }))
  }, [])

  const addTarget = useCallback((input: NewTargetInput) => {
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
    return id
  }, [])

  const deleteTarget = useCallback((id: string) => {
    setData((prev) => ({ ...prev, targets: prev.targets.filter((t) => t.id !== id) }))
  }, [])

  /* ─── Staff ────────────────────────────────────────────────────────── */
  // No delete. Staff ids are stamped on properties, deals, leads, logs and
  // every message ever sent; removing one would orphan all of it. Deactivating
  // keeps the history readable and is what the org document means by a
  // position being vacant.

  /* ─── Agent partners ───────────────────────────────────────────────── */

  const setPartnerStatus = useCallback((id: string, status: PartnerStatus) => {
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
  }, [])

  const assignPartner = useCallback((id: string, staffId: string | null) => {
    setData((prev) => ({
      ...prev,
      partners: prev.partners.map((p) =>
        p.id === id ? { ...p, ownerId: staffId } : p,
      ),
    }))
  }, [])

  const logPartnerContact = useCallback((id: string) => {
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
  }, [])

  const setPartnerNotes = useCallback((id: string, notes: string) => {
    setData((prev) => ({
      ...prev,
      partners: prev.partners.map((p) => (p.id === id ? { ...p, notes } : p)),
    }))
  }, [])

  const addStaff = useCallback((input: NewStaffInput) => {
    const id = `staff-${Date.now()}`
    setData((prev) => ({
      ...prev,
      staff: [
        ...prev.staff,
        // A new position starts on its own defaults, exactly as the API does
        // when a StaffProfile is created.
        {
          id,
          ...input,
          active: true,
          permissions: ROLE_PERMISSIONS[input.role],
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
    return id
  }, [])

  const updateStaff = useCallback((id: string, patch: StaffPatch) => {
    setData((prev) => ({
      ...prev,
      staff: prev.staff.map((sm) => (sm.id === id ? { ...sm, ...patch } : sm)),
    }))
  }, [])

  const setStaffActive = useCallback((id: string, active: boolean) => {
    setData((prev) => ({
      ...prev,
      staff: prev.staff.map((sm) => (sm.id === id ? { ...sm, active } : sm)),
    }))
  }, [])

  const moveDeal = useCallback((dealId: string, stage: DealStage) => {
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
  }, [])

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
    },
    [],
  )

  const toggleDocVerified = useCallback(
    (propertyId: string, docType: string) => {
      setData((prev) => ({
        ...prev,
        properties: prev.properties.map((p) => {
          if (p.id !== propertyId) return p
          const documents = p.documents.map((d) =>
            d.type === docType && d.present
              ? { ...d, verified: !d.verified }
              : d,
          )
          // A property counts as verified only when every document it holds
          // has been checked — and it must hold all four.
          const verified = documents.every((d) => d.present && d.verified)
          return { ...p, documents, verified }
        }),
      }))
    },
    [],
  )

  const setLeadStatus = useCallback((leadId: string, status: LeadStatus) => {
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
  }, [])

  const toggleLeadQualified = useCallback((leadId: string) => {
    setData((prev) => ({
      ...prev,
      leads: prev.leads.map((l) =>
        l.id === leadId ? { ...l, qualified: !l.qualified } : l,
      ),
    }))
  }, [])

  const setShootStage = useCallback((shootId: string, stage: ShootStage) => {
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
  }, [])

  const markShootPrepped = useCallback((shootId: string) => {
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
  }, [])

  const assignOps = useCallback((opsId: string, staffId: string | null) => {
    setData((prev) => ({
      ...prev,
      ops: prev.ops.map((o) => (o.id === opsId ? { ...o, assigneeId: staffId } : o)),
    }))
  }, [])

  const resolveOps = useCallback((opsId: string) => {
    setData((prev) => ({
      ...prev,
      ops: prev.ops.map((o) =>
        o.id === opsId ? { ...o, resolved: !o.resolved } : o,
      ),
    }))
  }, [])

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
    },
    [currentUserId],
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
      return id
    },
    [currentUserId],
  )

  const toggleThreadResolved = useCallback((threadId: string) => {
    setData((prev) => ({
      ...prev,
      threads: prev.threads.map((t) =>
        t.id === threadId ? { ...t, resolved: !t.resolved } : t,
      ),
    }))
  }, [])

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
    },
    [currentUserId],
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
      return id
    },
    [currentUserId, data.channels],
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
    },
    [currentUserId],
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
    },
    [currentUserId],
  )

  const resetData = useCallback(() => setData(freshData()), [])

  const value: StoreValue = {
    ...data,
    currentUser,
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
