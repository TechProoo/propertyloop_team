import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, MessageSquare, Send } from 'lucide-react'
import { useCurrentUser, useStore } from '../lib/storeContext'
import { dateTime, displayName, initials, relative } from '../lib/format'
import { THREAD_SUBJECT_LABEL } from '../lib/types'
import type { Thread, ThreadSubject } from '../lib/types'
import {
  Avatar,
  Badge,
  Button,
  Card,
  Empty,
  Note,
  PageHeader,
  Select,
  TextInput,
} from '../components/ui'

/**
 * Internal discussion, attached to a record.
 *
 * The deliberate choice here is that this is NOT a general team chat.
 * WhatsApp already does chat, everyone is already in it, and a chat tab
 * inside a portal will lose to it. What WhatsApp cannot do is hold a
 * conversation against a specific property, deal or lead so the reasoning
 * survives next to the thing it was about.
 *
 * Conversation in the Prisma schema already carries an optional listingId,
 * so this maps onto the existing messaging tables — with one addition: an
 * isInternal flag, because listConversations() currently returns every
 * conversation a user belongs to and staff threads would otherwise surface
 * in the customer inbox.
 */
export function Threads() {
  const me = useCurrentUser()
  const {
    threads,
    staffById,
    propertyById,
    dealById,
    leadById,
    shootById,
    postMessage,
    toggleThreadResolved,
    createThread,
    staff,
  } = useStore()

  const [params, setParams] = useSearchParams()
  const [filter, setFilter] = useState('MINE')
  const [draft, setDraft] = useState('')
  const [composing, setComposing] = useState(false)

  const visible = useMemo(() => {
    return threads
      .filter((t) => {
        if (filter === 'MINE' && !t.participantIds.includes(me.id)) return false
        if (filter === 'OPEN' && t.resolved) return false
        if (filter === 'RESOLVED' && !t.resolved) return false
        return true
      })
      .sort((a, b) => lastActivity(b) - lastActivity(a))
  }, [threads, filter, me.id])

  const openId = params.get('open')
  const selected =
    threads.find((t) => t.id === openId) ?? visible[0] ?? threads[0] ?? null

  function select(id: string) {
    setParams({ open: id })
    setDraft('')
  }

  function subjectLabel(subject: ThreadSubject): string | null {
    if (subject.kind === 'PROPERTY') return propertyById(subject.id)?.title ?? null
    if (subject.kind === 'DEAL') return dealById(subject.id)?.company ?? null
    if (subject.kind === 'LEAD') return leadById(subject.id)?.name ?? null
    if (subject.kind === 'SHOOT') return shootById(subject.id)?.title ?? null
    return null
  }

  return (
    <>
      <PageHeader
        title="Threads"
        subtitle="Discussion attached to a property, deal, lead or shoot"
        icon={MessageSquare}
        accent="teal"
        actions={
          <Button variant="primary" onClick={() => setComposing(true)}>
            New thread
          </Button>
        }
      />

      {composing && (
        <NewThread
          staff={staff}
          meId={me.id}
          onCancel={() => setComposing(false)}
          onCreate={(title, participants, message) => {
            const id = createThread(
              title,
              { kind: 'GENERAL', id: null },
              participants,
              message,
            )
            setComposing(false)
            select(id)
          }}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <div>
          <Select
            ariaLabel="Filter threads"
            value={filter}
            onChange={setFilter}
            className="mb-2"
          >
            <option value="MINE">Threads I am on</option>
            <option value="OPEN">All open</option>
            <option value="RESOLVED">Resolved</option>
            <option value="ALL">Everything</option>
          </Select>

          {visible.length === 0 ? (
            <Empty>No threads here.</Empty>
          ) : (
            <div className="pl-stagger flex max-h-[34rem] flex-col gap-1.5 overflow-y-auto pr-1">
              {visible.map((t) => {
                const last = t.messages[t.messages.length - 1]
                const author = staffById(last?.authorId ?? null)
                const isSelected = selected?.id === t.id
                const subject = subjectLabel(t.subject)
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => select(t.id)}
                    className={`rounded-xl border px-3 py-2.5 text-left transition-all duration-150 ${
                      isSelected
                        ? 'border-teal/40 bg-teal-soft/50 shadow-[var(--shadow-tile)]'
                        : 'border-line bg-surface hover:-translate-y-px hover:border-teal/30 hover:shadow-[var(--shadow-tile)]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm leading-snug font-medium text-ink">
                        {t.title}
                      </span>
                      {t.resolved && <Badge tone="ok">Resolved</Badge>}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge tone={t.subject.kind === 'GENERAL' ? 'neutral' : 'info'}>
                        {THREAD_SUBJECT_LABEL[t.subject.kind]}
                      </Badge>
                      {subject && (
                        <span className="truncate text-[11px] text-ink-3">{subject}</span>
                      )}
                    </div>
                    {last && (
                      <div className="mt-1 truncate text-xs text-ink-3">
                        {author ? displayName(author) : 'Someone'}: {last.text}
                      </div>
                    )}
                    <div className="mt-1 text-[11px] text-ink-3">
                      {last ? relative(last.createdAt) : relative(t.createdAt)}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {selected ? (
          <ThreadView
            thread={selected}
            subjectLabel={subjectLabel(selected.subject)}
            draft={draft}
            onDraft={setDraft}
            onSend={() => {
              postMessage(selected.id, draft)
              setDraft('')
            }}
            onToggleResolved={() => toggleThreadResolved(selected.id)}
          />
        ) : (
          <Empty>Select a thread.</Empty>
        )}
      </div>

      <div className="mt-6">
        <Note>
          This is deliberately not a general team chat. WhatsApp is better at
          chat and everyone is already there — keep &quot;where are you&quot;
          in WhatsApp. What belongs here is the reasoning that has to stay
          next to the record: why a listing was held, what was agreed on a
          mandate, what the decision was. Anything that changes a record&apos;s
          state gets written here, or it evaporates into scrollback.
        </Note>
      </div>
    </>
  )
}

function lastActivity(t: Thread): number {
  const last = t.messages[t.messages.length - 1]
  return new Date(last?.createdAt ?? t.createdAt).getTime()
}

function ThreadView({
  thread,
  subjectLabel,
  draft,
  onDraft,
  onSend,
  onToggleResolved,
}: {
  thread: Thread
  subjectLabel: string | null
  draft: string
  onDraft: (v: string) => void
  onSend: () => void
  onToggleResolved: () => void
}) {
  const me = useCurrentUser()
  const { staffById } = useStore()
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' })
  }, [thread.id, thread.messages.length])

  return (
    <Card padded={false} accent="teal" className="flex flex-col">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line bg-teal-soft/20 p-4 pt-5">
        <div className="min-w-0">
          <h2 className="font-display text-lg leading-tight text-ink">{thread.title}</h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge tone={thread.subject.kind === 'GENERAL' ? 'neutral' : 'info'}>
              {THREAD_SUBJECT_LABEL[thread.subject.kind]}
            </Badge>
            {subjectLabel && (
              <span className="text-xs text-ink-3">{subjectLabel}</span>
            )}
            <span className="text-xs text-ink-3">
              · {thread.participantIds.length} participants
            </span>
          </div>
        </div>
        <Button size="sm" onClick={onToggleResolved}>
          {thread.resolved ? (
            'Reopen'
          ) : (
            <>
              <Check size={13} />
              Resolve
            </>
          )}
        </Button>
      </header>

      <div className="flex max-h-[26rem] flex-col gap-4 overflow-y-auto p-4">
        {thread.messages.length === 0 && <Empty>No messages yet.</Empty>}
        {thread.messages.map((m) => {
          const author = staffById(m.authorId)
          const mine = m.authorId === me.id
          return (
            <div key={m.id} className="flex gap-2.5">
              <Avatar
                initials={author ? initials(author) : '?'}
                size="sm"
                seed={m.authorId}
                title={author ? displayName(author) : undefined}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium text-ink">
                    {author ? displayName(author) : 'Unknown'}
                    {mine && <span className="ml-1 text-xs text-ink-3">(you)</span>}
                  </span>
                  <span className="text-[11px] text-ink-3">{dateTime(m.createdAt)}</span>
                </div>
                <p className="mt-0.5 text-sm leading-relaxed text-ink-2">{m.text}</p>
              </div>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSend()
        }}
        className="flex gap-2 border-t border-line p-3"
      >
        <TextInput
          ariaLabel="Message"
          value={draft}
          onChange={onDraft}
          placeholder={thread.resolved ? 'Reopen to reply' : 'Write a message'}
        />
        <Button type="submit" variant="primary" disabled={!draft.trim()}>
          <Send size={14} />
        </Button>
      </form>
    </Card>
  )
}

function NewThread({
  staff,
  meId,
  onCancel,
  onCreate,
}: {
  staff: ReturnType<typeof useStore>['staff']
  meId: string
  onCancel: () => void
  onCreate: (title: string, participants: string[], message: string) => void
}) {
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [picked, setPicked] = useState<string[]>([meId])

  function toggle(id: string) {
    setPicked((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    )
  }

  return (
    <Card className="mb-4">
      <h2 className="mb-3 text-sm font-semibold text-ink">New thread</h2>
      <div className="grid gap-3">
        <TextInput
          ariaLabel="Thread title"
          value={title}
          onChange={setTitle}
          placeholder="What is this about?"
        />
        <TextInput
          ariaLabel="First message"
          value={message}
          onChange={setMessage}
          placeholder="First message"
        />
        <div>
          <span className="mb-1.5 block text-xs font-medium tracking-wide text-ink-3 uppercase">
            Participants
          </span>
          <div className="flex flex-wrap gap-1.5">
            {staff.map((s) => {
              const on = picked.includes(s.id)
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggle(s.id)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-all duration-150 ${
                    on
                      ? 'border-teal bg-teal-soft text-teal-ink'
                      : 'border-line text-ink-2 hover:-translate-y-px hover:border-teal/40'
                  }`}
                >
                  {displayName(s)}
                </button>
              )
            })}
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="primary"
            disabled={!title.trim() || picked.length === 0}
            onClick={() => onCreate(title.trim(), picked, message)}
          >
            Create
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </Card>
  )
}
