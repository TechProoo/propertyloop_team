import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  Clock,
  Handshake,
  Phone,
  Share2,
  UserPlus,
  UserX,
} from 'lucide-react'
import { useStore } from '../lib/storeContext'
import { can } from '../lib/permissions'
import { useCurrentUser } from '../lib/storeContext'
import {
  PARTNER_CONTACT_SLA_HOURS,
  assignableStaff,
  partnerContactOverdue,
  partnerPayoutGaps,
  partnerSnapshot,
  partnersReferredBy,
} from '../lib/metrics'
import { displayName, relative, shortDate } from '../lib/format'
import {
  PARTNER_EXPERIENCE_LABEL,
  PARTNER_STATUS_LABEL,
  partnerPayoutReady,
} from '../lib/types'
import type { AgentPartner, PartnerStatus } from '../lib/types'
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
  TextInput,
  Tr,
} from '../components/ui'
import type { BadgeTone } from '../components/ui'

const STATUS_TONE: Record<PartnerStatus, BadgeTone> = {
  NEW: 'warn',
  CONTACTED: 'info',
  VERIFIED: 'teal',
  ACTIVE: 'ok',
  DORMANT: 'neutral',
  REJECTED: 'danger',
}

const ALL_STATUSES: PartnerStatus[] = [
  'NEW',
  'CONTACTED',
  'VERIFIED',
  'ACTIVE',
  'DORMANT',
  'REJECTED',
]

/**
 * Agent partners — everyone who registered at /realtors/partners.
 *
 * Nothing is created on this screen. Registration happens on the public site,
 * which is the point: a recruitment link that writes into a spreadsheet gives
 * you a list of names, and a link that writes into the product gives you
 * realtors who can list on day one. What a manager does here is work them.
 *
 * The two numbers this page exists to surface are the uncomfortable ones:
 * how many people registered and were never called, and how many verified
 * partners still cannot be paid.
 */
