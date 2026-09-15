import { useState } from 'react'
import {
  CalendarClock,
  CheckCircle2,
  Clapperboard,
  Film,
  Pencil,
  Plus,
  RotateCcw,
  Sparkles,
  Video,
} from 'lucide-react'
import { useCurrentUser, useStore } from '../lib/storeContext'
import { can } from '../lib/permissions'
import { shootPrepLate, shootPrepOverdue } from '../lib/metrics'
import { displayName, dueLabel, relative, shortDate } from '../lib/format'
import {
  CONTENT_CHANNEL_LABEL,
  CONTENT_KIND_LABEL,
  SHOOT_STAGE_LABEL,
  SHOOT_STAGE_ORDER,
} from '../lib/types'
import type { ContentPiece, Shoot, ShootStage, Staff } from '../lib/types'
import { DiscussButton } from '../components/DiscussButton'
import { ContentForm, ShootForm } from '../components/forms2'
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

/**
 * The video production line and content calendar.
 *
 * The Ambassador (Staff F) carries 25–30 videos a month and the Secretary
 * (Staff G) is measured on having every shoot prepped 24 hours ahead. Those
 * two targets are the same pipeline seen from two ends, so they share one
 * board rather than two separate trackers.
 */
export function Content() {
  const me = useCurrentUser()
  const { shoots, content, propertyById, staffById, setShootStage, markShootPrepped } =
    useStore()

  const editable = can(me, 'MANAGE_CONTENT')
  const [stage, setStage] = useState('ALL')
  const [newShoot, setNewShoot] = useState(false)
  const [editShoot, setEditShoot] = useState<Shoot | null>(null)
  const [newPiece, setNewPiece] = useState(false)
  const [editPiece, setEditPiece] = useState<ContentPiece | null>(null)

  const visible = shoots.filter((s) => stage === 'ALL' || s.stage === stage)

  const published = shoots.filter((s) => s.stage === 'PUBLISHED')
  const inFlight = shoots.filter((s) => s.stage !== 'PUBLISHED')
  const reshoots = published.filter((s) => s.reshoot).length
  const reshootRate =
    published.length === 0 ? 0 : Math.round((reshoots / published.length) * 100)

  const rated = published.filter((s) => s.engagementRate !== null)
  const avgEngagement =
    rated.length === 0
      ? 0
      : Math.round(
          (rated.reduce((n, s) => n + (s.engagementRate ?? 0), 0) / rated.length) * 10,
        ) / 10

  // The Secretary's 24-hour prep rule, measured rather than asserted.
  const prepLate = shoots.filter((s) => shootPrepLate(s)).length

  return (
    <>
      <PageHeader
        title="Content & shoots"
        subtitle="Video production line and the publishing calendar"
        icon={Clapperboard}
        accent="violet"
        actions={
          editable && (
            <>
              <Button onClick={() => setNewPiece(true)}>
                <Plus size={15} />
                Content
              </Button>
              <Button variant="primary" onClick={() => setNewShoot(true)}>
                <Plus size={15} />
                Shoot
              </Button>
            </>
          )
        }
      />

      {newShoot && <ShootForm onClose={() => setNewShoot(false)} />}
      {editShoot && (
        <ShootForm existing={editShoot} onClose={() => setEditShoot(null)} />
      )}
      {newPiece && <ContentForm onClose={() => setNewPiece(false)} />}
      {editPiece && (
        <ContentForm existing={editPiece} onClose={() => setEditPiece(null)} />
      )}

      <div className="pl-stagger mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Videos published"
          value={published.length}
          sub="Target: 25–30 per month"
          tone={published.length >= 25 ? 'ok' : 'warn'}
          icon={Video}
        />
        <Stat
          label="In production"
          value={inFlight.length}
          sub="Requested through editing"
          accent="violet"
          icon={Film}
        />
        <Stat
          label="Avg engagement"
          value={`${avgEngagement}%`}
          sub="Target: 5%+"
          tone={avgEngagement >= 5 ? 'ok' : 'warn'}
          icon={Sparkles}
        />
        <Stat
          label="Reshoot rate"
          value={`${reshootRate}%`}
          sub="Target: under 10%"
          tone={reshootRate < 10 ? 'ok' : 'warn'}
          icon={RotateCcw}
        />
      </div>

      {prepLate > 0 && (
        <Card className="mb-4 border-accent/40">
          <div className="flex items-start gap-2.5">
            <CalendarClock
              size={16}
              className="mt-0.5 shrink-0 text-[color:var(--color-warn)]"
            />
            <p className="text-sm text-ink-2">
              <strong className="font-semibold text-ink">
                {prepLate} {prepLate === 1 ? 'shoot was' : 'shoots were'} not prepped 24
                hours in advance.
              </strong>{' '}
              Scripts, documents and logistics ready a day ahead is the Secretary&apos;s
              stated target, and it is the thing that protects the Ambassador&apos;s video
              count.
            </p>
          </div>
        </Card>
      )}

      <SectionTitle
        accent="violet"
        hint="Requested → scheduled → prepped → filmed → editing → published"
        action={
          <Select
            ariaLabel="Filter by stage"
            value={stage}
            onChange={setStage}
            className="w-auto py-1 text-xs"
          >
            <option value="ALL">All stages</option>
            {SHOOT_STAGE_ORDER.map((s) => (
              <option key={s} value={s}>
                {SHOOT_STAGE_LABEL[s]}
              </option>
            ))}
          </Select>
        }
      >
        Production line
      </SectionTitle>

      {visible.length === 0 ? (
        <Empty>No shoots at this stage.</Empty>
      ) : (
        <div className="pl-stagger mb-6 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((s) => (
            <ShootCard
              key={s.id}
              shoot={s}
              editable={editable}
              onEdit={() => setEditShoot(s)}
              propertyTitle={propertyById(s.propertyId)?.title ?? s.propertyTitle}
              presenter={staffById(s.presenterId)}
              secretary={staffById(s.secretaryId)}
              onStage={(next) => setShootStage(s.id, next)}
              onPrep={() => markShootPrepped(s.id)}
            />
          ))}
        </div>
      )}

      <SectionTitle accent="violet" hint="Published and scheduled pieces across every channel">
        Content calendar
      </SectionTitle>

      <TableWrap>
        <table className="w-full min-w-[48rem] border-collapse">
          <thead>
            <tr>
              <Th>Piece</Th>
              <Th>Channel</Th>
              <Th>Type</Th>
              <Th>Date</Th>
              <Th>Engagement</Th>
              <Th>Leads</Th>
              <Th>Owner</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {content.map((c) => {
              const ownerStaff = staffById(c.ownerId)
              return (
                <Tr key={c.id}>
                  <Td>{c.title}</Td>
                  <Td>
                    <Badge>{CONTENT_CHANNEL_LABEL[c.channel]}</Badge>
                  </Td>
                  <Td>
                    <span className="text-xs text-ink-2">
                      {CONTENT_KIND_LABEL[c.kind]}
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap">
                    {c.publishedAt ? (
                      <span className="text-xs text-ink-2">
                        {shortDate(c.publishedAt)}
                      </span>
                    ) : c.scheduledFor ? (
                      <Badge tone="info">{dueLabel(c.scheduledFor)}</Badge>
                    ) : (
                      <span className="text-xs text-ink-3">—</span>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap">
                    {c.engagementRate === null ? (
                      <span className="text-xs text-ink-3">—</span>
                    ) : (
                      <span
                        className={`text-xs ${c.engagementRate >= 4 ? 'text-primary' : 'text-[color:var(--color-warn)]'}`}
                      >
                        {c.engagementRate}%
                      </span>
                    )}
                  </Td>
                  <Td>{c.leadsGenerated || <span className="text-ink-3">—</span>}</Td>
                  <Td className="whitespace-nowrap">
                    <span className="text-xs text-ink-2">
                      {ownerStaff ? displayName(ownerStaff) : '—'}
                    </span>
                  </Td>
                  <Td className="text-right">
                    {editable && (
                      <button
                        type="button"
                        onClick={() => setEditPiece(c)}
                        aria-label={`Edit ${c.title}`}
                        title="Edit"
                        className="rounded-lg p-1.5 text-ink-3 transition-colors hover:bg-surface-2 hover:text-primary"
                      >
                        <Pencil size={13} strokeWidth={2} />
                      </button>
                    )}
                  </Td>
                </Tr>
              )
            })}
          </tbody>
        </table>
      </TableWrap>

      <div className="mt-6">
        <Note>
          Engagement rates are marked MANUAL on the scorecard because they come
          from each platform&apos;s own analytics, not from PropertyLoop&apos;s
          database. Video counts and reshoot rates are countable here and so
          can be trusted without anyone reporting them.
        </Note>
      </div>
    </>
  )
}

