// Derived numbers.
//
// Everything the dashboards display is computed here from the record
// collections, never stored as a standalone figure. That is the whole point:
// a number nobody can type is a number nobody can argue with.

import type {
  AgentPartner,
  Channel,
  ContentPiece,
  DailyLog,
  Deal,
  Lead,
  OpsItem,
  Property,
  Shoot,
  Staff,
  Target,
  Thread,
  ThreadSubjectKind,
} from './types'
import { partnerPayoutReady } from './types'
import { isWeekend, onDay, pct } from './format'

/** Operations' response-time commitment, in minutes. */
export const SLA_MINUTES = 30

/**
 * The definition settled in the "What counts as a qualified lead?" thread:
 * budget confirmed, timeline stated, specific property or service named.
 * Marketing and the GM read this same flag so the two numbers cannot drift.
 */
export function isQualified(lead: Lead): boolean {
  return lead.qualified
}

export function isOpenDeal(deal: Deal): boolean {
  return deal.stage !== 'LOST' && deal.stage !== 'PUBLISHED'
}

export function isWonDeal(deal: Deal): boolean {
  return deal.stage === 'MANDATE_SIGNED' || deal.stage === 'PUBLISHED'
}

export function dealIsStale(deal: Deal, days = 7, now = new Date()): boolean {
  if (deal.stage === 'LOST') return false
  const ms = now.getTime() - new Date(deal.lastActivityAt).getTime()
  return ms > days * 86_400_000
}

export function dealActionOverdue(deal: Deal, now = new Date()): boolean {
  if (!deal.nextActionAt || deal.stage === 'LOST') return false
  return new Date(deal.nextActionAt).getTime() < now.getTime()
}

/** A property is publishable only when it has photos and all four documents. */
export function publishBlockers(property: Property): string[] {
  const blockers: string[] = []
  if (property.photoCount === 0) blockers.push('No photos')
  else if (property.photoCount < 8) blockers.push('Under 8 photos')
  const missing = property.documents.filter((d) => !d.present)
  if (missing.length > 0) blockers.push(`${missing.length} document(s) missing`)
  const unverified = property.documents.filter((d) => d.present && !d.verified)
  if (unverified.length > 0) {
    blockers.push(`${unverified.length} document(s) unverified`)
  }
  return blockers
}

export function isPublishable(property: Property): boolean {
  return publishBlockers(property).length === 0
}

export function documentCompletion(property: Property): number {
  return pct(
    property.documents.filter((d) => d.present && d.verified).length,
    property.documents.length,
  )
}

/** Leads answered inside the SLA, as a percentage of those answered at all. */
export function slaCompliance(leads: Lead[]): number {
  const answered = leads.filter((l) => l.firstResponseMins !== null)
  if (answered.length === 0) return 100
  const inTime = answered.filter((l) => (l.firstResponseMins ?? 0) <= SLA_MINUTES)
  return pct(inTime.length, answered.length)
}

/** Leads with no response yet — the queue Operations is measured on. */
export function unanswered(leads: Lead[]): Lead[] {
  return leads.filter((l) => l.firstResponseMins === null)
}

/** Qualified → converted. The number the GM carries. */
export function conversionRate(leads: Lead[]): number {
  const qualified = leads.filter(isQualified)
  if (qualified.length === 0) return 0
  return pct(qualified.filter((l) => l.status === 'CONVERTED').length, qualified.length)
}

export interface CompanySnapshot {
  // Inventory
  propertiesTotal: number
  propertiesPublished: number
  propertiesPending: number
  propertiesVerified: number
  propertiesBlocked: number
  unitsAvailable: number
  unitsSold: number

  // Pipeline
  dealsOpen: number
  dealsWon: number
  mandatesSigned: number
  exclusiveMandates: number
  pipelineValue: number
  dealsStale: number

  // Demand
  leadsTotal: number
  leadsQualified: number
  leadsUnanswered: number
  leadsConverted: number
  conversion: number
  sla: number

  // Content
  videosPublished: number
  contentPublished: number
  leadsFromContent: number

  // Operations
  opsOpen: number
  opsUnassigned: number
  opsUrgent: number
  moneyAwaitingPayout: number
}

