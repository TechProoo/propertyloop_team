// Domain types for the PropertyLoop staff portal.
//
// Where a type mirrors something that already exists in the backend Prisma
// schema, the values are kept IDENTICAL to the schema so that swapping the
// mock store for the real API is a transport change and not a data
// remodelling exercise. Those are marked "mirrors <Model>.<field>".
//
// Note: tsconfig sets `erasableSyntaxOnly`, so these are const objects +
// union types rather than TS enums.

import type { Permission } from './permissions'

/* ─── Staff ──────────────────────────────────────────────────────────── */

// The seven positions in the September 2026 structure. `Role` in the backend
// is BUYER | AGENT | VENDOR | ADMIN and has no staff concept — this lives
// alongside it (see lib/permissions.ts).
export const StaffRole = {
  MD_CEO: 'MD_CEO',
  GM: 'GM',
  PROPERTY_LISTING: 'PROPERTY_LISTING',
  MARKETING: 'MARKETING',
  OPERATIONS: 'OPERATIONS',
  AMBASSADOR: 'AMBASSADOR',
  SECRETARY: 'SECRETARY',
} as const
export type StaffRole = (typeof StaffRole)[keyof typeof StaffRole]

export const STAFF_ROLE_LABEL: Record<StaffRole, string> = {
  MD_CEO: 'Managing Director / CEO',
  GM: 'General Manager — BD & Sales',
  PROPERTY_LISTING: 'Property & Listing Manager',
  MARKETING: 'Marketing & Content Executive',
  OPERATIONS: 'Operations & Customer Relationship',
  AMBASSADOR: 'Video Presenter — Ambassador',
  SECRETARY: 'Secretary',
}

export const STAFF_ROLE_SHORT: Record<StaffRole, string> = {
  MD_CEO: 'MD / CEO',
  GM: 'General Manager',
  PROPERTY_LISTING: 'Property & Listing',
  MARKETING: 'Marketing',
  OPERATIONS: 'Operations & CRM',
  AMBASSADOR: 'Ambassador',
  SECRETARY: 'Secretary',
}

export type Chapter = 'LAGOS' | 'OSUN'

export interface Staff {
  id: string
  /** "A"–"G", the letter used throughout the org document. */
  letter: string
  /** Real name where one has been assigned, otherwise null. */
  name: string | null
  role: StaffRole
  chapter: Chapter
  /** Set for staff who also carry Osun chapter duties. */
  secondaryChapter?: Chapter
  email: string | null
  reportsTo: string | null
  active: boolean
  /**
   * What this person may actually do. Issued by the API per person, not
   * derived from their position — see can() in permissions.ts.
   */
  permissions: Permission[]
}

/* ─── Developer & mandate pipeline ───────────────────────────────────── */
// This has NO backend equivalent. Developers, advertisers and B2B clients
// are not modelled in the Prisma schema, which is exactly why the pipeline
// belongs here rather than in the product database.

export const DealStage = {
  IDENTIFIED: 'IDENTIFIED',
  CONTACTED: 'CONTACTED',
  PRESENTATION_SENT: 'PRESENTATION_SENT',
  MEETING: 'MEETING',
  INVENTORY_RECEIVED: 'INVENTORY_RECEIVED',
  MANDATE_SIGNED: 'MANDATE_SIGNED',
  PUBLISHED: 'PUBLISHED',
  LOST: 'LOST',
} as const
export type DealStage = (typeof DealStage)[keyof typeof DealStage]

export const DEAL_STAGE_ORDER: DealStage[] = [
  'IDENTIFIED',
  'CONTACTED',
  'PRESENTATION_SENT',
  'MEETING',
  'INVENTORY_RECEIVED',
  'MANDATE_SIGNED',
  'PUBLISHED',
]

export const DEAL_STAGE_LABEL: Record<DealStage, string> = {
  IDENTIFIED: 'Identified',
  CONTACTED: 'Contacted',
  PRESENTATION_SENT: 'Presentation sent',
  MEETING: 'Meeting held',
  INVENTORY_RECEIVED: 'Inventory received',
  MANDATE_SIGNED: 'Mandate signed',
  PUBLISHED: 'Published',
  LOST: 'Lost',
}

export type DealKind =
  | 'DEVELOPER'
  | 'ADVERTISER'
  | 'FACILITY_MANAGEMENT'
  | 'BUILDING_FINISHING'
  | 'REALTOR'

