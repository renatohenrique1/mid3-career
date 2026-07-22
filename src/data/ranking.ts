import type {
  Match,
  PlayerStats,
  TournamentFormat,
  User,
} from '../types'

export const TOURNAMENT_FORMATS: Array<{
  id: TournamentFormat
  label: string
  short: string
  blurb: string
}> = [
  {
    id: 'classic',
    label: 'Clássico',
    short: 'Clássico',
    blurb: 'Set normal. Pontos: 3 + diferença de games.',
  },
  {
    id: 'tb',
    label: 'Tie-break',
    short: 'TB',
    blurb: 'Só tie-break até 10, com 2 de diferença.',
  },
  {
    id: 'fh',
    label: 'Só forehand',
    short: 'FH',
    blurb: 'Só vale forehand. Vitória = 1 ponto.',
  },
  {
    id: 'bh',
    label: 'Só backhand',
    short: 'BH',
    blurb: 'Só vale backhand. Vitória = 1 ponto.',
  },
  {
    id: 'fifteen_forty',
    label: '15–40',
    short: '15–40',
    blurb: 'Todo game começa 15–40. Vitória = 1 ponto.',
  },
]

export function normalizeFormat(
  format: TournamentFormat | undefined | null,
): TournamentFormat {
  if (
    format === 'classic' ||
    format === 'tb' ||
    format === 'fh' ||
    format === 'bh' ||
    format === 'fifteen_forty'
  ) {
    return format
  }
  return 'classic'
}

export function formatLabel(format: TournamentFormat): string {
  return TOURNAMENT_FORMATS.find((f) => f.id === format)?.label ?? 'Clássico'
}

export function formatShortLabel(format: TournamentFormat): string {
  return TOURNAMENT_FORMATS.find((f) => f.id === format)?.short ?? 'Clássico'
}

export function formatBlurb(format: TournamentFormat): string {
  return (
    TOURNAMENT_FORMATS.find((f) => f.id === format)?.blurb ??
    TOURNAMENT_FORMATS[0].blurb
  )
}

/** Clássico: 3 + |diff|. Outros formatos: 1 ponto. */
export function pointsForWin(
  format: TournamentFormat,
  gamesA: number,
  gamesB: number,
): number {
  if (normalizeFormat(format) === 'classic') {
    return 3 + Math.abs(gamesA - gamesB)
  }
  return 1
}

export function rankingHint(format: TournamentFormat): string {
  if (normalizeFormat(format) === 'classic') {
    return 'Clássico: 3 pts + diferença de games'
  }
  return '1 ponto por vitória neste formato'
}

/** Ranking com pontuação conforme o formato do torneio (ou clássico nos avulsos). */
export function computeRanking(
  users: User[],
  matches: Match[],
  format: TournamentFormat = 'classic',
): PlayerStats[] {
  const scoring = normalizeFormat(format)
  const stats = new Map<string, PlayerStats>()

  for (const user of users) {
    stats.set(user.id, {
      playerId: user.id,
      name: user.name,
      played: 0,
      wins: 0,
      losses: 0,
      points: 0,
      gamesFor: 0,
      gamesAgainst: 0,
      winRate: 0,
    })
  }

  for (const match of matches) {
    const a = stats.get(match.playerAId)
    const b = stats.get(match.playerBId)
    if (!a || !b) continue

    a.played += 1
    b.played += 1
    a.gamesFor += match.gamesA
    a.gamesAgainst += match.gamesB
    b.gamesFor += match.gamesB
    b.gamesAgainst += match.gamesA

    const pts = pointsForWin(scoring, match.gamesA, match.gamesB)
    if (match.gamesA > match.gamesB) {
      a.wins += 1
      a.points += pts
      b.losses += 1
    } else {
      b.wins += 1
      b.points += pts
      a.losses += 1
    }
  }

  const ranking = [...stats.values()].map((s) => ({
    ...s,
    winRate: s.played === 0 ? 0 : s.wins / s.played,
  }))

  ranking.sort((x, y) => {
    if (y.points !== x.points) return y.points - x.points
    if (y.played !== x.played) return y.played - x.played
    if (y.winRate !== x.winRate) return y.winRate - x.winRate
    const diffX = x.gamesFor - x.gamesAgainst
    const diffY = y.gamesFor - y.gamesAgainst
    if (diffY !== diffX) return diffY - diffX
    return x.name.localeCompare(y.name, 'pt-BR')
  })

  return ranking
}

/** Set clássico: 6–0…6–4, 7–5, 7–6. */
export function isValidSetScore(gamesA: number, gamesB: number): boolean {
  if (!Number.isInteger(gamesA) || !Number.isInteger(gamesB)) return false
  if (gamesA < 0 || gamesB < 0) return false
  if (gamesA === gamesB) return false

  const high = Math.max(gamesA, gamesB)
  const low = Math.min(gamesA, gamesB)

  if (high === 6 && low <= 4) return true
  if (high === 7 && (low === 5 || low === 6)) return true
  return false
}

/**
 * Tie-break estilo 5º set GS: até 10, precisa 2 de diferença.
 * Ex.: 10–8, 10–0, 12–10. Inválido: 10–9, 9–7.
 */
export function isValidTieBreakScore(pointsA: number, pointsB: number): boolean {
  if (!Number.isInteger(pointsA) || !Number.isInteger(pointsB)) return false
  if (pointsA < 0 || pointsB < 0) return false
  if (pointsA === pointsB) return false

  const high = Math.max(pointsA, pointsB)
  const low = Math.min(pointsA, pointsB)
  if (high < 10) return false
  if (high - low < 2) return false
  // Se passou de 10, só encerra com diferença exatamente 2 (sequência normal)
  if (high > 10 && high - low !== 2) return false
  return true
}

export function isValidMatchScore(
  format: TournamentFormat,
  scoreA: number,
  scoreB: number,
): boolean {
  if (normalizeFormat(format) === 'tb') {
    return isValidTieBreakScore(scoreA, scoreB)
  }
  return isValidSetScore(scoreA, scoreB)
}

export function scoreUnitLabel(format: TournamentFormat): string {
  return normalizeFormat(format) === 'tb' ? 'pontos' : 'games'
}

export function surfaceLabel(surface: 'hard' | 'clay'): string {
  return surface === 'hard' ? 'Rápida' : 'Saibro'
}

export const BALL_OPTIONS = [
  { id: 'inni_tournament', label: 'Inni Tournament' },
  { id: 'inni_clay', label: 'Inni Clay' },
  { id: 'wilson_rg', label: 'Wilson Roland Garros' },
  { id: 'wilson_us_open', label: 'Wilson US Open' },
] as const

export function ballLabel(
  ball: import('../types').BallBrand | null | undefined,
): string | null {
  if (!ball) return null
  return BALL_OPTIONS.find((b) => b.id === ball)?.label ?? ball
}

export function formatDuration(minutes: number | null | undefined): string | null {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return null
  const whole = Math.round(minutes)
  const h = Math.floor(whole / 60)
  const m = whole % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} h`
  return `${h} h ${m} min`
}

export const CLASSIC_QUICK_SCORES: Array<[number, number]> = [
  [6, 0],
  [6, 1],
  [6, 2],
  [6, 3],
  [6, 4],
  [7, 5],
  [7, 6],
]

export const TB_QUICK_SCORES: Array<[number, number]> = [
  [10, 0],
  [10, 1],
  [10, 2],
  [10, 3],
  [10, 4],
  [10, 5],
  [10, 6],
  [10, 7],
  [10, 8],
  [11, 9],
  [12, 10],
]
