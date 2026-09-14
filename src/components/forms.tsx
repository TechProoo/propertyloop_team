// Create and edit forms.
//
// What can be created here is a deliberate list. Properties, offline leads,
// deals and internal tasks are all things a staff member genuinely originates.
// KYC submissions, payouts, reports and disputes are NOT: those rows are
// projections of backend records, and a hand-made one would be a task with
// nothing behind it that can be marked resolved without anything happening.
//
// Each form does double duty — pass `existing` and it edits that record
// instead of creating one. Keeping both in one component means a field added
// to the create form can never go missing from the edit form.

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useCurrentUser, useStore } from '../lib/storeContext'
import { assignableStaff, deleteImpact, impactSentences } from '../lib/metrics'
import {
  DEAL_KIND_LABEL,
  DOCUMENT_TYPE_LABEL,
  LEAD_SOURCE_LABEL,
  LISTING_TYPE_LABEL,
  MANDATE_LABEL,
  OFFLINE_LEAD_SOURCES,
} from '../lib/types'
import type {
  Chapter,
  Deal,
  DealKind,
  DocumentType,
  Lead,
  LeadSource,
  ListingType,
  MandateType,
  OpsItem,
  Property,
} from '../lib/types'
import { displayName } from '../lib/format'
import {
  Button,
  Field,
  Modal,
  Note,
  NumberInput,
  Select,
  Textarea,
  TextInput,
  Toggle,
} from './ui'
import { PendingPhotos, SavedPhotos } from './PhotoManager'

/** Naira typed as "145000000" or "145,000,000" — both should work. */
function parseNaira(raw: string): number {
  const n = Number(raw.replace(/[,\s₦]/g, ''))
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0
}

function parseCount(raw: string, fallback = 0): number {
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : fallback
}

const DOC_TYPES: DocumentType[] = [
  'C_OF_O',
  'SURVEY_PLAN',
  'BUILDING_PERMIT',
  'RECEIPT',
]

/* ─── Danger zone ────────────────────────────────────────────────────── */

/**
 * Delete, with the consequences spelled out first.
 *
 * Records reference each other by id, so a delete is never local. Rather than
 * forbid it or corrupt the data silently, the impact is counted and shown,
 * and it takes a second, deliberate click.
 */