export const DEAL_KIND_LABEL: Record<DealKind, string> = {
  DEVELOPER: 'Developer',
  ADVERTISER: 'Advertiser',
  FACILITY_MANAGEMENT: 'Facility management',
  BUILDING_FINISHING: 'Building finishing',
  REALTOR: 'Realtor / agency',
}

export type MandateType = 'EXCLUSIVE' | 'PRIMARY' | 'OPEN' | 'NONE'

export const MANDATE_LABEL: Record<MandateType, string> = {
  EXCLUSIVE: 'Exclusive',
  PRIMARY: 'Primary',
  OPEN: 'Open',
  NONE: 'No mandate',
}

export interface Deal {
  id: string
  company: string
  contactName: string
  contactPhone: string | null
  kind: DealKind
  stage: DealStage
  mandate: MandateType
  /** Naira. Expected commission / package value, not the property price. */
  valueNaira: number
  /** Units or listings expected from this relationship. */
  expectedUnits: number
  ownerId: string
  chapter: Chapter
  createdAt: string
  lastActivityAt: string
  nextActionAt: string | null
  nextAction: string | null
  notes: string
}

/* ─── Property pipeline ──────────────────────────────────────────────── */

// mirrors Listing.status
export const ListingStatus = {
  PENDING_REVIEW: 'PENDING_REVIEW',
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  SOLD: 'SOLD',
  RENTED: 'RENTED',
  ARCHIVED: 'ARCHIVED',
} as const
export type ListingStatus = (typeof ListingStatus)[keyof typeof ListingStatus]

export const LISTING_STATUS_LABEL: Record<ListingStatus, string> = {
  PENDING_REVIEW: 'Pending review',
  ACTIVE: 'Published',
  PAUSED: 'Paused',
  SOLD: 'Sold',
  RENTED: 'Rented',
  ARCHIVED: 'Archived',
}

// mirrors ListingType
export type ListingType = 'SALE' | 'RENT' | 'SHORTLET'

export const LISTING_TYPE_LABEL: Record<ListingType, string> = {
  SALE: 'For sale',
  RENT: 'For rent',
  SHORTLET: 'Shortlet',
}

// mirrors DocumentType
export const DocumentType = {
  C_OF_O: 'C_OF_O',
  SURVEY_PLAN: 'SURVEY_PLAN',
  BUILDING_PERMIT: 'BUILDING_PERMIT',
  RECEIPT: 'RECEIPT',
} as const
export type DocumentType = (typeof DocumentType)[keyof typeof DocumentType]

export const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = {
  C_OF_O: 'Certificate of Occupancy',
  SURVEY_PLAN: 'Survey plan',
  BUILDING_PERMIT: 'Building permit',
  RECEIPT: 'Receipt',
}

export const DOCUMENT_TYPE_SHORT: Record<DocumentType, string> = {
  C_OF_O: 'C of O',
  SURVEY_PLAN: 'Survey',
  BUILDING_PERMIT: 'Permit',
  RECEIPT: 'Receipt',
}

export interface PropertyDoc {
  type: DocumentType
  present: boolean
  verified: boolean
}

export interface Property {
  id: string
  title: string
  location: string
  chapter: Chapter
  type: ListingType
  priceNaira: number
  developer: string | null
  /** Which deal in the developer pipeline brought this in, if any. */
  dealId: string | null
  status: ListingStatus
  /** mirrors Listing.verified */
  verified: boolean
  photoCount: number
  hasVideo: boolean
  documents: PropertyDoc[]
  /**
   * The staff member who sourced this. The Prisma Listing model has agentId
   * but NO sourcing attribution, so acquisition numbers are currently
   * unverifiable from the product database — this is the field to add.
   */
  sourcedById: string
  submittedAt: string
  publishedAt: string | null
  units: number
  unitsSold: number
}

/* ─── Leads ──────────────────────────────────────────────────────────── */

// mirrors Lead.status
export const LeadStatus = {
  NEW: 'NEW',
  CONTACTED: 'CONTACTED',
  VIEWING_SCHEDULED: 'VIEWING_SCHEDULED',
  NEGOTIATING: 'NEGOTIATING',
  CONVERTED: 'CONVERTED',
  LOST: 'LOST',
} as const
export type LeadStatus = (typeof LeadStatus)[keyof typeof LeadStatus]

