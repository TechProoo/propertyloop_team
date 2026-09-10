import { useMemo, useState } from 'react'
import {
  AlertCircle,
  Award,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Handshake,
  Pencil,
  Plus,
  RotateCcw,
  Wallet,
} from 'lucide-react'
import { useCurrentUser, useStore } from '../lib/storeContext'
import { can } from '../lib/permissions'
import { dealActionOverdue, dealIsStale } from '../lib/metrics'
import { displayName, dueLabel, naira, relative } from '../lib/format'
import {
  DEAL_KIND_LABEL,
  DEAL_STAGE_LABEL,
  DEAL_STAGE_ORDER,
  MANDATE_LABEL,
} from '../lib/types'
import type { Deal, DealStage, MandateType } from '../lib/types'
import { DealForm } from '../components/forms'
import { DiscussButton } from '../components/DiscussButton'
import {
  Badge,
  Button,
  Card,
  Empty,
  Note,
  PageHeader,
  Select,
  Stat,
  TextInput,
} from '../components/ui'

const MANDATE_TONE: Record<MandateType, 'ok' | 'info' | 'neutral'> = {
  EXCLUSIVE: 'ok',
  PRIMARY: 'info',
  OPEN: 'neutral',
  NONE: 'neutral',
}

/**
 * The developer, advertiser and B2B pipeline.
 *
 * Nothing here exists in the product database — there is no Developer,
 * Advertiser or FacilityClient model in the Prisma schema. That absence is
 * precisely why this pipeline belongs in the staff portal rather than being
 * duplicated from something the website already owns.
 */
