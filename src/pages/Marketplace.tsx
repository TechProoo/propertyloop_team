import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  BadgeCheck,
  Package,
  Store as StoreIcon,
  Wallet,
} from 'lucide-react'
import api, { apiErrorMessage } from '../lib/api'
import { nairaFull } from '../lib/format'
import {
  Badge,
  Button,
  Card,
  Empty,
  Modal,
  Note,
  NumberInput,
  PageHeader,
  Select,
  Stat,
  Td,
  TableWrap,
  Textarea,
  Th,
  Toggle,
  Tr,
} from '../components/ui'
import type { BadgeTone } from '../components/ui'

/* ─── Types mirroring the backend admin payloads ─────────────────────── */

type Summary = {
  stores: number
  activeStores: number
  openDisputes: number
  paidOrders: number
  gmvNaira: number
  commissionNaira: number
  vendorPaidOutNaira: number
  vendorOwedNaira: number
  refundedNaira: number
}

type AdminStore = {
  id: string
  slug: string
  name: string
  category: string
  owner: { id: string; name: string; email: string } | null
  commissionPct: number
  commissionPctOverride: number | null
  verified: boolean
  active: boolean
  ordersFulfilled: number
  products: number
}

type OrderItem = {
  name: string
  storeName: string
  category: string
  quantity: number
  unitPrice: number
  commissionPct: number
  commissionNaira: number
  vendorNetNaira: number
  payoutStatus: 'PAID_OUT' | 'OWED' | 'REFUNDED'
}

type AdminOrder = {
  id: string
  orderNumber: string
  status: string
  buyerName: string
  buyerEmail: string
  total: number
  refundedNaira: number
  hasOwedPayout: boolean
  placedAt: string
  items: OrderItem[]
}

type Dispute = {
  id: string
  status: 'OPEN' | 'RESOLVED_REFUND' | 'RESOLVED_REJECTED' | 'CANCELLED'
  reason: string
  details: string
  refundNaira: number
  resolutionNote?: string
  createdAt: string
  order?: {
    id: string
    orderNumber: string
    buyerName: string
    total: number
    refundedNaira: number
    status: string
    items: { name: string; storeName: string; quantity: number; unitPrice: number }[]
  }
}

const ORDER_STATUS_TONE: Record<string, BadgeTone> = {
  PENDING: 'neutral',
  PAID: 'ok',
  FULFILLED: 'info',
  DISPUTED: 'warn',
  REFUNDED: 'danger',
  CANCELLED: 'neutral',
}

type Tab = 'disputes' | 'orders' | 'stores'

