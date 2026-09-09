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
import { StoreContext } from './storeContext'
import type {
  NewDealInput,
  NewLeadInput,
  NewPropertyInput,
  NewTaskInput,
  PersistedData,
  StoreValue,
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
import type {
  DealStage,
  DocumentType,
  LeadStatus,
  ListingStatus,
  PropertyDoc,
  ShootStage,
  ThreadSubject,
} from './types'
import { ALL_STAFF_CHANNEL_ID } from './types'

const SESSION_KEY = 'pl-team.session'
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
    }
  } catch {
    // Private windows and cleared site data both land here.
    return freshData()
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<PersistedData>(loadData)
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(SESSION_KEY)
    } catch {
      return null
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(DATA_KEY, JSON.stringify(data))
    } catch {
      // Storage full or blocked — the portal keeps working in memory.
    }
  }, [data])

  useEffect(() => {
    try {
      if (currentUserId) localStorage.setItem(SESSION_KEY, currentUserId)
      else localStorage.removeItem(SESSION_KEY)
    } catch {
      // Same as above: a failed write must not break sign-in.
    }
  }, [currentUserId])

  const currentUser = useMemo(
    () => STAFF.find((s) => s.id === currentUserId) ?? null,
    [currentUserId],
  )

  const signIn = useCallback((staffId: string) => setCurrentUserId(staffId), [])
  const signOut = useCallback(() => setCurrentUserId(null), [])

  const staffById = useCallback(
    (id: string | null) => (id ? (STAFF.find((s) => s.id === id) ?? null) : null),
    [],
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
    staff: STAFF,
    currentUser,
    signIn,
    signOut,
    staffById,
    addProperty,
    addLead,
    addDeal,
    addTask,
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
