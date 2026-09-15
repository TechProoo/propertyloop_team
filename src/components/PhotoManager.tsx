import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import { ImagePlus, Loader2, Star, X } from 'lucide-react'
import { useStore } from '../lib/storeContext'
import { propertiesApi } from '../api/collections'
import { apiErrorMessage } from '../lib/api'
import { shrinkForUpload } from '../lib/imageResize'

/**
 * Property photos.
 *
 * The first photo is the cover: the website's listing cards and the app's
 * PropertyLoop stock both lead with it, and a listing with no cover reads as
 * empty however complete its details are.
 */

/** The website's agent form takes up to 10 photos. */
const MAX_PHOTOS = 10

function Tile({
  src,
  cover,
  onMakeCover,
  onRemove,
  disabled,
}: {
  src: string
  cover: boolean
  onMakeCover?: () => void
  onRemove: () => void
  disabled?: boolean
}) {
  return (
    <div className="group relative aspect-square overflow-hidden rounded-lg bg-surface-2">
      <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
      {cover && (
        <span className="absolute top-1.5 left-1.5 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-white">
          Cover
        </span>
      )}
      {/* Always visible rather than on hover — hover does not exist on a phone. */}
      <div className="absolute top-1.5 right-1.5 flex gap-1">
        {!cover && onMakeCover && (
          <button
            type="button"
            onClick={onMakeCover}
            disabled={disabled}
            aria-label="Make this the cover photo"
            title="Make cover"
            className="rounded-full bg-black/55 p-1 text-white transition-colors hover:bg-black/75 disabled:opacity-50"
          >
            <Star size={12} />
          </button>
        )}
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          aria-label="Remove this photo"
          title="Remove"
          className="rounded-full bg-black/55 p-1 text-white transition-colors hover:bg-black/75 disabled:opacity-50"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  )
}

function AddTile({
  onFiles,
  disabled,
  busy,
}: {
  onFiles: (files: File[]) => void
  disabled?: boolean
  busy?: boolean
}) {
  function pick(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    // Cleared so choosing the same file again still fires a change.
    e.target.value = ''
    if (files.length > 0) onFiles(files)
  }

  return (
    <label
      className={`flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line text-ink-3 transition-colors hover:border-primary hover:text-primary ${
        disabled ? 'pointer-events-none opacity-50' : ''
      }`}
    >
      {busy ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
      <span className="text-[11px] font-medium">Add photos</span>
      <input
        type="file"
        accept="image/*"
        multiple
        onChange={pick}
        disabled={disabled}
        className="sr-only"
      />
    </label>
  )
}

/** Photos picked for a property that has not been filed yet. */
export function PendingPhotos({
  files,
  onChange,
}: {
  files: File[]
  onChange: (files: File[]) => void
}) {
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files])
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews])

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {files.map((f, i) => (
          <Tile
            key={`${f.name}-${f.lastModified}-${i}`}
            src={previews[i]}
            cover={i === 0}
            onMakeCover={() => onChange([f, ...files.filter((_, j) => j !== i)])}
            onRemove={() => onChange(files.filter((_, j) => j !== i))}
          />
        ))}
        {files.length < MAX_PHOTOS && (
          <AddTile
            onFiles={(picked) => onChange([...files, ...picked].slice(0, MAX_PHOTOS))}
          />
        )}
      </div>
      <p className="mt-2 text-xs text-ink-3">
        They upload as soon as the property is filed. The first photo is the cover.
      </p>
    </div>
  )
}

/** Photos on a property that already exists — changes save immediately. */
export function SavedPhotos({ propertyId }: { propertyId: string }) {
  const { propertyById, serverIdFor, applyPropertyFromServer } = useStore()
  const images = propertyById(propertyId)?.images ?? []

  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(
    null,
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function upload(files: File[]) {
    const room = MAX_PHOTOS - images.length
    const batch = files.slice(0, Math.max(0, room))
    if (batch.length === 0) {
      setError(`A property can have at most ${MAX_PHOTOS} photos.`)
      return
    }

    setError(null)
    setUploading({ done: 0, total: batch.length })
    const failed: string[] = []
    let lastError: unknown = null

    // One at a time, each applied as it lands, so a failure names exactly
    // which photo did not make it and the rest are already saved.
    for (const [i, file] of batch.entries()) {
      try {
        const { blob, name } = await shrinkForUpload(file)
        const saved = await propertiesApi.uploadPhoto(serverIdFor(propertyId), blob, name)
        applyPropertyFromServer(propertyId, saved)
      } catch (e) {
        failed.push(file.name)
        lastError = e
      }
      setUploading({ done: i + 1, total: batch.length })
    }

    setUploading(null)
    if (failed.length > 0) {
      setError(
        `${failed.length === batch.length ? 'None' : `${failed.length} of ${batch.length}`} uploaded — ${failed.join(', ')} did not. ${apiErrorMessage(lastError, 'Try again.')}`,
      )
    }
  }

  async function reorder(next: string[]) {
    setBusy(true)
    setError(null)
    try {
      const saved = await propertiesApi.setPhotos(serverIdFor(propertyId), next)
      applyPropertyFromServer(propertyId, saved)
    } catch (e) {
      setError(apiErrorMessage(e, 'The photos could not be updated.'))
    } finally {
      setBusy(false)
    }
  }

  const working = uploading !== null || busy

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {images.map((url, i) => (
          <Tile
            key={url}
            src={url}
            cover={i === 0}
            disabled={working}
            onMakeCover={() => reorder([url, ...images.filter((u) => u !== url)])}
            onRemove={() => {
              if (window.confirm('Remove this photo from the listing?')) {
                void reorder(images.filter((u) => u !== url))
              }
            }}
          />
        ))}
        {images.length < MAX_PHOTOS && (
          <AddTile onFiles={(f) => void upload(f)} disabled={working} busy={uploading !== null} />
        )}
      </div>

      <p className="mt-2 text-xs text-ink-3">
        {uploading
          ? `Uploading ${Math.min(uploading.done + 1, uploading.total)} of ${uploading.total}…`
          : images.length === 0
            ? 'No photos yet. Until there are, this property shows as "Photos coming" on the website and in the app.'
            : 'Changes save immediately. The first photo is the cover — it is what the website and the app show first.'}
      </p>
      {error && <p className="mt-1.5 text-xs text-rose-600">{error}</p>}
    </div>
  )
}