export const LEAD_STATUS_ORDER: LeadStatus[] = [
  'NEW',
  'CONTACTED',
  'VIEWING_SCHEDULED',
  'NEGOTIATING',
  'CONVERTED',
]

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  VIEWING_SCHEDULED: 'Viewing scheduled',
  NEGOTIATING: 'Negotiating',
  CONVERTED: 'Converted',
  LOST: 'Lost',
}

// mirrors Lead.source
export const LeadSource = {
  LISTING_PAGE: 'LISTING_PAGE',
  AGENT_PROFILE: 'AGENT_PROFILE',
  PHONE: 'PHONE',
  EMAIL: 'EMAIL',
  REFERRAL: 'REFERRAL',
  OTHER: 'OTHER',
} as const
export type LeadSource = (typeof LeadSource)[keyof typeof LeadSource]

export const LEAD_SOURCE_LABEL: Record<LeadSource, string> = {
  LISTING_PAGE: 'Listing page',
  AGENT_PROFILE: 'Agent profile',
  PHONE: 'Phone',
  EMAIL: 'Email',
  REFERRAL: 'Referral',
  OTHER: 'Other',
}

/**
 * Sources a person may log by hand. Website enquiries (LISTING_PAGE,
 * AGENT_PROFILE) are written by the backend when someone submits the form —
 * typing those in would duplicate the record and start the SLA clock from
 * when somebody got round to it rather than when the enquiry arrived.
 */
export const OFFLINE_LEAD_SOURCES: LeadSource[] = ['PHONE', 'REFERRAL', 'EMAIL', 'OTHER']

export interface Lead {
  id: string
  name: string
  phone: string
  source: LeadSource
  status: LeadStatus
  /**
   * "Qualified" is the contested word between Marketing and the GM. It is a
   * single explicit flag here so both sides read the same number: budget
   * confirmed, timeline stated, and a property or service of interest named.
   */
  qualified: boolean
  propertyId: string | null
  budgetNaira: number | null
  ownerId: string
  createdAt: string
  lastContactAt: string | null
  /** Minutes from creation to first response — Operations' 30-minute SLA. */
  firstResponseMins: number | null
  notes: string
}

/* ─── Content & video production ─────────────────────────────────────── */

export const ShootStage = {
  REQUESTED: 'REQUESTED',
  SCHEDULED: 'SCHEDULED',
  PREPPED: 'PREPPED',
  FILMED: 'FILMED',
  EDITING: 'EDITING',
  PUBLISHED: 'PUBLISHED',
} as const
export type ShootStage = (typeof ShootStage)[keyof typeof ShootStage]

export const SHOOT_STAGE_ORDER: ShootStage[] = [
  'REQUESTED',
  'SCHEDULED',
  'PREPPED',
  'FILMED',
  'EDITING',
  'PUBLISHED',
]

export const SHOOT_STAGE_LABEL: Record<ShootStage, string> = {
  REQUESTED: 'Requested',
  SCHEDULED: 'Scheduled',
  PREPPED: 'Prepped',
  FILMED: 'Filmed',
  EDITING: 'Editing',
  PUBLISHED: 'Published',
}

export interface Shoot {
  id: string
  propertyId: string | null
  title: string
  location: string
  stage: ShootStage
  scheduledFor: string | null
  /** Secretary's target: script, documents and logistics ready 24h ahead. */
  prepCompleteAt: string | null
  presenterId: string
  secretaryId: string
  reshoot: boolean
  engagementRate: number | null
  publishedAt: string | null
}

export type ContentChannel =
  | 'INSTAGRAM'
  | 'LINKEDIN'
  | 'WHATSAPP'
  | 'TIKTOK'
  | 'X'

export const CONTENT_CHANNEL_LABEL: Record<ContentChannel, string> = {
  INSTAGRAM: 'Instagram',
  LINKEDIN: 'LinkedIn',
  WHATSAPP: 'WhatsApp Channel',
  TIKTOK: 'TikTok',
  X: 'X',
}

export type ContentKind = 'GRAPHIC' | 'CAROUSEL' | 'POST' | 'VIDEO' | 'CAMPAIGN'

export const CONTENT_KIND_LABEL: Record<ContentKind, string> = {
  GRAPHIC: 'Graphic',
  CAROUSEL: 'Carousel',
  POST: 'Post',
  VIDEO: 'Video',
  CAMPAIGN: 'Campaign',
}

