// One module per collection. Each returns domain types, not wire types —
// mapping happens on the way out, so the store never sees a DTO.

import type { AxiosError } from 'axios'
import api from '../lib/api'
import type {
  ContentDto,
  DailyLogDto,
  DealDto,
  LeadDto,
  ListingDto,
  OpsDto,
  Paged,
  PartnerDto,
  ShootDto,
  StaffDto,
  TargetDto,
  ThreadDto,
} from './dto'
import type { StaffIndex } from './map'
import {
  staffIndex,
  toChannel,
  toContent,
  toDailyLog,
  toDeal,
  toLead,
  toOpsItem,
  toPartner,
  toProperty,
  toShoot,
  toStaff,
  toTarget,
  toThread,
} from './map'
import type {
  AgentPartner,
  Channel,
  ContentPiece,
  DailyLog,
  Deal,
  DealStage,
  DocumentType,
  Lead,
  LeadStatus,
  ListingStatus,
  OpsItem,
  PartnerStatus,
  Property,
  Shoot,
  ShootStage,
  Staff,
  Target,
  Thread,
  ThreadSubject,
} from '../lib/types'
import type {
  ContentPatch,
  DealPatch,
  LeadPatch,
  NewContentInput,
  NewDealInput,
  NewLeadInput,
  NewPropertyInput,
  NewShootInput,
  NewStaffInput,
  NewTargetInput,
  NewTaskInput,
  PropertyPatch,
  ShootPatch,
  StaffPatch,
  TargetPatch,
  TaskPatch,
} from '../lib/storeContext'

/**
 * A read the signed-in person is not permitted comes back empty, not as an
 * error. The store already chooses endpoints by permission; this is the net
 * for a grant revoked between sign-in and load, so one screen someone cannot
 * see never takes down the screens they can.
 */
export async function orEmpty<T>(call: Promise<T>, empty: T): Promise<T> {
  try {
    return await call
  } catch (e) {
    if ((e as AxiosError)?.response?.status === 403) return empty
    throw e
  }
}

/** Days from now as an ISO timestamp, or null. */
function inDays(days: number | null | undefined): string | null {
  if (days === null || days === undefined) return null
  return new Date(Date.now() + days * 86_400_000).toISOString()
}

/* ─── Staff ──────────────────────────────────────────────────────────── */

export const staffApi = {
  async list(): Promise<{ staff: Staff[]; index: StaffIndex }> {
    const { data } = await api.get<StaffDto[]>('/staff')
    return { staff: data.map(toStaff), index: staffIndex(data) }
  },
  /**
   * Account and position together. The temporary password comes back exactly
   * once — the server keeps only its hash, so this is the only time it exists.
   */
  async provision(
    input: NewStaffInput,
  ): Promise<{ staff: Staff; temporaryPassword: string }> {
    const { data } = await api.post<{
      staff: StaffDto
      temporaryPassword: string
    }>('/staff/provision', {
      email: input.email,
      name: input.name,
      letter: input.letter,
      staffRole: input.role,
      chapter: input.chapter,
      secondaryChapter: input.secondaryChapter ?? null,
      reportsToId: input.reportsTo,
    })
    return {
      staff: toStaff(data.staff),
      temporaryPassword: data.temporaryPassword,
    }
  },
  async update(id: string, patch: StaffPatch): Promise<Staff> {
    const { data } = await api.patch<StaffDto>(`/staff/${id}`, {
      ...(patch.role !== undefined && { staffRole: patch.role }),
      ...(patch.chapter !== undefined && { chapter: patch.chapter }),
      // Present-but-undefined means the Osun box was un-ticked: clear it.
      ...('secondaryChapter' in patch && {
        secondaryChapter: patch.secondaryChapter ?? null,
      }),
      // Name and email live on the account; the API writes them there.
      ...(patch.name && { name: patch.name }),
      ...(patch.email && { email: patch.email }),
      ...(patch.reportsTo !== undefined && { reportsToId: patch.reportsTo }),
    })
    return toStaff(data)
  },
  async setActive(id: string, active: boolean): Promise<Staff> {
    const { data } = await api.patch<StaffDto>(`/staff/${id}/active`, { active })
    return toStaff(data)
  },
}