function ShootCard({
  shoot,
  editable,
  propertyTitle,
  presenter,
  secretary,
  onStage,
  onPrep,
  onEdit,
}: {
  shoot: Shoot
  editable: boolean
  onEdit: () => void
  propertyTitle: string | null
  presenter: Staff | null
  secretary: Staff | null
  onStage: (stage: ShootStage) => void
  onPrep: () => void
}) {
  const idx = SHOOT_STAGE_ORDER.indexOf(shoot.stage)
  const next = idx >= 0 && idx < SHOOT_STAGE_ORDER.length - 1
    ? SHOOT_STAGE_ORDER[idx + 1]
    : null

  const prepOverdue = shootPrepOverdue(shoot)

  return (
    <article className="rounded-2xl border border-line bg-surface p-3.5 shadow-[var(--shadow-tile)] transition-all duration-200 hover:-translate-y-0.5 hover:border-violet/40 hover:shadow-[var(--shadow-lift)]">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm leading-snug font-medium text-ink">{shoot.title}</h3>
        <Badge tone={shoot.stage === 'PUBLISHED' ? 'ok' : 'neutral'}>
          {SHOOT_STAGE_LABEL[shoot.stage]}
        </Badge>
      </div>

      <div className="mt-1 text-xs text-ink-3">
        {shoot.location}
        {propertyTitle && ` · ${propertyTitle}`}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {shoot.scheduledFor && (
          <Badge tone={prepOverdue ? 'warn' : 'info'}>
            {dueLabel(shoot.scheduledFor)}
          </Badge>
        )}
        {shoot.prepCompleteAt && (
          <Badge tone="ok">
            <CheckCircle2 size={11} className="mr-1" />
            prepped
          </Badge>
        )}
        {shoot.reshoot && (
          <Badge tone="warn">
            <RotateCcw size={11} className="mr-1" />
            reshoot
          </Badge>
        )}
        {shoot.engagementRate !== null && (
          <Badge tone={shoot.engagementRate >= 5 ? 'ok' : 'neutral'}>
            {shoot.engagementRate}% engagement
          </Badge>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-2.5">
        <span className="truncate text-[11px] text-ink-3">
          {presenter ? displayName(presenter) : '—'}
          {secretary && ` · prep: ${displayName(secretary)}`}
          {shoot.publishedAt && ` · ${relative(shoot.publishedAt)}`}
        </span>
        <span className="flex shrink-0 items-center gap-0.5">
          <DiscussButton kind="SHOOT" id={shoot.id} compact />
          {editable && (
            <button
              type="button"
              onClick={onEdit}
              aria-label={`Edit ${shoot.title}`}
              title="Edit"
              className="rounded p-1 text-ink-3 transition-colors hover:bg-surface-2 hover:text-primary"
            >
              <Pencil size={12} strokeWidth={2} />
            </button>
          )}
        </span>
        {editable && (
          <span className="flex shrink-0 gap-1.5">
            {!shoot.prepCompleteAt && shoot.stage !== 'PUBLISHED' && (
              <Button size="sm" onClick={onPrep}>
                Mark prepped
              </Button>
            )}
            {next && (
              <Button size="sm" variant="primary" onClick={() => onStage(next)}>
                {SHOOT_STAGE_LABEL[next]}
              </Button>
            )}
          </span>
        )}
      </div>
    </article>
  )
}