export function Marketplace() {
  const [tab, setTab] = useState<Tab>('disputes')
  const [summary, setSummary] = useState<Summary | null>(null)

  const loadSummary = useCallback(() => {
    api
      .get<Summary>('/marketplace/admin/summary')
      .then((r) => setSummary(r.data))
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    loadSummary()
  }, [loadSummary])

  return (
    <>
      <PageHeader
        title="Marketplace"
        subtitle="Stores, orders, payouts, refunds and disputes across the product marketplace."
        icon={StoreIcon}
        accent="gold"
      />

      {summary && (
        <div className="pl-stagger mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Gross sales"
            value={nairaFull(summary.gmvNaira)}
            sub={`${summary.paidOrders} paid orders`}
            accent="green"
            icon={Package}
          />
          <Stat
            label="Commission earned"
            value={nairaFull(summary.commissionNaira)}
            sub="PropertyLoop's share"
            tone="ok"
            icon={Wallet}
          />
          <Stat
            label="Owed to vendors"
            value={nairaFull(summary.vendorOwedNaira)}
            sub="Awaiting manual settlement"
            tone={summary.vendorOwedNaira > 0 ? 'warn' : 'default'}
            icon={Wallet}
          />
          <Stat
            label="Open disputes"
            value={summary.openDisputes}
            sub={`${nairaFull(summary.refundedNaira)} refunded to date`}
            tone={summary.openDisputes > 0 ? 'danger' : 'default'}
            icon={AlertTriangle}
          />
        </div>
      )}

      <div className="mb-4 flex gap-2">
        {(
          [
            ['disputes', 'Disputes'],
            ['orders', 'Orders'],
            ['stores', 'Stores'],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors ${
              tab === key
                ? 'bg-primary text-white'
                : 'border border-line bg-surface text-ink-2 hover:text-primary'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'disputes' && <DisputesTab onChange={loadSummary} />}
      {tab === 'orders' && <OrdersTab onChange={loadSummary} />}
      {tab === 'stores' && <StoresTab onChange={loadSummary} />}
    </>
  )
}

/* ─── Disputes ───────────────────────────────────────────────────────── */

function DisputesTab({ onChange }: { onChange: () => void }) {
  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [loading, setLoading] = useState(true)
  const [resolving, setResolving] = useState<Dispute | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    api
      .get<Dispute[]>('/marketplace/admin/disputes')
      .then((r) => setDisputes(r.data))
      .catch(() => setDisputes([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <Empty>Loading disputes…</Empty>
  if (disputes.length === 0) return <Empty>No disputes. All clear.</Empty>

  return (
    <>
      <div className="grid gap-3">
        {disputes.map((d) => (
          <Card key={d.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-ink">{d.reason}</span>
                  <DisputeBadge status={d.status} />
                </div>
                <p className="mt-1 text-sm text-ink-2">{d.details}</p>
                {d.order && (
                  <p className="mt-1.5 text-xs text-ink-3">
                    Order {d.order.orderNumber} · {d.order.buyerName} ·{' '}
                    {nairaFull(d.order.total)}
                    {d.order.refundedNaira > 0 &&
                      ` · ${nairaFull(d.order.refundedNaira)} refunded`}
                  </p>
                )}
                {d.resolutionNote && (
                  <p className="mt-1 text-xs text-ink-3 italic">
                    Note: {d.resolutionNote}
                  </p>
                )}
              </div>
              {d.status === 'OPEN' && (
                <Button variant="primary" size="sm" onClick={() => setResolving(d)}>
                  Resolve
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      {resolving && (
        <ResolveDisputeModal
          dispute={resolving}
          onClose={() => setResolving(null)}
          onDone={() => {
            setResolving(null)
            load()
            onChange()
          }}
        />
      )}
    </>
  )
}

function DisputeBadge({ status }: { status: Dispute['status'] }) {
  const map: Record<Dispute['status'], { tone: BadgeTone; label: string }> = {
    OPEN: { tone: 'warn', label: 'Open' },
    RESOLVED_REFUND: { tone: 'ok', label: 'Refunded' },
    RESOLVED_REJECTED: { tone: 'neutral', label: 'Rejected' },
    CANCELLED: { tone: 'neutral', label: 'Cancelled' },
  }
  const m = map[status]
  return <Badge tone={m.tone}>{m.label}</Badge>
}

function ResolveDisputeModal({
  dispute,
  onClose,
  onDone,
}: {
  dispute: Dispute
  onClose: () => void
  onDone: () => void
}) {
  const remaining = dispute.order
    ? dispute.order.total - dispute.order.refundedNaira
    : 0
  const [action, setAction] = useState<'refund' | 'reject'>('refund')
  const [partial, setPartial] = useState(false)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      await api.post(`/marketplace/admin/disputes/${dispute.id}/resolve`, {
        action,
        ...(action === 'refund' && partial && amount
          ? { refundNaira: Number(amount) }
          : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      })
      onDone()
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not resolve the dispute.'))
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Resolve dispute"
      subtitle={dispute.order ? `Order ${dispute.order.orderNumber}` : undefined}
      accent="gold"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={action === 'refund' ? 'primary' : 'danger'}
            onClick={submit}
            disabled={busy}
          >
            {busy
              ? 'Working…'
              : action === 'refund'
                ? 'Issue refund'
                : 'Reject dispute'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-2">
          <Toggle checked={action === 'refund'} onChange={() => setAction('refund')}>
            Refund the buyer
          </Toggle>
          <Toggle checked={action === 'reject'} onChange={() => setAction('reject')}>
            Reject
          </Toggle>
        </div>

        {action === 'refund' && (
          <>
            <Note>
              A full refund returns {nairaFull(remaining)} to the buyer. If a
              vendor was already paid their split, the refund is drawn from
              PropertyLoop's balance — recover it from the vendor separately.
            </Note>
            <div className="flex gap-2">
              <Toggle checked={!partial} onChange={() => setPartial(false)}>
                Full refund
              </Toggle>
              <Toggle checked={partial} onChange={() => setPartial(true)}>
                Partial
              </Toggle>
            </div>
            {partial && (
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold tracking-wider text-ink-3 uppercase">
                  Refund amount (₦), max {nairaFull(remaining)}
                </span>
                <NumberInput
                  value={amount}
                  onChange={setAmount}
                  placeholder="e.g. 50000"
                  ariaLabel="Refund amount"
                />
              </label>
            )}
          </>
        )}

        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold tracking-wider text-ink-3 uppercase">
            Note to the buyer (optional)
          </span>
          <Textarea
            value={note}
            onChange={setNote}
            placeholder="Briefly explain the decision."
            ariaLabel="Resolution note"
          />
        </label>

        {error && <p className="text-sm text-rose-ink">{error}</p>}
      </div>
    </Modal>
  )
}

/* ─── Orders ─────────────────────────────────────────────────────────── */

function OrdersTab({ onChange }: { onChange: () => void }) {
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('ALL')
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    const q = status === 'ALL' ? '' : `?status=${status}`
    api
      .get<{ items: AdminOrder[] }>(`/marketplace/admin/orders${q}`)
      .then((r) => setOrders(r.data.items))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false))
  }, [status])

  useEffect(() => {
    load()
  }, [load])

  async function refund(order: AdminOrder) {
    if (
      !window.confirm(
        `Refund the full remaining amount on ${order.orderNumber} to ${order.buyerName}?`,
      )
    )
      return
    setBusyId(order.id)
    try {
      await api.post(`/marketplace/admin/orders/${order.id}/refund`, {})
      load()
      onChange()
    } catch (e) {
      alert(apiErrorMessage(e, 'Refund failed.'))
    } finally {
      setBusyId(null)
    }
  }

  async function settle(order: AdminOrder) {
    if (
      !window.confirm(
        `Mark the owed payouts on ${order.orderNumber} as settled? Do this only after you have transferred the vendor their share.`,
      )
    )
      return
    setBusyId(order.id)
    try {
      await api.post(`/marketplace/admin/orders/${order.id}/settle-owed`, {})
      load()
      onChange()
    } catch (e) {
      alert(apiErrorMessage(e, 'Could not settle.'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Card>
      <div className="mb-3 max-w-xs">
        <Select ariaLabel="Filter orders by status" value={status} onChange={setStatus}>
          <option value="ALL">All statuses</option>
          <option value="PAID">Paid</option>
          <option value="FULFILLED">Fulfilled</option>
          <option value="DISPUTED">Disputed</option>
          <option value="REFUNDED">Refunded</option>
          <option value="PENDING">Pending</option>
        </Select>
      </div>

      {loading ? (
        <Empty>Loading orders…</Empty>
      ) : orders.length === 0 ? (
        <Empty>No orders match.</Empty>
      ) : (
        <TableWrap>
          <table className="w-full min-w-[56rem] border-collapse">
            <thead>
              <tr>
                <Th>Order</Th>
                <Th>Buyer</Th>
                <Th>Total</Th>
                <Th>Commission</Th>
                <Th>Status</Th>
                <Th className="text-right">Action</Th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const commission = o.items.reduce(
                  (s, i) => s + i.commissionNaira,
                  0,
                )
                return (
                  <Tr key={o.id} className="align-top">
                    <Td>
                      <span className="block font-medium text-ink">
                        {o.orderNumber}
                      </span>
                      <span className="mt-0.5 block text-xs text-ink-3">
                        {o.items.length} item{o.items.length === 1 ? '' : 's'}
                        {o.hasOwedPayout && ' · payout owed'}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-sm text-ink-2">{o.buyerName}</span>
                      <span className="mt-0.5 block text-xs text-ink-3">
                        {o.buyerEmail}
                      </span>
                    </Td>
                    <Td className="whitespace-nowrap">
                      {nairaFull(o.total)}
                      {o.refundedNaira > 0 && (
                        <span className="mt-0.5 block text-xs text-rose-ink">
                          −{nairaFull(o.refundedNaira)} refunded
                        </span>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap text-sm text-ink-2">
                      {nairaFull(commission)}
                    </Td>
                    <Td>
                      <Badge tone={ORDER_STATUS_TONE[o.status] ?? 'neutral'}>
                        {o.status}
                      </Badge>
                    </Td>
                    <Td className="text-right whitespace-nowrap">
                      <div className="inline-flex flex-col items-end gap-1">
                        {o.hasOwedPayout && (
                          <Button
                            size="sm"
                            onClick={() => settle(o)}
                            disabled={busyId === o.id}
                          >
                            Settle owed
                          </Button>
                        )}
                        {(o.status === 'PAID' ||
                          o.status === 'FULFILLED' ||
                          o.status === 'DISPUTED') &&
                          o.refundedNaira < o.total && (
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => refund(o)}
                              disabled={busyId === o.id}
                            >
                              Refund
                            </Button>
                          )}
                      </div>
                    </Td>
                  </Tr>
                )
              })}
            </tbody>
          </table>
        </TableWrap>
      )}
    </Card>
  )
}

/* ─── Stores ─────────────────────────────────────────────────────────── */

function StoresTab({ onChange }: { onChange: () => void }) {
  const [stores, setStores] = useState<AdminStore[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<AdminStore | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    api
      .get<AdminStore[]>('/marketplace/admin/stores')
      .then((r) => setStores(r.data))
      .catch(() => setStores([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function patch(store: AdminStore, data: Partial<AdminStore>) {
    try {
      await api.patch(`/marketplace/admin/stores/${store.id}`, data)
      load()
      onChange()
    } catch (e) {
      alert(apiErrorMessage(e, 'Could not update the store.'))
    }
  }

  if (loading) return <Empty>Loading stores…</Empty>
  if (stores.length === 0) return <Empty>No stores yet.</Empty>

  return (
    <>
      <div className="grid gap-3">
        {stores.map((s) => (
          <Card key={s.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-ink">{s.name}</span>
                  {s.verified ? (
                    <Badge tone="ok">
                      <BadgeCheck size={11} className="mr-0.5" />
                      Verified
                    </Badge>
                  ) : (
                    <Badge tone="warn">Unverified</Badge>
                  )}
                  {!s.active && <Badge tone="danger">Suspended</Badge>}
                </div>
                <p className="mt-1 text-xs text-ink-3">
                  {s.category} · {s.products} products · {s.ordersFulfilled} fulfilled
                  {s.owner && ` · ${s.owner.email}`}
                </p>
                <p className="mt-1 text-xs text-ink-3">
                  Commission:{' '}
                  {s.commissionPctOverride !== null
                    ? `${s.commissionPctOverride}% (negotiated)`
                    : 'by category'}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Toggle
                  checked={s.verified}
                  onChange={(v) => patch(s, { verified: v })}
                >
                  Verified
                </Toggle>
                <Toggle
                  checked={s.active}
                  onChange={(v) => patch(s, { active: v })}
                >
                  Active
                </Toggle>
                <Button size="sm" onClick={() => setEditing(s)}>
                  Commission
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {editing && (
        <CommissionModal
          store={editing}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null)
            load()
            onChange()
          }}
        />
      )}
    </>
  )
}

function CommissionModal({
  store,
  onClose,
  onDone,
}: {
  store: AdminStore
  onClose: () => void
  onDone: () => void
}) {
  const [value, setValue] = useState(
    store.commissionPctOverride !== null ? String(store.commissionPctOverride) : '',
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(clear: boolean) {
    setBusy(true)
    setError(null)
    try {
      await api.patch(`/marketplace/admin/stores/${store.id}`, {
        commissionPctOverride: clear ? null : Number(value),
      })
      onDone()
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not save.'))
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Negotiated commission"
      subtitle={store.name}
      accent="gold"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => save(true)} disabled={busy}>
            Clear (use category rates)
          </Button>
          <Button variant="primary" onClick={() => save(false)} disabled={busy || !value}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <Note>
          Leave blank and clear to charge the standard rate for each product's
          category. A number here overrides every category for this store.
        </Note>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold tracking-wider text-ink-3 uppercase">
            Commission percent
          </span>
          <NumberInput
            value={value}
            onChange={setValue}
            placeholder="e.g. 5"
            ariaLabel="Commission percent"
          />
        </label>
        {error && <p className="text-sm text-rose-ink">{error}</p>}
      </div>
    </Modal>
  )
}
