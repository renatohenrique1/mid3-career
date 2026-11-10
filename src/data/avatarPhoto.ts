import { getSupabase, isSupabaseConfigured } from '../lib/supabase'

const MAX_EDGE = 512

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

function compressAvatar(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height))
      const width = Math.max(1, Math.round(image.width * scale))
      const height = Math.max(1, Math.round(image.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) {
        URL.revokeObjectURL(objectUrl)
        reject(new Error('canvas'))
        return
      }
      context.drawImage(image, 0, 0, width, height)
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(objectUrl)
          if (!blob) reject(new Error('blob'))
          else resolve(blob)
        },
        'image/jpeg',
        0.82,
      )
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('image'))
    }
    image.src = objectUrl
  })
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('read'))
    reader.readAsDataURL(blob)
  })
}

export async function storeAvatarFile(
  userId: string,
  file: File,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!file.type.startsWith('image/')) {
    return { ok: false, error: 'Escolha uma imagem.' }
  }
  let blob: Blob
  try {
    blob = await compressAvatar(file)
  } catch {
    return { ok: false, error: 'Não consegui ler essa foto. Escolha outra.' }
  }

  if (!isSupabaseConfigured()) {
    try {
      return { ok: true, url: await blobToDataUrl(blob) }
    } catch {
      return { ok: false, error: 'Não consegui guardar a foto neste aparelho.' }
    }
  }

  const path = `${userId}.jpg`
  const { error } = await getSupabase()
    .storage.from('avatars')
    .upload(path, blob, {
      upsert: true,
      contentType: 'image/jpeg',
      cacheControl: '3600',
    })
  if (error) return { ok: false, error: readError(error.message) }

  const { data } = getSupabase().storage.from('avatars').getPublicUrl(path)
  return { ok: true, url: `${data.publicUrl}?v=${Date.now()}` }
}

export async function removeStoredAvatar(userId: string): Promise<void> {
  if (!isSupabaseConfigured()) return
  await getSupabase().storage.from('avatars').remove([`${userId}.jpg`])
}
