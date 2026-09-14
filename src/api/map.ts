// Wire shape → domain shape.
//
// The only module that knows both. Anything the API names differently, or
// keys differently, is reconciled here so no screen has to care.

import type {
  AgentPartner,
  Channel,
  ChatMessage,
  ContentPiece,
  DailyLog,
  Deal,
  Lead,
  OpsItem,
  OpsKind,
  Property,
  Shoot,
  Staff,
  Target,
  Thread,
  ThreadSubject,
  ThreadSubjectKind,
} from '../lib/types'
import { ALL_STAFF_CHANNEL_ID } from '../lib/types'
import type {
  ContentDto,
  DailyLogDto,
  DealDto,
  LeadDto,
  ListingDto,
  OpsDto,
  PartnerDto,
  ShootDto,
  StaffDto,
  TargetDto,
  ThreadDto,
} from './dto'

/**
 * Threads and messages are keyed by user id; everything else in the portal is
 * keyed by staff id. This is the lookup between them, built once from the
 * staff list, which is why staff must load before threads are mapped.
 */
export interface StaffIndex {
  /** user id → staff id, for reading threads. */
  staffId: Map<string, string>
  /** staff id → user id, for writing them: the API takes user ids. */
  userId: Map<string, string>
}

export function staffIndex(staff: StaffDto[]): StaffIndex {
  return {
    staffId: new Map(staff.map((s) => [s.userId, s.id])),
    userId: new Map(staff.map((s) => [s.id, s.userId])),
  }
}

export function toStaff(dto: StaffDto): Staff {
  return {
    id: dto.id,
    letter: dto.letter,
    name: dto.user.name,
    role: dto.staffRole,
    chapter: dto.chapter,
    ...(dto.secondaryChapter && { secondaryChapter: dto.secondaryChapter }),
    email: dto.user.email,
    reportsTo: dto.reportsToId,
    active: dto.active,
    permissions: dto.permissions,
  }
}

export function toDeal(dto: DealDto): Deal {
  return {
    id: dto.id,
    company: dto.company,
    contactName: dto.contactName,
    contactPhone: dto.contactPhone,
    kind: dto.kind,
    stage: dto.stage,
    mandate: dto.mandate,
    valueNaira: dto.valueNaira,
    expectedUnits: dto.expectedUnits,
    ownerId: dto.ownerId,
    chapter: dto.chapter,
    createdAt: dto.createdAt,
    lastActivityAt: dto.lastActivityAt,
    nextActionAt: dto.nextActionAt,
    nextAction: dto.nextAction,
    notes: dto.notes,
  }
}

export function toProperty(dto: ListingDto): Property {
  return {
    id: dto.id,
    title: dto.title,
    location: dto.location,
    // Listings that predate chapters have none. Lagos is where the company
    // is, and an unlabelled property showing under no chapter at all would
    // simply vanish from the screen.
    chapter: dto.chapter ?? 'LAGOS',
    type: dto.type,
    priceNaira: dto.priceNaira,
    developer: dto.developer,
    dealId: dto.dealId,
    status: dto.status,
    verified: dto.verified,
    photoCount: dto.photoCount,
    hasVideo: dto.hasVideo,
    documents: dto.documents,
    // Agent-owned stock has no staff sourcer. Empty string rather than null
    // keeps Property.sourcedById a plain string for every screen that reads
    // it; staffById('') is null, which renders as unattributed.
    sourcedById: dto.sourcedById ?? '',
    submittedAt: dto.submittedAt,
    publishedAt: dto.publishedAt,
    units: dto.units,
    unitsSold: dto.unitsSold,
  }
}

export function toLead(dto: LeadDto): Lead {
  return {
    id: dto.id,
    name: dto.name,
    phone: dto.phone,
    source: dto.source,
    status: dto.status,
    qualified: dto.qualified,
    propertyId: dto.propertyId,
    budgetNaira: dto.budgetNaira,
    ownerId: dto.ownerId ?? '',
    createdAt: dto.createdAt,
    lastContactAt: dto.lastContactAt,
    firstResponseMins: dto.firstResponseMins,
    notes: dto.notes ?? '',
  }
}

export function toShoot(dto: ShootDto): Shoot {
  return {
    id: dto.id,
    propertyId: dto.listingId,
    title: dto.title,
    location: dto.location,
    stage: dto.stage,
    scheduledFor: dto.scheduledFor,
    prepCompleteAt: dto.prepCompleteAt,
    presenterId: dto.presenterId,
    secretaryId: dto.secretaryId,
    reshoot: dto.reshoot,
    engagementRate: dto.engagementRate,
    publishedAt: dto.publishedAt,
  }
}

export function toContent(dto: ContentDto): ContentPiece {
  return {
    id: dto.id,
    title: dto.title,
    channel: dto.channel,
    kind: dto.kind,
    publishedAt: dto.publishedAt,
    scheduledFor: dto.scheduledFor,
    engagementRate: dto.engagementRate,
    leadsGenerated: dto.leadsGenerated,
    ownerId: dto.ownerId,
  }
}

const OPS_KINDS: OpsKind[] = [
  'KYC',
  'WITHDRAWAL',
  'REPORT',
  'DISPUTE',
  'LISTING_REVIEW',
  'ENQUIRY',
  'TASK',
]

