import { useState } from 'react'
import {
  AlertTriangle,
  Banknote,
  Flame,
  Inbox,
  LifeBuoy,
  Plus,
  UserX,
} from 'lucide-react'
import { useCurrentUser, useStore } from '../lib/storeContext'
import { can } from '../lib/permissions'
import { displayName, naira, relative } from '../lib/format'
import { OPS_KIND_LABEL, OPS_KIND_SOURCE } from '../lib/types'
import type { OpsItem, OpsKind } from '../lib/types'
import {
  Badge,
  Button,
  Card,
  Empty,
  Note,
  PageHeader,
  SectionTitle,
  Select,
  Stat,
  TableWrap,
  Td,
  Th,
  Tr,
} from '../components/ui'
import type { BadgeTone } from '../components/ui'
import { NewTaskForm } from '../components/forms'

const KIND_TONE: Record<OpsKind, BadgeTone> = {
  KYC: 'info',
  WITHDRAWAL: 'danger',
  REPORT: 'warn',
  DISPUTE: 'danger',
  LISTING_REVIEW: 'neutral',
  ENQUIRY: 'accent',
  TASK: 'violet',
}

/**
 * The operations queue.
 *
 * Every row here corresponds to work already accumulating in the product
 * database — KycSubmission, WithdrawalRequest, Report, JobDisputeMessage —
 * and none of it is assigned to a position in the September 2026 org
 * document. Withdrawals in particular are a human manually transferring
 * money out of the business. Surfacing the unassigned count is the point of
 * the screen.
 */
