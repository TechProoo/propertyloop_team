import { useState } from 'react'
import { KeyRound, Pencil, ShieldCheck, Users } from 'lucide-react'
import { Plus } from 'lucide-react'
import { useCurrentUser, useStore } from '../lib/storeContext'
import { PERMISSION_LABEL, SENSITIVE_PERMISSIONS } from '../lib/permissions'
import type { Permission } from '../lib/permissions'
import { can } from '../lib/permissions'
import { staffSummary } from '../lib/metrics'
import { displayName, initials } from '../lib/format'
import { STAFF_ROLE_LABEL } from '../lib/types'
import type { Staff } from '../lib/types'
import { StaffForm } from '../components/forms2'
import {
  Avatar,
  Badge,
  Button,
  Card,
  PageHeader,
  Progress,
  SectionTitle,
} from '../components/ui'

/**
 * The org structure, with each person's access spelled out.
 *
 * The access shown is what the API has issued to that person — the same list
 * every staff route checks before it answers — so this screen and the server
 * cannot disagree about who can do what.
 */
export function Team() {
  const me = useCurrentUser()
  const { staff, targets, properties, deals, leads, ops, provisioned, dismissProvisioned } =
    useStore()
  const canManageStaff = can(me, 'MANAGE_STAFF')
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Staff | null>(null)

  const lagos = staff.filter((s) => s.chapter === 'LAGOS')
  const osun = staff.filter((s) => s.chapter === 'OSUN')
  const unfilled = staff.filter((s) => s.name === null)

  return (
    <>
      <PageHeader
        title="Team"
        subtitle="Organisational structure, September 2026 — and what each position can reach"
        icon={Users}
        accent="blue"
        actions={
          canManageStaff && (
            <Button variant="primary" onClick={() => setAdding(true)}>
              <Plus size={15} />
              Add position
            </Button>
          )
        }
      />

      {adding && <StaffForm onClose={() => setAdding(false)} />}
      {editing && <StaffForm existing={editing} onClose={() => setEditing(null)} />}

      {provisioned && (
        <Card accent="gold" className="mb-5">
          <div className="flex flex-wrap items-start gap-2.5">
            <KeyRound size={16} className="mt-0.5 shrink-0 text-[color:var(--color-accent)]" />
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-ink">
                {provisioned.kind === 'reset'
                  ? `${provisioned.name}'s password has been reset`
                  : `${provisioned.name} can now sign in`}
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-ink-2">
                Email <strong className="font-medium text-ink">{provisioned.email}</strong>,
                temporary password{' '}
                <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[13px] text-ink select-all">
                  {provisioned.temporaryPassword}
                </code>
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-3">
                Send it to them privately, not to a group chat. It is all small
                letters, digits and hyphens. It is shown this once: the server keeps
                only a hash, so closing this is final.
                {provisioned.kind === 'reset' &&
                  ' Their old password no longer works, and any device they were signed in on has been signed out.'}
              </p>
            </div>
            <Button size="sm" variant="ghost" onClick={dismissProvisioned}>
              I&apos;ve sent it
            </Button>
          </div>
        </Card>
      )}

      {unfilled.length > 0 && (
        <Card accent="gold" className="mb-5">
          <p className="text-sm text-ink-2">
            <strong className="font-semibold text-ink">
              {unfilled.length} of {staff.length} positions have no name attached
            </strong>{' '}
            — {unfilled.map((s) => `Staff ${s.letter}`).join(', ')}. They are shown by
            their letter from the org document rather than a placeholder that
            would read like a real employee.
          </p>
        </Card>
      )}

      <SectionTitle accent="blue" hint="Reports to the Managing Director through the General Manager">
        Lagos — head office
      </SectionTitle>
      <div className="pl-stagger mb-6 grid gap-3 lg:grid-cols-2">
        {lagos.map((s) => (
          <PersonCard
            key={s.id}
            person={s}
            highlight={s.id === me.id}
            canEdit={canManageStaff}
            onEdit={() => setEditing(s)}
            summary={staffSummary(s, { targets, properties, deals, leads, ops })}
          />
        ))}
      </div>

      <SectionTitle accent="violet" hint="Reports weekly to the General Manager">
        Osun state chapter
      </SectionTitle>
      <div className="pl-stagger mb-6 grid gap-3 lg:grid-cols-2">
        {osun.map((s) => (
          <PersonCard
            key={s.id}
            person={s}
            highlight={s.id === me.id}
            canEdit={canManageStaff}
            onEdit={() => setEditing(s)}
            summary={staffSummary(s, { targets, properties, deals, leads, ops })}
          />
        ))}
      </div>

      <Card accent="blue">
        <div className="flex items-start gap-2.5">
          <ShieldCheck size={16} className="mt-0.5 shrink-0 text-primary" />
          <div>
            <h2 className="text-sm font-semibold text-ink">
              Access is enforced by the server
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-2">
              Each card shows what that person actually holds, issued to them by the
              API — not what their position is meant to get. A button hidden here is
              refused there too: every staff route checks the same list before it
              answers. Items in red can move money, read identity documents or change
              what the public site shows.
            </p>
          </div>
        </div>
      </Card>
    </>
  )
}

