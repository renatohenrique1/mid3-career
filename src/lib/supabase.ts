import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''

export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey && !url.includes('SEU_PROJECT'))
}

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY em .env.local',
    )
  }
  if (!client) {
    client = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  }
  return client
}

/** Email sintético estável a partir do nome (login só com nome + senha). */
export function toAuthEmail(name: string): string {
  const key = name.trim().toLowerCase().replace(/\s+/g, ' ')
  const local =
    key.replace(/[^a-z0-9._-]/g, '').replace(/^\.+|\.+$/g, '').slice(0, 64) ||
    'player'
  return `${local}@mid3.players`
}
