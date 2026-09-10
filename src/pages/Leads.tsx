import { useMemo, useState } from 'react'
import {
  CheckCheck,
  ClipboardList,
  Clock,
  Pencil,
  Plus,
  Star,
  Timer,
} from 'lucide-react'
import { useCurrentUser, useStore } from '../lib/storeContext'
import { can } from '../lib/permissions'
import { SLA_MINUTES, conversionRate, slaCompliance, unanswered } from '../lib/metrics'
import { displayName, naira, relative } from '../lib/format'
import {
  LEAD_SOURCE_LABEL,
  LEAD_STATUS_LABEL,
  LEAD_STATUS_ORDER,
} from '../lib/types'
import type { Lead, LeadStatus } from '../lib/types'
import {
  Badge,
  Button,
  Card,
  Empty,
  Note,
  PageHeader,
  Select,
  Stat,
  TableWrap,
  Td,
  Th,
  Tr,
  TextInput,
} from '../components/ui'
import type { BadgeTone } from '../components/ui'
import { LeadForm } from '../components/forms'
import { DiscussButton } from '../components/DiscussButton'

const STATUS_TONE: Record<LeadStatus, BadgeTone> = {
  NEW: 'warn',
  CONTACTED: 'neutral',
  VIEWING_SCHEDULED: 'info',
  NEGOTIATING: 'accent',
  CONVERTED: 'ok',
  LOST: 'neutral',
}

const ALL_STATUSES: LeadStatus[] = [...LEAD_STATUS_ORDER, 'LOST']

/**
 * The lead pipeline.
 *
 * Status values mirror Lead.status in the Prisma schema. The "qualified"
 * flag is the important column: the org document has Marketing generating
 * 150–200 qualified leads a month and the GM converting 25% of them, which
 * would be 37–50 closed deals against a target of 8–12 mandates. Those
 * cannot both be true, so qualification is one explicit flag with one
 * definition rather than two teams counting differently.
 */