function PersonCard({
  person,
  highlight,
  summary,
  canEdit,
  onEdit,
}: {
  person: Staff
  highlight: boolean
  summary: ReturnType<typeof staffSummary>
  canEdit: boolean
  onEdit: () => void
}) {
  const { staffById } = useStore()
  const manager = staffById(person.reportsTo)
  // What the API issued to this person, not their position's defaults.
  const permissions = person.permissions
  const sensitive = permissions.filter((p) => SENSITIVE_PERMISSIONS.includes(p))

  return (
    <Card
      hover
      accent={person.name === null ? 'gold' : 'blue'}
      className={highlight ? 'ring-2 ring-primary/30' : ''}
    >
      <div className="flex items-start gap-3">
        <Avatar initials={initials(person)} size="lg" seed={person.id} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-ink">{displayName(person)}</h3>
            <Badge>Staff {person.letter}</Badge>
            {highlight && <Badge tone="ok">you</Badge>}
            {person.name === null && <Badge tone="warn">unfilled</Badge>}
            {!person.active && <Badge tone="danger">inactive</Badge>}
          </div>
          <p className="mt-0.5 text-xs text-ink-3">{STAFF_ROLE_LABEL[person.role]}</p>
          <p className="mt-0.5 text-xs text-ink-3">
            {manager ? `Reports to ${displayName(manager)}` : 'Reports to the board'}
            {person.secondaryChapter && ` · also ${person.secondaryChapter} chapter`}
          </p>
        </div>
        <div className="flex items-start gap-1">
          <div className="text-right">
            <div className="font-display text-xl leading-none text-ink">
              {summary.score === null ? '—' : `${summary.score}%`}
            </div>
            <div className="mt-1 text-[10px] text-ink-3">
              {summary.targetsMet}/{summary.targetsTotal} targets
            </div>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={onEdit}
              aria-label={`Edit ${displayName(person)}`}
              title="Edit position"
              className="rounded-lg p-1.5 text-ink-3 transition-colors hover:bg-surface-2 hover:text-primary"
            >
              <Pencil size={13} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>

      {summary.score !== null && <Progress value={summary.score} className="mt-3" />}

      <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-3 sm:grid-cols-4">
        <Metric label="Sourced" value={summary.propertiesSourced} />
        <Metric label="Deals" value={summary.dealsOwned} />
        <Metric label="Leads" value={summary.leadsOwned} />
        <Metric label="Ops" value={summary.opsAssigned} />
      </dl>

      <div className="mt-3 border-t border-line pt-3">
        <span className="mb-1.5 block text-[10px] font-medium tracking-wide text-ink-3 uppercase">
          Access ({permissions.length})
        </span>
        <div className="flex flex-wrap gap-1">
          {permissions.map((p: Permission) => (
            <Badge key={p} tone={sensitive.includes(p) ? 'danger' : 'neutral'}>
              {PERMISSION_LABEL[p]}
            </Badge>
          ))}
        </div>
      </div>
    </Card>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-[10px] tracking-wide text-ink-3 uppercase">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-ink">{value}</dd>
    </div>
  )
}
