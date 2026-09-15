// What the API actually sends.
//
// Kept separate from lib/types.ts on purpose. Those are the shapes the screens
// are written against; these are the shapes on the wire, and the two disagree
// in small ways that would otherwise leak into every component: the API calls
// a property's owning record `listingId` where the portal says `propertyId`, a
// log's day is `day` rather than `date`, threads are keyed by user id while
// everything in the portal is keyed by staff id.
//
// map.ts is the only place that knows about both.

import type {
  Chapter,
  ContentChannel,
  ContentKind,
  DealKind,
  DealStage,
  DocumentType,
  LeadSource,
  LeadStatus,
  ListingStatus,
  ListingType,
  MandateType,
  PartnerExperience,
  PartnerStatus,
  ShootStage,
  StaffRole,
  TargetUnit,
} from '../lib/types'
import type { Permission } from '../lib/permissions'

/** Dates arrive as ISO strings; Prisma DateTime serialises that way. */
type Iso = string

export interface StaffDto {
  id: string
  userId: string
  letter: string
  staffRole: StaffRole
  chapter: Chapter
  secondaryChapter: Chapter | null
  permissions: Permission[]
  reportsToId: string | null
  active: boolean
  createdAt: Iso
  user: {
    id: string
    name: string | null
    email: string
    avatarUrl: string | null
    phone: string | null
  }
}

export interface DealDto {
  id: string
  company: string
  contactName: string
  contactPhone: string | null
  kind: DealKind
  stage: DealStage
  mandate: MandateType
  valueNaira: number
  expectedUnits: number
  chapter: Chapter
  ownerId: string
  nextAction: string | null
  nextActionAt: Iso | null
  notes: string
  lastActivityAt: Iso
  createdAt: Iso
}

/** Shaped by StaffListingsService — already close to the portal's Property. */
export interface ListingDto {
  id: string
  title: string
  location: string
  chapter: Chapter | null
  type: ListingType
  priceNaira: number
  developer: string | null
  dealId: string | null
  status: ListingStatus
  verified: boolean
  photoCount: number
  /** Already rewritten for display by the API. */
  images: string[]
  propertyType: string
  address: string
  beds: number
  baths: number
  /** Free text, as agents enter it ("2,400"). */
  sqft: string
  yearBuilt: string | null
  /** Sanitised HTML from the rich text editor. */
  description: string
  features: string[]
  virtualTourUrl: string | null
  /** Uploaded video files and YouTube / Vimeo links. */
  videoUrls: string[]
  documentFiles: {
    id: string
    type: DocumentType
    name: string
    url: string | null
    verified: boolean
  }[]
  hasVideo: boolean
  documents: { type: DocumentType; present: boolean; verified: boolean }[]
  sourcedById: string | null
  submittedAt: Iso
  publishedAt: Iso | null
  units: number
  unitsSold: number
}

/** Shaped by StaffLeadsService. */
export interface LeadDto {
  id: string
  name: string
  phone: string
  source: LeadSource
  status: LeadStatus
  qualified: boolean
  propertyId: string | null
  budgetNaira: number | null
  ownerId: string | null
  createdAt: Iso
  lastContactAt: Iso | null
  firstResponseMins: number | null
  notes: string | null
}

export interface ShootDto {
  id: string
  title: string
  location: string
  listingId: string | null
  /** Present on the list; absent on write responses. */
  listing?: { id: string; title: string; location: string } | null
  stage: ShootStage
  scheduledFor: Iso | null
  prepCompleteAt: Iso | null
  presenterId: string
  secretaryId: string
  reshoot: boolean
  engagementRate: number | null
  publishedAt: Iso | null
}

export interface ContentDto {
  id: string
  title: string
  channel: ContentChannel
  kind: ContentKind
  publishedAt: Iso | null
  scheduledFor: Iso | null
  engagementRate: number | null
  leadsGenerated: number
  ownerId: string
}

export interface OpsDto {
  id: string
  kind: string
  subject: string
  amountNaira: number | null
  openedAt: Iso
  assigneeId: string | null
  resolved: boolean
  urgent: boolean
  /** False for anything projected from another model — a payout, a KYC row. */
  editable: boolean
  source: string
}

export interface TargetDto {
  id: string
  staffId: string
  label: string
  min: number
  max: number
  actual: number
  unit: TargetUnit
  ceiling: boolean
  provenance: 'DATABASE' | 'MANUAL'
  period: string
}

export interface DailyLogDto {
  id: string
  staffId: string
  /** YYYY-MM-DD. The portal calls this `date`. */
  day: string
  summary: string
  blockers: string
  plan: string
  submittedAt: Iso
  updatedAt: Iso
}

/** A Conversation row. Participants and senders are USER ids, not staff ids. */
export interface ThreadDto {
  id: string
  title: string | null
  kind: string
  /** Conversation stores WHEN it was resolved, not whether. */
  resolvedAt: Iso | null
  createdAt: Iso
  listingId: string | null
  dealId: string | null
  leadId: string | null
  shootId: string | null
  participants: { userId: string; lastReadAt: Iso | null }[]
  messages: { id: string; senderUserId: string; text: string; createdAt: Iso }[]
  listing: { id: string; title: string } | null
  deal: { id: string; company: string } | null
  lead: { id: string; name: string } | null
}

export interface PartnerDto {
  id: string
  code: string
  name: string | null
  email: string
  phone: string | null
  status: PartnerStatus
  experience: PartnerExperience | null
  agencyName: string | null
  operatingState: string | null
  referredByCode: string | null
  owner: { id: string; name: string | null } | null
  payoutReady: boolean
  /** e.g. ["passport photo", "NIN"] — exactly what is still missing. */
  payoutGaps: string[]
  registeredAt: Iso
  lastContactAt: Iso | null
  notes: string | null
}

export interface Paged<T> {
  items: T[]
  total: number
  page: number
  limit: number
  pages: number
}
