// Shoots, content, targets and staff.
//
// Split from forms.tsx purely for size — same conventions: one component does
// create and edit, `existing` decides which, and anything destructive states
// its consequences first.

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useStore } from '../lib/storeContext'
import {
  CONTENT_CHANNEL_LABEL,
  CONTENT_KIND_LABEL,
  STAFF_ROLE_LABEL,
} from '../lib/types'
import type {
  Chapter,
  ContentChannel,
  ContentKind,
  ContentPiece,
  Shoot,
  Staff,
  StaffRole,
  Target,
  TargetUnit,
} from '../lib/types'
import { assignableStaff } from '../lib/metrics'
import { displayName } from '../lib/format'
import {
  Button,
  Field,
  Modal,
  Note,
  NumberInput,
  Select,
  TextInput,
  Toggle,
} from './ui'

function parseNumber(raw: string, fallback = 0): number {
  const n = Number(raw.replace(/[,\s₦%]/g, ''))
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

/** Simple confirm-then-act, for records nothing else points at. */
function DeleteRow({
  what,
  note,
  onDelete,
}: {
  what: string
  note?: string
  onDelete: () => void
}) {
  const [armed, setArmed] = useState(false)
  return (
    <div className="mt-2 rounded-xl border border-rose/25 bg-rose-soft/25 p-3.5">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-rose-ink uppercase">
        <AlertTriangle size={13} strokeWidth={2} />
        Delete
      </h3>
      {note && <p className="mt-2 text-xs leading-relaxed text-ink-2">{note}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
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
    </div>
  )
}

/* ─── Shoot ──────────────────────────────────────────────────────────── */

export function ShootForm({
  existing,
  onClose,
}: {
  existing?: Shoot
  onClose: () => void
}) {
  const { addShoot, updateShoot, deleteShoot, properties, staff, threads } = useStore()
  const editing = existing !== undefined

  const [title, setTitle] = useState(existing?.title ?? '')
  const [location, setLocation] = useState(existing?.location ?? '')
  const [propertyId, setPropertyId] = useState(existing?.propertyId ?? '')
  const [presenterId, setPresenterId] = useState(
    existing?.presenterId ?? staff.find((s) => s.role === 'AMBASSADOR')?.id ?? staff[0].id,
  )
  const [secretaryId, setSecretaryId] = useState(
    existing?.secretaryId ?? staff.find((s) => s.role === 'SECRETARY')?.id ?? staff[0].id,
  )
  const [booked, setBooked] = useState(existing ? existing.scheduledFor !== null : true)
  const [inDays, setInDays] = useState('3')
  const [reschedule, setReschedule] = useState(false)
  const [reshoot, setReshoot] = useState(existing?.reshoot ?? false)

  const valid = title.trim() !== '' && location.trim() !== ''

  // Picking a property fills the location, since a shoot happens at the address.
  function pickProperty(id: string) {
    setPropertyId(id)
    const p = properties.find((x) => x.id === id)
    if (p && location.trim() === '') setLocation(p.location)
    if (p && title.trim() === '') setTitle(p.title)
  }

  function submit() {
    if (!valid) return
    if (editing) {
      updateShoot(existing.id, {
        title: title.trim(),
        location: location.trim(),
        propertyId: propertyId || null,
        presenterId,
        secretaryId,
        reshoot,
        scheduledInDays: !booked
          ? null
          : reschedule
            ? parseNumber(inDays, 3)
            : undefined,
      })
    } else {
      addShoot({
        title: title.trim(),
        location: location.trim(),
        propertyId: propertyId || null,
        presenterId,
        secretaryId,
        scheduledInDays: booked ? parseNumber(inDays, 3) : null,
      })
    }
    onClose()
  }

  const pinnedThreads = existing
    ? threads.filter(
        (t) => t.subject.kind === 'SHOOT' && t.subject.id === existing.id,
      ).length
    : 0

  return (
    <Modal
      title={editing ? 'Edit shoot' : 'Request a shoot'}
      subtitle={
        editing
          ? 'Stage is moved from the board, not here'
          : 'Unscheduled shoots sit in Requested until a date is booked'
      }
      accent="violet"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={!valid}>
            {editing ? 'Save changes' : 'Request shoot'}
          </Button>
        </>
      }
    >
      <div className="grid gap-3.5">
        <Field label="Property">
          <Select value={propertyId} onChange={pickProperty}>
            <option value="">Not about a specific listing</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Title">
          <TextInput
            value={title}
            onChange={setTitle}
            placeholder="Cedarwood Phase 2 — 3-bed walkthrough"
          />
        </Field>

        <Field label="Location">
          <TextInput
            value={location}
            onChange={setLocation}
            placeholder="Lekki Phase 1, Lagos"
          />
        </Field>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Presenter">
            <Select value={presenterId} onChange={setPresenterId}>
              {assignableStaff(staff, existing?.presenterId).map((sm) => (
                <option key={sm.id} value={sm.id}>
                  {displayName(sm)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Prepped by">
            <Select value={secretaryId} onChange={setSecretaryId}>
              {assignableStaff(staff, existing?.secretaryId).map((sm) => (
                <option key={sm.id} value={sm.id}>
                  {displayName(sm)}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Toggle checked={booked} onChange={setBooked}>
            Date is booked
          </Toggle>
          {booked && editing && (
            <Toggle checked={reschedule} onChange={setReschedule}>
              Reschedule it
            </Toggle>
          )}
          {booked && (!editing || reschedule) && (
            <div className="w-36">
              <Field label="In how many days?">
                <NumberInput value={inDays} onChange={setInDays} />
              </Field>
            </div>
          )}
        </div>

        {editing && (
          <Toggle checked={reshoot} onChange={setReshoot}>
            This was a reshoot
          </Toggle>
        )}

        <Note>
          The Secretary is measured on every shoot being prepped 24 hours before
          its booked time, so a shoot with no date cannot be late — it simply
          sits in Requested until someone books it.
        </Note>

        {editing && (
          <DeleteRow
            what="shoot"
            note={
              pinnedThreads > 0
                ? `${pinnedThreads} thread${pinnedThreads === 1 ? '' : 's'} pinned to this shoot will be deleted with it.`
                : 'Nothing else references this shoot.'
            }
            onDelete={() => {
              deleteShoot(existing.id)
              onClose()
            }}
          />
        )}
      </div>
    </Modal>
  )
}

/* ─── Content ────────────────────────────────────────────────────────── */

export function ContentForm({
  existing,
  onClose,
}: {
  existing?: ContentPiece
  onClose: () => void
}) {
  const { addContent, updateContent, deleteContent, staff } = useStore()
  const editing = existing !== undefined

  const [title, setTitle] = useState(existing?.title ?? '')
  const [channel, setChannel] = useState<ContentChannel>(
    existing?.channel ?? 'INSTAGRAM',
  )
  const [kind, setKind] = useState<ContentKind>(existing?.kind ?? 'POST')
  const [ownerId, setOwnerId] = useState(
    existing?.ownerId ?? staff.find((s) => s.role === 'MARKETING')?.id ?? staff[0].id,
  )
  const [scheduled, setScheduled] = useState(
    existing ? existing.publishedAt === null : true,
  )
  const [inDays, setInDays] = useState('2')
  const [publishNow, setPublishNow] = useState(false)
  const [engagement, setEngagement] = useState(
    existing?.engagementRate !== null && existing?.engagementRate !== undefined
      ? String(existing.engagementRate)
      : '',
  )
  const [leads, setLeads] = useState(
    existing ? String(existing.leadsGenerated) : '0',
  )

  const valid = title.trim() !== ''
  const alreadyPublished = existing?.publishedAt !== null && existing !== undefined

  function submit() {
    if (!valid) return
    if (editing) {
      updateContent(existing.id, {
        title: title.trim(),
        channel,
        kind,
        ownerId,
        engagementRate: engagement.trim() === '' ? null : parseNumber(engagement),
        leadsGenerated: Math.round(parseNumber(leads)),
        publishNow: publishNow || undefined,
        scheduledInDays:
          alreadyPublished || publishNow
            ? undefined
            : scheduled
              ? parseNumber(inDays, 2)
              : null,
      })
    } else {
      addContent({
        title: title.trim(),
        channel,
        kind,
        ownerId,
        scheduledInDays: scheduled ? parseNumber(inDays, 2) : null,
      })
    }
    onClose()
  }

  return (
    <Modal
      title={editing ? 'Edit content' : 'Plan a content piece'}
      subtitle={
        editing
          ? 'Engagement and leads come from each platform, so they are typed in'
          : 'Schedule it, or publish straight away'
      }
      accent="violet"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={!valid}>
            {editing ? 'Save changes' : 'Add to calendar'}
          </Button>
        </>
      }
    >
      <div className="grid gap-3.5">
        <Field label="Title">
          <TextInput
            value={title}
            onChange={setTitle}
            placeholder="Cedarwood Phase 2 launch carousel"
          />
        </Field>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Channel">
            <Select value={channel} onChange={(v) => setChannel(v as ContentChannel)}>
              {Object.entries(CONTENT_CHANNEL_LABEL).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Type">
            <Select value={kind} onChange={(v) => setKind(v as ContentKind)}>
              {Object.entries(CONTENT_KIND_LABEL).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Owner">
          <Select value={ownerId} onChange={setOwnerId}>
            {assignableStaff(staff, existing?.ownerId).map((sm) => (
              <option key={sm.id} value={sm.id}>
                {displayName(sm)}
              </option>
            ))}
          </Select>
        </Field>

        {!alreadyPublished && (
          <div className="flex flex-wrap items-center gap-3">
            <Toggle checked={scheduled} onChange={setScheduled}>
              Schedule for later
            </Toggle>
            {scheduled && (
              <div className="w-36">
                <Field label="In how many days?">
                  <NumberInput value={inDays} onChange={setInDays} />
                </Field>
              </div>
            )}
            {editing && !scheduled && (
              <Toggle checked={publishNow} onChange={setPublishNow}>
                Mark as published now
              </Toggle>
            )}
          </div>
        )}

        {editing && (
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Engagement rate (%)">
              <TextInput
                value={engagement}
                onChange={setEngagement}
                placeholder="Blank until you have read it"
              />
            </Field>
            <Field label="Leads generated">
              <NumberInput value={leads} onChange={setLeads} />
            </Field>
          </div>
        )}

        <Note>
          Engagement is marked <strong>manual</strong> on the scorecard because
          it comes from each platform&apos;s own analytics, not from
          PropertyLoop&apos;s database. Leaving it blank is more honest than a
          zero nobody has checked.
        </Note>

        {editing && (
          <DeleteRow
            what="piece"
            note="Nothing else references a content piece."
            onDelete={() => {
              deleteContent(existing.id)
              onClose()
            }}
          />
        )}
      </div>
    </Modal>
  )
}

/* ─── Target ─────────────────────────────────────────────────────────── */

export function TargetForm({
  existing,
  staffId,
  onClose,
}: {
  existing?: Target
  /** Required when creating — whose target this is. */
  staffId?: string
  onClose: () => void
}) {
  const { addTarget, updateTarget, deleteTarget, staff } = useStore()
  const editing = existing !== undefined

  const [label, setLabel] = useState(existing?.label ?? '')
  const [owner, setOwner] = useState(existing?.staffId ?? staffId ?? staff[0].id)
  const [unit, setUnit] = useState<TargetUnit>(existing?.unit ?? 'COUNT')
  const [min, setMin] = useState(existing ? String(existing.min) : '')
  const [max, setMax] = useState(existing ? String(existing.max) : '')
  const [actual, setActual] = useState(existing ? String(existing.actual) : '0')
  const [ceiling, setCeiling] = useState(existing?.ceiling ?? false)

  const valid = label.trim() !== '' && min.trim() !== ''
  const ownerName = staff.find((s) => s.id === owner)

  function submit() {
    if (!valid) return
    const lo = parseNumber(min)
    const hi = max.trim() === '' ? lo : parseNumber(max, lo)
    if (editing) {
      updateTarget(existing.id, {
        label: label.trim(),
        min: lo,
        max: Math.max(lo, hi),
        actual: parseNumber(actual),
        unit,
        ceiling,
      })
    } else {
      addTarget({
        staffId: owner,
        label: label.trim(),
        min: lo,
        max: Math.max(lo, hi),
        unit,
        ceiling,
      })
    }
    onClose()
  }

  return (
    <Modal
      title={editing ? 'Edit target' : 'Set a target'}
      subtitle={
        ownerName ? `For ${displayName(ownerName)}` : 'Monthly target'
      }
      accent="gold"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={!valid}>
            {editing ? 'Save target' : 'Set target'}
          </Button>
        </>
      }
    >
      <div className="grid gap-3.5">
        <Field label="What is being measured?">
          <TextInput
            value={label}
            onChange={setLabel}
            placeholder="Verified properties listed"
          />
        </Field>

        {!editing && (
          <Field label="Whose target?">
            <Select value={owner} onChange={setOwner}>
              {assignableStaff(staff).map((sm) => (
                <option key={sm.id} value={sm.id}>
                  {displayName(sm)}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <div className="grid gap-3.5 sm:grid-cols-3">
          <Field label="Unit">
            <Select value={unit} onChange={(v) => setUnit(v as TargetUnit)}>
              <option value="COUNT">Count</option>
              <option value="NAIRA">Naira</option>
              <option value="PERCENT">Percent</option>
            </Select>
          </Field>
          <Field label={ceiling ? 'Limit' : 'Minimum'}>
            <TextInput value={min} onChange={setMin} placeholder="20" />
          </Field>
          <Field label="Upper end (optional)">
            <TextInput value={max} onChange={setMax} placeholder="30" />
          </Field>
        </div>

        {editing && (
          <Field label="Actual so far">
            <TextInput value={actual} onChange={setActual} />
          </Field>
        )}

        <Toggle checked={ceiling} onChange={setCeiling}>
          Stay under this number, rather than reach it
        </Toggle>

        <Note>
          A target set here is marked <strong>manual</strong> — there is no
          query behind it, so somebody has to type the actual. That is exactly
          the distinction the Targets screen shows, and a scorecard made mostly
          of manual rows measures diligence in reporting rather than results.
        </Note>

        {editing && (
          <DeleteRow
            what="target"
            note="Removing a target changes the average this person is scored on."
            onDelete={() => {
              deleteTarget(existing.id)
              onClose()
            }}
          />
        )}
      </div>
    </Modal>
  )
}

/* ─── Staff ──────────────────────────────────────────────────────────── */

export function StaffForm({
  existing,
  onClose,
}: {
  existing?: Staff
  onClose: () => void
}) {
  const { addStaff, updateStaff, setStaffActive, staff } = useStore()
  const editing = existing !== undefined

  const [name, setName] = useState(existing?.name ?? '')
  const [letter, setLetter] = useState(existing?.letter ?? '')
  const [role, setRole] = useState<StaffRole>(existing?.role ?? 'PROPERTY_LISTING')
  const [chapter, setChapter] = useState<Chapter>(existing?.chapter ?? 'LAGOS')
  const [alsoOsun, setAlsoOsun] = useState(existing?.secondaryChapter === 'OSUN')
  const [email, setEmail] = useState(existing?.email ?? '')
  const [reportsTo, setReportsTo] = useState(existing?.reportsTo ?? '')

  const valid = editing || letter.trim() !== ''

  function submit() {
    if (!valid) return
    const shared = {
      name: name.trim() || null,
      role,
      chapter,
      secondaryChapter:
        alsoOsun && chapter !== 'OSUN' ? ('OSUN' as Chapter) : undefined,
      email: email.trim() || null,
      reportsTo: reportsTo || null,
    }
    if (editing) updateStaff(existing.id, shared)
    else addStaff({ letter: letter.trim().toUpperCase(), ...shared })
    onClose()
  }

  return (
    <Modal
      title={editing ? 'Edit position' : 'Add a position'}
      subtitle={
        editing
          ? 'Leave the name blank while the position is unfilled'
          : 'A new colleague joins the all-staff channel straight away'
      }
      accent="blue"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={!valid}>
            {editing ? 'Save changes' : 'Add position'}
          </Button>
        </>
      }
    >
      <div className="grid gap-3.5">
        <div className="grid gap-3.5 sm:grid-cols-[1fr_7rem]">
          <Field label="Name">
            <TextInput
              value={name}
              onChange={setName}
              placeholder="Leave blank if the position is unfilled"
            />
          </Field>
          <Field label="Staff letter">
            <TextInput value={letter} onChange={setLetter} placeholder="C" />
          </Field>
        </div>

        <Field label="Position">
          <Select value={role} onChange={(v) => setRole(v as StaffRole)}>
            {Object.entries(STAFF_ROLE_LABEL).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Chapter">
            <Select value={chapter} onChange={(v) => setChapter(v as Chapter)}>
              <option value="LAGOS">Lagos</option>
              <option value="OSUN">Osun</option>
            </Select>
          </Field>
          <Field label="Reports to">
            <Select value={reportsTo} onChange={setReportsTo}>
              <option value="">Nobody — reports to the board</option>
              {staff
                .filter((sm) => sm.id !== existing?.id)
                .map((sm) => (
                  <option key={sm.id} value={sm.id}>
                    {displayName(sm)}
                  </option>
                ))}
            </Select>
          </Field>
        </div>

        {chapter !== 'OSUN' && (
          <Toggle checked={alsoOsun} onChange={setAlsoOsun}>
            Also carries Osun chapter duties
          </Toggle>
        )}

        <Field label="Email">
          <TextInput value={email} onChange={setEmail} placeholder="Optional" />
        </Field>

        <Note>
          Changing the position changes what this person can reach across the
          whole portal — see the access list on their card. That gating shapes
          this interface only; it does not secure the API until staff
          permissions exist there.
        </Note>

        {editing && (
          <div className="mt-2 rounded-xl border border-line bg-surface-2/40 p-3.5">
            <h3 className="text-xs font-semibold tracking-wider text-ink-2 uppercase">
              {existing.active ? 'Deactivate' : 'Reactivate'}
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-ink-2">
              Staff are never deleted. Their id is stamped on every property,
              deal, lead, log and message they touched, so removing them would
              orphan all of it. Deactivating keeps the history readable.
            </p>
            <div className="mt-3">
              <Button
                size="sm"
                variant={existing.active ? 'danger' : 'secondary'}
                onClick={() => {
                  setStaffActive(existing.id, !existing.active)
                  onClose()
                }}
              >
                {existing.active ? 'Deactivate this position' : 'Reactivate'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
