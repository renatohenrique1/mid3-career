import type {
  AvatarId,
  BackhandType,
  RacketModel,
  User,
} from '../types'
import { localDateString } from './ranking'

export const RACKET_MODELS: Array<{ id: RacketModel; label: string }> = [
  { id: 'wilson_blade_98', label: 'Wilson Blade 98' },
  { id: 'yonex_ezone_98', label: 'Yonex EZONE 98' },
  { id: 'yonex_vcore_95', label: 'Yonex VCORE 95' },
]

export const AVATAR_OPTIONS: Array<{
  id: AvatarId
  label: string
  src?: string
}> = [
  { id: 'ball', label: 'Bola', src: '/avatars/ball.png' },
  { id: 'racket', label: 'Raquete', src: '/avatars/racket.png' },
  { id: 'crossed', label: 'Raquetes cruzadas', src: '/avatars/crossed.png' },
  { id: 'initial', label: 'Inicial do Nome' },
]

export const BACKHAND_OPTIONS: Array<{ id: BackhandType; label: string }> = [
  { id: 'one_handed', label: 'One-handed' },
  { id: 'two_handed', label: 'Two-handed' },
]

export function racketLabel(id: RacketModel | null | undefined): string {
  if (!id) return '—'
  return RACKET_MODELS.find((r) => r.id === id)?.label ?? id
}

export function backhandLabel(id: BackhandType | null | undefined): string {
  if (!id) return '—'
  return BACKHAND_OPTIONS.find((b) => b.id === id)?.label ?? id
}

export function normalizeNickname(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '')
}

export function isValidNickname(raw: string): boolean {
  const n = normalizeNickname(raw)
  return /^[a-z0-9_]{3,20}$/.test(n)
}

export function nameChangesLeft(user: User): number {
  return Math.max(0, user.nameChangesMax - user.nameChangesUsed)
}

/** Ms até poder trocar nick de novo; 0 = pode agora. */
export function nicknameCooldownMs(user: User, now = Date.now()): number {
  if (!user.nicknameChangedAt) return 0
  const last = new Date(user.nicknameChangedAt).getTime()
  if (Number.isNaN(last)) return 0
  const week = 7 * 24 * 60 * 60 * 1000
  return Math.max(0, last + week - now)
}

export function formatCooldown(ms: number): string {
  if (ms <= 0) return 'Disponível agora'
  const totalMin = Math.ceil(ms / 60000)
  const days = Math.floor(totalMin / (60 * 24))
  const hours = Math.floor((totalMin - days * 60 * 24) / 60)
  const mins = totalMin % 60
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}min`
  return `${mins} min`
}

export function needsNicknameSetup(user: User): boolean {
  return !user.nickname?.trim()
}

export function displayHandle(user: User): string {
  return user.nickname ? `@${user.nickname}` : user.name
}

export function nameInitial(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  return trimmed.charAt(0).toUpperCase()
}

/** Contagem de sets vencidos: avulsos vs torneio. */
export function countSetWinsSplit(
  userId: string,
  matches: Array<{
    tournamentId: string | null
    playerAId: string
    playerBId: string
    gamesA: number
    gamesB: number
  }>,
): { casual: number; tournament: number; total: number } {
  let casual = 0
  let tournament = 0
  for (const m of matches) {
    const won =
      (m.playerAId === userId && m.gamesA > m.gamesB) ||
      (m.playerBId === userId && m.gamesB > m.gamesA)
    if (!won) continue
    if (m.tournamentId) tournament += 1
    else casual += 1
  }
  return { casual, tournament, total: casual + tournament }
}

export function todayIso(): string {
  return localDateString()
}
