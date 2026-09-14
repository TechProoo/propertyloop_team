/**
 * Shrink a photo before it is uploaded.
 *
 * Phone cameras produce 4–8MB images, while a listing card is a few hundred
 * pixels wide and the detail page is under 2000. Sending the original makes an
 * office connection wait for bytes nobody sees, and runs into the 10MB limit.
 *
 * Anything the browser cannot decode — HEIC, on most browsers — is sent as it
 * is. The server converts HEIC itself.
 */

const MAX_EDGE = 2000
const QUALITY = 0.85
/** Under this and already small enough in pixels, re-encoding gains nothing. */
const SMALL_ENOUGH = 1.5 * 1024 * 1024

export async function shrinkForUpload(
  file: File,
): Promise<{ blob: Blob; name: string }> {
  const original = { blob: file as Blob, name: file.name }
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return original

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return original
  }

  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    if (scale === 1 && file.size <= SMALL_ENOUGH) return original

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return original
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', QUALITY),
    )
    // Keep whichever is smaller: a flat PNG screenshot can grow as a JPEG.
    if (!blob || blob.size >= file.size) return original
    return { blob, name: file.name.replace(/\.[^.]+$/, '') + '.jpg' }
  } finally {
    bitmap.close()
  }
}