export function companySnapshot(input: {
  properties: Property[]
  deals: Deal[]
  leads: Lead[]
  shoots: Shoot[]
  content: ContentPiece[]
  ops: OpsItem[]
}): CompanySnapshot {
  const { properties, deals, leads, shoots, content, ops } = input

  const openOps = ops.filter((o) => !o.resolved)

  return {
    propertiesTotal: properties.length,
    propertiesPublished: properties.filter((p) => p.status === 'ACTIVE').length,
    propertiesPending: properties.filter((p) => p.status === 'PENDING_REVIEW').length,
    propertiesVerified: properties.filter((p) => p.verified).length,
    propertiesBlocked: properties.filter(
      (p) => p.status === 'PENDING_REVIEW' && !isPublishable(p),
    ).length,
    unitsAvailable: properties.reduce((n, p) => n + (p.units - p.unitsSold), 0),
    unitsSold: properties.reduce((n, p) => n + p.unitsSold, 0),

    dealsOpen: deals.filter(isOpenDeal).length,
    dealsWon: deals.filter(isWonDeal).length,
    mandatesSigned: deals.filter((d) => d.mandate !== 'NONE').length,
    exclusiveMandates: deals.filter((d) => d.mandate === 'EXCLUSIVE').length,
    pipelineValue: deals.filter(isOpenDeal).reduce((n, d) => n + d.valueNaira, 0),
    dealsStale: deals.filter((d) => dealIsStale(d)).length,

    leadsTotal: leads.length,
    leadsQualified: leads.filter(isQualified).length,
    leadsUnanswered: unanswered(leads).length,
    leadsConverted: leads.filter((l) => l.status === 'CONVERTED').length,
    conversion: conversionRate(leads),
    sla: slaCompliance(leads),

    videosPublished: shoots.filter((s) => s.stage === 'PUBLISHED').length,
    contentPublished: content.filter((c) => c.publishedAt !== null).length,
    leadsFromContent: content.reduce((n, c) => n + c.leadsGenerated, 0),

    opsOpen: openOps.length,
    opsUnassigned: openOps.filter((o) => o.assigneeId === null).length,
    opsUrgent: openOps.filter((o) => o.urgent).length,
    moneyAwaitingPayout: openOps
      .filter((o) => o.kind === 'WITHDRAWAL')
      .reduce((n, o) => n + (o.amountNaira ?? 0), 0),
  }
}

/** Progress against the lower bound of a target range, capped at 100. */
export function targetProgress(target: Target): number {
  if (target.ceiling) {
    // A ceiling is met by staying at or under the number, so anything within
    // it is 100% — not a fraction of it. Going over falls away from there.
    if (target.max === 0) return target.actual === 0 ? 100 : 0
    if (target.actual <= target.max) return 100
    const overshoot = (target.actual - target.max) / target.max
    return Math.max(0, Math.round((1 - overshoot) * 100))
  }
  if (target.min === 0) return 100
  return Math.min(100, Math.round((target.actual / target.min) * 100))
}

export function targetMet(target: Target): boolean {
  return targetProgress(target) >= 100
}

/** Average progress across a staff member's targets — their scorecard number. */
export function staffScore(targets: Target[], staffId: string): number | null {
  const own = targets.filter((t) => t.staffId === staffId)
  if (own.length === 0) return null
  const total = own.reduce((n, t) => n + targetProgress(t), 0)
  return Math.round(total / own.length)
}

export interface StaffSummary {
  staff: Staff
  score: number | null
  targetsMet: number
  targetsTotal: number
  propertiesSourced: number
  dealsOwned: number
  leadsOwned: number
  opsAssigned: number
}

export function staffSummary(
  staff: Staff,
  input: {
    targets: Target[]
    properties: Property[]
    deals: Deal[]
    leads: Lead[]
    ops: OpsItem[]
  },
): StaffSummary {
  const own = input.targets.filter((t) => t.staffId === staff.id)
  return {
    staff,
    score: staffScore(input.targets, staff.id),
    targetsMet: own.filter(targetMet).length,
    targetsTotal: own.length,
    propertiesSourced: input.properties.filter((p) => p.sourcedById === staff.id).length,
    dealsOwned: input.deals.filter((d) => d.ownerId === staff.id && isOpenDeal(d)).length,
    leadsOwned: input.leads.filter(
      (l) => l.ownerId === staff.id && l.status !== 'CONVERTED' && l.status !== 'LOST',
    ).length,
    opsAssigned: input.ops.filter((o) => o.assigneeId === staff.id && !o.resolved).length,
  }
}

