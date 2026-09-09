import { Database, Gauge, PenLine, Target as TargetIcon } from 'lucide-react'
import { useCurrentUser, useStore } from '../lib/storeContext'
import { can } from '../lib/permissions'
import { staffScore, targetMet, targetProgress } from '../lib/metrics'
import { displayName, formatTargetValue, initials } from '../lib/format'
import { STAFF_ROLE_LABEL } from '../lib/types'
import type { Staff, Target } from '../lib/types'
import {
  Avatar,
  Badge,
  Card,
  Empty,
  Note,
  PageHeader,
  Progress,
  Stat,
} from '../components/ui'

/**
 * Monthly targets from the September 2026 org document.
 *
 * The `provenance` column is the point of this screen. A target whose actual
 * comes from the database is a fact; one that somebody types is a claim. A
 * scorecard made mostly of claims measures diligence in reporting rather
 * than results, so the split is shown rather than hidden.
 */
export function Targets() {
  const me = useCurrentUser()
  const { targets, staff } = useStore()

  const seesAll = can(me.role, 'VIEW_ALL_TARGETS')
  const people = seesAll ? staff : staff.filter((s) => s.id === me.id)

  const manual = targets.filter((t) => t.provenance === 'MANUAL').length
  const fromDb = targets.length - manual

  return (
    <>
      <PageHeader
        title="Targets"
        subtitle={
          seesAll
            ? 'Monthly targets and progress across the team'
            : 'Your monthly targets'
        }
        icon={TargetIcon}
        accent="gold"
      />

      {seesAll && (
        <div className="pl-stagger mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Targets met"
            value={targets.filter(targetMet).length}
            sub={`of ${targets.length} tracked`}
            accent="gold"
            icon={TargetIcon}
          />
          <Stat
            label="From the database"
            value={fromDb}
            sub="Queryable, not self-reported"
            tone="ok"
            icon={Database}
          />
          <Stat
            label="Manually entered"
            value={manual}
            sub="Someone types these"
            tone={manual > 0 ? 'warn' : 'default'}
            icon={PenLine}
          />
          <Stat
            label="Team average"
            value={`${Math.round(
              staff.reduce((n, s) => n + (staffScore(targets, s.id) ?? 0), 0) /
                Math.max(1, staff.length),
            )}%`}
            sub="Average progress across everyone"
            accent="blue"
            icon={Gauge}
          />
        </div>
      )}

      <div className="pl-stagger flex flex-col gap-4">
        {people.map((person) => (
          <PersonTargets
            key={person.id}
            person={person}
            targets={targets.filter((t) => t.staffId === person.id)}
          />
        ))}
      </div>

      {seesAll && (
        <div className="mt-6">
          <Note>
            Two figures in this document contradict each other and the
            scorecard cannot resolve it: Marketing is asked for 150–200
            qualified leads a month, and the General Manager to convert 25% of
            qualified leads. That would be 37–50 closed deals against a target
            of 8–12 mandates. Either the conversion rate or the definition of
            &quot;qualified&quot; has to give — see the lead pipeline, where
            qualification is one shared flag.
          </Note>
        </div>
      )}
    </>
  )
}

function PersonTargets({ person, targets }: { person: Staff; targets: Target[] }) {
  const score = targets.length === 0 ? null : staffScore(targets, person.id)

  return (
    <Card accent={score !== null && score >= 100 ? 'green' : 'gold'} hover>
      <div className="mb-4 flex items-center gap-3">
        <Avatar initials={initials(person)} size="lg" seed={person.id} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-ink">
            {displayName(person)}
            {person.name === null && (
              <span className="ml-2 text-xs font-normal text-ink-3">
                (position unfilled)
              </span>
            )}
          </h2>
          <p className="truncate text-xs text-ink-3">
            {STAFF_ROLE_LABEL[person.role]}
            {person.secondaryChapter && ` · also ${person.secondaryChapter} chapter`}
          </p>
        </div>
        <div className="text-right">
          <div className="font-display text-2xl leading-none text-ink">
            {score === null ? '—' : `${score}%`}
          </div>
          <div className="mt-1 text-[11px] text-ink-3">
            {targets.filter(targetMet).length}/{targets.length} met
          </div>
        </div>
      </div>

      {targets.length === 0 ? (
        <Empty>No targets set for this position.</Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {targets.map((t) => {
            const progress = targetProgress(t)
            const range =
              t.min === t.max
                ? formatTargetValue(t.min, t.unit)
                : `${formatTargetValue(t.min, t.unit)}–${formatTargetValue(t.max, t.unit)}`
            return (
              <div
                key={t.id}
                className="rounded-xl border border-line bg-surface-2/20 p-3 transition-colors hover:border-primary/30 hover:bg-surface-2/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm leading-snug text-ink">{t.label}</span>
                  <span
                    title={
                      t.provenance === 'DATABASE'
                        ? 'Derived from records — nobody types this'
                        : 'Entered by hand from an external source'
                    }
                    className="mt-0.5 shrink-0 text-ink-3"
                  >
                    {t.provenance === 'DATABASE' ? (
                      <Database size={13} strokeWidth={1.75} />
                    ) : (
                      <PenLine size={13} strokeWidth={1.75} />
                    )}
                  </span>
                </div>

                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-display text-xl leading-none text-ink">
                    {formatTargetValue(t.actual, t.unit)}
                  </span>
                  <span className="text-xs text-ink-3">of {range}</span>
                  {targetMet(t) && <Badge tone="ok">met</Badge>}
                </div>

                <Progress value={progress} className="mt-2" />
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
