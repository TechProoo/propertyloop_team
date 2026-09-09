import { useState } from 'react'
import {
  CalendarCheck,
  CalendarX,
  CheckCircle2,
  CircleAlert,
  Database,
  Flame,
  NotebookPen,
  PenLine,
  Zap,
} from 'lucide-react'
import { useCurrentUser, useStore } from '../lib/storeContext'
import { can } from '../lib/permissions'
import { dayActivity, missedLogDays } from '../lib/metrics'
import type { DayActivity } from '../lib/metrics'
import {
  dayLabel,
  displayName,
  initials,
  isWeekend,
  isoDate,
  recentDays,
  relative,
} from '../lib/format'
import { STAFF_ROLE_SHORT } from '../lib/types'
import type { Staff } from '../lib/types'
import {
  Avatar,
  Badge,
  Button,
  Card,
  Empty,
  Note,
  PageHeader,
  SectionTitle,
  Select,
  Stat,
} from '../components/ui'

/**
 * Daily work logs.
 *
 * A written log on its own only measures how diligently somebody reports. So
 * every entry is shown next to the activity the RECORDS hold for that same
 * day — properties submitted, deals advanced, leads contacted. The two
 * together are reviewable; either alone is not. Where they disagree, that is
 * the conversation worth having, not a number to argue about.
 */
export function Logs() {
  const me = useCurrentUser()
  const seesAll = can(me.role, 'VIEW_ALL_LOGS')
  const [tab, setTab] = useState<'MINE' | 'TEAM'>(seesAll ? 'TEAM' : 'MINE')

  return (
    <>
      <PageHeader
        title="Daily log"
        subtitle="What you did, beside what the records show"
        icon={NotebookPen}
        accent="violet"
        actions={
          seesAll && (
            <div className="flex gap-1 rounded-lg border border-line p-0.5">
              <Button
                size="sm"
                variant={tab === 'TEAM' ? 'primary' : 'ghost'}
                onClick={() => setTab('TEAM')}
              >
                Team
              </Button>
              <Button
                size="sm"
                variant={tab === 'MINE' ? 'primary' : 'ghost'}
                onClick={() => setTab('MINE')}
              >
                Mine
              </Button>
            </div>
          )
        }
      />

      {tab === 'MINE' ? <MyLog /> : <TeamLogs />}
    </>
  )
}

/* ─── Writing your own ───────────────────────────────────────────────── */

