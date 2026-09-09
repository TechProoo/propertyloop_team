import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MessagesSquare, Send, Users } from 'lucide-react'
import { useCurrentUser, useStore } from '../lib/storeContext'
import {
  directCounterpart,
  lastMessageAt,
  unreadCount,
} from '../lib/metrics'
import { dateTime, dayLabel, displayName, initials, isoDate, relative } from '../lib/format'
import { ALL_STAFF_CHANNEL_ID, STAFF_ROLE_SHORT } from '../lib/types'
import type { Channel, ChatMessage, Staff } from '../lib/types'
import {
  Avatar,
  Badge,
  Button,
  Card,
  Empty,
  Note,
  PageHeader,
  TextInput,
} from '../components/ui'

/**
 * Direct messages and the all-staff group.
 *
 * Distinct from Threads, which pins discussion to a specific record. This is
 * the ordinary back-and-forth. It maps onto the same Conversation /
 * ConversationParticipant / Message tables in the backend —
 * ConversationParticipant.lastReadAt already carries exactly the read state
 * used here — with an isInternal flag so staff conversations never surface in
 * the customer inbox.
 */
export function Messages() {
  const me = useCurrentUser()
  const { channels, staff, staffById, openDirect, sendMessage, markChannelRead } =
    useStore()

  const [params, setParams] = useSearchParams()
  const [draft, setDraft] = useState('')

  const mine = useMemo(
    () =>
      channels
        .filter((c) => c.memberIds.includes(me.id))
        .sort((a, b) => {
          // The group channel stays pinned at the top.
          if (a.id === ALL_STAFF_CHANNEL_ID) return -1
          if (b.id === ALL_STAFF_CHANNEL_ID) return 1
          return lastMessageAt(b) - lastMessageAt(a)
        }),
    [channels, me.id],
  )

  const openId = params.get('c')
  const selected = mine.find((c) => c.id === openId) ?? mine[0] ?? null

  // Opening a channel marks it read. Keyed on the message count too, so a
  // message arriving while it is open does not leave a stale badge.
  const selectedId = selected?.id
  const messageCount = selected?.messages.length ?? 0
  useEffect(() => {
    if (selectedId) markChannelRead(selectedId)
  }, [selectedId, messageCount, markChannelRead])

  function select(id: string) {
    setParams({ c: id })
    setDraft('')
  }

  // Colleagues with no direct channel yet — starting one creates it.
  const withoutDm = staff.filter(
    (s) =>
      s.id !== me.id &&
      !mine.some((c) => c.kind === 'DIRECT' && c.memberIds.includes(s.id)),
  )

  function channelTitle(c: Channel): string {
    if (c.kind === 'GROUP') return c.name ?? 'Group'
    const other = staffById(directCounterpart(c, me.id))
    return other ? displayName(other) : 'Direct message'
  }

  return (
    <>
      <PageHeader
        title="Messages"
        subtitle="Everyone in one group, and one-to-one with each colleague"
        icon={MessagesSquare}
        accent="teal"
      />

      <div className="grid gap-4 lg:grid-cols-[19rem_1fr]">
        <div className="flex flex-col gap-3">
          <Card padded={false}>
            <div className="flex flex-col gap-1 p-2">
              {mine.map((c) => {
                const unread = unreadCount(c, me.id)
                const last = c.messages[c.messages.length - 1]
                const author = staffById(last?.authorId ?? null)
                const isGroup = c.kind === 'GROUP'
                const other = staffById(directCounterpart(c, me.id))
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => select(c.id)}
                    className={`flex items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition-all duration-150 ${
                      selected?.id === c.id
                        ? 'bg-teal-soft ring-1 ring-teal/25'
                        : 'hover:bg-surface-2'
                    }`}
                  >
                    {isGroup ? (
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gold to-[#d9a44e] text-white">
                        <Users size={15} strokeWidth={1.9} />
                      </span>
                    ) : (
                      <Avatar
                        initials={other ? initials(other) : '?'}
                        seed={other?.id ?? c.id}
                      />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-medium text-ink">
                          {channelTitle(c)}
                        </span>
                        {last && (
                          <span className="shrink-0 text-[10px] text-ink-3">
                            {relative(last.createdAt)}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5">
                        <span className="min-w-0 flex-1 truncate text-xs text-ink-3">
                          {last
                            ? `${author && author.id === me.id ? 'You' : author ? displayName(author) : ''}: ${last.text}`
                            : 'No messages yet'}
                        </span>
                        {unread > 0 && (
                          <span className="shrink-0 rounded-full bg-gradient-to-br from-teal to-[#2aa8a5] px-1.5 py-0.5 text-[10px] font-bold text-white">
                            {unread}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </Card>

          {withoutDm.length > 0 && (
            <Card>
              <h2 className="mb-2 text-xs font-semibold tracking-wide text-ink-3 uppercase">
                Start a conversation
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {withoutDm.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => select(openDirect(s.id))}
                    className="rounded-full border border-line px-2.5 py-1 text-xs font-medium text-ink-2 transition-all duration-150 hover:-translate-y-px hover:border-teal/40 hover:bg-teal-soft/40 hover:text-teal-ink"
                  >
                    {displayName(s)}
                  </button>
                ))}
              </div>
            </Card>
          )}
        </div>

        {selected ? (
          <ChannelView
            channel={selected}
            title={channelTitle(selected)}
            draft={draft}
            onDraft={setDraft}
            onSend={() => {
              sendMessage(selected.id, draft)
              setDraft('')
            }}
          />
        ) : (
          <Empty>Select a conversation.</Empty>
        )}
      </div>

      <div className="mt-6">
        <Note>
          Messages here are ordinary conversation. Anything that changes the
          state of a record — why a listing was held, what was agreed on a
          mandate — belongs on that record&apos;s thread instead, where the
          next person to open it will find it.
        </Note>
      </div>
    </>
  )
}

function ChannelView({
  channel,
  title,
  draft,
  onDraft,
  onSend,
}: {
  channel: Channel
  title: string
  draft: string
  onDraft: (v: string) => void
  onSend: () => void
}) {
  const me = useCurrentUser()
  const { staffById } = useStore()
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' })
  }, [channel.id, channel.messages.length])

  const members = channel.memberIds
    .map((id) => staffById(id))
    .filter((s): s is Staff => s !== null)
  const other =
    channel.kind === 'DIRECT'
      ? members.find((s) => s.id !== me.id) ?? null
      : null

  // Group consecutive messages by calendar day so long channels stay readable.
  const groups: { day: string; messages: ChatMessage[] }[] = []
  for (const m of channel.messages) {
    const day = isoDate(new Date(m.createdAt))
    const last = groups[groups.length - 1]
    if (last && last.day === day) last.messages.push(m)
    else groups.push({ day, messages: [m] })
  }

  return (
    <Card padded={false} accent="teal" className="flex flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-teal-soft/20 p-4 pt-5">
        <div className="flex min-w-0 items-center gap-2.5">
          {channel.kind === 'GROUP' ? (
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gold to-[#d9a44e] text-white shadow-[var(--shadow-tile)]">
              <Users size={19} strokeWidth={1.9} />
            </span>
          ) : (
            <Avatar
              initials={other ? initials(other) : '?'}
              size="lg"
              seed={other?.id}
            />
          )}
          <div className="min-w-0">
            <h2 className="truncate font-display text-lg leading-tight text-ink">
              {title}
            </h2>
            <p className="truncate text-xs text-ink-3">
              {channel.kind === 'GROUP'
                ? `${members.length} members — everyone`
                : other
                  ? STAFF_ROLE_SHORT[other.role]
                  : ''}
            </p>
          </div>
        </div>
        {channel.kind === 'GROUP' && <Badge tone="accent">All staff</Badge>}
      </header>

      <div className="flex max-h-[28rem] flex-col gap-4 overflow-y-auto p-4">
        {channel.messages.length === 0 && (
          <Empty>No messages yet. Say something.</Empty>
        )}
        {groups.map((g) => (
          <div key={g.day} className="flex flex-col gap-3.5">
            <div className="flex items-center gap-2">
              <span className="h-px flex-1 bg-line" />
              <span className="text-[10px] tracking-wide text-ink-3 uppercase">
                {dayLabel(g.day)}
              </span>
              <span className="h-px flex-1 bg-line" />
            </div>
            {g.messages.map((m) => {
              const author = staffById(m.authorId)
              const isMine = m.authorId === me.id
              return (
                <div
                  key={m.id}
                  className={`flex gap-2.5 ${isMine ? 'flex-row-reverse' : ''}`}
                >
                  <Avatar
                    initials={author ? initials(author) : '?'}
                    size="sm"
                    seed={m.authorId}
                    title={author ? displayName(author) : undefined}
                  />
                  <div className={`min-w-0 max-w-[80%] ${isMine ? 'text-right' : ''}`}>
                    <div
                      className={`flex items-baseline gap-2 ${isMine ? 'justify-end' : ''}`}
                    >
                      <span className="text-xs font-medium text-ink">
                        {isMine ? 'You' : author ? displayName(author) : 'Unknown'}
                      </span>
                      <span className="text-[10px] text-ink-3">
                        {dateTime(m.createdAt)}
                      </span>
                    </div>
                    <p
                      className={`pl-fade mt-1 inline-block px-3.5 py-2 text-left text-sm leading-relaxed shadow-[var(--shadow-tile)] ${
                        isMine
                          ? 'rounded-2xl rounded-tr-md bg-gradient-to-br from-primary to-primary-ink text-white'
                          : 'rounded-2xl rounded-tl-md bg-surface-2 text-ink'
                      }`}
                    >
                      {m.text}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
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
          placeholder={
            channel.kind === 'GROUP'
              ? 'Message everyone'
              : `Message ${title}`
          }
        />
        <Button type="submit" variant="primary" disabled={!draft.trim()}>
          <Send size={14} />
        </Button>
      </form>
    </Card>
  )
}