export function Deals() {
  const me = useCurrentUser()
  const { deals, staffById, moveDeal } = useStore()
  const editable = can(me.role, 'MANAGE_DEALS')
  const seesRevenue = can(me.role, 'VIEW_REVENUE')

  const [kind, setKind] = useState('ALL')
  const [owner, setOwner] = useState('ALL')
  const [chapter, setChapter] = useState('ALL')
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Deal | null>(null)

  const filtered = useMemo(() => {
    return deals.filter((d) => {
      if (kind !== 'ALL' && d.kind !== kind) return false
      if (owner !== 'ALL' && d.ownerId !== owner) return false
      if (chapter !== 'ALL' && d.chapter !== chapter) return false
      if (query) {
        const q = query.toLowerCase()
        if (
          !d.company.toLowerCase().includes(q) &&
          !d.contactName.toLowerCase().includes(q)
        ) {
          return false
        }
      }
      return true
    })
  }, [deals, kind, owner, chapter, query])

  const live = filtered.filter((d) => d.stage !== 'LOST')
  const lost = filtered.filter((d) => d.stage === 'LOST')

  const pipelineValue = live.reduce((n, d) => n + d.valueNaira, 0)
  const exclusives = live.filter((d) => d.mandate === 'EXCLUSIVE').length
  const stale = live.filter((d) => dealIsStale(d)).length
  const overdue = live.filter((d) => dealActionOverdue(d)).length

  const owners = [...new Set(deals.map((d) => d.ownerId))]

  return (
    <>
      <PageHeader
        title="Deals & mandates"
        subtitle="Developers, advertisers, facility management and realtor partnerships"
        icon={Handshake}
        accent="gold"
        actions={
          editable && (
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus size={15} />
              Add deal
            </Button>
          )
        }
      />

      {creating && <DealForm onClose={() => setCreating(false)} />}
      {editing && <DealForm existing={editing} onClose={() => setEditing(null)} />}

      <div className="pl-stagger mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label={seesRevenue ? 'Pipeline value' : 'Live deals'}
          value={seesRevenue ? naira(pipelineValue) : live.length}
          sub={
            seesRevenue
              ? `${live.length} live deals`
              : 'Deal values need revenue access'
          }
          accent="gold"
          icon={Wallet}
        />
        <Stat
          label="Exclusive mandates"
          value={exclusives}
          sub="Target: 3 per month"
          tone={exclusives >= 3 ? 'ok' : 'warn'}
          icon={Award}
        />
        <Stat
          label="Overdue actions"
          value={overdue}
          sub="Next action date has passed"
          tone={overdue > 0 ? 'danger' : 'default'}
          icon={AlertCircle}
        />
        <Stat
          label="Stale"
          value={stale}
          sub="No activity in over 7 days"
          tone={stale > 0 ? 'warn' : 'default'}
          icon={Clock3}
        />
      </div>

      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <TextInput
            ariaLabel="Search deals"
            value={query}
            onChange={setQuery}
            placeholder="Search company or contact"
          />
          <Select ariaLabel="Filter by kind" value={kind} onChange={setKind}>
            <option value="ALL">All kinds</option>
            {Object.entries(DEAL_KIND_LABEL).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </Select>
          <Select ariaLabel="Filter by owner" value={owner} onChange={setOwner}>
            <option value="ALL">All owners</option>
            {owners.map((id) => {
              const s = staffById(id)
              return (
                <option key={id} value={id}>
                  {s ? displayName(s) : id}
                </option>
              )
            })}
          </Select>
          <Select ariaLabel="Filter by chapter" value={chapter} onChange={setChapter}>
            <option value="ALL">All chapters</option>
            <option value="LAGOS">Lagos</option>
            <option value="OSUN">Osun</option>
          </Select>
        </div>
      </Card>

      {live.length === 0 ? (
        <Empty>No deals match these filters.</Empty>
      ) : (
        <div className="pl-stagger flex gap-3 overflow-x-auto pb-3">
          {DEAL_STAGE_ORDER.map((stage) => {
            const column = live.filter((d) => d.stage === stage)
            const value = column.reduce((n, d) => n + d.valueNaira, 0)
            return (
              <div key={stage} className="w-72 shrink-0">
                <div className="mb-2 flex items-baseline justify-between gap-2 px-1">
                  <h2 className="text-xs font-semibold tracking-wide text-ink uppercase">
                    {DEAL_STAGE_LABEL[stage]}
                  </h2>
                  <span className="text-xs text-ink-3">
                    {column.length}
                    {seesRevenue && value > 0 && ` · ${naira(value)}`}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {column.map((d) => (
                    <DealCard
                      key={d.id}
                      deal={d}
                      editable={editable}
                      seesRevenue={seesRevenue}
                      onMove={(next) => moveDeal(d.id, next)}
                      onEdit={() => setEditing(d)}
                    />
                  ))}
                  {column.length === 0 && (
                    <div className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-xs text-ink-3">
                      Empty
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {lost.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-xs font-semibold tracking-wide text-ink-3 uppercase">
            Lost ({lost.length})
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {lost.map((d) => (
              <div
                key={d.id}
                className="rounded-2xl border border-line bg-surface p-3 opacity-60 transition-opacity hover:opacity-100"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-medium text-ink">{d.company}</div>
                  {editable && (
                    <span className="flex shrink-0 gap-0.5">
                      <button
                        type="button"
                        onClick={() => setEditing(d)}
                        aria-label={`Edit ${d.company}`}
                        title="Edit"
                        className="rounded p-1 text-ink-3 transition-colors hover:bg-surface-2 hover:text-primary"
                      >
                        <Pencil size={12} strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveDeal(d.id, 'IDENTIFIED')}
                        title="Reopen this deal"
                        className="rounded p-1 text-ink-3 transition-colors hover:bg-surface-2 hover:text-primary"
                      >
                        <RotateCcw size={12} strokeWidth={2} />
                      </button>
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-xs text-ink-3">{d.notes}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6">
        <Note>
          Developers, advertisers and B2B clients have no model in the Prisma
          schema, so this pipeline is the only record of them. Properties that
          arrive through a signed mandate link back to the deal that produced
          them — that link is what makes a mandate measurable rather than
          asserted.
        </Note>
      </div>
    </>
  )
}

function DealCard({
  deal,
  editable,
  seesRevenue,
  onMove,
  onEdit,
}: {
  deal: Deal
  editable: boolean
  seesRevenue: boolean
  onMove: (stage: DealStage) => void
  onEdit: () => void
}) {
  const { staffById } = useStore()
  const owner = staffById(deal.ownerId)
  const idx = DEAL_STAGE_ORDER.indexOf(deal.stage)
  const overdue = dealActionOverdue(deal)
  const stale = dealIsStale(deal)

  return (
    <article className="group rounded-2xl border border-line bg-surface p-3 shadow-[var(--shadow-tile)] transition-all duration-200 hover:-translate-y-0.5 hover:border-gold/40 hover:shadow-[var(--shadow-lift)]">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm leading-snug font-medium text-ink">{deal.company}</h3>
        {seesRevenue && (
          <span className="shrink-0 text-xs font-medium text-ink-2">
            {naira(deal.valueNaira)}
          </span>
        )}
      </div>

      <div className="mt-1 text-xs text-ink-3">
        {deal.contactName}
        {deal.contactPhone && ` · ${deal.contactPhone}`}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <Badge>{DEAL_KIND_LABEL[deal.kind]}</Badge>
        {deal.mandate !== 'NONE' && (
          <Badge tone={MANDATE_TONE[deal.mandate]}>{MANDATE_LABEL[deal.mandate]}</Badge>
        )}
        {deal.chapter === 'OSUN' && <Badge tone="info">Osun</Badge>}
        {deal.expectedUnits > 0 && <Badge>{deal.expectedUnits} units</Badge>}
      </div>

      {deal.nextAction && (
        <div
          className={`mt-2.5 flex items-start gap-1.5 text-xs ${
            overdue ? 'text-[color:var(--color-danger)]' : 'text-ink-2'
          }`}
        >
          {overdue && <AlertCircle size={13} className="mt-0.5 shrink-0" />}
          <span>
            {deal.nextAction}
            {deal.nextActionAt && (
              <span className="text-ink-3"> · {dueLabel(deal.nextActionAt)}</span>
            )}
          </span>
        </div>
      )}

      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-line pt-2.5">
        <span className="truncate text-[11px] text-ink-3">
          {owner ? displayName(owner) : '—'} ·{' '}
          <span className={stale ? 'text-[color:var(--color-warn)]' : ''}>
            {relative(deal.lastActivityAt)}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-0.5">
          <DiscussButton kind="DEAL" id={deal.id} compact />
          {editable && (
            <button
              type="button"
              onClick={onEdit}
              aria-label={`Edit ${deal.company}`}
              title="Edit"
              className="rounded p-1 text-ink-3 transition-colors hover:bg-surface-2 hover:text-primary"
            >
              <Pencil size={12} strokeWidth={2} />
            </button>
          )}
        </span>
        {editable && (
          <span className="flex shrink-0 gap-1">
            <button
              type="button"
              aria-label="Move back a stage"
              disabled={idx <= 0}
              onClick={() => onMove(DEAL_STAGE_ORDER[idx - 1])}
              className="rounded p-1 text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-25 disabled:hover:bg-transparent"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              aria-label="Advance a stage"
              disabled={idx < 0 || idx >= DEAL_STAGE_ORDER.length - 1}
              onClick={() => onMove(DEAL_STAGE_ORDER[idx + 1])}
              className="rounded p-1 text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-25 disabled:hover:bg-transparent"
            >
              <ChevronRight size={14} />
            </button>
          </span>
        )}
      </div>
    </article>
  )
}
