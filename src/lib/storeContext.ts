// Store context, value shape and the hooks that read it.
//
// Split out from store.tsx so that file exports only the provider component —
// mixing components and plain functions in one module breaks Fast Refresh.

import { createContext, useContext } from 'react'
import type {
  Channel,
  Chapter,
  ContentPiece,
  DailyLog,
  Deal,
  DealKind,
  DealStage,
  DocumentType,
  Lead,
  LeadSource,
  LeadStatus,
  ListingStatus,
  ListingType,
  MandateType,
  OpsItem,
  Property,
  Shoot,
  ShootStage,
  Staff,
  Target,
  Thread,
  ThreadSubject,
} from './types'

export interface PersistedData {
  deals: Deal[]
  properties: Property[]
  leads: Lead[]
  shoots: Shoot[]
  content: ContentPiece[]
  ops: OpsItem[]
  threads: Thread[]
  targets: Target[]
  logs: DailyLog[]
  channels: Channel[]
}

export interface StoreValue extends PersistedData {
  staff: Staff[]
  currentUser: Staff | null
  signIn: (staffId: string) => void
  signOut: () => void

  staffById: (id: string | null) => Staff | null
  propertyById: (id: string | null) => Property | null
  dealById: (id: string | null) => Deal | null
  leadById: (id: string | null) => Lead | null
  shootById: (id: string | null) => Shoot | null

  /* ── Creating records ──────────────────────────────────────────────
     Each returns the new id so a screen can select or scroll to it. Note
     what is NOT here: no way to create a KYC, payout, report or dispute
     item. Those are projections of backend records, and a hand-made one
     would be a task with nothing behind it. */

  addProperty: (input: NewPropertyInput) => string
  addLead: (input: NewLeadInput) => string
  addDeal: (input: NewDealInput) => string
  addTask: (input: NewTaskInput) => string

  moveDeal: (dealId: string, stage: DealStage) => void
  setPropertyStatus: (propertyId: string, status: ListingStatus) => void
  toggleDocVerified: (propertyId: string, docType: string) => void
  setLeadStatus: (leadId: string, status: LeadStatus) => void
  toggleLeadQualified: (leadId: string) => void
  setShootStage: (shootId: string, stage: ShootStage) => void
  markShootPrepped: (shootId: string) => void
  assignOps: (opsId: string, staffId: string | null) => void
  resolveOps: (opsId: string) => void
  postMessage: (threadId: string, text: string) => void
  createThread: (
    title: string,
    subject: ThreadSubject,
    participantIds: string[],
    firstMessage: string,
  ) => string
  toggleThreadResolved: (threadId: string) => void

  /** Create or update the signed-in user's log for one calendar day. */
  saveLog: (
    date: string,
    fields: { summary: string; blockers: string; plan: string },
  ) => void
  logFor: (staffId: string, date: string) => DailyLog | null

  /** Find the existing direct channel with someone, or open a new one. */
  openDirect: (otherStaffId: string) => string
  sendMessage: (channelId: string, text: string) => void
  markChannelRead: (channelId: string) => void

  resetData: () => void
}

export interface NewPropertyInput {
  title: string
  location: string
  chapter: Chapter
  type: ListingType
  priceNaira: number
  developer: string | null
  dealId: string | null
  units: number
  photoCount: number
  /** Which of the four documents the owner has actually handed over. */
  documentsPresent: DocumentType[]
}

export interface NewLeadInput {
  name: string
  phone: string
  source: LeadSource
  propertyId: string | null
  budgetNaira: number | null
  ownerId: string
  notes: string
}

export interface NewDealInput {
  company: string
  contactName: string
  contactPhone: string | null
  kind: DealKind
  mandate: MandateType
  valueNaira: number
  expectedUnits: number
  chapter: Chapter
  ownerId: string
  nextAction: string | null
  /** Days from today, or null for no scheduled follow-up. */
  nextActionInDays: number | null
  notes: string
}

export interface NewTaskInput {
  subject: string
  assigneeId: string | null
  urgent: boolean
}

export const StoreContext = createContext<StoreValue | null>(null)

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>')
  return ctx
}

/** The signed-in user, for screens that are already behind the auth gate. */
export function useCurrentUser(): Staff {
  const { currentUser } = useStore()
  if (!currentUser) throw new Error('useCurrentUser used outside a protected route')
  return currentUser
}