/* ─── Deals ──────────────────────────────────────────────────────────── */

export const dealsApi = {
  async list(): Promise<Deal[]> {
    const { data } = await api.get<DealDto[]>('/deals')
    return data.map(toDeal)
  },
  async create(input: NewDealInput): Promise<Deal> {
    const { data } = await api.post<DealDto>('/deals', {
      company: input.company,
      contactName: input.contactName,
      contactPhone: input.contactPhone,
      kind: input.kind,
      mandate: input.mandate,
      valueNaira: input.valueNaira,
      expectedUnits: input.expectedUnits,
      chapter: input.chapter,
      ownerId: input.ownerId,
      nextAction: input.nextAction,
      nextActionAt: inDays(input.nextActionInDays),
      notes: input.notes,
    })
    return toDeal(data)
  },
  async update(id: string, patch: DealPatch): Promise<Deal> {
    const { nextActionInDays, ...rest } = patch
    const { data } = await api.patch<DealDto>(`/deals/${id}`, {
      ...rest,
      ...(nextActionInDays !== undefined && {
        nextActionAt: inDays(nextActionInDays),
      }),
    })
    return toDeal(data)
  },
  async setStage(id: string, stage: DealStage): Promise<Deal> {
    const { data } = await api.patch<DealDto>(`/deals/${id}/stage`, { stage })
    return toDeal(data)
  },
  remove: (id: string) => api.delete(`/deals/${id}`).then(() => undefined),
}

/* ─── Properties ─────────────────────────────────────────────────────── */

export const propertiesApi = {
  async list(): Promise<Property[]> {
    const { data } = await api.get<ListingDto[]>('/staff/listings')
    return data.map(toProperty)
  },
  async create(input: NewPropertyInput): Promise<Property> {
    const { data } = await api.post<ListingDto>('/staff/listings', {
      title: input.title,
      location: input.location,
      chapter: input.chapter,
      type: input.type,
      priceNaira: input.priceNaira,
      units: input.units,
      dealId: input.dealId,
      documentsPresent: input.documentsPresent,
    })
    return toProperty(data)
  },
  async update(id: string, patch: PropertyPatch): Promise<Property> {
    // Photo and video counts are read from what is uploaded, and `developer`
    // is the linked mandate's company — neither is typed in, so neither is
    // sent. Documents are: which of the four are on file is a fact somebody
    // records by hand.
    const { data } = await api.patch<ListingDto>(`/staff/listings/${id}`, {
      ...(patch.title !== undefined && { title: patch.title }),
      ...(patch.location !== undefined && { location: patch.location }),
      ...(patch.chapter !== undefined && { chapter: patch.chapter }),
      ...(patch.type !== undefined && { type: patch.type }),
      ...(patch.priceNaira !== undefined && { priceNaira: patch.priceNaira }),
      ...(patch.units !== undefined && { units: patch.units }),
      ...(patch.unitsSold !== undefined && { unitsSold: patch.unitsSold }),
      ...(patch.dealId !== undefined && { dealId: patch.dealId }),
      ...(patch.documentsPresent !== undefined && {
        documentsPresent: patch.documentsPresent,
      }),
    })
    return toProperty(data)
  },
  async setStatus(id: string, status: ListingStatus): Promise<Property> {
    const { data } = await api.patch<ListingDto>(
      `/staff/listings/${id}/status`,
      { status },
    )
    return toProperty(data)
  },
  async setDocumentVerified(
    id: string,
    type: DocumentType,
    verified: boolean,
  ): Promise<Property> {
    const { data } = await api.patch<ListingDto>(
      `/staff/listings/${id}/documents/${type}`,
      { verified },
    )
    return toProperty(data)
  },
  /**
   * One photo per request, so a failure names exactly which photo did not land.
   * The server makes the first photo on a listing its cover.
   */
  async uploadPhoto(id: string, photo: Blob, filename: string): Promise<Property> {
    const form = new FormData()
    form.append('file', photo, filename)
    const { data } = await api.post<ListingDto>(`/staff/listings/${id}/photos`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      // A photo on a slow office line is not a cold start; give it room.
      timeout: 120_000,
    })
    return toProperty(data)
  },
  /** Reorder or remove photos. Whatever comes first is the cover. */
  async setPhotos(id: string, images: string[]): Promise<Property> {
    const { data } = await api.patch<ListingDto>(`/staff/listings/${id}/photos`, {
      images,
    })
    return toProperty(data)
  },
  remove: (id: string) =>
    api.delete(`/staff/listings/${id}`).then(() => undefined),
}