export function Partners() {
  const me = useCurrentUser()
  const {
    partners,
    staff,
    staffById,
    setPartnerStatus,
    assignPartner,
    logPartnerContact,
  } = useStore()

  const canManage = can(me, 'MANAGE_PARTNERS')
  const [status, setStatus] = useState('ALL')
  const [owner, setOwner] = useState('ALL')
  const [query, setQuery] = useState('')
  const [onlyProblems, setOnlyProblems] = useState(false)

  const snap = partnerSnapshot(partners)

  const filtered = useMemo(() => {
    return partners
      .filter((p) => {
        if (status !== 'ALL' && p.status !== status) return false
        if (owner === 'UNASSIGNED' && p.ownerId !== null) return false
        else if (owner !== 'ALL' && owner !== 'UNASSIGNED' && p.ownerId !== owner)
          return false
        if (onlyProblems) {
          const stuck =
            partnerContactOverdue(p) ||
            ((p.status === 'VERIFIED' || p.status === 'ACTIVE') &&
              !partnerPayoutReady(p))
          if (!stuck) return false
        }
        if (query) {
          const q = query.toLowerCase()
          if (
            !p.fullName.toLowerCase().includes(q) &&
            !p.code.toLowerCase().includes(q) &&
            !p.whatsapp.includes(q) &&
            !(p.agencyName ?? '').toLowerCase().includes(q)
          ) {
            return false
          }
        }
        return true
      })
      .sort(
        (a, b) =>
          new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime(),
      )
  }, [partners, status, owner, query, onlyProblems])

  return (
    <>
      <PageHeader
        title="Agent partners"
        subtitle="Everyone who registered through the partner link"
        icon={Handshake}
        accent="teal"
      />

      <div className="pl-stagger mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Registered"
          value={snap.total}
          sub={`${snap.registeredThisWeek} this week · ${snap.fromReferral} by referral`}
          accent="teal"
          icon={UserPlus}
        />
        <Stat
          label="Never contacted"
          value={snap.uncontacted}
          sub={`${snap.unassigned} have no owner`}
          tone={snap.uncontacted > 0 ? 'warn' : 'ok'}
          icon={Phone}
        />
        <Stat
          label={`Past the ${PARTNER_CONTACT_SLA_HOURS}h SLA`}
          value={snap.overdueContact}
          sub="Registered and still waiting"
          tone={snap.overdueContact > 0 ? 'danger' : 'ok'}
          icon={Clock}
        />
        <Stat
          label="Cannot be paid"
          value={snap.cannotBePaid}
          sub="Verified or active, payout details missing"
          tone={snap.cannotBePaid > 0 ? 'warn' : 'ok'}
          icon={Banknote}
        />
      </div>

      {snap.overdueContact > 0 && (
        <Card accent="rose" className="mb-4 border-rose/30">
          <div className="flex items-start gap-2.5">
            <AlertTriangle
              size={16}
              className="mt-0.5 shrink-0 text-[color:var(--color-danger)]"
            />
            <p className="text-sm leading-relaxed text-ink-2">
              <strong className="font-semibold text-ink">
                {snap.overdueContact}{' '}
                {snap.overdueContact === 1 ? 'partner has' : 'partners have'} been
                waiting longer than {PARTNER_CONTACT_SLA_HOURS} hours.
              </strong>{' '}
              The org document commits to onboarding every new realtor within
              that window. Someone who registers and hears nothing for a week
              does not come back — and they tell other realtors.
            </p>
          </div>
        </Card>
      )}

      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <TextInput
            ariaLabel="Search partners"
            value={query}
            onChange={setQuery}
            placeholder="Name, code, phone or agency"
          />
          <Select ariaLabel="Filter by status" value={status} onChange={setStatus}>
            <option value="ALL">All statuses</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PARTNER_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
          <Select ariaLabel="Filter by owner" value={owner} onChange={setOwner}>
            <option value="ALL">Anyone handling</option>
            <option value="UNASSIGNED">Nobody assigned</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {displayName(s)}
              </option>
            ))}
          </Select>
          <Button
            variant={onlyProblems ? 'primary' : 'secondary'}
            onClick={() => setOnlyProblems((v) => !v)}
          >
            {onlyProblems ? 'Showing stuck only' : 'Show stuck only'}
          </Button>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Empty>No partners match these filters.</Empty>
      ) : (
        <TableWrap>
          <table className="w-full min-w-[64rem] border-collapse">
            <thead>
              <tr>
                <Th>Partner</Th>
                <Th>Experience</Th>
                <Th>Where</Th>
                <Th>Referred by</Th>
                <Th>Payout</Th>
                <Th>Contact</Th>
                <Th>Handled by</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const ownerStaff = staffById(p.ownerId)
                const gaps = partnerPayoutGaps(p)
                const overdue = partnerContactOverdue(p)
                const brought = partnersReferredBy(partners, p.code).length
                return (
                  <Tr key={p.id} className="align-top">
                    <Td>
                      <span className="block font-medium text-ink">
                        {p.fullName}
                      </span>
                      <span className="mt-0.5 block font-mono text-[11px] text-teal">
                        {p.code}
                      </span>
                      <span className="mt-0.5 block text-xs text-ink-3">
                        {p.whatsapp}
                      </span>
                      {p.agencyName && (
                        <span className="mt-0.5 block text-xs text-ink-3">
                          {p.agencyName}
                        </span>
                      )}
                      {brought > 0 && (
                        <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-primary">
                          <Share2 size={10} />
                          brought {brought}
                        </span>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap">
                      <span className="text-xs text-ink-2">
                        {p.experience
                          ? PARTNER_EXPERIENCE_LABEL[p.experience]
                          : '—'}
                      </span>
                    </Td>
                    <Td className="whitespace-nowrap">
                      <span className="text-xs text-ink-2">
                        {p.operatingState ?? '—'}
                      </span>
                    </Td>
                    <Td className="whitespace-nowrap">
                      {p.referredByCode ? (
                        <span className="font-mono text-[11px] text-ink-2">
                          {p.referredByCode}
                        </span>
                      ) : (
                        <span className="text-xs text-ink-3">direct</span>
                      )}
                    </Td>
                    <Td>
                      {partnerPayoutReady(p) ? (
                        <Badge tone="ok">
                          <BadgeCheck size={11} className="mr-1" />
                          ready
                        </Badge>
                      ) : (
                        <span
                          title={`Missing: ${gaps.join(', ')}`}
                          className="text-xs text-[color:var(--color-warn)]"
                        >
                          {gaps.length} missing
                        </span>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap">
                      {p.lastContactAt ? (
                        <span className="text-xs text-ink-2">
                          {relative(p.lastContactAt)}
                        </span>
                      ) : (
                        <span
                          className={`text-xs ${
                            overdue
                              ? 'text-[color:var(--color-danger)]'
                              : 'text-ink-3'
                          }`}
                        >
                          never · reg. {shortDate(p.registeredAt)}
                        </span>
                      )}
                      {canManage && !p.lastContactAt && (
                        <Button
                          size="sm"
                          className="mt-1.5"
                          onClick={() => logPartnerContact(p.id)}
                        >
                          Log a call
                        </Button>
                      )}
                    </Td>
                    <Td>
                      {canManage ? (
                        <Select
                          ariaLabel={`Assign ${p.fullName}`}
                          value={p.ownerId ?? ''}
                          onChange={(v) => assignPartner(p.id, v || null)}
                          className="min-w-[9rem] py-1 text-xs"
                        >
                          <option value="">Nobody</option>
                          {assignableStaff(staff, p.ownerId).map((s) => (
                            <option key={s.id} value={s.id}>
                              {displayName(s)}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <span className="text-xs text-ink-2">
                          {ownerStaff ? displayName(ownerStaff) : '—'}
                        </span>
                      )}
                    </Td>
                    <Td>
                      {canManage ? (
                        <Select
                          ariaLabel={`Status for ${p.fullName}`}
                          value={p.status}
                          onChange={(v) =>
                            setPartnerStatus(p.id, v as PartnerStatus)
                          }
                          className="min-w-[8.5rem] py-1 text-xs"
                        >
                          {ALL_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {PARTNER_STATUS_LABEL[s]}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <Badge tone={STATUS_TONE[p.status]}>
                          {PARTNER_STATUS_LABEL[p.status]}
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
        <SectionTitle accent="teal" hint="Who is bringing other realtors in">
          Referral chain
        </SectionTitle>
        <ReferralChain partners={partners} />
        <DormantPartners />
      </div>

      <div className="mt-6">
        <Note>
          Nobody is created on this screen — registration happens at{' '}
          <strong>propertyloop.ng/realtors/partners</strong>, which creates a
          real account rather than a spreadsheet row, so a partner can list on
          the day they join. <strong>Verified</strong> is the gate for
          appearing in the public directory: an unvetted stranger with a
          PropertyLoop profile is the reputational risk this whole programme
          has to avoid.
        </Note>
      </div>
    </>
  )
}

/* ─── Referral chain ─────────────────────────────────────────────────── */

function ReferralChain({ partners }: { partners: AgentPartner[] }) {
  const recruiters = partners
    .map((p) => ({ partner: p, brought: partnersReferredBy(partners, p.code) }))
    .filter((r) => r.brought.length > 0)
    .sort((a, b) => b.brought.length - a.brought.length)

  if (recruiters.length === 0) {
    return <Empty>No partner has referred anyone yet.</Empty>
  }

  return (
    <div className="pl-stagger grid gap-2 md:grid-cols-2">
      {recruiters.map(({ partner, brought }) => (
        <Card key={partner.id} hover accent="teal">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-ink">
                {partner.fullName}
              </h3>
              <p className="mt-0.5 font-mono text-[11px] text-teal">
                {partner.code}
              </p>
            </div>
            <Badge tone="teal">
              {brought.length} referred
            </Badge>
          </div>
          <ul className="mt-3 flex flex-col gap-1.5 border-t border-line pt-3">
            {brought.map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span className="truncate text-ink-2">{b.fullName}</span>
                <Badge tone={STATUS_TONE[b.status]}>
                  {PARTNER_STATUS_LABEL[b.status]}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  )
}

/* ─── Dormant note ───────────────────────────────────────────────────── */

function DormantPartners() {
  const { partners } = useStore()
  const dormant = partners.filter(
    (p) => p.status === 'DORMANT' || p.status === 'REJECTED',
  )
  if (dormant.length === 0) return null
  return (
    <Card className="mt-4">
      <SectionTitle hint="Kept on file — we need the record of why">
        <UserX size={13} className="mr-1 inline" />
        Dormant and declined
      </SectionTitle>
      <ul className="flex flex-col gap-1.5">
        {dormant.map((p) => (
          <li key={p.id} className="text-xs text-ink-2">
            <strong className="font-medium text-ink">{p.fullName}</strong>{' '}
            <span className="text-ink-3">— {p.notes || 'no reason given'}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}
