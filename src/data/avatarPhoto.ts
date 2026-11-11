import { getSupabase, isSupabaseConfigured } from '../lib/supabase'

const MAX_EDGE = 2048
const OUTPUT_EDGE = 512

export type FramingSource = {
  bitmap: ImageBitmap
  previewUrl: string
  width: number
  height: number
}

export type AvatarCropRect = {
  sx: number
  sy: number
  size: number
  width?: number
  height?: number
}

export type FramedAvatar = {
  icon: Blob
  source: Blob
  crop: AvatarCropRect
}

function readError(message: string): string {
  const text = message.toLowerCase()
  if (
    text.includes('bucket') ||
    text.includes('avatar_url') ||
    text.includes('schema cache') ||
    text.includes('row-level') ||
    text.includes('policy')
  ) {
    return 'A foto ainda não pode ser gravada. Rode a query de fotos de perfil no SQL Editor do Supabase.'
  }
  return 'Não consegui enviar a foto. Tente de novo.'
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('blob'))),
      'image/jpeg',
      quality,
    )
  })
}

const UPLOAD_LIMIT = 1_700_000

async function encodeFrame(original: ImageBitmap) {
  let edge = MAX_EDGE
  let quality = 0.9
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const scale = Math.min(1, edge / Math.max(original.width, original.height))
    const width = Math.max(1, Math.round(original.width * scale))
    const height = Math.max(1, Math.round(original.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('canvas')
    context.fillStyle = '#121214'
    context.fillRect(0, 0, width, height)
    context.drawImage(original, 0, 0, width, height)
    const blob = await canvasToJpeg(canvas, quality)
    if (blob.size <= UPLOAD_LIMIT || attempt === 5) {
      return { bitmap: await createImageBitmap(canvas), blob, width, height }
    }
    if (quality > 0.62) quality -= 0.1
    else edge = Math.round(edge * 0.8)
  }
  throw new Error('encode')
}

export async function openFramingSource(file: File): Promise<FramingSource> {
  if (file.type && !file.type.startsWith('image/')) {
    throw new Error('type')
  }
  const original = await createImageBitmap(file, {
    imageOrientation: 'from-image',
  })
  try {
    const encoded = await encodeFrame(original)
    return {
      bitmap: encoded.bitmap,
      previewUrl: URL.createObjectURL(encoded.blob),
      width: encoded.width,
      height: encoded.height,
    }
  } finally {
    original.close()
  }
}

export function closeFramingSource(source: FramingSource) {
  source.bitmap.close()
  URL.revokeObjectURL(source.previewUrl)
}

export function cropFramedBitmap(
  bitmap: ImageBitmap,
  crop: { sx: number; sy: number; size: number },
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = OUTPUT_EDGE
  canvas.height = OUTPUT_EDGE
  const context = canvas.getContext('2d')
  if (!context) return Promise.reject(new Error('canvas'))
  const sx = Math.max(0, crop.sx)
  const sy = Math.max(0, crop.sy)
  const size = Math.max(1, Math.min(crop.size, bitmap.width - sx, bitmap.height - sy))
  context.fillStyle = '#121214'
  context.fillRect(0, 0, OUTPUT_EDGE, OUTPUT_EDGE)
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(bitmap, sx, sy, size, size, 0, 0, OUTPUT_EDGE, OUTPUT_EDGE)
  return canvasToJpeg(canvas, 0.82)
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('read'))
    reader.readAsDataURL(blob)
  })
}

function sourceStorageKey(userId: string) {
  return `mid3-avatar-source:${userId}`
}

function cropStorageKey(userId: string) {
  return `mid3-avatar-crop:${userId}`
}

async function rememberLocalOriginal(userId: string, source: Blob, crop: AvatarCropRect) {
  try {
    localStorage.setItem(sourceStorageKey(userId), await blobToDataUrl(source))
    localStorage.setItem(cropStorageKey(userId), JSON.stringify(crop))
  } catch {
    // Sem espaço local, o enquadramento seguinte usa o ícone já recortado.
  }
}

