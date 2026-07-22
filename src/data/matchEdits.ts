import { ballLabel, formatDuration, surfaceLabel } from './ranking'
import { racketLabel } from './profile'
import type { Match, MatchEditPayload, User } from '../types'

/** Aceita payload camelCase (app) ou snake_case (legado/manual). */
export function normalizeMatchEditPayload(raw: unknown): MatchEditPayload {
  const p = (raw ?? {}) as Record<string, unknown>
  const num = (v: unknown, fallback = 0) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : fallback
  }
  return {
    date: String(p.date ?? p.match_date ?? ''),
    surface: (p.surface as MatchEditPayload['surface']) ?? 'hard',
    playerAId: String(p.playerAId ?? p.player_a_id ?? ''),
    playerBId: String(p.playerBId ?? p.player_b_id ?? ''),
    gamesA: num(p.gamesA ?? p.games_a),
    gamesB: num(p.gamesB ?? p.games_b),
    durationMinutes:
      p.durationMinutes === undefined && p.duration_minutes === undefined
        ? null
        : num(p.durationMinutes ?? p.duration_minutes, 0) || null,
    ball: (p.ball as MatchEditPayload['ball']) ?? null,
    racketA: (p.racketA ?? p.racket_a ?? null) as MatchEditPayload['racketA'],
    racketB: (p.racketB ?? p.racket_b ?? null) as MatchEditPayload['racketB'],
  }
}

export function describeMatchEditChanges(
  match: Match,
  payload: MatchEditPayload,
  users: User[],
): string[] {
  const changes: string[] = []
  const name = (id: string) => users.find((u) => u.id === id)?.name ?? '?'

  if (payload.date !== match.date) {
    changes.push(`Data: ${formatDate(match.date)} → ${formatDate(payload.date)}`)
  }
  if (payload.surface !== match.surface) {
    changes.push(
      `Superfície: ${surfaceLabel(match.surface)} → ${surfaceLabel(payload.surface)}`,
    )
  }
  if (
    payload.gamesA !== match.gamesA ||
    payload.gamesB !== match.gamesB
  ) {
    changes.push(
      `Placar: ${match.gamesA}–${match.gamesB} → ${payload.gamesA}–${payload.gamesB}`,
    )
  }
  if (
    (payload.durationMinutes ?? null) !== (match.durationMinutes ?? null)
  ) {
    const from = formatDuration(match.durationMinutes) ?? '—'
    const to = formatDuration(payload.durationMinutes) ?? '—'
    changes.push(`Duração: ${from} → ${to}`)
  }
  if ((payload.ball ?? null) !== (match.ball ?? null)) {
    changes.push(
      `Bola: ${ballLabel(match.ball) ?? '—'} → ${ballLabel(payload.ball) ?? '—'}`,
    )
  }
  if ((payload.racketA ?? null) !== (match.racketA ?? null)) {
    changes.push(
      `Raquete ${name(match.playerAId)}: ${racketLabel(match.racketA)} → ${racketLabel(payload.racketA)}`,
    )
  }
  if ((payload.racketB ?? null) !== (match.racketB ?? null)) {
    changes.push(
      `Raquete ${name(match.playerBId)}: ${racketLabel(match.racketB)} → ${racketLabel(payload.racketB)}`,
    )
  }
  if (
    payload.playerAId !== match.playerAId ||
    payload.playerBId !== match.playerBId
  ) {
    changes.push('Jogadores alterados')
  }

  return changes.length > 0 ? changes : ['Sem diferenças detectadas']
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}