/* ─── Shoot preparation ──────────────────────────────────────────────── */
// The Secretary's target is every shoot prepped 24 hours ahead. These live
// here rather than in the component so the time lookup stays out of render.

const ONE_DAY = 86_400_000

/** Prep was finished less than 24h before the shoot, or never finished. */
export function shootPrepLate(shoot: Shoot, now: Date = new Date()): boolean {
  if (!shoot.scheduledFor) return false
  const scheduled = new Date(shoot.scheduledFor).getTime()
  if (!shoot.prepCompleteAt) return scheduled < now.getTime()
  return scheduled - new Date(shoot.prepCompleteAt).getTime() < ONE_DAY
}

/** Shoot is inside its 24h window and still has no prep recorded. */
export function shootPrepOverdue(shoot: Shoot, now: Date = new Date()): boolean {
  if (!shoot.scheduledFor || shoot.prepCompleteAt) return false
  return new Date(shoot.scheduledFor).getTime() - now.getTime() < ONE_DAY
}

/* ─── Daily activity ─────────────────────────────────────────────────── */
// What the RECORDS say a person did on a given day, independent of what they
// wrote in their log. Shown beside the written entry so a manager reads the
// narrative and the evidence together rather than one or the other.

export interface DayActivity {
  propertiesSubmitted: number
  propertiesPublished: number
  dealsAdvanced: number
  leadsContacted: number
  shootsPrepped: number
  videosPublished: number
  threadMessages: number
  /** Sum of the above — zero means the records show nothing that day. */
  total: number
}

export function dayActivity(
  staffId: string,
  day: string,
  input: {
    properties: Property[]
    deals: Deal[]
    leads: Lead[]
    shoots: Shoot[]
    threads: Thread[]
  },
): DayActivity {
  const propertiesSubmitted = input.properties.filter(
    (p) => p.sourcedById === staffId && onDay(p.submittedAt, day),
  ).length

  const propertiesPublished = input.properties.filter(
    (p) => p.sourcedById === staffId && p.publishedAt && onDay(p.publishedAt, day),
  ).length

  const dealsAdvanced = input.deals.filter(
    (d) => d.ownerId === staffId && onDay(d.lastActivityAt, day),
  ).length

  const leadsContacted = input.leads.filter(
    (l) => l.ownerId === staffId && l.lastContactAt && onDay(l.lastContactAt, day),
  ).length

  const shootsPrepped = input.shoots.filter(
    (s) => s.secretaryId === staffId && s.prepCompleteAt && onDay(s.prepCompleteAt, day),
  ).length

  const videosPublished = input.shoots.filter(
    (s) => s.presenterId === staffId && s.publishedAt && onDay(s.publishedAt, day),
  ).length

  const threadMessages = input.threads.reduce(
    (n, t) =>
      n +
      t.messages.filter((m) => m.authorId === staffId && onDay(m.createdAt, day))
        .length,
    0,
  )

  const total =
    propertiesSubmitted +
    propertiesPublished +
    dealsAdvanced +
    leadsContacted +
    shootsPrepped +
    videosPublished +
    threadMessages

  return {
    propertiesSubmitted,
    propertiesPublished,
    dealsAdvanced,
    leadsContacted,
    shootsPrepped,
    videosPublished,
    threadMessages,
    total,
  }
}

/** Working days in the window where someone filed nothing. */
export function missedLogDays(
  staffId: string,
  logs: DailyLog[],
  days: string[],
): string[] {
  return days.filter(
    (d) => !isWeekend(d) && !logs.some((l) => l.staffId === staffId && l.date === d),
  )
}

/* ─── Messaging ──────────────────────────────────────────────────────── */

