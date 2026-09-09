// Creation forms.
//
// What can be created here is a deliberate list. Properties, offline leads,
// deals and internal tasks are all things a staff member genuinely originates.
// KYC submissions, payouts, reports and disputes are NOT: those rows are
// projections of backend records, and a hand-made one would be a task with
// nothing behind it that can be marked resolved without anything happening.
//
// Each form is uncontrolled about validation beyond "the required fields are
// filled" — the point is to get real work in quickly, not to police it.

import { useState } from 'react'
import { useCurrentUser, useStore } from '../lib/storeContext'
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
  DealKind,
  DocumentType,
  LeadSource,
  ListingType,
  MandateType,
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

/* ─── Property ───────────────────────────────────────────────────────── */

export function NewPropertyForm({ onClose }: { onClose: () => void }) {
  const me = useCurrentUser()
  const { addProperty, deals } = useStore()

  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [chapter, setChapter] = useState<Chapter>(
    me.chapter === 'OSUN' ? 'OSUN' : 'LAGOS',
  )
  const [type, setType] = useState<ListingType>('SALE')
  const [price, setPrice] = useState('')
  const [developer, setDeveloper] = useState('')
  const [dealId, setDealId] = useState('')
  const [units, setUnits] = useState('1')
  const [photos, setPhotos] = useState('0')
  const [docs, setDocs] = useState<DocumentType[]>([])

  // Only mandates that actually produce inventory are worth linking to.
  const linkable = deals.filter(
    (d) => d.stage !== 'LOST' && d.kind !== 'ADVERTISER',
  )

  const valid = title.trim() !== '' && location.trim() !== '' && parseNaira(price) > 0

  function toggleDoc(t: DocumentType) {
    setDocs((prev) => (prev.includes(t) ? prev.filter((d) => d !== t) : [...prev, t]))
  }

  function submit() {
    if (!valid) return
    addProperty({
      title: title.trim(),
      location: location.trim(),
      chapter,
      type,
      priceNaira: parseNaira(price),
      developer: developer.trim() || null,
      dealId: dealId || null,
      units: Math.max(1, parseCount(units, 1)),
      photoCount: parseCount(photos),
      documentsPresent: docs,
    })
    onClose()
  }

  return (
    <Modal
      title="Add a property"
      subtitle="Filed as pending review — verification and publishing stay separate steps"
      accent="green"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={!valid}>
            File for review
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

        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Developer or owner">
            <TextInput
              value={developer}
              onChange={setDeveloper}
              placeholder="Optional"
            />
          </Field>
          <Field label="From which mandate?">
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

        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Units">
            <NumberInput value={units} onChange={setUnits} min={1} />
          </Field>
          <Field label="Photos uploaded">
            <NumberInput value={photos} onChange={setPhotos} />
          </Field>
        </div>

        <Field label="Documents received">
          <div className="flex flex-wrap gap-1.5">
            {DOC_TYPES.map((t) => (
              <Toggle key={t} checked={docs.includes(t)} onChange={() => toggleDoc(t)}>
                {DOCUMENT_TYPE_LABEL[t]}
              </Toggle>
            ))}
          </div>
        </Field>

        <Note>
          Documents are recorded as <strong>received but unverified</strong> —
          somebody still has to check them. Publishing needs all four verified
          plus at least eight photos, and this listing will be attributed to{' '}
          <strong>{displayName(me)}</strong> as the person who sourced it.
        </Note>
      </div>
    </Modal>
  )
}

/* ─── Lead ───────────────────────────────────────────────────────────── */