function cropFromParts(parts: number[]): AvatarCropRect | null {
  const [sx, sy, size, width, height] = parts
  if (![sx, sy, size].every((value) => Number.isFinite(value)) || size <= 1) return null
  const crop: AvatarCropRect = { sx, sy, size }
  if (
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    width > 1 &&
    height > 1
  ) {
    crop.width = width
    crop.height = height
  }
  return crop
}

function readLocalCrop(userId: string): AvatarCropRect | null {
  try {
    const raw = localStorage.getItem(cropStorageKey(userId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as AvatarCropRect
    return cropFromParts([
      parsed.sx,
      parsed.sy,
      parsed.size,
      parsed.width ?? NaN,
      parsed.height ?? NaN,
    ])
  } catch {
    return null
  }
}

export function readAvatarCrop(url: string): AvatarCropRect | null {
  try {
    const raw = new URL(url).searchParams.get('crop')
    if (!raw) return null
    return cropFromParts(raw.split(',').map(Number))
  } catch {
    return null
  }
}

async function fileFromUrl(url: string, name: string): Promise<File> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(String(response.status))
  const blob = await response.blob()
  if (blob.size < 32) throw new Error('empty')
  if (blob.type && !blob.type.startsWith('image/')) throw new Error('type')
  return new File([blob], name, { type: blob.type || 'image/jpeg' })
}

async function uploadAvatarObject(path: string, blob: Blob) {
  return getSupabase().storage.from('avatars').upload(path, blob, {
    upsert: true,
    contentType: 'image/jpeg',
    cacheControl: '3600',
  })
}

export async function storeAvatarBlob(
  userId: string,
  framed: FramedAvatar,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const { icon, source, crop } = framed
  if (!isSupabaseConfigured()) {
    try {
      await rememberLocalOriginal(userId, source, crop)
      return { ok: true, url: await blobToDataUrl(icon) }
    } catch {
      return { ok: false, error: 'Não consegui guardar a foto neste aparelho.' }
    }
  }

  const upload = await uploadAvatarObject(`${userId}.jpg`, source)
  if (upload.error) return { ok: false, error: readError(upload.error.message) }

  const { data } = getSupabase().storage.from('avatars').getPublicUrl(`${userId}.jpg`)
  const cropQuery = [crop.sx, crop.sy, crop.size, crop.width ?? 0, crop.height ?? 0]
    .map((value) => value.toFixed(2))
    .join(',')
  return { ok: true, url: `${data.publicUrl}?v=${Date.now()}&crop=${cropQuery}` }
}

export async function loadAvatarForReframe(
  userId: string,
  avatarUrl: string,
): Promise<
  { ok: true; file: File; crop: AvatarCropRect | null } | { ok: false; error: string }
> {
  const savedCrop = readAvatarCrop(avatarUrl)
  let localSource: string | null = null
  try {
    localSource = localStorage.getItem(sourceStorageKey(userId))
  } catch {
    localSource = null
  }
  const attempts: Array<{ url: string; crop: AvatarCropRect | null }> = []
  if (savedCrop?.width && !avatarUrl.startsWith('data:')) {
    attempts.push({ url: avatarUrl, crop: savedCrop })
  }
  if (localSource) {
    attempts.push({ url: localSource, crop: readLocalCrop(userId) ?? savedCrop })
  }
  attempts.push({ url: avatarUrl, crop: null })

  for (const attempt of attempts) {
    try {
      const file = await fileFromUrl(attempt.url, 'foto-perfil.jpg')
      return { ok: true, file, crop: attempt.crop }
    } catch {
      continue
    }
  }
  return { ok: false, error: 'Não consegui abrir a foto para enquadrar de novo.' }
}

export async function removeStoredAvatar(userId: string): Promise<void> {
  localStorage.removeItem(sourceStorageKey(userId))
  localStorage.removeItem(cropStorageKey(userId))
  if (!isSupabaseConfigured()) return
  await getSupabase().storage.from('avatars').remove([`${userId}.jpg`])
}
