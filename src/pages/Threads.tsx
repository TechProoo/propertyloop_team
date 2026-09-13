import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, ChevronLeft, MessageSquare, Send } from 'lucide-react'
import { useCurrentUser, useStore } from '../lib/storeContext'
import { decodeSubject, encodeSubject, threadsForSubject } from '../lib/metrics'
import { dateTime, displayName, initials, relative } from '../lib/format'
import { THREAD_SUBJECT_LABEL } from '../lib/types'
import type { Thread, ThreadSubject, ThreadSubjectKind } from '../lib/types'
import {
  Avatar,
  Badge,
  Button,
  Card,
  Empty,
  Field,
  Note,
  PageHeader,
  Select,
  Textarea,
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

  // A Discuss button anywhere in the app lands here as ?subject=KIND:ID. It
  // narrows the list to that record and, when nothing exists yet, opens the
  // composer already attached to it — so the first thread on a property is
  // one click from the property, not a form somebody fills in twice.
  const subjectParam = params.get('subject')
  const pinned = useMemo(() => decodeSubject(subjectParam), [subjectParam])
  const pinnedThreads = pinned
    ? threadsForSubject(threads, pinned.kind, pinned.id)
    : []

  // Composer visibility is DERIVED, not synced in an effect: open by default
  // when a record has no threads yet, and an explicit open/close overrides
  // that — but only for the record it was made on, so arriving at a different
  // record falls back to the default again.
  const autoCompose = pinned !== null && pinnedThreads.length === 0
  const [override, setOverride] = useState<{ key: string; open: boolean } | null>(
    null,
  )
  const subjectKey = subjectParam ?? ''
  const composing =
    override && override.key === subjectKey ? override.open : autoCompose

  const setComposing = (open: boolean) => setOverride({ key: subjectKey, open })

  const visible = useMemo(() => {
    return threads
      .filter((t) => {
        if (pinned) {
          return t.subject.kind === pinned.kind && t.subject.id === pinned.id
        }
        if (filter === 'MINE' && !t.participantIds.includes(me.id)) return false
        if (filter === 'OPEN' && t.resolved) return false
        if (filter === 'RESOLVED' && !t.resolved) return false
        return true
      })
      .sort((a, b) => lastActivity(b) - lastActivity(a))
  }, [threads, filter, me.id, pinned])

  const openId = params.get('open')
  const selected =
    threads.find((t) => t.id === openId) ?? visible[0] ?? threads[0] ?? null

  // Same rule as Messages: defaulting to the first thread is right when both
  // panes are on screen, but on a phone it would hide the list behind a
  // thread nobody chose.
  const openedOnPurpose = Boolean(openId)

  function select(id: string) {
    setParams({ open: id })
    setDraft('')
  }

  function clearPin() {
    setParams({})
    setOverride(null)
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

      {pinned && (
        <Card accent="teal" className="mb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-2">
              Showing threads about{' '}
              <strong className="font-semibold text-ink">
                {subjectLabel({ kind: pinned.kind, id: pinned.id }) ?? pinned.id}
              </strong>{' '}
              <Badge tone="info">{THREAD_SUBJECT_LABEL[pinned.kind]}</Badge>
            </p>
            <div className="flex gap-2">
              {!composing && (
                <Button size="sm" variant="primary" onClick={() => setComposing(true)}>
                  New thread about this
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={clearPin}>
                Show all threads
              </Button>
            </div>
          </div>
        </Card>
      )}

      {composing && (
        <NewThread
          staff={staff}
          meId={me.id}
          pinned={pinned}
          subjectLabel={subjectLabel}
          onCancel={() => setComposing(false)}
          onCreate={(title, subject, participants, message) => {
            const id = createThread(title, subject, participants, message)
            setComposing(false)
            // Keep the record filter on so the new thread appears in context.
            if (subject.kind !== 'GENERAL' && subject.id) {
              setParams({ subject: encodeSubject(subject.kind, subject.id), open: id })
            } else {
              select(id)
            }
            setDraft('')
          }}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <div className={openedOnPurpose ? 'hidden lg:block' : 'block'}>
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
          <div className={openedOnPurpose ? 'block' : 'hidden lg:block'}>
            <ThreadView
              thread={selected}
              subjectLabel={subjectLabel(selected.subject)}
              draft={draft}
              onDraft={setDraft}
              onBack={() => setParams(pinned ? { subject: subjectParam ?? '' } : {})}
              onSend={() => {
                postMessage(selected.id, draft)
                setDraft('')
              }}
              onToggleResolved={() => toggleThreadResolved(selected.id)}
            />
          </div>
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
  onBack,
}: {
  thread: Thread
  subjectLabel: string | null
  draft: string
  onDraft: (v: string) => void
  onSend: () => void
  onToggleResolved: () => void
  /** Returns to the thread list. Only reachable below lg. */
  onBack: () => void
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
        <div className="flex min-w-0 items-start gap-1.5">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to threads"
            className="-mt-0.5 -ml-1 shrink-0 rounded-lg p-1.5 text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink lg:hidden"
          >
            <ChevronLeft size={18} />
          </button>
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
  pinned,
  subjectLabel,
  onCancel,
  onCreate,
}: {
  staff: ReturnType<typeof useStore>['staff']
  meId: string
  /** Set when arriving from a Discuss button — the record is fixed. */
  pinned: { kind: ThreadSubjectKind; id: string } | null
  subjectLabel: (subject: ThreadSubject) => string | null
  onCancel: () => void
  onCreate: (
    title: string,
    subject: ThreadSubject,
    participants: string[],
    message: string,
  ) => void
}) {
  const { properties, deals, leads, shoots } = useStore()
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [picked, setPicked] = useState<string[]>([meId])
  const [kind, setKind] = useState<ThreadSubjectKind>(pinned?.kind ?? 'GENERAL')
  const [recordId, setRecordId] = useState<string>(pinned?.id ?? '')

  // The records a thread can be attached to, per kind.
  const options: { id: string; label: string }[] =
    kind === 'PROPERTY'
      ? properties.map((p) => ({ id: p.id, label: p.title }))
      : kind === 'DEAL'
        ? deals.map((d) => ({ id: d.id, label: d.company }))
        : kind === 'LEAD'
          ? leads.map((l) => ({ id: l.id, label: l.name }))
          : kind === 'SHOOT'
            ? shoots.map((sh) => ({ id: sh.id, label: sh.title }))
            : []

  const needsRecord = kind !== 'GENERAL'
  const valid = title.trim() !== '' && picked.length > 0 && (!needsRecord || recordId)

  function toggle(id: string) {
    setPicked((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    )
  }

  function changeKind(next: ThreadSubjectKind) {
    setKind(next)
    setRecordId('')
  }

  function submit() {
    if (!valid) return
    onCreate(
      title.trim(),
      { kind, id: needsRecord ? recordId : null },
      picked,
      message,
    )
  }

  return (
    <Card accent="teal" className="mb-4">
      <h2 className="mb-3 text-sm font-semibold text-ink">New thread</h2>
      <div className="grid gap-3.5">
        {pinned ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-teal/30 bg-teal-soft/40 px-3 py-2">
            <Badge tone="info">{THREAD_SUBJECT_LABEL[pinned.kind]}</Badge>
            <span className="text-sm text-ink">
              {subjectLabel({ kind: pinned.kind, id: pinned.id }) ?? pinned.id}
            </span>
            <span className="text-xs text-ink-3">— this thread stays on it</span>
          </div>
        ) : (
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="About">
              <Select
                ariaLabel="Thread subject kind"
                value={kind}
                onChange={(v) => changeKind(v as ThreadSubjectKind)}
              >
                {(
                  ['GENERAL', 'PROPERTY', 'DEAL', 'LEAD', 'SHOOT'] as ThreadSubjectKind[]
                ).map((k) => (
                  <option key={k} value={k}>
                    {k === 'GENERAL' ? 'Nothing in particular' : THREAD_SUBJECT_LABEL[k]}
                  </option>
                ))}
              </Select>
            </Field>
            {needsRecord && (
              <Field label="Which one?">
                <Select
                  ariaLabel="Record"
                  value={recordId}
                  onChange={setRecordId}
                >
                  <option value="">Choose…</option>
                  {options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>
        )}

        <Field label="Title">
          <TextInput
            ariaLabel="Thread title"
            value={title}
            onChange={setTitle}
            placeholder="What is this about?"
          />
        </Field>

        <Field label="First message">
          <Textarea
            ariaLabel="First message"
            value={message}
            onChange={setMessage}
            rows={3}
            placeholder="The reasoning worth finding again later."
          />
        </Field>

        <Field label="Participants">
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
        </Field>

        <div className="flex gap-2">
          <Button variant="primary" disabled={!valid} onClick={submit}>
            Create thread
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </Card>
  )
}