export interface ContentPiece {
  id: string
  title: string
  channel: ContentChannel
  kind: ContentKind
  publishedAt: string | null
  scheduledFor: string | null
  engagementRate: number | null
  leadsGenerated: number
  ownerId: string
}

/* ─── Operations queue ───────────────────────────────────────────────── */
// Work already accumulating in the product database with no owner in the
// org document. Each item maps to a real backend model.

export type OpsKind =
  | 'KYC'
  | 'WITHDRAWAL'
  | 'REPORT'
  | 'DISPUTE'
  | 'LISTING_REVIEW'
  | 'ENQUIRY'
  | 'TASK'

/**
 * The queues that are PROJECTIONS of backend records. Nobody may create one
 * by hand: a payout row with no WithdrawalRequest behind it can be marked
 * resolved without any money moving, which is worse than having no row. Only
 * TASK is hand-created, and it is labelled as such wherever it appears.
 */
export const DERIVED_OPS_KINDS: OpsKind[] = [
  'KYC',
  'WITHDRAWAL',
  'REPORT',
  'DISPUTE',
  'LISTING_REVIEW',
  'ENQUIRY',
]

export const OPS_KIND_LABEL: Record<OpsKind, string> = {
  KYC: 'KYC review',
  WITHDRAWAL: 'Withdrawal payout',
  REPORT: 'User / content report',
  DISPUTE: 'Escrow dispute',
  LISTING_REVIEW: 'Listing review',
  ENQUIRY: 'Customer enquiry',
  TASK: 'Internal task',
}

/** The Prisma model each queue reads from, surfaced so the wiring is obvious. */
export const OPS_KIND_SOURCE: Record<OpsKind, string> = {
  KYC: 'KycSubmission',
  WITHDRAWAL: 'WithdrawalRequest',
  REPORT: 'Report / FeedReport',
  DISPUTE: 'JobDisputeMessage',
  LISTING_REVIEW: 'Listing',
  ENQUIRY: 'Message',
  TASK: 'Created here',
}

export interface OpsItem {
  id: string
  kind: OpsKind
  subject: string
  /** Naira, for withdrawals. Money leaving the business needs a face on it. */
  amountNaira: number | null
  openedAt: string
  assigneeId: string | null
  resolved: boolean
  urgent: boolean
}

/* ─── Internal threads ───────────────────────────────────────────────── */
// Discussion attached to a record. Conversation in the Prisma schema already
// carries an optional listingId, so this maps onto it directly — with an
// isInternal flag so staff chatter never reaches the customer inbox.

export type ThreadSubjectKind =
  | 'PROPERTY'
  | 'DEAL'
  | 'LEAD'
  | 'SHOOT'
  | 'GENERAL'

export const THREAD_SUBJECT_LABEL: Record<ThreadSubjectKind, string> = {
  PROPERTY: 'Property',
  DEAL: 'Deal',
  LEAD: 'Lead',
  SHOOT: 'Shoot',
  GENERAL: 'General',
}

export interface ThreadSubject {
  kind: ThreadSubjectKind
  /** null for GENERAL threads, which are not attached to a record. */
  id: string | null
}

export interface ThreadMessage {
  id: string
  authorId: string
  text: string
  createdAt: string
}

export interface Thread {
  id: string
  title: string
  subject: ThreadSubject
  participantIds: string[]
  messages: ThreadMessage[]
  resolved: boolean
  createdAt: string
}

/* ─── Targets ────────────────────────────────────────────────────────── */

export type TargetUnit = 'COUNT' | 'NAIRA' | 'PERCENT'

export interface Target {
  id: string
  staffId: string
  label: string
  /** Lower and upper bound of the monthly range from the org document. */
  min: number
  max: number
  actual: number
  unit: TargetUnit
  /**
   * True when the number is a limit to stay UNDER rather than a floor to
   * reach — reshoot rate, scheduling conflicts. Progress inverts for these.
   */
  ceiling?: boolean
  /**
   * Where the number comes from. DATABASE numbers are queryable and cannot be
   * argued with; MANUAL numbers are somebody typing. The distinction is shown
   * in the UI on purpose — a scorecard built on MANUAL rows measures
   * diligence in reporting, not results.
   */
  provenance: 'DATABASE' | 'MANUAL'
}