/* ─── Leads ──────────────────────────────────────────────────────────── */

export const leadsApi = {
  async list(): Promise<Lead[]> {
    const { data } = await api.get<LeadDto[]>('/staff/leads')
    return data.map(toLead)
  },
  async create(input: NewLeadInput): Promise<Lead> {
    const { data } = await api.post<LeadDto>('/staff/leads', {
      name: input.name,
      phone: input.phone,
      source: input.source,
      propertyId: input.propertyId,
      ownerId: input.ownerId,
      budgetNaira: input.budgetNaira,
      notes: input.notes,
    })
    return toLead(data)
  },
  async update(id: string, patch: LeadPatch): Promise<Lead> {
    const { data } = await api.patch<LeadDto>(`/staff/leads/${id}`, patch)
    return toLead(data)
  },
  async setStatus(id: string, status: LeadStatus): Promise<Lead> {
    const { data } = await api.patch<LeadDto>(`/staff/leads/${id}`, { status })
    return toLead(data)
  },
  async setQualified(id: string, qualified: boolean): Promise<Lead> {
    const { data } = await api.patch<LeadDto>(`/staff/leads/${id}`, {
      qualified,
    })
    return toLead(data)
  },
  remove: (id: string) => api.delete(`/staff/leads/${id}`).then(() => undefined),
}

/* ─── Shoots and content ─────────────────────────────────────────────── */

export const productionApi = {
  async listShoots(): Promise<Shoot[]> {
    const { data } = await api.get<ShootDto[]>('/production/shoots')
    return data.map(toShoot)
  },
  async createShoot(input: NewShootInput): Promise<Shoot> {
    const { data } = await api.post<ShootDto>('/production/shoots', {
      title: input.title,
      location: input.location,
      listingId: input.propertyId,
      presenterId: input.presenterId,
      secretaryId: input.secretaryId,
      scheduledFor: inDays(input.scheduledInDays),
    })
    return toShoot(data)
  },
  async updateShoot(id: string, patch: ShootPatch): Promise<Shoot> {
    const { scheduledInDays, propertyId, ...rest } = patch
    const { data } = await api.patch<ShootDto>(`/production/shoots/${id}`, {
      ...rest,
      ...(propertyId !== undefined && { listingId: propertyId }),
      ...(scheduledInDays !== undefined && {
        scheduledFor: inDays(scheduledInDays),
      }),
    })
    return toShoot(data)
  },
  async setShootStage(id: string, stage: ShootStage): Promise<Shoot> {
    const { data } = await api.patch<ShootDto>(
      `/production/shoots/${id}/stage`,
      { stage },
    )
    return toShoot(data)
  },
  async markPrepped(id: string): Promise<Shoot> {
    const { data } = await api.post<ShootDto>(
      `/production/shoots/${id}/prepped`,
      {},
    )
    return toShoot(data)
  },
  removeShoot: (id: string) =>
    api.delete(`/production/shoots/${id}`).then(() => undefined),

  async listContent(): Promise<ContentPiece[]> {
    const { data } = await api.get<ContentDto[]>('/production/content')
    return data.map(toContent)
  },
  async createContent(input: NewContentInput): Promise<ContentPiece> {
    const { data } = await api.post<ContentDto>('/production/content', {
      title: input.title,
      channel: input.channel,
      kind: input.kind,
      ownerId: input.ownerId,
      scheduledFor: inDays(input.scheduledInDays),
    })
    return toContent(data)
  },
  async updateContent(id: string, patch: ContentPatch): Promise<ContentPiece> {
    const { scheduledInDays, publishNow, ...rest } = patch
    const { data } = await api.patch<ContentDto>(`/production/content/${id}`, {
      ...rest,
      ...(scheduledInDays !== undefined && {
        scheduledFor: inDays(scheduledInDays),
      }),
      // The server stamps the time; it only accepts the intent.
      ...(publishNow && { publishNow: true }),
    })
    return toContent(data)
  },
  removeContent: (id: string) =>
    api.delete(`/production/content/${id}`).then(() => undefined),
}