/** Messages in a channel after the reader last opened it, excluding their own. */
export function unreadCount(channel: Channel, staffId: string): number {
  const since = channel.lastReadAt[staffId]
  return channel.messages.filter(
    (m) =>
      m.authorId !== staffId &&
      (!since || new Date(m.createdAt).getTime() > new Date(since).getTime()),
  ).length
}

export function totalUnread(channels: Channel[], staffId: string): number {
  return channels
    .filter((c) => c.memberIds.includes(staffId))
    .reduce((n, c) => n + unreadCount(c, staffId), 0)
}

/** The other member of a direct channel. */
export function directCounterpart(
  channel: Channel,
  staffId: string,
): string | null {
  if (channel.kind !== 'DIRECT') return null
  return channel.memberIds.find((id) => id !== staffId) ?? null
}

export function lastMessageAt(channel: Channel): number {
  const last = channel.messages[channel.messages.length - 1]
  return new Date(last?.createdAt ?? channel.createdAt).getTime()
}

/* ─── Threads on records ─────────────────────────────────────────────── */

/** Threads pinned to one specific record. */
export function threadsForSubject(
  threads: Thread[],
  kind: ThreadSubjectKind,
  id: string,
): Thread[] {
  return threads.filter((t) => t.subject.kind === kind && t.subject.id === id)
}

/** Open threads on a record — the count worth putting on a button. */
export function openThreadCount(
  threads: Thread[],
  kind: ThreadSubjectKind,
  id: string,
): number {
  return threadsForSubject(threads, kind, id).filter((t) => !t.resolved).length
}

/**
 * URL encoding for "this thread is about that record", e.g. PROPERTY:prop-1.
 * A single param keeps every Discuss link in the app one shape.
 */
export function encodeSubject(kind: ThreadSubjectKind, id: string): string {
  return `${kind}:${id}`
}

export function decodeSubject(
  raw: string | null,
): { kind: ThreadSubjectKind; id: string } | null {
  if (!raw) return null
  const [kind, ...rest] = raw.split(':')
  const id = rest.join(':')
  if (!id) return null
  const valid: ThreadSubjectKind[] = ['PROPERTY', 'DEAL', 'LEAD', 'SHOOT', 'GENERAL']
  if (!valid.includes(kind as ThreadSubjectKind)) return null
  return { kind: kind as ThreadSubjectKind, id }
}

/* ─── Delete impact ──────────────────────────────────────────────────── */

export interface DeleteImpact {
  /** Leads whose propertyId would be cleared. */
  leadsUnlinked: number
  /** Shoots whose propertyId would be cleared. */
  shootsUnlinked: number
  /** Properties whose dealId would be cleared. */
  propertiesUnlinked: number
  /** Threads pinned to the record, which go with it. */
  threadsRemoved: number
}

/**
 * What else a deletion touches.
 *
 * Records here reference each other by id, so removing one without cleaning
 * up leaves leads pointing at properties that no longer exist. Rather than
 * forbid deletion or silently corrupt the data, the consequences are counted
 * and shown before anyone confirms.
 */
export function deleteImpact(
  kind: 'PROPERTY' | 'DEAL' | 'LEAD',
  id: string,
  input: {
    properties: Property[]
    leads: Lead[]
    shoots: Shoot[]
    threads: Thread[]
  },
): DeleteImpact {
  const threadsRemoved = threadsForSubject(input.threads, kind, id).length

  if (kind === 'PROPERTY') {
    return {
      leadsUnlinked: input.leads.filter((l) => l.propertyId === id).length,
      shootsUnlinked: input.shoots.filter((s) => s.propertyId === id).length,
      propertiesUnlinked: 0,
      threadsRemoved,
    }
  }
  if (kind === 'DEAL') {
    return {
      leadsUnlinked: 0,
      shootsUnlinked: 0,
      propertiesUnlinked: input.properties.filter((p) => p.dealId === id).length,
      threadsRemoved,
    }
  }
  return {
    leadsUnlinked: 0,
    shootsUnlinked: 0,
    propertiesUnlinked: 0,
    threadsRemoved,
  }
}