function DangerZone({
  what,
  impact,
  blocked,
  onDelete,
}: {
  what: string
  impact: string[]
  /** Set when deletion is not allowed at all, with the reason why. */
  blocked?: string
  onDelete: () => void
}) {
  const [armed, setArmed] = useState(false)

  return (
    <div className="mt-2 rounded-xl border border-rose/25 bg-rose-soft/25 p-3.5">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-rose-ink uppercase">
        <AlertTriangle size={13} strokeWidth={2} />
        Delete
      </h3>

      {blocked ? (
        <p className="mt-2 text-xs leading-relaxed text-ink-2">{blocked}</p>
      ) : (
        <>
          <p className="mt-2 text-xs leading-relaxed text-ink-2">
            {impact.length === 0 ? (
              <>Nothing else references this {what}, so it goes on its own.</>
            ) : (
              <>
                This also changes other records:
                <ul className="mt-1.5 ml-4 list-disc space-y-0.5">
                  {impact.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </>
            )}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {armed ? (
              <>
                <Button size="sm" variant="danger" onClick={onDelete}>
                  Yes, delete this {what}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setArmed(false)}>
                  Keep it
                </Button>
              </>
            ) : (
              <Button size="sm" variant="danger" onClick={() => setArmed(true)}>
                Delete this {what}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

/* ─── Property ───────────────────────────────────────────────────────── */

export function PropertyForm({
  existing,
  onClose,
}: {
  existing?: Property
  onClose: () => void
}) {
  const me = useCurrentUser()
  const {
    addProperty,
    updateProperty,
    deleteProperty,
    deals,
    properties,
    leads,
    shoots,
    threads,
  } = useStore()
  const editing = existing !== undefined

  const [title, setTitle] = useState(existing?.title ?? '')
  const [location, setLocation] = useState(existing?.location ?? '')
  const [chapter, setChapter] = useState<Chapter>(
    existing?.chapter ?? (me.chapter === 'OSUN' ? 'OSUN' : 'LAGOS'),
  )
  const [type, setType] = useState<ListingType>(existing?.type ?? 'SALE')
  const [price, setPrice] = useState(
    existing ? String(existing.priceNaira) : '',
  )
  const [dealId, setDealId] = useState(existing?.dealId ?? '')
  const [units, setUnits] = useState(existing ? String(existing.units) : '1')
  const [unitsSold, setUnitsSold] = useState(
    existing ? String(existing.unitsSold) : '0',
  )
  const [docs, setDocs] = useState<DocumentType[]>(
    existing ? existing.documents.filter((d) => d.present).map((d) => d.type) : [],
  )
  const [newPhotos, setNewPhotos] = useState<File[]>([])

  const linkable = deals.filter(
    (d) => d.stage !== 'LOST' && d.kind !== 'ADVERTISER',
  )
  const valid = title.trim() !== '' && location.trim() !== '' && parseNaira(price) > 0

  function toggleDoc(t: DocumentType) {
    setDocs((prev) => (prev.includes(t) ? prev.filter((d) => d !== t) : [...prev, t]))
  }

  function submit() {
    if (!valid) return
    const shared = {
      title: title.trim(),
      location: location.trim(),
      chapter,
      type,
      priceNaira: parseNaira(price),
      // The developer is whoever signed the mandate, not a second free-text copy.
      developer: linkable.find((d) => d.id === dealId)?.company ?? null,
      dealId: dealId || null,
      units: Math.max(1, parseCount(units, 1)),
      // Counted from uploads on the listing, never typed.
      photoCount: existing?.photoCount ?? 0,
      documentsPresent: docs,
    }
    if (editing) {
      updateProperty(existing.id, {
        ...shared,
        unitsSold: Math.min(parseCount(unitsSold), Math.max(1, parseCount(units, 1))),
      })
    } else {
      addProperty({ ...shared, photos: newPhotos })
    }
    onClose()
  }

  // A live listing must be paused first. Deleting something the public site is
  // serving should never be one click inside an edit dialog.
  const blocked =
    existing?.status === 'ACTIVE'
      ? 'This listing is published on propertyloop.ng. Pause it first, then delete.'
      : undefined

  const impact = existing
    ? impactSentences(
        deleteImpact('PROPERTY', existing.id, { properties, leads, shoots, threads }),
      )
    : []

  return (
    <Modal
      title={editing ? 'Edit property' : 'Add a property'}
      subtitle={
        editing
          ? 'Changes apply immediately — verification status follows the documents'
          : 'Filed as pending review — verification and publishing stay separate steps'
      }
      accent="green"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={!valid}>
            {editing ? 'Save changes' : 'File for review'}
          </Button>
        </>
      }
    >
      <div className="grid gap-3.5">
        <Field label="Title">
          <TextInput
            value={title}
            onChange={setTitle}
            placeholder="3-Bed Terrace, Cedarwood Phase 2"
          />
        </Field>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Location">
            <TextInput
              value={location}
              onChange={setLocation}
              placeholder="Lekki Phase 1, Lagos"
            />
          </Field>
          <Field label="Chapter">
            <Select value={chapter} onChange={(v) => setChapter(v as Chapter)}>
              <option value="LAGOS">Lagos</option>
              <option value="OSUN">Osun</option>
            </Select>
          </Field>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Listing type">
            <Select value={type} onChange={(v) => setType(v as ListingType)}>
              {Object.entries(LISTING_TYPE_LABEL).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={type === 'SHORTLET' ? 'Price per night (₦)' : 'Price (₦)'}>
            <TextInput value={price} onChange={setPrice} placeholder="145,000,000" />
          </Field>
        </div>

        <div className="grid gap-3.5">
          <Field label="From which mandate? The developer is taken from the deal">
            <Select value={dealId} onChange={setDealId}>
              <option value="">Not from a deal</option>
              {linkable.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.company}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className={`grid gap-3.5 ${editing ? 'sm:grid-cols-2' : ''}`}>
          <Field label="Units">
            <NumberInput value={units} onChange={setUnits} min={1} />
          </Field>
          {editing && (
            <Field label="Units sold">
              <NumberInput value={unitsSold} onChange={setUnitsSold} />
            </Field>
          )}
        </div>

        <Field label="Documents on file">
          <div className="flex flex-wrap gap-1.5">
            {DOC_TYPES.map((t) => (
              <Toggle key={t} checked={docs.includes(t)} onChange={() => toggleDoc(t)}>
                {DOCUMENT_TYPE_LABEL[t]}
              </Toggle>
            ))}
          </div>
        </Field>

        <Field label="Photos">
          {editing ? (
            <SavedPhotos propertyId={existing.id} />
          ) : (
            <PendingPhotos files={newPhotos} onChange={setNewPhotos} />
          )}
        </Field>

        {editing && (
          <p className="text-xs text-ink-3">
            {existing.hasVideo ? 'Video tour uploaded.' : 'No video tour yet.'}
          </p>
        )}

        {editing ? (
          <Note>
            Un-ticking a document also clears its verification — a document that
            is no longer on file cannot stay checked. Verification of the
            remaining documents is unaffected.
          </Note>
        ) : (
          <Note>
            Documents are recorded as <strong>received but unverified</strong> —
            somebody still has to check them. Publishing needs all four verified
            plus at least eight photos, and this listing will be attributed to{' '}
            <strong>{displayName(me)}</strong> as the person who sourced it.
          </Note>
        )}

        {editing && (
          <DangerZone
            what="property"
            impact={impact}
            blocked={blocked}
            onDelete={() => {
              deleteProperty(existing.id)
              onClose()
            }}
          />
        )}
      </div>
    </Modal>
  )
}

/* ─── Lead ───────────────────────────────────────────────────────────── */

export function LeadForm({
  existing,
  onClose,
}: {
  existing?: Lead
  onClose: () => void
}) {
  const me = useCurrentUser()
  const { addLead, updateLead, deleteLead, properties, leads, shoots, threads, staff } =
    useStore()
  const editing = existing !== undefined

  const [name, setName] = useState(existing?.name ?? '')
  const [phone, setPhone] = useState(existing?.phone ?? '')
  const [source, setSource] = useState<LeadSource>(existing?.source ?? 'PHONE')
  const [propertyId, setPropertyId] = useState(existing?.propertyId ?? '')
  const [budget, setBudget] = useState(
    existing?.budgetNaira ? String(existing.budgetNaira) : '',
  )
  const [ownerId, setOwnerId] = useState(existing?.ownerId ?? me.id)
  const [notes, setNotes] = useState(existing?.notes ?? '')

  // When editing, keep whatever source the record already has even if it came
  // from the website — otherwise saving would silently rewrite its origin.
  const sourceOptions = editing
    ? Array.from(new Set([existing.source, ...OFFLINE_LEAD_SOURCES]))
    : OFFLINE_LEAD_SOURCES

  const selectable = properties.filter(
    (p) => p.status === 'ACTIVE' || p.id === existing?.propertyId,
  )
  // Every lead belongs to a property — the table cannot store one without.
  const valid = name.trim() !== '' && phone.trim() !== '' && propertyId !== ''

  function submit() {
    if (!valid) return
    const shared = {
      name: name.trim(),
      phone: phone.trim(),
      source,
      propertyId: propertyId || null,
      budgetNaira: parseNaira(budget) || null,
      ownerId,
      notes: notes.trim(),
    }
    if (editing) updateLead(existing.id, shared)
    else addLead(shared)
    onClose()
  }

  const impact = existing
    ? impactSentences(
        deleteImpact('LEAD', existing.id, { properties, leads, shoots, threads }),
      )
    : []

  return (
    <Modal
      title={editing ? 'Edit enquiry' : 'Log an enquiry'}
      subtitle={
        editing
          ? 'Correct the details — status and response time are unchanged'
          : 'For calls, walk-ins and referrals — website enquiries arrive on their own'
      }
      accent="blue"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={!valid}>
            {editing ? 'Save changes' : 'Log enquiry'}
          </Button>
        </>
      }
    >
      <div className="grid gap-3.5">
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Name">
            <TextInput value={name} onChange={setName} placeholder="Chidi Anyanwu" />
          </Field>
          <Field label="Phone">
            <TextInput value={phone} onChange={setPhone} placeholder="0803 555 0000" />
          </Field>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="How did they reach us?">
            <Select value={source} onChange={(v) => setSource(v as LeadSource)}>
              {sourceOptions.map((sc) => (
                <option key={sc} value={sc}>
                  {LEAD_SOURCE_LABEL[sc]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Budget (₦)">
            <TextInput value={budget} onChange={setBudget} placeholder="Optional" />
          </Field>
        </div>

        <Field label="Property of interest">
          <Select value={propertyId} onChange={setPropertyId}>
            <option value="" disabled>
              Choose the property they asked about
            </option>
            {selectable.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Owner">
          <Select value={ownerId} onChange={setOwnerId}>
            {assignableStaff(staff, existing?.ownerId).map((sm) => (
              <option key={sm.id} value={sm.id}>
                {displayName(sm)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Notes">
          <Textarea
            value={notes}
            onChange={setNotes}
            rows={3}
            placeholder="What they asked for, timeline, anything agreed on the call."
          />
        </Field>

        {!editing && (
          <Note>
            Only offline sources are listed. Enquiries from the website and agent
            profiles are written by the platform itself — typing one in here would
            duplicate the record and start the response clock from now rather than
            when it actually arrived. This lead is filed as{' '}
            <strong>contacted</strong>, since the conversation has already happened.
          </Note>
        )}

        {editing && (
          <DangerZone
            what="enquiry"
            impact={impact}
            onDelete={() => {
              deleteLead(existing.id)
              onClose()
            }}
          />
        )}
      </div>
    </Modal>
  )
}

/* ─── Deal ───────────────────────────────────────────────────────────── */

export function DealForm({
  existing,
  onClose,
}: {
  existing?: Deal
  onClose: () => void
}) {
  const me = useCurrentUser()
  const { addDeal, updateDeal, deleteDeal, properties, leads, shoots, threads, staff } =
    useStore()
  const editing = existing !== undefined

  const [company, setCompany] = useState(existing?.company ?? '')
  const [contactName, setContactName] = useState(existing?.contactName ?? '')
  const [contactPhone, setContactPhone] = useState(existing?.contactPhone ?? '')
  const [kind, setKind] = useState<DealKind>(existing?.kind ?? 'DEVELOPER')
  const [mandate, setMandate] = useState<MandateType>(existing?.mandate ?? 'NONE')
  const [value, setValue] = useState(existing ? String(existing.valueNaira) : '')
  const [expectedUnits, setExpectedUnits] = useState(
    existing ? String(existing.expectedUnits) : '0',
  )
  const [chapter, setChapter] = useState<Chapter>(
    existing?.chapter ?? (me.chapter === 'OSUN' ? 'OSUN' : 'LAGOS'),
  )
  const [ownerId, setOwnerId] = useState(existing?.ownerId ?? me.id)
  const [nextAction, setNextAction] = useState(existing?.nextAction ?? '')
  const [nextInDays, setNextInDays] = useState('3')
  const [rescheduleNext, setRescheduleNext] = useState(false)
  const [notes, setNotes] = useState(existing?.notes ?? '')

  const valid = company.trim() !== '' && contactName.trim() !== ''

  function submit() {
    if (!valid) return
    const shared = {
      company: company.trim(),
      contactName: contactName.trim(),
      contactPhone: contactPhone.trim() || null,
      kind,
      mandate,
      valueNaira: parseNaira(value),
      expectedUnits: parseCount(expectedUnits),
      chapter,
      ownerId,
      nextAction: nextAction.trim() || null,
      notes: notes.trim(),
    }
    if (editing) {
      updateDeal(existing.id, {
        ...shared,
        // Leave the existing due date alone unless asked, so saving a typo in
        // the notes does not silently push a follow-up back three days.
        nextActionInDays: !nextAction.trim()
          ? null
          : rescheduleNext
            ? parseCount(nextInDays, 3)
            : undefined,
      })
    } else {
      addDeal({
        ...shared,
        nextActionInDays: nextAction.trim() ? parseCount(nextInDays, 3) : null,
      })
    }
    onClose()
  }

  const impact = existing
    ? impactSentences(
        deleteImpact('DEAL', existing.id, { properties, leads, shoots, threads }),
      )
    : []

  return (
    <Modal
      title={editing ? 'Edit deal' : 'Add a deal'}
      subtitle={
        editing
          ? 'Saving counts as activity, so this stops reading as stale'
          : 'Starts at identified — move it along the board as it progresses'
      }
      accent="gold"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={!valid}>
            {editing ? 'Save changes' : 'Add deal'}
          </Button>
        </>
      }
    >
      <div className="grid gap-3.5">
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Company">
            <TextInput
              value={company}
              onChange={setCompany}
              placeholder="Cedarwood Developments"
            />
          </Field>
          <Field label="Kind">
            <Select value={kind} onChange={(v) => setKind(v as DealKind)}>
              {Object.entries(DEAL_KIND_LABEL).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Contact name">
            <TextInput
              value={contactName}
              onChange={setContactName}
              placeholder="Tunde Bakare"
            />
          </Field>
          <Field label="Contact phone">
            <TextInput
              value={contactPhone}
              onChange={setContactPhone}
              placeholder="Optional"
            />
          </Field>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Expected value (₦)">
            <TextInput
              value={value}
              onChange={setValue}
              placeholder="Commission or package value"
            />
          </Field>
          <Field label="Expected units">
            <NumberInput value={expectedUnits} onChange={setExpectedUnits} />
          </Field>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-3">
          <Field label="Mandate">
            <Select value={mandate} onChange={(v) => setMandate(v as MandateType)}>
              {Object.entries(MANDATE_LABEL).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Chapter">
            <Select value={chapter} onChange={(v) => setChapter(v as Chapter)}>
              <option value="LAGOS">Lagos</option>
              <option value="OSUN">Osun</option>
            </Select>
          </Field>
          <Field label="Owner">
            <Select value={ownerId} onChange={setOwnerId}>
              {assignableStaff(staff, existing?.ownerId).map((sm) => (
                <option key={sm.id} value={sm.id}>
                  {displayName(sm)}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Next action">
          <TextInput
            value={nextAction}
            onChange={setNextAction}
            placeholder="Send partnership deck"
          />
        </Field>

        {nextAction.trim() !== '' &&
          (editing ? (
            <div className="flex flex-wrap items-center gap-3">
              <Toggle checked={rescheduleNext} onChange={setRescheduleNext}>
                Reschedule the follow-up
              </Toggle>
              {rescheduleNext && (
                <div className="w-32">
                  <Field label="In how many days?">
                    <NumberInput value={nextInDays} onChange={setNextInDays} min={0} />
                  </Field>
                </div>
              )}
            </div>
          ) : (
            <div className="w-40">
              <Field label="In how many days?">
                <NumberInput value={nextInDays} onChange={setNextInDays} min={0} />
              </Field>
            </div>
          ))}

        <Field label="Notes">
          <Textarea
            value={notes}
            onChange={setNotes}
            rows={3}
            placeholder="Who the decision maker is, what they want, anything already agreed."
          />
        </Field>

        {!editing && (
          <Note>
            A deal with no next action logged goes stale silently. Setting one now
            is what puts it on your dashboard queue when it comes due.
          </Note>
        )}

        {editing && (
          <DangerZone
            what="deal"
            impact={impact}
            onDelete={() => {
              deleteDeal(existing.id)
              onClose()
            }}
          />
        )}
      </div>
    </Modal>
  )
}

/* ─── Internal task ──────────────────────────────────────────────────── */

export function TaskForm({
  existing,
  onClose,
}: {
  existing?: OpsItem
  onClose: () => void
}) {
  const { addTask, updateTask, deleteOpsItem, staff } = useStore()
  const editing = existing !== undefined

  const [subject, setSubject] = useState(existing?.subject ?? '')
  const [assigneeId, setAssigneeId] = useState(existing?.assigneeId ?? '')
  const [urgent, setUrgent] = useState(existing?.urgent ?? false)

  const valid = subject.trim() !== ''

  function submit() {
    if (!valid) return
    const shared = {
      subject: subject.trim(),
      assigneeId: assigneeId || null,
      urgent,
    }
    if (editing) updateTask(existing.id, shared)
    else addTask(shared)
    onClose()
  }

  return (
    <Modal
      title={editing ? 'Edit task' : 'Add an internal task'}
      subtitle="Something the team has to do that the platform does not know about"
      accent="violet"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={!valid}>
            {editing ? 'Save changes' : 'Add task'}
          </Button>
        </>
      }
    >
      <div className="grid gap-3.5">
        <Field label="What needs doing?">
          <TextInput
            value={subject}
            onChange={setSubject}
            placeholder="Chase Cedarwood for the Phase 2 building permit"
          />
        </Field>

        <Field label="Assign to">
          <Select value={assigneeId} onChange={setAssigneeId}>
            <option value="">Leave unassigned</option>
            {assignableStaff(staff, existing?.assigneeId).map((sm) => (
              <option key={sm.id} value={sm.id}>
                {displayName(sm)}
              </option>
            ))}
          </Select>
        </Field>

        <Toggle checked={urgent} onChange={setUrgent}>
          Needs action today
        </Toggle>

        {!editing && (
          <Note>
            Only internal tasks can be created here. KYC reviews, payouts, reports
            and disputes are read from the platform&apos;s own records — a
            hand-made one of those would be a row somebody could mark resolved
            without any money moving or any document being checked.
          </Note>
        )}

        {editing && (
          <DangerZone
            what="task"
            impact={[]}
            onDelete={() => {
              deleteOpsItem(existing.id)
              onClose()
            }}
          />
        )}
      </div>
    </Modal>
  )
}
