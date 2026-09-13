// Store context, value shape and the hooks that read it.
//
// Split out from store.tsx so that file exports only the provider component —
// mixing components and plain functions in one module breaks Fast Refresh.

import { createContext, useContext } from 'react'
import type {
  AgentPartner,
  Channel,
  Chapter,
  ContentChannel,
  ContentKind,
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
  PartnerStatus,
  Property,
  Shoot,
  ShootStage,
  Staff,
  StaffRole,
  Target,
  TargetUnit,
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
  /** Editable, so it lives in persisted data rather than as a module const. */
  staff: Staff[]
  partners: AgentPartner[]
}

export interface StoreValue extends PersistedData {
  currentUser: Staff | null

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

  /* Editing. Patches are partial — a form sends only what it owns, so
     nothing it does not render can be wiped by omission. */
  updateProperty: (id: string, patch: PropertyPatch) => void
  updateLead: (id: string, patch: LeadPatch) => void
  updateDeal: (id: string, patch: DealPatch) => void
  updateTask: (id: string, patch: TaskPatch) => void

  /* Deleting. Each cascades: references held by other records are cleared
     and threads pinned to the record go with it, so nothing is left
     pointing at an id that no longer exists. Use deleteImpact() to show
     what will happen before calling these. */
  deleteProperty: (id: string) => void
  deleteLead: (id: string) => void
  deleteDeal: (id: string) => void
  deleteOpsItem: (id: string) => void

  /* Shoots and content — the Ambassador's and Marketing's own records. */
  addShoot: (input: NewShootInput) => string
  updateShoot: (id: string, patch: ShootPatch) => void
  deleteShoot: (id: string) => void
  addContent: (input: NewContentInput) => string
  updateContent: (id: string, patch: ContentPatch) => void
  deleteContent: (id: string) => void

  /* Targets. Editing the number somebody is measured against is deliberately
     a separate permission from reading it. */
  updateTarget: (id: string, patch: TargetPatch) => void
  addTarget: (input: NewTargetInput) => string
  deleteTarget: (id: string) => void

  /* Staff. There is no delete — ids are referenced by every other record, so
     people are deactivated instead, which keeps their history intact. */
  /* Agent partners — people who registered at /realtors/partners. They are
     not created here: registration happens on the public site. What the
     manager does is work them. */
  setPartnerStatus: (id: string, status: PartnerStatus) => void
  assignPartner: (id: string, staffId: string | null) => void
  logPartnerContact: (id: string) => void
  setPartnerNotes: (id: string, notes: string) => void

  addStaff: (input: NewStaffInput) => string
  updateStaff: (id: string, patch: StaffPatch) => void
  setStaffActive: (id: string, active: boolean) => void

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

export type PropertyPatch = Partial<
  Pick<
    Property,
    | 'title'
    | 'location'
    | 'chapter'
    | 'type'
    | 'priceNaira'
    | 'developer'
    | 'dealId'
    | 'units'
    | 'unitsSold'
    | 'photoCount'
    | 'hasVideo'
  >
> & { documentsPresent?: DocumentType[] }

export type LeadPatch = Partial<
  Pick<
    Lead,
    'name' | 'phone' | 'source' | 'propertyId' | 'budgetNaira' | 'ownerId' | 'notes'
  >
>

export type DealPatch = Partial<
  Pick<
    Deal,
    | 'company'
    | 'contactName'
    | 'contactPhone'
    | 'kind'
    | 'mandate'
    | 'valueNaira'
    | 'expectedUnits'
    | 'chapter'
    | 'ownerId'
    | 'nextAction'
    | 'notes'
  >
> & { nextActionInDays?: number | null }

export type TaskPatch = Partial<Pick<OpsItem, 'subject' | 'assigneeId' | 'urgent'>>

export interface NewShootInput {
  title: string
  location: string
  propertyId: string | null
  presenterId: string
  secretaryId: string
  /** Days from today, or null when nothing is booked yet. */
  scheduledInDays: number | null
}

export type ShootPatch = Partial<
  Pick<
    Shoot,
    | 'title'
    | 'location'
    | 'propertyId'
    | 'presenterId'
    | 'secretaryId'
    | 'reshoot'
    | 'engagementRate'
  >
> & { scheduledInDays?: number | null }

export interface NewContentInput {
  title: string
  channel: ContentChannel
  kind: ContentKind
  ownerId: string
  /** Days from today. Null publishes it immediately. */
  scheduledInDays: number | null
}

export type ContentPatch = Partial<
  Pick<
    ContentPiece,
    'title' | 'channel' | 'kind' | 'ownerId' | 'engagementRate' | 'leadsGenerated'
  >
> & { scheduledInDays?: number | null; publishNow?: boolean }

export type TargetPatch = Partial<
  Pick<Target, 'label' | 'min' | 'max' | 'actual' | 'unit' | 'ceiling' | 'provenance'>
>

export interface NewTargetInput {
  staffId: string
  label: string
  min: number
  max: number
  unit: TargetUnit
  ceiling: boolean
}

export interface NewStaffInput {
  letter: string
  name: string | null
  role: StaffRole
  chapter: Chapter
  secondaryChapter?: Chapter
  email: string | null
  reportsTo: string | null
}

export type StaffPatch = Partial<
  Pick<Staff, 'name' | 'role' | 'chapter' | 'secondaryChapter' | 'email' | 'reportsTo'>
>

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