export function NewLeadForm({ onClose }: { onClose: () => void }) {
  const me = useCurrentUser()
  const { addLead, properties, staff } = useStore()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [source, setSource] = useState<LeadSource>('PHONE')
  const [propertyId, setPropertyId] = useState('')
  const [budget, setBudget] = useState('')
  const [ownerId, setOwnerId] = useState(me.id)
  const [notes, setNotes] = useState('')

  const live = properties.filter((p) => p.status === 'ACTIVE')
  const valid = name.trim() !== '' && phone.trim() !== ''

  function submit() {
    if (!valid) return
    addLead({
      name: name.trim(),
      phone: phone.trim(),
      source,
      propertyId: propertyId || null,
      budgetNaira: parseNaira(budget) || null,
      ownerId,
      notes: notes.trim(),
    })
    onClose()
  }

  return (
    <Modal
      title="Log an enquiry"
      subtitle="For calls, walk-ins and referrals — website enquiries arrive on their own"
      accent="blue"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={!valid}>
            Log enquiry
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
              {OFFLINE_LEAD_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {LEAD_SOURCE_LABEL[s]}
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
            <option value="">Not about a specific listing</option>
            {live.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Owner">
          <Select value={ownerId} onChange={setOwnerId}>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {displayName(s)}
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

        <Note>
          Only offline sources are listed. Enquiries from the website and agent
          profiles are written by the platform itself — typing one in here would
          duplicate the record and start the response clock from now rather than
          when it actually arrived. This lead is filed as{' '}
          <strong>contacted</strong>, since the conversation has already happened.
        </Note>
      </div>
    </Modal>
  )
}

/* ─── Deal ───────────────────────────────────────────────────────────── */

export function NewDealForm({ onClose }: { onClose: () => void }) {
  const me = useCurrentUser()
  const { addDeal, staff } = useStore()

  const [company, setCompany] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [kind, setKind] = useState<DealKind>('DEVELOPER')
  const [mandate, setMandate] = useState<MandateType>('NONE')
  const [value, setValue] = useState('')
  const [expectedUnits, setExpectedUnits] = useState('0')
  const [chapter, setChapter] = useState<Chapter>(
    me.chapter === 'OSUN' ? 'OSUN' : 'LAGOS',
  )
  const [ownerId, setOwnerId] = useState(me.id)
  const [nextAction, setNextAction] = useState('')
  const [nextInDays, setNextInDays] = useState('3')
  const [notes, setNotes] = useState('')

  const valid = company.trim() !== '' && contactName.trim() !== ''

  function submit() {
    if (!valid) return
    addDeal({
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
      nextActionInDays: nextAction.trim() ? parseCount(nextInDays, 3) : null,
      notes: notes.trim(),
    })
    onClose()
  }

  return (
    <Modal
      title="Add a deal"
      subtitle="Starts at identified — move it along the board as it progresses"
      accent="gold"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={!valid}>
            Add deal
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
            <TextInput value={value} onChange={setValue} placeholder="Commission or package value" />
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
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {displayName(s)}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-[1fr_9rem]">
          <Field label="Next action">
            <TextInput
              value={nextAction}
              onChange={setNextAction}
              placeholder="Send partnership deck"
            />
          </Field>
          <Field label="In how many days?">
            <NumberInput value={nextInDays} onChange={setNextInDays} min={0} />
          </Field>
        </div>

        <Field label="Notes">
          <Textarea
            value={notes}
            onChange={setNotes}
            rows={3}
            placeholder="Who the decision maker is, what they want, anything already agreed."
          />
        </Field>

        <Note>
          A deal with no next action logged goes stale silently. Setting one now
          is what puts it on your dashboard queue when it comes due.
        </Note>
      </div>
    </Modal>
  )
}

/* ─── Internal task ──────────────────────────────────────────────────── */

export function NewTaskForm({ onClose }: { onClose: () => void }) {
  const { addTask, staff } = useStore()

  const [subject, setSubject] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [urgent, setUrgent] = useState(false)

  const valid = subject.trim() !== ''

  function submit() {
    if (!valid) return
    addTask({
      subject: subject.trim(),
      assigneeId: assigneeId || null,
      urgent,
    })
    onClose()
  }

  return (
    <Modal
      title="Add an internal task"
      subtitle="Something the team has to do that the platform does not know about"
      accent="violet"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={!valid}>
            Add task
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
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {displayName(s)}
              </option>
            ))}
          </Select>
        </Field>

        <Toggle checked={urgent} onChange={setUrgent}>
          Needs action today
        </Toggle>

        <Note>
          Only internal tasks can be created here. KYC reviews, payouts, reports
          and disputes are read from the platform&apos;s own records — a
          hand-made one of those would be a row somebody could mark resolved
          without any money moving or any document being checked.
        </Note>
      </div>
    </Modal>
  )
}