/* ─── Operations queue ───────────────────────────────────────────────── */

export const opsApi = {
  async list(): Promise<OpsItem[]> {
    const { data } = await api.get<OpsDto[]>('/ops-queue', {
      // Resolved items are what "5 closed today" counts, so the queue is
      // filtered in the UI rather than at the API.
      params: { includeResolved: true },
    })
    return data.map(toOpsItem)
  },
  async createTask(input: NewTaskInput): Promise<OpsItem> {
    const { data } = await api.post<OpsDto>('/ops-queue/tasks', {
      subject: input.subject,
      assigneeId: input.assigneeId,
      urgent: input.urgent,
    })
    return toOpsItem(data)
  },
  async updateTask(id: string, patch: TaskPatch): Promise<OpsItem> {
    const { data } = await api.patch<OpsDto>(`/ops-queue/tasks/${id}`, patch)
    return toOpsItem(data)
  },
  async resolveTask(id: string): Promise<OpsItem> {
    const { data } = await api.patch<OpsDto>(`/ops-queue/tasks/${id}`, {
      resolved: true,
    })
    return toOpsItem(data)
  },
  removeTask: (id: string) =>
    api.delete(`/ops-queue/tasks/${id}`).then(() => undefined),
}

/* ─── Targets ────────────────────────────────────────────────────────── */

export const targetsApi = {
  /** Everyone's scorecard. Needs VIEW_ALL_TARGETS. */
  async list(): Promise<Target[]> {
    const { data } = await api.get<TargetDto[]>('/targets')
    return data.map(toTarget)
  },
  /** Your own targets — what everyone else reads. */
  async mine(): Promise<Target[]> {
    const { data } = await api.get<TargetDto[]>('/targets/mine')
    return data.map(toTarget)
  },
  async create(input: NewTargetInput): Promise<Target> {
    const { data } = await api.post<TargetDto>('/targets', {
      staffId: input.staffId,
      label: input.label,
      min: input.min,
      max: input.max,
      unit: input.unit,
      ceiling: input.ceiling,
    })
    return toTarget(data)
  },
  async update(id: string, patch: TargetPatch): Promise<Target> {
    const { data } = await api.patch<TargetDto>(`/targets/${id}`, patch)
    return toTarget(data)
  },
  remove: (id: string) => api.delete(`/targets/${id}`).then(() => undefined),
}

/* ─── Daily logs ─────────────────────────────────────────────────────── */

export const logsApi = {
  /**
   * Logs for the Logs screen's fortnight.
   *
   * A manager reads everyone's in one request; anyone else reads their own.
   * A daily log is somebody writing candidly about what is blocking them, and
   * the API keeps everyone else's out of reach for that reason — this does
   * not try to get round it.
   */
  async recent(canReadAll: boolean, days = 14): Promise<DailyLog[]> {
    const { data } = canReadAll
      ? await api.get<DailyLogDto[]>('/daily-logs/recent', { params: { days } })
      : await api.get<DailyLogDto[]>('/daily-logs/mine')
    return data.map(toDailyLog)
  },
  async save(
    day: string,
    fields: { summary: string; blockers: string; plan: string },
  ): Promise<DailyLog> {
    const { data } = await api.put<DailyLogDto>(`/daily-logs/${day}`, fields)
    return toDailyLog(data)
  },
}