export function Ops() {
  const me = useCurrentUser()
  const { ops, staff, staffById, assignOps, resolveOps } = useStore()

  const canReviewKyc = can(me.role, 'REVIEW_KYC')
  const canApprovePayout = can(me.role, 'APPROVE_WITHDRAWAL')
  const canResolveDispute = can(me.role, 'RESOLVE_DISPUTE')
  const canHandle = can(me.role, 'HANDLE_OPS')

  const [kind, setKind] = useState('ALL')
  const [showResolved, setShowResolved] = useState('OPEN')
  const [creating, setCreating] = useState(false)

  const filtered = ops.filter((o) => {
    if (kind !== 'ALL' && o.kind !== kind) return false
    if (showResolved === 'OPEN' && o.resolved) return false
    if (showResolved === 'DONE' && !o.resolved) return false
    return true
  })

  const open = ops.filter((o) => !o.resolved)
  const unassigned = open.filter((o) => o.assigneeId === null)
  const money = open
    .filter((o) => o.kind === 'WITHDRAWAL')
    .reduce((n, o) => n + (o.amountNaira ?? 0), 0)

  /** Whether the signed-in role is allowed to close this particular item. */
  function mayResolve(item: OpsItem): boolean {
    if (item.kind === 'KYC') return canReviewKyc
    if (item.kind === 'WITHDRAWAL') return canApprovePayout
    if (item.kind === 'DISPUTE') return canResolveDispute
    return can(me.role, 'HANDLE_OPS')
  }

  return (
    <>
      <PageHeader
        title="Operations"
        subtitle="Work arriving from the platform that needs a person"
        icon={LifeBuoy}
        accent="rose"
        actions={
          canHandle && (
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus size={15} />
              Add task
            </Button>
          )
        }
      />

      {creating && <NewTaskForm onClose={() => setCreating(false)} />}

      <div className="pl-stagger mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Open items"
          value={open.length}
          sub="Across every queue"
          accent="blue"
          icon={Inbox}
        />
        <Stat
          label="Unassigned"
          value={unassigned.length}
          sub="No owner in the org structure"
          tone={unassigned.length > 0 ? 'danger' : 'ok'}
          icon={UserX}
        />
        <Stat
          label="Urgent"
          value={open.filter((o) => o.urgent).length}
          sub="Flagged for same-day action"
          tone={open.some((o) => o.urgent) ? 'warn' : 'default'}
          icon={Flame}
        />
        <Stat
          label="Awaiting payout"
          value={naira(money)}
          sub="Manual transfers still to make"
          tone={money > 0 ? 'danger' : 'ok'}
          icon={Banknote}
        />
      </div>

      {unassigned.length > 0 && (
        <Card className="mb-4 border-[color:rgba(180,68,47,0.3)]">
          <div className="flex items-start gap-2.5">
            <AlertTriangle
              size={16}
              className="mt-0.5 shrink-0 text-[color:var(--color-danger)]"
            />
            <p className="text-sm leading-relaxed text-ink-2">
              <strong className="font-semibold text-ink">
                {unassigned.length} open {unassigned.length === 1 ? 'item has' : 'items have'}{' '}
                no owner.
              </strong>{' '}
              The org document assigns seven commercial positions and none of
              them to platform operations. Until somebody holds this queue by
              name, KYC submissions, user reports and vendor payouts wait for
              whoever happens to notice.
            </p>
          </div>
        </Card>
      )}

      <SectionTitle
        accent="rose"
        action={
          <div className="flex gap-2">
            <Select
              ariaLabel="Filter by kind"
              value={kind}
              onChange={setKind}
              className="w-auto py-1 text-xs"
            >
              <option value="ALL">All queues</option>
              {Object.entries(OPS_KIND_LABEL).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </Select>
            <Select
              ariaLabel="Filter by state"
              value={showResolved}
              onChange={setShowResolved}
              className="w-auto py-1 text-xs"
            >
              <option value="OPEN">Open</option>
              <option value="DONE">Resolved</option>
              <option value="ALL">Everything</option>
            </Select>
          </div>
        }
      >
        Queue
      </SectionTitle>

      {filtered.length === 0 ? (
        <Empty>Nothing in this queue.</Empty>
      ) : (
        <TableWrap>
          <table className="w-full min-w-[52rem] border-collapse">
            <thead>
              <tr>
                <Th>Item</Th>
                <Th>Queue</Th>
                <Th>Amount</Th>
                <Th>Waiting</Th>
                <Th>Assigned to</Th>
                <Th className="text-right">Action</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => {
                const allowed = mayResolve(o)
                return (
                  <Tr key={o.id} className={o.resolved ? 'opacity-55' : ''}>
                    <Td>
                      <span className="flex items-center gap-1.5">
                        {o.urgent && !o.resolved && (
                          <span
                            title="Urgent"
                            className="h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--color-danger)]"
                          />
                        )}
                        {o.subject}
                      </span>
                    </Td>
                    <Td>
                      <Badge tone={KIND_TONE[o.kind]}>{OPS_KIND_LABEL[o.kind]}</Badge>
                      <span className="mt-1 block font-mono text-[10px] text-ink-3">
                        {o.kind === 'TASK' ? 'manual' : OPS_KIND_SOURCE[o.kind]}
                      </span>
                    </Td>
                    <Td className="whitespace-nowrap">
                      {o.amountNaira ? (
                        <span className="font-medium">{naira(o.amountNaira)}</span>
                      ) : (
                        <span className="text-ink-3">—</span>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap">
                      <span className="text-xs text-ink-2">{relative(o.openedAt)}</span>
                    </Td>
                    <Td>
                      <Select
                        ariaLabel={`Assign ${o.subject}`}
                        value={o.assigneeId ?? ''}
                        onChange={(v) => assignOps(o.id, v || null)}
                        className="min-w-[9rem] py-1 text-xs"
                      >
                        <option value="">Unassigned</option>
                        {staff.map((s) => (
                          <option key={s.id} value={s.id}>
                            {displayName(s)}
                          </option>
                        ))}
                      </Select>
                    </Td>
                    <Td className="text-right whitespace-nowrap">
                      {allowed ? (
                        <Button
                          size="sm"
                          variant={o.resolved ? 'ghost' : 'primary'}
                          onClick={() => resolveOps(o.id)}
                        >
                          {o.resolved ? 'Reopen' : 'Resolve'}
                        </Button>
                      ) : (
                        <span
                          className="text-xs text-ink-3"
                          title={`Your role cannot close ${OPS_KIND_LABEL[o.kind].toLowerCase()} items`}
                        >
                          Not your queue
                        </span>
                      )}
                    </Td>
                  </Tr>
                )
              })}
            </tbody>
          </table>
        </TableWrap>
      )}

      <div className="pl-stagger mt-4 flex flex-wrap gap-2">
        {(Object.keys(OPS_KIND_LABEL) as OpsKind[]).map((k) => {
          const count = open.filter((o) => o.kind === k).length
          const assignee = [
            ...new Set(
              open
                .filter((o) => o.kind === k && o.assigneeId)
                .map((o) => staffById(o.assigneeId)?.id ?? ''),
            ),
          ]
          return (
            <div
              key={k}
              className="rounded-xl border border-line bg-surface px-3 py-2 shadow-[var(--shadow-tile)] transition-transform duration-150 hover:-translate-y-0.5"
            >
              <div className="text-xs font-medium text-ink">{OPS_KIND_LABEL[k]}</div>
              <div className="mt-0.5 text-[11px] text-ink-3">
                {count} open · {assignee.length === 0 ? 'nobody assigned' : `${assignee.length} owner(s)`}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-6">
        <Note>
          Payouts and KYC are gated separately from the rest of the queue. The
          person carrying the sales number should not also be the person who
          releases money, and identity documents should be seen by as few
          people as the work allows. The backend cannot enforce either split
          today — its admin check is a single <code>role !== ADMIN</code> test
          — so this separation is a design intention until staff permissions
          exist in the API.
        </Note>
      </div>
    </>
  )
}
