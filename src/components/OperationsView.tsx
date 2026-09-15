import { Link } from 'react-router-dom'
import {
  Banknote,
  Handshake,
  Hourglass,
  IdCard,
  Inbox,
  Scale,
  Timer,
  UserX,
} from 'lucide-react'
import { useCurrentUser, useStore } from '../lib/storeContext'
import {
  missedLogDays,
  partnerSnapshot,
  slaCompliance,
  staffScore,
  unanswered,
} from '../lib/metrics'
import { displayName, initials, isoDate, relative } from '../lib/format'
import { OPS_KIND_LABEL, STAFF_ROLE_SHORT } from '../lib/types'
import type { OpsItem, OpsKind } from '../lib/types'
import { Avatar, Badge, Card, Empty, SectionTitle, Stat } from './ui'

/**
 * The Operations Manager's dashboard.
 *
 * The owner's view answers "how is the company doing"; this one answers the
 * questions an operations manager is held to: is the queue moving, is anything
 * sitting without an owner, are the promises to customers and partners being
 * kept, and is the team working it actually filing and keeping up.
 */

/** Queues in the order they cost the most when ignored. */
const KIND_ORDER: OpsKind[] = [
  'DISPUTE',
  'WITHDRAWAL',
  'KYC',
  'ENQUIRY',
  'REPORT',
  'LISTING_REVIEW',
  'TASK',
]

/** The last seven calendar days, today first. */
function lastSevenDays(now: Date = new Date()): string[] {
  return Array.from({ length: 7 }, (_, i) => isoDate(new Date(now.getTime() - i * 86_400_000)))
}

function oldestOpen(items: OpsItem[]): OpsItem | null {
  return items.reduce<OpsItem | null>(
    (oldest, o) => (!oldest || o.openedAt < oldest.openedAt ? o : oldest),
    null,
  )
}