export function toOpsItem(dto: OpsDto): OpsItem {
  return {
    id: dto.id,
    // An unrecognised kind becomes TASK rather than crashing the queue: a new
    // queue added to the API should not blank the screen for everyone until
    // the portal is redeployed.
    kind: (OPS_KINDS as string[]).includes(dto.kind)
      ? (dto.kind as OpsKind)
      : 'TASK',
    subject: dto.subject,
    amountNaira: dto.amountNaira,
    openedAt: dto.openedAt,
    assigneeId: dto.assigneeId,
    resolved: dto.resolved,
    urgent: dto.urgent,
  }
}

export function toTarget(dto: TargetDto): Target {
  return {
    id: dto.id,
    staffId: dto.staffId,
    label: dto.label,
    min: dto.min,
    max: dto.max,
    actual: dto.actual,
    unit: dto.unit,
    ceiling: dto.ceiling,
    provenance: dto.provenance,
  }
}

export function toDailyLog(dto: DailyLogDto): DailyLog {
  return {
    id: dto.id,
    staffId: dto.staffId,
    date: dto.day,
    summary: dto.summary,
    blockers: dto.blockers,
    plan: dto.plan,
    submittedAt: dto.submittedAt,
    updatedAt: dto.updatedAt,
  }
}

function threadSubject(dto: ThreadDto): ThreadSubject {
  // The API calls a property a listing. Order matters only in that a thread
  // carries at most one of these.
  const pairs: [ThreadSubjectKind, string | null][] = [
    ['PROPERTY', dto.listingId],
    ['DEAL', dto.dealId],
    ['LEAD', dto.leadId],
    ['SHOOT', dto.shootId],
  ]
  for (const [kind, id] of pairs) if (id) return { kind, id }
  return { kind: 'GENERAL', id: null }
}

function threadTitle(dto: ThreadDto): string {
  if (dto.title) return dto.title
  return (
    dto.listing?.title ??
    dto.deal?.company ??
    dto.lead?.name ??
    'Untitled thread'
  )
}

export function toThread(dto: ThreadDto, index: StaffIndex): Thread {
  return {
    id: dto.id,
    title: threadTitle(dto),
    subject: threadSubject(dto),
    // Anyone in the conversation who is not staff is dropped rather than
    // shown as an unresolvable id — internal threads should only ever hold
    // staff, and a stray participant is a data problem, not something to
    // render.
    participantIds: dto.participants
      .map((p) => index.staffId.get(p.userId))
      .filter((id): id is string => Boolean(id)),
    messages: dto.messages.map((m) => ({
      id: m.id,
      authorId: index.staffId.get(m.senderUserId) ?? '',
      text: m.text,
      createdAt: m.createdAt,
    })),
    resolved: dto.resolvedAt !== null,
    createdAt: dto.createdAt,
  }
}

/**
 * The same Conversation rows, read as chat rather than as discussion pinned to
 * a record. A STAFF_GROUP conversation is the all-staff channel; everything
 * else with exactly two participants is a direct message.
 */
export function toChannel(dto: ThreadDto, index: StaffIndex): Channel {
  const isGroup = dto.kind === 'STAFF_GROUP'
  const messages: ChatMessage[] = dto.messages.map((m) => ({
    id: m.id,
    authorId: index.staffId.get(m.senderUserId) ?? '',
    text: m.text,
    createdAt: m.createdAt,
  }))

  const lastReadAt: Record<string, string> = {}
  for (const p of dto.participants) {
    const staffId = index.staffId.get(p.userId)
    if (staffId && p.lastReadAt) lastReadAt[staffId] = p.lastReadAt
  }

  return {
    // The all-staff channel is referenced by a fixed id across the portal, so
    // it keeps that id here whatever the database calls the row.
    id: isGroup ? ALL_STAFF_CHANNEL_ID : dto.id,
    kind: isGroup ? 'GROUP' : 'DIRECT',
    name: isGroup ? (dto.title ?? 'All staff') : null,
    memberIds: dto.participants
      .map((p) => index.staffId.get(p.userId))
      .filter((id): id is string => Boolean(id)),
    messages,
    lastReadAt,
    createdAt: dto.createdAt,
  }
}

/** Which payout fields are present, read back out of the gap list. */
function payoutFlags(gaps: string[]) {
  const missing = (needle: string) =>
    gaps.some((g) => g.toLowerCase().includes(needle))
  return {
    hasPhoto: !missing('photo'),
    hasBank: !missing('bank'),
    hasNin: !missing('nin'),
    hasTaxId: !missing('tin') && !missing('payer'),
  }
}

export function toPartner(dto: PartnerDto): AgentPartner {
  return {
    id: dto.id,
    code: dto.code,
    fullName: dto.name ?? 'Unnamed partner',
    whatsapp: dto.phone ?? '',
    email: dto.email,
    experience: dto.experience,
    agencyName: dto.agencyName,
    operatingState: dto.operatingState,
    status: dto.status,
    referredByCode: dto.referredByCode,
    ownerId: dto.owner?.id ?? null,
    ...payoutFlags(dto.payoutGaps),
    registeredAt: dto.registeredAt,
    lastContactAt: dto.lastContactAt,
    notes: dto.notes ?? '',
  }
}