export function Leads() {
  const me = useCurrentUser()
  const { leads, staffById, propertyById, setLeadStatus, toggleLeadQualified } = useStore()

  const canQualify = can(me.role, 'QUALIFY_LEAD')
  const canManage = can(me.role, 'MANAGE_LEADS')

  const [status, setStatus] = useState('ALL')
  const [owner, setOwner] = useState('ALL')
  const [onlyQualified, setOnlyQualified] = useState('ALL')
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Lead | null>(null)

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      if (status !== 'ALL' && l.status !== status) return false
      if (owner !== 'ALL' && l.ownerId !== owner) return false
      if (onlyQualified === 'YES' && !l.qualified) return false
      if (onlyQualified === 'NO' && l.qualified) return false
      if (query && !l.name.toLowerCase().includes(query.toLowerCase())) return false
      return true
    })
  }, [leads, status, owner, onlyQualified, query])

  const owners = [...new Set(leads.map((l) => l.ownerId))]
  const sla = slaCompliance(leads)
  const waiting = unanswered(leads)

  return (
    <>
      <PageHeader
        title="Leads"
        subtitle="Enquiries from the website, referrals and campaigns"
        icon={ClipboardList}
        accent="blue"
        actions={
          canManage && (
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus size={15} />
              Log an enquiry
            </Button>
          )
        }
      />

      {creating && <LeadForm onClose={() => setCreating(false)} />}
      {editing && <LeadForm existing={editing} onClose={() => setEditing(null)} />}

      <div className="pl-stagger mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Qualified"
          value={leads.filter((l) => l.qualified).length}
          sub={`of ${leads.length} total enquiries`}
          accent="blue"
          icon={Star}
        />
        <Stat
          label="Conversion"
          value={`${conversionRate(leads)}%`}
          sub="Qualified leads that closed"
          tone={conversionRate(leads) >= 25 ? 'ok' : 'warn'}
          icon={CheckCheck}
        />
        <Stat
          label="Awaiting first reply"
          value={waiting.length}
          sub={`${SLA_MINUTES}-minute SLA`}
          tone={waiting.length > 0 ? 'danger' : 'ok'}
          icon={Clock}
        />
        <Stat
          label="SLA compliance"
          value={`${sla}%`}
          sub="Of leads that were answered"
          tone={sla >= 90 ? 'ok' : 'warn'}
          icon={Timer}
        />
      </div>

      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <TextInput
            ariaLabel="Search leads"
            value={query}
            onChange={setQuery}
            placeholder="Search name"
          />
          <Select ariaLabel="Filter by status" value={status} onChange={setStatus}>
            <option value="ALL">All statuses</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {LEAD_STATUS_LABEL[s]}
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
          <Select
            ariaLabel="Filter by qualification"
            value={onlyQualified}
            onChange={setOnlyQualified}
          >
            <option value="ALL">Qualified and not</option>
            <option value="YES">Qualified only</option>
            <option value="NO">Not qualified</option>
          </Select>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Empty>No leads match these filters.</Empty>
      ) : (
        <TableWrap>
          <table className="w-full min-w-[60rem] border-collapse">
            <thead>
              <tr>
                <Th>Lead</Th>
                <Th>Interest</Th>
                <Th>Budget</Th>
                <Th>Source</Th>
                <Th>First reply</Th>
                <Th>Owner</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => {
                const ownerStaff = staffById(l.ownerId)
                const property = propertyById(l.propertyId)
                const late =
                  l.firstResponseMins !== null && l.firstResponseMins > SLA_MINUTES
                return (
                  <Tr key={l.id} className="align-top">
                    <Td>
                      <span className="flex items-center gap-1.5">
                        {canQualify ? (
                          <button
                            type="button"
                            onClick={() => toggleLeadQualified(l.id)}
                            aria-label={
                              l.qualified ? 'Remove qualified flag' : 'Mark as qualified'
                            }
                            title={
                              l.qualified
                                ? 'Qualified: budget, timeline and interest confirmed'
                                : 'Not qualified'
                            }
                            className="rounded p-0.5 transition-colors hover:bg-surface-2"
                          >
                            <Star
                              size={14}
                              strokeWidth={1.75}
                              className={
                                l.qualified
                                  ? 'fill-accent text-accent'
                                  : 'text-ink-3'
                              }
                            />
                          </button>
                        ) : (
                          l.qualified && (
                            <Star size={14} className="fill-accent text-accent" />
                          )
                        )}
                        <span className="font-medium text-ink">{l.name}</span>
                        <DiscussButton kind="LEAD" id={l.id} compact />
                        {canManage && (
                          <button
                            type="button"
                            onClick={() => setEditing(l)}
                            aria-label={`Edit ${l.name}`}
                            title="Edit"
                            className="rounded p-1 text-ink-3 transition-colors hover:bg-surface-2 hover:text-primary"
                          >
                            <Pencil size={12} strokeWidth={2} />
                          </button>
                        )}
                      </span>
                      <span className="mt-0.5 block text-xs text-ink-3">{l.phone}</span>
                      {l.notes && (
                        <span className="mt-1 block max-w-xs text-xs text-ink-3">
                          {l.notes}
                        </span>
                      )}
                    </Td>
                    <Td>
                      <span className="text-xs text-ink-2">
                        {property ? property.title : '—'}
                      </span>
                    </Td>
                    <Td className="whitespace-nowrap">
                      {l.budgetNaira ? naira(l.budgetNaira) : <span className="text-ink-3">—</span>}
                    </Td>
                    <Td>
                      <Badge>{LEAD_SOURCE_LABEL[l.source]}</Badge>
                    </Td>
                    <Td className="whitespace-nowrap">
                      {l.firstResponseMins === null ? (
                        <span className="inline-flex items-center gap-1 text-xs text-[color:var(--color-danger)]">
                          <Clock size={13} />
                          waiting {relative(l.createdAt).replace(' ago', '')}
                        </span>
                      ) : (
                        <span
                          className={`text-xs ${late ? 'text-[color:var(--color-warn)]' : 'text-ink-2'}`}
                        >
                          {l.firstResponseMins} min
                        </span>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap">
                      <span className="text-xs text-ink-2">
                        {ownerStaff ? displayName(ownerStaff) : '—'}
                      </span>
                    </Td>
                    <Td>
                      {canManage ? (
                        <Select
                          ariaLabel={`Status for ${l.name}`}
                          value={l.status}
                          onChange={(v) => setLeadStatus(l.id, v as LeadStatus)}
                          className="min-w-[10rem] py-1 text-xs"
                        >
                          {ALL_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {LEAD_STATUS_LABEL[s]}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <Badge tone={STATUS_TONE[l.status]}>
                          {LEAD_STATUS_LABEL[l.status]}
                        </Badge>
                      )}
                    </Td>
                  </Tr>
                )
              })}
            </tbody>
          </table>
        </TableWrap>
      )}

      <div className="mt-6">
        <Note>
          <strong className="font-semibold">Qualified</strong> means all three:
          budget confirmed, timeline stated, and a specific property or service
          named. Anything else is an enquiry. Marketing and the General Manager
          read this one flag so the lead-generation number and the conversion
          denominator can never drift apart.
        </Note>
      </div>
    </>
  )
}
