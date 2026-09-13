import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Building2,
  CheckCircle2,
  Clapperboard,
  Clock3,
  FileWarning,
  NotebookPen,
  Star,
  Timer,
  Wallet,
} from 'lucide-react'
import { useCurrentUser, useStore } from '../lib/storeContext'
import { can } from '../lib/permissions'
import {
  companySnapshot,
  dealActionOverdue,
  publishBlockers,
  staffScore,
  targetProgress,
} from '../lib/metrics'
import {
  displayName,
  dueLabel,
  initials,
  isoDate,
  naira,
  relative,
} from '../lib/format'
import {
  DEAL_STAGE_LABEL,
  LEAD_STATUS_LABEL,
  OPS_KIND_LABEL,
  STAFF_ROLE_SHORT,
} from '../lib/types'
import {
  Avatar,
  Badge,
  Button,
  Card,
  Empty,
  Note,
  Progress,
  SectionTitle,
  Stat,
} from '../components/ui'

export function Dashboard() {
  const me = useCurrentUser()
  const store = useStore()
  const { properties, deals, leads, shoots, content, ops, threads, targets, staff } =
    store

  const snap = companySnapshot({ properties, deals, leads, shoots, content, ops })
  const seesEverything = can(me, 'VIEW_ALL_TARGETS')
  const myScore = staffScore(targets, me.id)

  return (
    <>
      <Hero />

      {seesEverything ? (
        <ManagementView snapshot={snap} />
      ) : (
        <PersonalView score={myScore} />
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <MyWork />
        <div className="flex flex-col gap-4">
          {can(me, 'HANDLE_OPS') && <OpsAlert />}
          <ActiveThreads />
        </div>
      </div>

      {seesEverything && (
        <>
          <div className="mt-6">
            <SectionTitle accent="gold" hint="Average progress across each person's monthly targets">
              Team scorecard
            </SectionTitle>
            <div className="pl-stagger grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {staff.map((s) => {
                const score = staffScore(targets, s.id)
                return (
                  <Link
                    key={s.id}
                    to="/targets"
                    className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-[var(--shadow-tile)] transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--shadow-lift)]"
                  >
                    <Avatar initials={initials(s)} seed={s.id} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-ink">
                        {displayName(s)}
                      </div>
                      <div className="truncate text-xs text-ink-3">
                        {STAFF_ROLE_SHORT[s.role]}
                      </div>
                      <Progress value={score ?? 0} className="mt-1.5" />
                    </div>
                    <div className="font-display text-lg text-ink">
                      {score === null ? '—' : `${score}%`}
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>

          <div className="mt-6">
            <Note>
              Every figure on this page is derived from the records in this
              portal, not typed in by anyone. When the API is connected, the
              same numbers come from Postgres — which is the point: a weekly
              review should read evidence, not self-reported summaries.
            </Note>
          </div>
        </>
      )}

      {threads.length === 0 && <Empty>No threads yet.</Empty>}
    </>
  )
}

/* ─── Hero ───────────────────────────────────────────────────────────── */

/**
 * A greeting band rather than a plain page title. On a dashboard the first
 * thing on screen sets the tone for everything under it, and a line of grey
 * text made the whole tool read as unfinished.
 */
function Hero() {
  const me = useCurrentUser()
  const { logs } = useStore()
  const filedToday = logs.some((l) => l.staffId === me.id && l.date === isoDate())

  return (
    <section className="pl-rise relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-primary-ink via-primary to-primary-light p-6 text-white shadow-[var(--shadow-lift)] sm:p-7">
      {/* Soft light blooms so the band is not a flat rectangle of green. */}
      <span className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full bg-amber-300/20 blur-3xl" />
      <span className="pointer-events-none absolute -bottom-28 left-1/3 h-56 w-56 rounded-full bg-emerald-300/20 blur-3xl" />

      <div className="relative flex flex-wrap items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <Avatar initials={initials(me)} seed={me.id} size="lg" ring />
          <div>
            <h1 className="font-display text-2xl leading-tight sm:text-3xl">
              {greeting()}, {displayName(me)}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/70">
              <span>{STAFF_ROLE_SHORT[me.role]}</span>
              <span className="text-white/35">·</span>
              <span>
                {me.chapter === 'OSUN' ? 'Osun chapter' : 'Lagos head office'}
              </span>
              <span className="text-white/35">·</span>
              <span>{today()}</span>
            </p>
          </div>
        </div>

        <Link
          to="/logs"
          className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold backdrop-blur-sm transition-all duration-150 hover:-translate-y-0.5 ${
            filedToday
              ? 'bg-white/15 text-white hover:bg-white/25'
              : 'bg-amber-400 text-amber-950 hover:bg-amber-300'
          }`}
        >
          {filedToday ? (
            <>
              <CheckCircle2 size={16} />
              Log filed today
            </>
          ) : (
            <>
              <NotebookPen size={16} />
              File today&apos;s log
            </>
          )}
        </Link>
      </div>
    </section>
  )
}

function greeting(now: Date = new Date()): string {
  const h = now.getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function today(now: Date = new Date()): string {
  return now.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

/* ─── Management view ────────────────────────────────────────────────── */

function ManagementView({
  snapshot,
}: {
  snapshot: ReturnType<typeof companySnapshot>
}) {
  const s = snapshot
  return (
    <>
      <SectionTitle hint="The five questions the owner should be able to answer at a glance">
        Company
      </SectionTitle>

      <div className="pl-stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Published inventory"
          value={s.propertiesPublished}
          sub={`${s.propertiesPending} pending · ${s.unitsAvailable} units available`}
          to="/properties"
          tone="ok"
          icon={Building2}
        />
        <Stat
          label="Open pipeline"
          value={naira(s.pipelineValue)}
          sub={`${s.dealsOpen} live deals · ${s.exclusiveMandates} exclusive`}
          to="/deals"
          accent="gold"
          icon={Wallet}
        />
        <Stat
          label="Qualified leads"
          value={s.leadsQualified}
          sub={`${s.conversion}% converted · ${s.leadsUnanswered} unanswered`}
          to="/leads"
          tone={s.leadsUnanswered > 3 ? 'warn' : 'default'}
          accent="blue"
          icon={Star}
        />
        <Stat
          label="Awaiting payout"
          value={naira(s.moneyAwaitingPayout)}
          sub={`${s.opsUnassigned} ops items unassigned`}
          to="/ops"
          tone={s.moneyAwaitingPayout > 0 ? 'danger' : 'default'}
          icon={Banknote}
        />
      </div>

      <div className="pl-stagger mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Blocked listings"
          value={s.propertiesBlocked}
          sub="Pending review, missing photos or documents"
          to="/properties"
          tone={s.propertiesBlocked > 0 ? 'warn' : 'default'}
          icon={FileWarning}
        />
        <Stat
          label="Stale deals"
          value={s.dealsStale}
          sub="No activity logged in over 7 days"
          to="/deals"
          tone={s.dealsStale > 0 ? 'warn' : 'default'}
          icon={Clock3}
        />
        <Stat
          label="Enquiry SLA"
          value={`${s.sla}%`}
          sub="Answered within 30 minutes"
          to="/leads"
          tone={s.sla >= 90 ? 'ok' : 'warn'}
          icon={Timer}
        />
        <Stat
          label="Videos published"
          value={s.videosPublished}
          sub={`${s.contentPublished} content pieces · ${s.leadsFromContent} leads`}
          to="/content"
          accent="violet"
          icon={Clapperboard}
        />
      </div>
    </>
  )
}

/* ─── Personal view ──────────────────────────────────────────────────── */

function PersonalView({ score }: { score: number | null }) {
  const me = useCurrentUser()
  const { targets } = useStore()
  const mine = targets.filter((t) => t.staffId === me.id)

  return (
    <Card accent="gold">
      <SectionTitle accent="gold" hint="Your monthly targets, from the September 2026 structure">
        This month
      </SectionTitle>
      {mine.length === 0 ? (
        <Empty>No targets set for this role yet.</Empty>
      ) : (
        <>
          <div className="mb-4 flex items-baseline gap-3">
            <span className="font-display text-3xl text-ink">
              {score === null ? '—' : `${score}%`}
            </span>
            <span className="text-sm text-ink-3">average progress</span>
          </div>
          <div className="pl-stagger grid gap-3 sm:grid-cols-2">
            {mine.map((t) => {
              const p = targetProgress(t)
              return (
                <div key={t.id}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm text-ink">{t.label}</span>
                    <span className="shrink-0 text-xs font-medium text-ink-2">{p}%</span>
                  </div>
                  <Progress value={p} className="mt-1.5" />
                </div>
              )
            })}
          </div>
        </>
      )}
    </Card>
  )
}

/* ─── My work ────────────────────────────────────────────────────────── */

function MyWork() {
  const me = useCurrentUser()
  const { deals, properties, leads, shoots } = useStore()

  const myDeals = deals
    .filter((d) => d.ownerId === me.id && d.stage !== 'LOST' && d.nextActionAt)
    .sort(
      (a, b) =>
        new Date(a.nextActionAt ?? 0).getTime() -
        new Date(b.nextActionAt ?? 0).getTime(),
    )
    .slice(0, 4)

  const myBlocked = properties
    .filter((p) => p.sourcedById === me.id && p.status === 'PENDING_REVIEW')
    .slice(0, 3)

  const myNewLeads = leads
    .filter((l) => l.ownerId === me.id && l.firstResponseMins === null)
    .slice(0, 3)

  const myShoots = shoots
    .filter(
      (s) =>
        (s.presenterId === me.id || s.secretaryId === me.id) &&
        s.stage !== 'PUBLISHED' &&
        s.scheduledFor,
    )
    .slice(0, 3)

  const empty =
    myDeals.length === 0 &&
    myBlocked.length === 0 &&
    myNewLeads.length === 0 &&
    myShoots.length === 0

  return (
    <Card accent="blue">
      <SectionTitle accent="blue" hint="Everything assigned to you that needs a decision">
        Your queue
      </SectionTitle>

      {empty && <Empty>Nothing waiting on you.</Empty>}

      <div className="pl-stagger flex flex-col gap-2">
        {myNewLeads.map((l) => (
          <Row
            key={l.id}
            to="/leads"
            tone="danger"
            title={`Unanswered — ${l.name}`}
            meta={`${LEAD_STATUS_LABEL[l.status]} · arrived ${relative(l.createdAt)}`}
          />
        ))}
        {myDeals.map((d) => (
          <Row
            key={d.id}
            to="/deals"
            tone={dealActionOverdue(d) ? 'danger' : 'neutral'}
            title={`${d.company} — ${d.nextAction}`}
            meta={`${DEAL_STAGE_LABEL[d.stage]} · ${d.nextActionAt ? dueLabel(d.nextActionAt) : ''}`}
          />
        ))}
        {myBlocked.map((p) => {
          const blockers = publishBlockers(p)
          return (
            <Row
              key={p.id}
              to="/properties"
              tone={blockers.length > 0 ? 'warn' : 'ok'}
              title={p.title}
              meta={blockers.length > 0 ? blockers.join(' · ') : 'Ready to publish'}
            />
          )
        })}
        {myShoots.map((s) => (
          <Row
            key={s.id}
            to="/content"
            tone="neutral"
            title={s.title}
            meta={`${s.location}${s.scheduledFor ? ` · ${dueLabel(s.scheduledFor)}` : ''}`}
          />
        ))}
      </div>
    </Card>
  )
}

function Row({
  to,
  title,
  meta,
  tone,
}: {
  to: string
  title: string
  meta: string
  tone: 'neutral' | 'ok' | 'warn' | 'danger'
}) {
  const dot = {
    neutral: 'bg-ink-3',
    ok: 'bg-primary',
    warn: 'bg-accent',
    danger: 'bg-[color:var(--color-danger)]',
  }[tone]

  return (
    <Link
      to={to}
      className="flex items-start gap-2.5 rounded-xl border border-line px-3 py-2.5 transition-all duration-150 hover:-translate-y-px hover:border-primary/40 hover:bg-surface-2/40"
    >
      <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-ink">{title}</span>
        <span className="block truncate text-xs text-ink-3">{meta}</span>
      </span>
      <ArrowRight size={14} className="mt-1 shrink-0 text-ink-3" />
    </Link>
  )
}

/* ─── Ops alert ──────────────────────────────────────────────────────── */

function OpsAlert() {
  const { ops } = useStore()
  const unassigned = ops.filter((o) => !o.resolved && o.assigneeId === null)
  const money = unassigned
    .filter((o) => o.kind === 'WITHDRAWAL')
    .reduce((n, o) => n + (o.amountNaira ?? 0), 0)

  if (unassigned.length === 0) return null

  return (
    <Card accent="rose" className="border-rose/30">
      <div className="flex items-start gap-2.5">
        <AlertTriangle
          size={16}
          className="mt-0.5 shrink-0 text-[color:var(--color-warn)]"
        />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-ink">
            {unassigned.length} operations {unassigned.length === 1 ? 'item' : 'items'} with
            no owner
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-ink-2">
            {money > 0 && (
              <>
                <strong className="font-semibold text-ink">{naira(money)}</strong> of that
                is vendor payouts waiting on a manual transfer.{' '}
              </>
            )}
            None of this work is assigned to a position in the org structure.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {[...new Set(unassigned.map((o) => o.kind))].map((k) => (
              <Badge key={k} tone="warn">
                {OPS_KIND_LABEL[k]}
              </Badge>
            ))}
          </div>
          <Link to="/ops" className="mt-3 inline-block">
            <Button size="sm">Open the queue</Button>
          </Link>
        </div>
      </div>
    </Card>
  )
}

/* ─── Threads ────────────────────────────────────────────────────────── */

function ActiveThreads() {
  const me = useCurrentUser()
  const { threads, staffById } = useStore()

  const mine = threads
    .filter((t) => !t.resolved && t.participantIds.includes(me.id))
    .sort((a, b) => {
      const aLast = a.messages[a.messages.length - 1]?.createdAt ?? a.createdAt
      const bLast = b.messages[b.messages.length - 1]?.createdAt ?? b.createdAt
      return new Date(bLast).getTime() - new Date(aLast).getTime()
    })
    .slice(0, 4)

  return (
    <Card accent="teal">
      <SectionTitle
        accent="teal"
        hint="Discussion attached to a record, not scattered in chat"
        action={
          <Link to="/threads" className="text-xs text-primary hover:underline">
            All threads
          </Link>
        }
      >
        Your threads
      </SectionTitle>

      {mine.length === 0 ? (
        <Empty>You are not on any open threads.</Empty>
      ) : (
        <div className="flex flex-col gap-2">
          {mine.map((t) => {
            const last = t.messages[t.messages.length - 1]
            const author = staffById(last?.authorId ?? null)
            return (
              <Link
                key={t.id}
                to={`/threads?open=${t.id}`}
                className="rounded-xl border border-line px-3 py-2.5 transition-all duration-150 hover:-translate-y-px hover:border-teal/40 hover:bg-teal-soft/25"
              >
                <div className="truncate text-sm font-medium text-ink">{t.title}</div>
                {last && (
                  <div className="mt-0.5 truncate text-xs text-ink-3">
                    {author ? displayName(author) : 'Someone'}: {last.text}
                  </div>
                )}
                <div className="mt-1 text-[11px] text-ink-3">
                  {last ? relative(last.createdAt) : relative(t.createdAt)} ·{' '}
                  {t.messages.length} {t.messages.length === 1 ? 'message' : 'messages'}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </Card>
  )
}
