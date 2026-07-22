import { isSupabaseConfigured } from '../lib/supabase'
import { localRepository } from './localRepository'
import type { DataRepository } from './repository'
import { supabaseRepository } from './supabaseRepository'

export function getRepository(): DataRepository {
  return isSupabaseConfigured() ? supabaseRepository : localRepository
}

export function getBackendMode(): 'local' | 'supabase' {
  return getRepository().mode
}