export function OperationsView() {
  const me = useCurrentUser()
  const { ops, leads, partners, logs, staff, targets } = useStore()

  const open = ops.filter((o) => !o.resolved)
  const unassigned = open.filter((o) => o.assigneeId === null)
  const urgent = open.filter((o) => o.urgent)
  const oldest = oldestOpen(open)
  const partnersSnap = partnerSnapshot(partners)
  const waitingLeads = unanswered(leads).length

  const days = lastSevenDays()
  const today = days[0]
  // The manager and everyone reporting to them. Deactivated people are
  // history, not workload.
  const team = staff.filter((s) => s.active && (s.id === me.id || s.reportsTo === me.id))
  const reports = team.filter((s) => s.id !== me.id)

  const byKind = KIND_ORDER.map((kind) => {
    const items = open.filter((o) => o.kind === kind)
    return {
      kind,
      open: items.length,
      unassigned: items.filter((o) => o.assigneeId === null).length,
      urgent: items.filter((o) => o.urgent).length,
    }
  }).filter((k) => k.open > 0)

  return (
    <>
      <SectionTitle
        accent="rose"
        hint="The queue, the people working it, and the promises being kept"
      >
        Operations
      </SectionTitle>

      <div className="pl-stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Open items"
          value={open.length}
          sub={`${urgent.length} urgent · across every queue`}
          to="/ops"
          tone={urgent.length > 0 ? 'warn' : 'default'}
          accent="blue"
          icon={Inbox}
        />
        <Stat
          label="No owner"
          value={unassigned.length}
          sub="Open items nobody is assigned to"
          to="/ops"
          tone={unassigned.length > 0 ? 'danger' : 'ok'}
          icon={UserX}
        />
        <Stat
          label="Oldest open"
          value={oldest ? relative(oldest.openedAt) : '—'}
          sub={oldest ? oldest.subject : 'Nothing waiting'}
          to="/ops"
          icon={Hourglass}
        />
        <Stat
          label="Enquiry SLA"
          value={`${slaCompliance(leads)}%`}
          sub={`Answered within 30 minutes · ${waitingLeads} unanswered`}
          to="/leads"
          tone={waitingLeads > 0 ? 'warn' : 'ok'}
          icon={Timer}
        />
      </div>

      <div className="pl-stagger mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="KYC waiting"
          value={open.filter((o) => o.kind === 'KYC').length}
          sub="Identity checks to review"
          to="/ops"
          accent="blue"
          icon={IdCard}
        />
        <Stat
          label="Escrow disputes"
          value={open.filter((o) => o.kind === 'DISPUTE').length}
          sub="Yours to resolve"
          to="/ops"
          tone={open.some((o) => o.kind === 'DISPUTE') ? 'danger' : 'default'}
          icon={Scale}
        />
        <Stat
          label="Partners not contacted"
          value={partnersSnap.overdueContact}
          sub={`Past the 48-hour promise · ${partnersSnap.unassigned} unassigned`}
          to="/partners"
          tone={partnersSnap.overdueContact > 0 ? 'warn' : 'ok'}
          accent="gold"
          icon={Handshake}
        />
        <Stat
          label="Payouts waiting"
          value={open.filter((o) => o.kind === 'WITHDRAWAL').length}
          sub="Approved by the MD, not operations"
          to="/ops"
          icon={Banknote}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card accent="teal">
          <SectionTitle
            accent="teal"
            hint="Open work, today's log and this week's missed logs for each person"
            action={
              <Link to="/logs" className="text-xs text-primary hover:underline">
                Daily logs
              </Link>
            }
          >
            Your team
          </SectionTitle>

          {reports.length === 0 && (
            <Empty>
              Nobody reports to you yet. Reporting lines are set on the Team screen.
            </Empty>
          )}

          <div className="flex flex-col gap-2">
            {team.map((person) => {
              const assigned = open.filter((o) => o.assigneeId === person.id)
              const filedToday = logs.some((l) => l.staffId === person.id && l.date === today)
              const missed = missedLogDays(person.id, logs, days.slice(1)).length
              const score = staffScore(targets, person.id)
              return (
                <div
                  key={person.id}
                  className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5"
                >
                  <Avatar initials={initials(person)} seed={person.id} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-ink">
                        {displayName(person)}
                      </span>
                      {person.id === me.id && <Badge tone="ok">you</Badge>}
                    </div>
                    <div className="truncate text-xs text-ink-3">
                      {STAFF_ROLE_SHORT[person.role]} · {assigned.length} open
                      {assigned.some((o) => o.urgent) &&
                        ` · ${assigned.filter((o) => o.urgent).length} urgent`}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      <Badge tone={filedToday ? 'ok' : 'warn'}>
                        {filedToday ? 'Log filed today' : 'No log today'}
                      </Badge>
                      {missed > 0 && (
                        <Badge tone="danger">
                          {missed} missed {missed === 1 ? 'day' : 'days'} this week
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-lg leading-none text-ink">
                      {score === null ? '—' : `${score}%`}
                    </div>
                    <div className="mt-1 text-[10px] text-ink-3">targets</div>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        <Card accent="rose">
          <SectionTitle
            accent="rose"
            hint="What is open in each queue, and how much of it has no owner"
            action={
              <Link to="/ops" className="text-xs text-primary hover:underline">
                Open the queue
              </Link>
            }
          >
            Queue by type
          </SectionTitle>

          {byKind.length === 0 ? (
            <Empty>The queue is clear.</Empty>
          ) : (
            <div className="flex flex-col gap-2">
              {byKind.map((k) => (
                <Link
                  key={k.kind}
                  to="/ops"
                  className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5 transition-all duration-150 hover:-translate-y-px hover:border-primary/40 hover:bg-surface-2/40"
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">
                    {OPS_KIND_LABEL[k.kind]}
                  </span>
                  <span className="flex shrink-0 flex-wrap justify-end gap-1">
                    {k.urgent > 0 && <Badge tone="danger">{k.urgent} urgent</Badge>}
                    {k.unassigned > 0 && <Badge tone="warn">{k.unassigned} no owner</Badge>}
                  </span>
                  <span className="font-display w-8 shrink-0 text-right text-lg leading-none text-ink">
                    {k.open}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  )
}
