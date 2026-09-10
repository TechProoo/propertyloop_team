import { Link } from 'react-router-dom'
import { MessageSquare, MessageSquarePlus } from 'lucide-react'
import { useStore } from '../lib/storeContext'
import { encodeSubject, openThreadCount } from '../lib/metrics'
import type { ThreadSubjectKind } from '../lib/types'

/**
 * "Discuss this" — the entry point that makes threads-on-records real.
 *
 * Every one of these links to the same URL shape, `/threads?subject=KIND:ID`.
 * The Threads screen filters to that record, and opens the composer already
 * attached to it when there is nothing there yet. One shape means a Discuss
 * button can be dropped onto any record screen without new plumbing.
 */
export function DiscussButton({
  kind,
  id,
  compact = false,
  label = 'Discuss',
}: {
  kind: ThreadSubjectKind
  id: string
  /** Icon and count only — for dense rows and cards. */
  compact?: boolean
  label?: string
}) {
  const { threads } = useStore()
  const count = openThreadCount(threads, kind, id)
  const to = `/threads?subject=${encodeSubject(kind, id)}`

  const title =
    count === 0
      ? 'Start a thread about this'
      : `${count} open ${count === 1 ? 'thread' : 'threads'} about this`

  if (compact) {
    return (
      <Link
        to={to}
        title={title}
        onClick={(e) => e.stopPropagation()}
        className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-1.5 py-1 text-[11px] font-semibold transition-colors ${
          count > 0
            ? 'bg-teal-soft text-teal-ink hover:bg-teal-soft/70'
            : 'text-ink-3 hover:bg-surface-2 hover:text-teal'
        }`}
      >
        {count > 0 ? (
          <>
            <MessageSquare size={12} strokeWidth={2} />
            {count}
          </>
        ) : (
          <MessageSquarePlus size={12} strokeWidth={2} />
        )}
      </Link>
    )
  }

  return (
    <Link
      to={to}
      title={title}
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-semibold transition-all duration-150 hover:-translate-y-px ${
        count > 0
          ? 'border-teal/30 bg-teal-soft text-teal-ink'
          : 'border-line text-ink-2 hover:border-teal/40 hover:text-teal'
      }`}
    >
      <MessageSquare size={13} strokeWidth={2} />
      {count > 0 ? `${count} ${count === 1 ? 'thread' : 'threads'}` : label}
    </Link>
  )
}