export function impactSentences(impact: DeleteImpact): string[] {
  const out: string[] = []
  if (impact.leadsUnlinked > 0) {
    out.push(
      `${impact.leadsUnlinked} lead${impact.leadsUnlinked === 1 ? '' : 's'} will no longer be linked to a property`,
    )
  }
  if (impact.shootsUnlinked > 0) {
    out.push(
      `${impact.shootsUnlinked} shoot${impact.shootsUnlinked === 1 ? '' : 's'} will lose its property link`,
    )
  }
  if (impact.propertiesUnlinked > 0) {
    out.push(
      `${impact.propertiesUnlinked} propert${impact.propertiesUnlinked === 1 ? 'y' : 'ies'} will no longer show which mandate produced them`,
    )
  }
  if (impact.threadsRemoved > 0) {
    out.push(
      `${impact.threadsRemoved} thread${impact.threadsRemoved === 1 ? '' : 's'} pinned to it will be deleted`,
    )
  }
  return out
}

/* ─── Active staff ───────────────────────────────────────────────────── */

/**
 * Staff who can be given new work.
 *
 * A deactivated position keeps its history — its id is still stamped on the
 * properties and messages it produced — but must not appear in an assignment
 * dropdown. `keepId` holds one exception open so editing a record that is
 * already assigned to somebody now inactive does not silently reassign it.
 */
export function assignableStaff(staff: Staff[], keepId?: string | null): Staff[] {
  return staff.filter((s) => s.active || (keepId != null && s.id === keepId))
}

/* ─── Agent partners ─────────────────────────────────────────────────── */

export interface PartnerSnapshot {
  total: number
  /** Registered and never contacted — the number that embarrasses you. */
  uncontacted: number
  /** Uncontacted for more than 48 hours, the stated onboarding SLA. */
  overdueContact: number
  verified: number
  active: number
  /** Verified but something still blocks a commission transfer. */
  cannotBePaid: number
  /** Arrived through another partner's link. */
  fromReferral: number
  registeredThisWeek: number
  unassigned: number
}

/** Operations' onboarding commitment for a new realtor, in hours. */
export const PARTNER_CONTACT_SLA_HOURS = 48

export function partnerContactOverdue(
  p: AgentPartner,
  now: Date = new Date(),
): boolean {
  if (p.lastContactAt) return false
  if (p.status === 'REJECTED' || p.status === 'DORMANT') return false
  const age = now.getTime() - new Date(p.registeredAt).getTime()
  return age > PARTNER_CONTACT_SLA_HOURS * 3_600_000
}

export function partnerSnapshot(
  partners: AgentPartner[],
  now: Date = new Date(),
): PartnerSnapshot {
  const live = partners.filter(
    (p) => p.status !== 'REJECTED' && p.status !== 'DORMANT',
  )
  return {
    total: partners.length,
    uncontacted: live.filter((p) => p.lastContactAt === null).length,
    overdueContact: partners.filter((p) => partnerContactOverdue(p, now)).length,
    verified: partners.filter((p) => p.status === 'VERIFIED').length,
    active: partners.filter((p) => p.status === 'ACTIVE').length,
    cannotBePaid: partners.filter(
      (p) =>
        (p.status === 'VERIFIED' || p.status === 'ACTIVE') &&
        !partnerPayoutReady(p),
    ).length,
    fromReferral: partners.filter((p) => p.referredByCode !== null).length,
    registeredThisWeek: partners.filter(
      (p) =>
        now.getTime() - new Date(p.registeredAt).getTime() < 7 * 86_400_000,
    ).length,
    unassigned: live.filter((p) => p.ownerId === null).length,
  }
}

/** Which of the four payout requirements are still outstanding. */
export function partnerPayoutGaps(p: AgentPartner): string[] {
  const gaps: string[] = []
  if (!p.hasPhoto) gaps.push('passport photo')
  if (!p.hasBank) gaps.push('bank account')
  if (!p.hasNin) gaps.push('NIN')
  if (!p.hasTaxId) gaps.push('Payer ID or TIN')
  return gaps
}

/** Partners a given partner brought in, by their code. */
export function partnersReferredBy(
  partners: AgentPartner[],
  code: string,
): AgentPartner[] {
  return partners.filter((p) => p.referredByCode === code)
}
