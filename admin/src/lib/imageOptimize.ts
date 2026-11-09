/**
 * Turns any browser-readable image (JPG, PNG, GIF, BMP, WebP, AVIF…) into a small WebP before upload:
 *  1. downscale so the longest side is at most `maxSide` px (never upscales),
 *  2. encode as WebP — transparency is kept, so 3D illustrations stay clean,
 *  3. lower the quality step by step until the file fits `targetBytes` (or quality hits the floor).
 * Keeps storage and bandwidth low; the app shows these at ~120px, so 640px is plenty even on 3× screens.
 */
export type OptimizedImage = {
  blob: Blob
  width: number
  height: number
  originalBytes: number
  bytes: number
}

const MAX_INPUT_BYTES = 25 * 1024 * 1024

export async function optimizeToWebp(
  file: File,
  { maxSide = 640, targetBytes = 150 * 1024, startQuality = 0.86, minQuality = 0.5 } = {},
): Promise<OptimizedImage> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.')
  if (file.size > MAX_INPUT_BYTES) throw new Error('That image is over 25 MB — please pick a smaller one.')

  const bitmap = await decode(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { alpha: true })
  if (!ctx) throw new Error('Your browser could not process this image.')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, width, height)
  if ('close' in bitmap) bitmap.close()

  let quality = startQuality
  let blob = await encode(canvas, quality)
  while (blob.size > targetBytes && quality > minQuality) {
    quality = Math.max(minQuality, quality - 0.08)
    blob = await encode(canvas, quality)
  }
  return { blob, width, height, originalBytes: file.size, bytes: blob.size }
}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file)
  } catch {
    // Fallback for formats/browsers where createImageBitmap fails
    const url = URL.createObjectURL(file)
    try {
      const img = new Image()
      img.decoding = 'async'
      img.src = url
      await img.decode()
      return img
    } catch {
      throw new Error('This image format is not supported by your browser (try JPG or PNG).')
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}

function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (!b) return reject(new Error('Could not convert the image.'))
        // Older Safari silently falls back to PNG — refuse rather than upload a heavy file.
        if (b.type !== 'image/webp') return reject(new Error('This browser cannot create WebP images — please use Chrome or Edge.'))
        resolve(b)
      },
      'image/webp',
      quality,
    )
  })
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
