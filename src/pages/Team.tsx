import { useState } from 'react'
import { Pencil, RotateCcw, ShieldAlert, Users } from 'lucide-react'
import { Plus } from 'lucide-react'
import { useCurrentUser, useStore } from '../lib/storeContext'
import { PERMISSION_LABEL, ROLE_PERMISSIONS, SENSITIVE_PERMISSIONS } from '../lib/permissions'
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
  Note,
  PageHeader,
  Progress,
  SectionTitle,
} from '../components/ui'

/**
 * The org structure, with each position's access spelled out.
 *
 * Showing permissions per role is not decoration. Today the backend has one
 * binary admin check, so giving these nine people staff logins would hand a
 * Secretary and an Ambassador the same powers as the CEO. Writing the
 * intended access down per position is the first step to enforcing it.
 */
export function Team() {
  const me = useCurrentUser()
  const { staff, targets, properties, deals, leads, ops, resetData } = useStore()
  const canManageStaff = can(me, 'MANAGE_STAFF')
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Staff | null>(null)
  const [resetArmed, setResetArmed] = useState(false)

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

      <SectionTitle accent="violet" hint="Both Sodiqs lead the chapter, reporting weekly to the General Manager">
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

      <Card accent="rose" className="border-rose/30">
        <div className="flex items-start gap-2.5">
          <ShieldAlert
            size={16}
            className="mt-0.5 shrink-0 text-[color:var(--color-danger)]"
          />
          <div>
            <h2 className="text-sm font-semibold text-ink">
              These permissions are not enforced yet
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-2">
              The backend&apos;s <code>Role</code> enum is BUYER, AGENT, VENDOR
              and ADMIN — there is no staff concept — and every admin endpoint
              runs the same check: throw unless the role is exactly ADMIN.
              Creating staff accounts today would mean nine people with
              identical, total access: suspend any user, change any
              listing&apos;s status, approve withdrawals, resolve escrow
              disputes, read KYC documents. The access shown on each card is
              the intended shape, and the reason a StaffProfile table with
              per-permission grants should land before the first login is
              handed out.
            </p>
          </div>
        </div>
      </Card>

      {canManageStaff && (
        <Card className="mt-4">
          <h2 className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-ink-2 uppercase">
            <RotateCcw size={13} strokeWidth={2} />
            Sample data
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-ink-2">
            Everything in this portal is invented sample data held in your
            browser. Resetting puts it back exactly as it started — useful
            before showing the team, and the only way to undo a delete.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {resetArmed ? (
              <>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    resetData()
                    setResetArmed(false)
                  }}
                >
                  Yes, discard my changes
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setResetArmed(false)}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={() => setResetArmed(true)}>
                Reset sample data
              </Button>
            )}
          </div>
        </Card>
      )}

      <div className="mt-4">
        <Note>
          Sodiq (1st) carries both a Lagos listing role and Osun chapter
          duties, so he appears under Lagos with the second chapter noted. If
          the split is meant to be even, it is worth saying which is primary —
          his Lagos target and his Osun target are currently counted as though
          he were in one place.
        </Note>
      </div>
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
  const permissions = ROLE_PERMISSIONS[person.role]
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

      <dl className="mt-3 grid grid-cols-4 gap-2 border-t border-line pt-3">
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
