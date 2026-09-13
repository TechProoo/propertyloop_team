import { Fragment, useMemo, useState } from 'react'
import {
  BadgeCheck,
  Building2,
  Check,
  FileWarning,
  Image,
  Pencil,
  Plus,
  Rocket,
  Video,
  X,
} from 'lucide-react'
import { useCurrentUser, useStore } from '../lib/storeContext'
import { can } from '../lib/permissions'
import { documentCompletion, isPublishable, publishBlockers } from '../lib/metrics'
import { displayName, naira, relative, shortDate } from '../lib/format'
import {
  DOCUMENT_TYPE_LABEL,
  DOCUMENT_TYPE_SHORT,
  LISTING_STATUS_LABEL,
  LISTING_TYPE_LABEL,
} from '../lib/types'
import type { ListingStatus, Property } from '../lib/types'
import {
  Badge,
  Button,
  Card,
  Empty,
  Note,
  PageHeader,
  Progress,
  Select,
  Stat,
  Td,
  TableWrap,
  Th,
  Tr,
  TextInput,
} from '../components/ui'
import type { BadgeTone } from '../components/ui'
import { PropertyForm } from '../components/forms'
import { DiscussButton } from '../components/DiscussButton'

const STATUS_TONE: Record<ListingStatus, BadgeTone> = {
  PENDING_REVIEW: 'warn',
  ACTIVE: 'ok',
  PAUSED: 'neutral',
  SOLD: 'info',
  RENTED: 'info',
  ARCHIVED: 'neutral',
}

/**
 * The property pipeline.
 *
 * Status values here are identical to Listing.status in the Prisma schema
 * (PENDING_REVIEW / ACTIVE / PAUSED / SOLD / RENTED / ARCHIVED) because the
 * product database is the authority on what is actually published. This
 * screen is a working view onto that pipeline, not a second copy of it —
 * "published" must mean the same thing in both places or the number is
 * fiction.
 */
