import { useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import { ExternalLink, FileText, Loader2, ShieldCheck, Video, X } from 'lucide-react'
import { useStore } from '../lib/storeContext'
import { propertiesApi } from '../api/collections'
import { apiErrorMessage } from '../lib/api'
import { DOCUMENT_TYPE_LABEL } from '../lib/types'
import type { DocumentType } from '../lib/types'

/*
 * Documents and videos, with the website agent form's rules: documents are
 * PDF, JPG or PNG up to 10MB with the type guessed from the file name; videos
 * are uploaded files up to 50MB or YouTube / Vimeo links.
 */

const DOC_MAX = 10 * 1024 * 1024
const VIDEO_MAX = 50 * 1024 * 1024
const MAX_VIDEOS = 10
const DOC_ACCEPT = '.pdf,image/jpeg,image/png'
const DOC_MIME = ['application/pdf', 'image/jpeg', 'image/png']
const DOC_TYPES = Object.keys(DOCUMENT_TYPE_LABEL) as DocumentType[]

/** The agent form's rule: guess from the name, Certificate of Occupancy by default. */
function inferDocType(name: string): DocumentType {
  const n = name.toLowerCase()
  if (n.includes('survey')) return 'SURVEY_PLAN'
  if (n.includes('permit')) return 'BUILDING_PERMIT'
  if (n.includes('receipt')) return 'RECEIPT'
  return 'C_OF_O'
}

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`
const isVideoLink = (v: string) => /^https?:\/\//i.test(v) && /youtu|vimeo/i.test(v)
const videoLabel = (url: string, i: number) =>
  /youtu/i.test(url) ? 'YouTube Video' : /vimeo/i.test(url) ? 'Vimeo Video' : `Video ${i + 1}`

function screen(files: File[], max: number, accept: (f: File) => boolean, what: string) {
  const ok: File[] = []
  const skipped: string[] = []
  for (const f of files) {
    if (!accept(f)) {
      skipped.push(`${f.name} (not ${what})`)
    } else if (f.size > max) {
      skipped.push(`${f.name} (${(f.size / 1024 / 1024).toFixed(1)}MB > ${max / 1024 / 1024}MB)`)
    } else {
      ok.push(f)
    }
  }
  return { ok, skipped: skipped.length ? `Skipped: ${skipped.join(', ')}` : '' }
}

const isDoc = (f: File) => DOC_MIME.includes(f.type) || /\.(pdf|jpe?g|png)$/i.test(f.name)
const isVideo = (f: File) => f.type.startsWith('video/')

function PickButton({
  icon,
  title,
  detail,
  accept,
  onFiles,
  disabled,
}: {
  icon: ReactNode
  title: string
  detail: string
  accept: string
  onFiles: (files: File[]) => void
  disabled?: boolean
}) {
  function pick(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    // Cleared so choosing the same file again still fires a change.
    e.target.value = ''
    if (files.length > 0) onFiles(files)
  }

  return (
    <label
      className={`flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-line bg-surface p-3.5 transition-colors hover:border-primary hover:bg-primary-soft/40 ${
        disabled ? 'pointer-events-none opacity-50' : ''
      }`}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-primary">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{title}</span>
        <span className="block text-xs text-ink-3">{detail}</span>
      </span>
      <input
        type="file"
        accept={accept}
        multiple
        onChange={pick}
        disabled={disabled}
        className="sr-only"
      />
    </label>
  )
}

function RemoveButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-label="Remove"
      onClick={onClick}
      disabled={disabled}
      className="shrink-0 rounded-full p-1 text-ink-3 transition-colors hover:bg-rose-100 hover:text-rose-600 disabled:opacity-50"
    >
      <X size={14} />
    </button>
  )
}

const ROW = 'flex items-center gap-2.5 rounded-lg border border-line bg-surface-2/50 px-3 py-2'

/* ─── Documents ─────────────────────────────────────────────────────────── */

export interface PendingDocument {
  file: File
  type: DocumentType
}

/** Documents chosen for a property that has not been filed yet. */
export function PendingDocuments({
  items,
  onChange,
}: {
  items: PendingDocument[]
  onChange: (next: PendingDocument[]) => void
}) {
  const [skipped, setSkipped] = useState('')

  return (
    <div>
      <PickButton
        icon={<FileText size={18} />}
        title="Upload verified documents"
        detail="PDF, JPG or PNG - max 10MB per file"
        accept={DOC_ACCEPT}
        onFiles={(files) => {
          const { ok, skipped } = screen(files, DOC_MAX, isDoc, 'a PDF, JPG or PNG')
          setSkipped(skipped)
          onChange([...items, ...ok.map((file) => ({ file, type: inferDocType(file.name) }))])
        }}
      />
      {skipped && <p className="mt-1.5 text-xs text-rose-600">{skipped}</p>}
      {items.length > 0 && (
        <ul className="mt-2 grid gap-1.5">
          {items.map((item, i) => (
            <li key={`${item.file.name}-${i}`} className={ROW}>
              <FileText size={15} className="shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{item.file.name}</p>
                <p className="text-[11px] text-ink-3">{mb(item.file.size)}</p>
              </div>
              <select
                aria-label="Document type"
                value={item.type}
                onChange={(e) =>
                  onChange(
                    items.map((x, j) =>
                      j === i ? { ...x, type: e.target.value as DocumentType } : x,
                    ),
                  )
                }
                className="rounded-lg border border-line bg-surface px-2 py-1 text-xs text-ink"
              >
                {DOC_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {DOCUMENT_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
              <RemoveButton onClick={() => onChange(items.filter((_, j) => j !== i))} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Documents on a property that exists — changes save immediately. */
export function SavedDocuments({ propertyId }: { propertyId: string }) {
  const { propertyById, serverIdFor, applyPropertyFromServer } = useStore()
  const files = propertyById(propertyId)?.documentFiles ?? []
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function upload(picked: File[]) {
    const { ok, skipped } = screen(picked, DOC_MAX, isDoc, 'a PDF, JPG or PNG')
    setError(skipped || null)
    const failed: string[] = []
    for (const [i, file] of ok.entries()) {
      setStatus(`Uploading ${i + 1} of ${ok.length}…`)
      try {
        const saved = await propertiesApi.uploadDocument(
          serverIdFor(propertyId),
          file,
          inferDocType(file.name),
        )
        applyPropertyFromServer(propertyId, saved)
      } catch (e) {
        failed.push(`${file.name}: ${apiErrorMessage(e, 'did not upload')}`)
      }
    }
    setStatus(null)
    if (failed.length) setError(failed.join(' · '))
  }

  async function remove(docId: string) {
    if (!window.confirm('Remove this document from the listing?')) return
    setStatus('Removing…')
    setError(null)
    try {
      applyPropertyFromServer(
        propertyId,
        await propertiesApi.removeDocument(serverIdFor(propertyId), docId),
      )
    } catch (e) {
      setError(apiErrorMessage(e, 'The document could not be removed.'))
    } finally {
      setStatus(null)
    }
  }

  return (
    <div>
      <PickButton
        icon={status ? <Loader2 size={18} className="animate-spin" /> : <FileText size={18} />}
        title={status ?? 'Upload verified documents'}
        detail="PDF, JPG or PNG - max 10MB per file"
        accept={DOC_ACCEPT}
        onFiles={(f) => void upload(f)}
        disabled={status !== null}
      />
      {error && <p className="mt-1.5 text-xs text-rose-600">{error}</p>}
      {files.length > 0 && (
        <ul className="mt-2 grid gap-1.5">
          {files.map((d) => (
            <li key={d.id} className={ROW}>
              <FileText size={15} className="shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                {d.url ? (
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex max-w-full items-center gap-1 truncate text-sm font-medium text-ink hover:text-primary"
                  >
                    <span className="truncate">{d.name}</span>
                    <ExternalLink size={12} className="shrink-0" />
                  </a>
                ) : (
                  <p className="truncate text-sm font-medium text-ink">{d.name}</p>
                )}
                <p className="text-[11px] text-ink-3">
                  {DOCUMENT_TYPE_LABEL[d.type]}
                  {d.url ? '' : ' · recorded, no file'}
                </p>
              </div>
              {d.verified && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-semibold text-primary-ink">
                  <ShieldCheck size={11} />
                  Verified
                </span>
              )}
              <RemoveButton onClick={() => void remove(d.id)} disabled={status !== null} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ─── Videos ────────────────────────────────────────────────────────────── */

function LinkInput({ onAdd, disabled }: { onAdd: (url: string) => void; disabled?: boolean }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  function commit(raw: string) {
    const v = raw.trim()
    if (!v) return
    if (!isVideoLink(v)) {
      setError('Paste a full YouTube or Vimeo link.')
      return
    }
    onAdd(v)
    setValue('')
    setError('')
  }

  return (
    <div>
      <input
        type="url"
        value={value}
        disabled={disabled}
        placeholder="Paste YouTube/Vimeo URL..."
        onChange={(e) => {
          const v = e.target.value
          setValue(v)
          // As on the agent form: a pasted link is added the moment it lands.
          if (isVideoLink(v.trim())) commit(v)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit(value)
          }
        }}
        className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
      />
      <p className={`mt-1 text-[11px] ${error ? 'text-rose-600' : 'text-ink-3'}`}>
        {error || 'YouTube or Vimeo link'}
      </p>
    </div>
  )
}

/** Videos chosen for a property that has not been filed yet. */
export function PendingVideos({
  files,
  onFilesChange,
  links,
  onLinksChange,
}: {
  files: File[]
  onFilesChange: (next: File[]) => void
  links: string[]
  onLinksChange: (next: string[]) => void
}) {
  const [skipped, setSkipped] = useState('')
  const full = files.length + links.length >= MAX_VIDEOS

  return (
    <div>
      {(links.length > 0 || files.length > 0) && (
        <ul className="mb-2 grid gap-1.5">
          {links.map((url, i) => (
            <li key={url} className={ROW}>
              <Video size={15} className="shrink-0 text-primary" />
              <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                {videoLabel(url, i)}
              </p>
              <RemoveButton onClick={() => onLinksChange(links.filter((u) => u !== url))} />
            </li>
          ))}
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className={ROW}>
              <Video size={15} className="shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{f.name}</p>
                <p className="text-[11px] text-ink-3">{mb(f.size)} · uploads when you file</p>
              </div>
              <RemoveButton onClick={() => onFilesChange(files.filter((_, j) => j !== i))} />
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <PickButton
          icon={<Video size={18} />}
          title={files.length > 0 ? 'Add Another' : 'Choose Video'}
          detail="MP4, MOV (max 50MB)"
          accept="video/*"
          disabled={full}
          onFiles={(picked) => {
            const { ok, skipped } = screen(picked, VIDEO_MAX, isVideo, 'a video')
            setSkipped(skipped)
            onFilesChange([...files, ...ok].slice(0, MAX_VIDEOS - links.length))
          }}
        />
        <LinkInput
          disabled={full}
          onAdd={(url) => {
            if (!links.includes(url)) onLinksChange([...links, url])
          }}
        />
      </div>
      {skipped && <p className="mt-1.5 text-xs text-rose-600">{skipped}</p>}
    </div>
  )
}

/** Videos on a property that exists — changes save immediately. */
export function SavedVideos({ propertyId }: { propertyId: string }) {
  const { propertyById, serverIdFor, applyPropertyFromServer } = useStore()
  const urls = propertyById(propertyId)?.videoUrls ?? []
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const busy = status !== null
  const full = urls.length >= MAX_VIDEOS

  async function upload(picked: File[]) {
    const { ok, skipped } = screen(picked, VIDEO_MAX, isVideo, 'a video')
    setError(skipped || null)
    for (const file of ok.slice(0, MAX_VIDEOS - urls.length)) {
      setStatus(`Uploading ${file.name}…`)
      try {
        const saved = await propertiesApi.uploadVideo(serverIdFor(propertyId), file, (pct) =>
          setStatus(`Uploading ${file.name} — ${pct}%`),
        )
        applyPropertyFromServer(propertyId, saved)
      } catch (e) {
        setError(apiErrorMessage(e, `${file.name} did not upload.`))
      }
    }
    setStatus(null)
  }

  async function save(next: string[]) {
    setStatus('Saving…')
    setError(null)
    try {
      applyPropertyFromServer(
        propertyId,
        await propertiesApi.setVideos(serverIdFor(propertyId), next),
      )
    } catch (e) {
      setError(apiErrorMessage(e, 'The videos could not be updated.'))
    } finally {
      setStatus(null)
    }
  }

  return (
    <div>
      {urls.length > 0 && (
        <ul className="mb-2 grid gap-1.5">
          {urls.map((url, i) => (
            <li key={url} className={ROW}>
              <Video size={15} className="shrink-0 text-primary" />
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1 truncate text-sm font-medium text-ink hover:text-primary"
              >
                {videoLabel(url, i)}
              </a>
              <RemoveButton
                disabled={busy}
                onClick={() => {
                  if (window.confirm('Remove this video from the listing?')) {
                    void save(urls.filter((u) => u !== url))
                  }
                }}
              />
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <PickButton
          icon={busy ? <Loader2 size={18} className="animate-spin" /> : <Video size={18} />}
          title={status ?? (urls.length > 0 ? 'Add Another' : 'Choose Video')}
          detail="MP4, MOV (max 50MB)"
          accept="video/*"
          disabled={busy || full}
          onFiles={(f) => void upload(f)}
        />
        <LinkInput
          disabled={busy || full}
          onAdd={(url) => {
            if (!urls.includes(url)) void save([...urls, url])
          }}
        />
      </div>
      {error && <p className="mt-1.5 text-xs text-rose-600">{error}</p>}
    </div>
  )
}