function MyLog() {
  const me = useCurrentUser()
  const store = useStore()
  const { logs, saveLog, logFor, properties, deals, leads, shoots, threads } = store

  const days = recentDays(14)
  const [day, setDay] = useState(isoDate())

  const existing = logFor(me.id, day)
  const [summary, setSummary] = useState(existing?.summary ?? '')
  const [blockers, setBlockers] = useState(existing?.blockers ?? '')
  const [plan, setPlan] = useState(existing?.plan ?? '')
  const [savedAt, setSavedAt] = useState<string | null>(null)

  // Switching day reloads the form from whatever is stored for that day.
  function pickDay(next: string) {
    const entry = logFor(me.id, next)
    setDay(next)
    setSummary(entry?.summary ?? '')
    setBlockers(entry?.blockers ?? '')
    setPlan(entry?.plan ?? '')
    setSavedAt(null)
  }

  const activity = dayActivity(me.id, day, {
    properties,
    deals,
    leads,
    shoots,
    threads,
  })

  const missed = missedLogDays(me.id, logs, days)
  const dirty =
    summary !== (existing?.summary ?? '') ||
    blockers !== (existing?.blockers ?? '') ||
    plan !== (existing?.plan ?? '')

  function submit() {
    saveLog(day, { summary, blockers, plan })
    setSavedAt(new Date().toISOString())
  }

  const mine = logs
    .filter((l) => l.staffId === me.id)
    .sort((a, b) => b.date.localeCompare(a.date))

  return (
    <>
      <div className="pl-stagger mb-4 grid gap-3 sm:grid-cols-3">
        <Stat
          label="Entries filed"
          value={mine.length}
          sub="All time"
          accent="violet"
          icon={CalendarCheck}
        />
        <Stat
          label="Missed working days"
          value={missed.length}
          sub="In the last 14 days"
          tone={missed.length > 0 ? 'warn' : 'ok'}
          icon={CalendarX}
        />
        <Stat
          label="Recorded today"
          value={activity.total}
          sub="Actions the system saw"
          tone={activity.total > 0 ? 'ok' : 'default'}
          icon={Zap}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <Card accent="violet">
          <SectionTitle
            accent="violet"
            action={
              <Select
                ariaLabel="Choose a day"
                value={day}
                onChange={pickDay}
                className="w-auto py-1 text-xs"
              >
                {days.map((d) => (
                  <option key={d} value={d}>
                    {dayLabel(d)}
                    {isWeekend(d) ? ' (weekend)' : ''}
                    {logFor(me.id, d) ? ' ✓' : ''}
                  </option>
                ))}
              </Select>
            }
          >
            {dayLabel(day)}
          </SectionTitle>

          <div className="grid gap-3">
            <LogField
              label="What did you do?"
              value={summary}
              onChange={setSummary}
              rows={5}
              placeholder="The work itself — what moved, and how far."
            />
            <LogField
              label="What is blocking you?"
              value={blockers}
              onChange={setBlockers}
              rows={3}
              placeholder="The part a manager most needs to read. Write 'None.' if nothing."
            />
            <LogField
              label="What is next?"
              value={plan}
              onChange={setPlan}
              rows={2}
              placeholder="Tomorrow's first thing."
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-3">
            <Button variant="primary" onClick={submit} disabled={!summary.trim() || !dirty}>
              {existing ? 'Update entry' : 'File entry'}
            </Button>
            {existing && !dirty && !savedAt && (
              <span className="flex items-center gap-1.5 text-xs text-ink-3">
                <CheckCircle2 size={13} className="text-primary" />
                Filed {relative(existing.updatedAt)}
              </span>
            )}
            {savedAt && (
              <span className="flex items-center gap-1.5 text-xs text-primary">
                <CheckCircle2 size={13} />
                Saved
              </span>
            )}
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <ActivityPanel activity={activity} />

          <Card>
            <SectionTitle accent="violet" hint="Your last 14 days">
              History
            </SectionTitle>
            {mine.length === 0 ? (
              <Empty>Nothing filed yet.</Empty>
            ) : (
              <div className="pl-stagger flex max-h-72 flex-col gap-1.5 overflow-y-auto pr-1">
                {mine.slice(0, 14).map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => pickDay(l.date)}
                    className={`rounded-xl border px-3 py-2 text-left transition-all duration-150 ${
                      l.date === day
                        ? 'border-violet/40 bg-violet-soft/50'
                        : 'border-line hover:-translate-y-px hover:border-violet/30'
                    }`}
                  >
                    <div className="text-xs font-medium text-ink">{dayLabel(l.date)}</div>
                    <div className="mt-0.5 line-clamp-2 text-xs text-ink-3">
                      {l.summary}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <div className="mt-6">
        <Note>
          The panel on the right is not something anybody types — it is counted
          from the properties, deals, leads and shoots you touched that day. If
          the written entry and the record disagree, that gap is the useful
          conversation.
        </Note>
      </div>
    </>
  )
}

function LogField({
  label,
  value,
  onChange,
  rows,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  rows: number
  placeholder: string
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium tracking-wide text-ink-3 uppercase">
        {label}
      </span>
      <textarea
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full resize-y rounded-lg border border-line bg-surface px-3 py-2 text-sm leading-relaxed text-ink outline-none transition-colors focus:border-primary"
      />
    </label>
  )
}

function ActivityPanel({ activity }: { activity: DayActivity }) {
  const rows: [string, number][] = [
    ['Properties submitted', activity.propertiesSubmitted],
    ['Properties published', activity.propertiesPublished],
    ['Deals advanced', activity.dealsAdvanced],
    ['Leads contacted', activity.leadsContacted],
    ['Shoots prepped', activity.shootsPrepped],
    ['Videos published', activity.videosPublished],
    ['Thread messages', activity.threadMessages],
  ]

  return (
    <Card accent="teal">
      <SectionTitle accent="teal" hint="Counted from records, not reported">
        What the system saw
      </SectionTitle>
      {activity.total === 0 ? (
        <p className="text-xs leading-relaxed text-ink-3">
          No recorded activity for this day. That is not automatically a
          problem — meetings, calls and travel leave no trace in the database.
          It is a reason to read the written entry rather than the number.
        </p>
      ) : (
        <dl className="flex flex-col gap-1.5">
          {rows
            .filter(([, n]) => n > 0)
            .map(([label, n]) => (
              <div
                key={label}
                className="flex items-baseline justify-between gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-teal-soft/40"
              >
                <dt className="text-xs text-ink-2">{label}</dt>
                <dd className="font-display text-base text-teal">{n}</dd>
              </div>
            ))}
        </dl>
      )}
    </Card>
  )
}

/* ─── Manager view ───────────────────────────────────────────────────── */

function TeamLogs() {
  const store = useStore()
  const { staff, logs, properties, deals, leads, shoots, threads } = store
  const days = recentDays(14)
  const [day, setDay] = useState(isoDate())

  const filed = staff.filter((s) => logs.some((l) => l.staffId === s.id && l.date === day))
  const notFiled = staff.filter((s) => !filed.includes(s))

  return (
    <>
      <div className="pl-stagger mb-4 grid gap-3 sm:grid-cols-3">
        <Stat
          label="Filed"
          value={`${filed.length}/${staff.length}`}
          sub={dayLabel(day)}
          accent="violet"
          icon={CalendarCheck}
        />
        <Stat
          label="Not filed"
          value={notFiled.length}
          sub={isWeekend(day) ? 'Weekend — not expected' : 'Working day'}
          tone={notFiled.length > 0 && !isWeekend(day) ? 'warn' : 'default'}
          icon={CalendarX}
        />
        <Stat
          label="Blockers raised"
          value={
            logs.filter(
              (l) =>
                l.date === day &&
                l.blockers.trim() !== '' &&
                l.blockers.trim().toLowerCase() !== 'none.',
            ).length
          }
          sub="Worth reading first"
          accent="rose"
          icon={Flame}
        />
      </div>

      <SectionTitle
        accent="violet"
        action={
          <Select
            ariaLabel="Choose a day"
            value={day}
            onChange={setDay}
            className="w-auto py-1 text-xs"
          >
            {days.map((d) => (
              <option key={d} value={d}>
                {dayLabel(d)}
                {isWeekend(d) ? ' (weekend)' : ''}
              </option>
            ))}
          </Select>
        }
      >
        {dayLabel(day)}
      </SectionTitle>

      <div className="pl-stagger flex flex-col gap-3">
        {staff.map((person) => {
          const entry = logs.find((l) => l.staffId === person.id && l.date === day)
          const activity = dayActivity(person.id, day, {
            properties,
            deals,
            leads,
            shoots,
            threads,
          })
          return (
            <TeamLogRow
              key={person.id}
              person={person}
              entry={entry ?? null}
              activity={activity}
              weekend={isWeekend(day)}
            />
          )
        })}
      </div>

      <div className="mt-6">
        <Note>
          Read the blockers column first — it is the only part of a daily log
          that changes what a manager should do next. A run of &quot;None.&quot;
          from someone whose targets are slipping is itself worth a question.
        </Note>
      </div>
    </>
  )
}

function TeamLogRow({
  person,
  entry,
  activity,
  weekend,
}: {
  person: Staff
  entry: { summary: string; blockers: string; plan: string; updatedAt: string } | null
  activity: DayActivity
  weekend: boolean
}) {
  const hasBlocker =
    entry !== null &&
    entry.blockers.trim() !== '' &&
    entry.blockers.trim().toLowerCase() !== 'none.'

  return (
    <Card
      hover
      accent={hasBlocker ? 'gold' : entry ? 'green' : undefined}
      className={hasBlocker ? 'border-gold/30' : ''}
    >
      <div className="flex items-start gap-3">
        <Avatar initials={initials(person)} seed={person.id} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-ink">{displayName(person)}</h3>
            <span className="text-xs text-ink-3">{STAFF_ROLE_SHORT[person.role]}</span>
            {entry ? (
              <Badge tone="ok">filed {relative(entry.updatedAt)}</Badge>
            ) : (
              <Badge tone={weekend ? 'neutral' : 'warn'}>
                {weekend ? 'weekend' : 'not filed'}
              </Badge>
            )}
            <span
              title="Actions counted from records for this day"
              className="inline-flex items-center gap-1 text-[11px] text-ink-3"
            >
              <Database size={11} strokeWidth={1.75} />
              {activity.total} recorded
            </span>
          </div>

          {entry ? (
            <div className="mt-2 grid gap-2">
              <LogLine icon="summary" text={entry.summary} />
              {hasBlocker && <LogLine icon="blocker" text={entry.blockers} />}
              {entry.plan.trim() && <LogLine icon="plan" text={entry.plan} />}
            </div>
          ) : (
            <p className="mt-2 text-xs text-ink-3">
              {weekend
                ? 'No entry — weekend.'
                : activity.total > 0
                  ? `No entry filed, but the records show ${activity.total} action${activity.total === 1 ? '' : 's'} that day.`
                  : 'No entry filed and no recorded activity.'}
            </p>
          )}
        </div>
      </div>
    </Card>
  )
}

function LogLine({
  icon,
  text,
}: {
  icon: 'summary' | 'blocker' | 'plan'
  text: string
}) {
  const meta = {
    summary: { node: <PenLine size={12} strokeWidth={1.75} />, cls: 'text-ink-2' },
    blocker: {
      node: <CircleAlert size={12} strokeWidth={1.75} />,
      cls: 'text-[color:var(--color-warn)]',
    },
    plan: { node: <CheckCircle2 size={12} strokeWidth={1.75} />, cls: 'text-ink-3' },
  }[icon]

  return (
    <div className="flex items-start gap-2">
      <span className={`mt-0.5 shrink-0 ${meta.cls}`}>{meta.node}</span>
      <p className={`text-xs leading-relaxed ${meta.cls}`}>{text}</p>
    </div>
  )
}