export function Properties() {
  const me = useCurrentUser()
  const { properties, staffById, setPropertyStatus, toggleDocVerified } = useStore()

  const canPublish = can(me, 'PUBLISH_PROPERTY')
  const canVerify = can(me, 'VERIFY_DOCUMENTS')
  const canAdd = can(me, 'MANAGE_PROPERTIES')

  const [status, setStatus] = useState('ALL')
  const [chapter, setChapter] = useState('ALL')
  const [sourced, setSourced] = useState('ALL')
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Property | null>(null)

  const filtered = useMemo(() => {
    return properties.filter((p) => {
      if (status !== 'ALL' && p.status !== status) return false
      if (chapter !== 'ALL' && p.chapter !== chapter) return false
      if (sourced !== 'ALL' && p.sourcedById !== sourced) return false
      if (query) {
        const q = query.toLowerCase()
        if (
          !p.title.toLowerCase().includes(q) &&
          !p.location.toLowerCase().includes(q) &&
          !(p.developer ?? '').toLowerCase().includes(q)
        ) {
          return false
        }
      }
      return true
    })
  }, [properties, status, chapter, sourced, query])

  const pending = properties.filter((p) => p.status === 'PENDING_REVIEW')
  const blocked = pending.filter((p) => !isPublishable(p))
  const readyToPublish = pending.filter(isPublishable)

  const sourcers = [...new Set(properties.map((p) => p.sourcedById))]

  return (
    <>
      <PageHeader
        title="Properties"
        subtitle="Acquire → verify → publish. Status matches Listing.status on the website."
        icon={Building2}
        accent="green"
        actions={
          canAdd && (
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus size={15} />
              Add property
            </Button>
          )
        }
      />

      {creating && <PropertyForm onClose={() => setCreating(false)} />}
      {editing && (
        <PropertyForm existing={editing} onClose={() => setEditing(null)} />
      )}

      <div className="pl-stagger mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Published"
          value={properties.filter((p) => p.status === 'ACTIVE').length}
          sub="Live on propertyloop.ng"
          tone="ok"
          icon={Rocket}
        />
        <Stat
          label="Pending review"
          value={pending.length}
          sub="Awaiting verification"
          accent="blue"
          icon={Image}
        />
        <Stat
          label="Blocked"
          value={blocked.length}
          sub="Missing photos or documents"
          tone={blocked.length > 0 ? 'warn' : 'default'}
          icon={FileWarning}
        />
        <Stat
          label="Ready to publish"
          value={readyToPublish.length}
          sub="All documents verified"
          tone={readyToPublish.length > 0 ? 'ok' : 'default'}
          icon={BadgeCheck}
        />
      </div>

      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <TextInput
            ariaLabel="Search properties"
            value={query}
            onChange={setQuery}
            placeholder="Search title, location or developer"
          />
          <Select ariaLabel="Filter by status" value={status} onChange={setStatus}>
            <option value="ALL">All statuses</option>
            {Object.entries(LISTING_STATUS_LABEL).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </Select>
          <Select ariaLabel="Filter by chapter" value={chapter} onChange={setChapter}>
            <option value="ALL">All chapters</option>
            <option value="LAGOS">Lagos</option>
            <option value="OSUN">Osun</option>
          </Select>
          <Select ariaLabel="Filter by who sourced it" value={sourced} onChange={setSourced}>
            <option value="ALL">Anyone sourced</option>
            {sourcers.map((id) => {
              const s = staffById(id)
              return (
                <option key={id} value={id}>
                  {s ? displayName(s) : id}
                </option>
              )
            })}
          </Select>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Empty>No properties match these filters.</Empty>
      ) : (
        <TableWrap>
          <table className="w-full min-w-[62rem] border-collapse">
            <thead>
              <tr>
                <Th>Property</Th>
                <Th>Price</Th>
                <Th>Documents</Th>
                <Th>Media</Th>
                <Th>Sourced by</Th>
                <Th>Status</Th>
                <Th className="text-right">Action</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const sourcer = staffById(p.sourcedById)
                const blockers = publishBlockers(p)
                const isOpen = expanded === p.id
                return (
                  <Fragment key={p.id}>
                    <Tr className="align-top">
                      <Td>
                        <button
                          type="button"
                          onClick={() => setExpanded(isOpen ? null : p.id)}
                          className="text-left"
                        >
                          <span className="block font-medium text-ink hover:text-primary">
                            {p.title}
                          </span>
                          <span className="mt-0.5 block text-xs text-ink-3">
                            {p.location} · {LISTING_TYPE_LABEL[p.type]}
                            {p.developer && ` · ${p.developer}`}
                          </span>
                        </button>
                      </Td>
                      <Td className="whitespace-nowrap">
                        {naira(p.priceNaira)}
                        {p.units > 1 && (
                          <span className="mt-0.5 block text-xs text-ink-3">
                            {p.units - p.unitsSold} of {p.units} left
                          </span>
                        )}
                      </Td>
                      <Td>
                        <div className="flex w-32 items-center gap-2">
                          <Progress value={documentCompletion(p)} className="flex-1" />
                          <span className="text-xs text-ink-3">
                            {p.documents.filter((d) => d.present && d.verified).length}/4
                          </span>
                        </div>
                      </Td>
                      <Td>
                        <span className="flex items-center gap-2.5 text-xs text-ink-2">
                          <span
                            className={`flex items-center gap-1 ${p.photoCount < 8 ? 'text-[color:var(--color-warn)]' : ''}`}
                          >
                            <Image size={13} strokeWidth={1.75} />
                            {p.photoCount}
                          </span>
                          {p.hasVideo && (
                            <span className="flex items-center gap-1 text-primary">
                              <Video size={13} strokeWidth={1.75} />
                            </span>
                          )}
                        </span>
                      </Td>
                      <Td className="whitespace-nowrap">
                        <span className="text-xs text-ink-2">
                          {sourcer ? displayName(sourcer) : '—'}
                        </span>
                        <span className="mt-0.5 block text-xs text-ink-3">
                          {relative(p.submittedAt)}
                        </span>
                      </Td>
                      <Td>
                        <Badge tone={STATUS_TONE[p.status]}>
                          {LISTING_STATUS_LABEL[p.status]}
                        </Badge>
                        {p.chapter === 'OSUN' && (
                          <span className="mt-1 block">
                            <Badge tone="info">Osun</Badge>
                          </span>
                        )}
                      </Td>
                      <Td className="text-right whitespace-nowrap">
                        <span className="mr-1.5 inline-flex items-center gap-0.5 align-middle">
                          <DiscussButton kind="PROPERTY" id={p.id} compact />
                          {canAdd && (
                            <button
                              type="button"
                              onClick={() => setEditing(p)}
                              aria-label={`Edit ${p.title}`}
                              title="Edit"
                              className="rounded-lg p-1.5 text-ink-3 transition-colors hover:bg-surface-2 hover:text-primary"
                            >
                              <Pencil size={13} strokeWidth={2} />
                            </button>
                          )}
                        </span>
                        {p.status === 'PENDING_REVIEW' &&
                          (blockers.length === 0 ? (
                            canPublish ? (
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => setPropertyStatus(p.id, 'ACTIVE')}
                              >
                                Publish
                              </Button>
                            ) : (
                              <Badge tone="ok">Ready</Badge>
                            )
                          ) : (
                            <span
                              title={blockers.join(' · ')}
                              className="inline-flex items-center gap-1 text-xs text-[color:var(--color-warn)]"
                            >
                              <FileWarning size={13} />
                              {blockers.length} blocker
                              {blockers.length === 1 ? '' : 's'}
                            </span>
                          ))}
                        {p.status === 'ACTIVE' && canPublish && (
                          <Button size="sm" onClick={() => setPropertyStatus(p.id, 'PAUSED')}>
                            Pause
                          </Button>
                        )}
                        {p.status === 'PAUSED' && canPublish && (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => setPropertyStatus(p.id, 'ACTIVE')}
                          >
                            Republish
                          </Button>
                        )}
                      </Td>
                    </Tr>
                    {isOpen && (
                      <tr>
                        <Td colSpan={7} className="bg-surface-2/40">
                          <DocumentPanel
                            property={p}
                            canVerify={canVerify}
                            onToggle={(type) => toggleDocVerified(p.id, type)}
                          />
                        </Td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </TableWrap>
      )}

      <div className="mt-6">
        <Note>
          A property counts as verified only when all four documents are
          present and checked. Publishing is gated on that plus photographs —
          the gate exists here so "we have properties" becomes a number
          somebody can audit. The <code>sourcedById</code> field driving the
          attribution column has no equivalent in the Prisma schema yet;
          adding it is what makes each person's acquisition figure verifiable.
        </Note>
      </div>
    </>
  )
}

function DocumentPanel({
  property,
  canVerify,
  onToggle,
}: {
  property: Property
  canVerify: boolean
  onToggle: (docType: string) => void
}) {
  return (
    <div className="py-1">
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-ink-2 uppercase">
        Documents — submitted {shortDate(property.submittedAt)}
      </h3>
      <div className="flex flex-wrap gap-2">
        {property.documents.map((d) => {
          const tone = !d.present ? 'danger' : d.verified ? 'ok' : 'warn'
          const label = !d.present
            ? 'Missing'
            : d.verified
              ? 'Verified'
              : 'Unverified'
          return (
            <div
              key={d.type}
              className="flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-1.5"
            >
              <span className="text-xs text-ink" title={DOCUMENT_TYPE_LABEL[d.type]}>
                {DOCUMENT_TYPE_SHORT[d.type]}
              </span>
              <Badge tone={tone}>{label}</Badge>
              {d.present && canVerify && (
                <button
                  type="button"
                  onClick={() => onToggle(d.type)}
                  aria-label={d.verified ? 'Mark unverified' : 'Mark verified'}
                  className="rounded p-0.5 text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
                >
                  {d.verified ? <X size={13} /> : <Check size={13} />}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