/* ─── Threads and channels ───────────────────────────────────────────── */

export const threadsApi = {
  async list(index: StaffIndex): Promise<Thread[]> {
    const { data } = await api.get<ThreadDto[]>('/threads', {
      params: { kind: 'STAFF_THREAD' },
    })
    return data.map((t) => toThread(t, index))
  },
  async create(
    index: StaffIndex,
    title: string,
    subject: ThreadSubject,
    participantIds: string[],
    firstMessage: string,
  ): Promise<Thread> {
    const { data } = await api.post<ThreadDto>('/threads', {
      title,
      // The API speaks in listings and user ids; the portal speaks in
      // properties and staff ids.
      subject: subject.kind === 'PROPERTY' ? 'LISTING' : subject.kind,
      subjectId: subject.id ?? undefined,
      participantUserIds: participantIds
        .map((id) => index.userId.get(id))
        .filter((id): id is string => Boolean(id)),
      firstMessage,
    })
    return toThread(data, index)
  },
  /**
   * Returns nothing on purpose. The API answers with the single new message,
   * not the thread — mapping that as a thread threw, which reported every
   * sent message as a failure even though it had saved.
   */
  async postMessage(threadId: string, text: string): Promise<void> {
    await api.post(`/threads/${threadId}/messages`, { text })
  },
  async setResolved(
    index: StaffIndex,
    threadId: string,
    resolved: boolean,
  ): Promise<Thread> {
    const { data } = await api.patch<ThreadDto>(
      `/threads/${threadId}/resolved`,
      { resolved },
    )
    return toThread(data, index)
  },
}

export const channelsApi = {
  /** The all-staff group plus every direct conversation. */
  async list(index: StaffIndex): Promise<Channel[]> {
    const [group, direct] = await Promise.all([
      api.get<ThreadDto>('/threads/all-staff').then((r) => r.data),
      api
        .get<ThreadDto[]>('/threads', { params: { kind: 'STAFF_DIRECT' } })
        .then((r) => r.data),
    ])
    return [group, ...direct].map((c) => toChannel(c, index))
  },
  /** Takes a STAFF id and resolves it — the endpoint itself wants a user id. */
  async openDirect(index: StaffIndex, otherStaffId: string): Promise<Channel> {
    const userId = index.userId.get(otherStaffId)
    if (!userId) throw new Error('That staff member has no user account')
    const { data } = await api.post<ThreadDto>(`/threads/direct/${userId}`, {})
    return toChannel(data, index)
  },
  /** Returns nothing, for the same reason as threadsApi.postMessage. */
  async send(channelId: string, text: string): Promise<void> {
    await api.post(`/threads/${channelId}/messages`, { text })
  },
  markRead: (channelId: string) =>
    api.post(`/threads/${channelId}/read`, {}).then(() => undefined),
}

/* ─── Agent partners ─────────────────────────────────────────────────── */

export const partnersApi = {
  async list(): Promise<AgentPartner[]> {
    const { data } = await api.get<Paged<PartnerDto>>('/staff/partners', {
      params: { limit: 200 },
    })
    return data.items.map(toPartner)
  },
  /*
   * The write endpoints answer with the bare AgentPartner row — no name, no
   * payout gaps — which the list-shaped mapper cannot read. The screen already
   * holds the change, so nothing is mapped back.
   */
  async setStatus(id: string, status: PartnerStatus): Promise<void> {
    await api.patch(`/staff/partners/${id}/status`, { status })
  },
  async assign(id: string, staffId: string | null): Promise<void> {
    await api.patch(`/staff/partners/${id}/owner`, { staffId })
  },
  async logContact(id: string): Promise<void> {
    await api.post(`/staff/partners/${id}/contact`, {})
  },
  async setNotes(id: string, notes: string): Promise<void> {
    await api.patch(`/staff/partners/${id}/notes`, { notes })
  },
}