/* ─── Daily work log ─────────────────────────────────────────────────── */
// One entry per person per day. Deliberately paired in the UI with the
// activity the records already show for that day: a written log on its own
// measures diligence in reporting, but written alongside what the system
// actually recorded it becomes reviewable.

export interface DailyLog {
  id: string
  staffId: string
  /** Local calendar day, YYYY-MM-DD. One entry per person per day. */
  date: string
  /** What was done. */
  summary: string
  /** What is in the way — the part a manager most needs to read. */
  blockers: string
  /** What is planned next. */
  plan: string
  submittedAt: string
  updatedAt: string
}

/* ─── Messaging ──────────────────────────────────────────────────────── */
// Direct messages and the all-staff group. Distinct from Thread, which is
// discussion pinned to a specific record. Maps onto the same Conversation /
// ConversationParticipant / Message tables in the Prisma schema, with
// ConversationParticipant.lastReadAt already carrying the read state.

export type ChannelKind = 'DIRECT' | 'GROUP'

export interface ChatMessage {
  id: string
  authorId: string
  text: string
  createdAt: string
}

export interface Channel {
  id: string
  kind: ChannelKind
  /** Set for GROUP. Null for DIRECT — the name is the other person. */
  name: string | null
  memberIds: string[]
  messages: ChatMessage[]
  /** staffId → ISO timestamp they last opened this channel. */
  lastReadAt: Record<string, string>
  createdAt: string
}

/** The one channel everybody is in. Seeded, and cannot be left. */
export const ALL_STAFF_CHANNEL_ID = 'channel-all-staff'

/* ─── Agent partners ─────────────────────────────────────────────────── */
// People who registered through /realtors/partners on the public site.
// Distinct from Staff: a partner works WITH PropertyLoop on commission, not
// for it. The manager-side view exists because a recruitment link with no
// tracking behind it is just a form — somebody has to see who arrived, who
// vouched for them, and who is still waiting to be called.

export const PartnerStatus = {
  /** Registered, nobody has spoken to them yet. */
  NEW: 'NEW',
  /** Someone has made contact. */
  CONTACTED: 'CONTACTED',
  /** Identity and credentials checked — eligible for the public directory. */
  VERIFIED: 'VERIFIED',
  /** Listing or selling. */
  ACTIVE: 'ACTIVE',
  /** Went quiet, or declined. */
  DORMANT: 'DORMANT',
  /** Failed verification. Kept, not deleted — we need the record of why. */
  REJECTED: 'REJECTED',
} as const
export type PartnerStatus = (typeof PartnerStatus)[keyof typeof PartnerStatus]

export const PARTNER_STATUS_ORDER: PartnerStatus[] = [
  'NEW',
  'CONTACTED',
  'VERIFIED',
  'ACTIVE',
]

export const PARTNER_STATUS_LABEL: Record<PartnerStatus, string> = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  VERIFIED: 'Verified',
  ACTIVE: 'Active',
  DORMANT: 'Dormant',
  REJECTED: 'Rejected',
}

export type PartnerExperience = 'NEW' | 'ONE_TO_THREE' | 'THREE_PLUS'

export const PARTNER_EXPERIENCE_LABEL: Record<PartnerExperience, string> = {
  NEW: 'New to sales',
  ONE_TO_THREE: '1–3 years',
  THREE_PLUS: '3+ years',
}

export interface AgentPartner {
  id: string
  /** Human-readable partner number, e.g. AGT-4192. */
  code: string
  fullName: string
  whatsapp: string
  email: string
  experience: PartnerExperience | null
  agencyName: string | null
  operatingState: string | null

  status: PartnerStatus
  /** Partner code of whoever referred them, if anyone. */
  referredByCode: string | null
  /** Staff member who recruited or is handling them. */
  ownerId: string | null

  /**
   * Payout readiness, not a promise of payment. Split out because the
   * registration form lets people skip it — so "registered" and "can be
   * paid" are genuinely different states, and the gap between them is the
   * thing that stalls a first commission.
   */
  hasPhoto: boolean
  hasBank: boolean
  hasNin: boolean
  hasTaxId: boolean

  registeredAt: string
  lastContactAt: string | null
  notes: string
}

/** All four payout fields present — nothing blocks a commission transfer. */
export function partnerPayoutReady(p: AgentPartner): boolean {
  return p.hasPhoto && p.hasBank && p.hasNin && p.hasTaxId
}
