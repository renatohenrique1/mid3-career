import type {
  Match,
  PlayerStats,
  TournamentFormat,
  TournamentStructure,
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
    blurb:
      'Um super tie-break clássico: corre até 10, precisa de 2 de diferença. Sem firula de set — é bate-bola direto no placar.',
  },
  {
    id: 'fh',
    label: 'Só forehand',
    short: 'FH',
    blurb:
      'Só forehand. Sacador, devolvedor, slice, voleio — tudo de FH. A meta é viver na esquerda do oponente. Placar: 2–0 ou 2–1.',
  },
  {
    id: 'bh',
    label: 'Só backhand',
    short: 'BH',
    blurb:
      'Regra de ouro: só backhand. Sacador, devolvedor, slice, voleio — tudo de BH. Quer ganhar? Empurre o cara na direita o set inteiro. Placar: 2–0 ou 2–1.',
  },
  {
    id: 'fifteen_forty',
    label: '15–40',
    short: '15–40',
    blurb:
      'Game normal… só que o sacador já entra perdendo 15–40. Servir sob pressão desde o primeiro ponto. Quem aguenta? Placar: 4–0, 4–1, 4–2 ou 4–3.',
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

export const CLASSIC_STRUCTURES: Array<{
  id: TournamentStructure
  label: string
  short: string
  blurb: string
}> = [
  {
    id: 'round_robin',
    label: 'Todos contra todos',
    short: 'Round-robin',
    blurb: 'Cada um joga com cada um. Ideal para 3 jogadores.',
  },
  {
    id: 'points_league',
    label: 'Liga por pontos',
    short: 'Liga',
    blurb: 'Sets dentro do período somam no ranking do torneio.',
  },
]

export const SPECIAL_STRUCTURE: {
  id: TournamentStructure
  label: string
  short: string
  blurb: string
} = {
  id: 'round_robin_double',
  label: 'Todos contra todos (2 jogos)',
  short: '2× cada',
  blurb:
    'Cada um joga 2 sets com cada. Ranking: vitórias → saldo de games → confronto direto.',
}

export function normalizeStructure(
  structure: TournamentStructure | undefined | null,
): TournamentStructure | undefined {
  if (
    structure === 'round_robin' ||
    structure === 'points_league' ||
    structure === 'round_robin_double'
  ) {
    return structure
  }
  return undefined
}

export function structureLabel(
  structure: TournamentStructure | undefined | null,
): string {
  const id = normalizeStructure(structure)
  if (!id) return ''
  if (id === 'round_robin_double') return SPECIAL_STRUCTURE.label
  return CLASSIC_STRUCTURES.find((s) => s.id === id)?.label ?? ''
}

export function structureShortLabel(
  structure: TournamentStructure | undefined | null,
): string {
  const id = normalizeStructure(structure)
  if (!id) return ''
  if (id === 'round_robin_double') return SPECIAL_STRUCTURE.short
  return CLASSIC_STRUCTURES.find((s) => s.id === id)?.short ?? ''
}

export function matchesPerPairLimit(
  structure: TournamentStructure | undefined | null,
): number | null {
  if (normalizeStructure(structure) === 'round_robin_double') return 2
  return null
}

/** Meta de confrontos no painel (clássico RR = 1; double = 2). */
export function fixtureTargetForStructure(
  structure: TournamentStructure | undefined | null,
): number | null {
  const id = normalizeStructure(structure)
  if (id === 'round_robin_double') return 2
  if (id === 'round_robin') return 1
  return null
}

export type PairFixture = {
  playerAId: string
  playerBId: string
  playerAName: string
  playerBName: string
  played: number
  target: number
  remaining: number
}

export function buildRoundRobinFixtures(
  participants: User[],
  matches: Match[],
  structure: TournamentStructure | undefined | null,
): PairFixture[] | null {
  const target = fixtureTargetForStructure(structure)
  if (target == null || participants.length < 2) return null

  const fixtures: PairFixture[] = []
  for (let i = 0; i < participants.length; i += 1) {
    for (let j = i + 1; j < participants.length; j += 1) {
      const a = participants[i]
      const b = participants[j]
      const played = countPairMatches(matches, a.id, b.id)
      fixtures.push({
        playerAId: a.id,
        playerBId: b.id,
        playerAName: a.name,
        playerBName: b.name,
        played,
        target,
        remaining: Math.max(0, target - played),
      })
    }
  }

  fixtures.sort((x, y) => {
    if (y.remaining !== x.remaining) return y.remaining - x.remaining
    if (x.played !== y.played) return x.played - y.played
    return `${x.playerAName}${x.playerBName}`.localeCompare(
      `${y.playerAName}${y.playerBName}`,
      'pt-BR',
    )
  })

  return fixtures
}

export function isRoundRobinFixturesComplete(
  participants: User[],
  matches: Match[],
  structure: TournamentStructure | undefined | null,
): boolean {
  const fixtures = buildRoundRobinFixtures(participants, matches, structure)
  if (!fixtures || fixtures.length === 0) return false
  return fixtures.every((f) => f.remaining === 0)
}

/** Encerra sozinho: confrontos completos OU dia seguinte ao endsOn (com sets). */
export function shouldAutoFinishTournament(
  tournament: {
    status: string
    structure?: TournamentStructure
    endsOn?: string
  },
  participants: User[],
  matches: Match[],
): boolean {
  if (tournament.status === 'finished') return false
  if (matches.length === 0) return false

  if (
    isRoundRobinFixturesComplete(
      participants,
      matches,
      tournament.structure,
    )
  ) {
    return true
  }

  const end = tournament.endsOn?.trim()
  if (end && localDateString() > end) return true

  return false
}

/** Data local YYYY-MM-DD (evita virar “amanhã/ontem” com UTC). */
export function localDateString(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Se o torneio tem período, a data do set precisa estar nele.
 * Sem startsOn/endsOn (legado / outros formatos) → liberado.
 */
export function tournamentMatchDateError(
  tournament: {
    status?: string
    startsOn?: string
    endsOn?: string
  } | null | undefined,
  matchDate: string,
): string | null {
  if (!tournament) return 'Torneio não encontrado.'
  if (tournament.status === 'finished') {
    return 'Este torneio já foi encerrado.'
  }
  const start = tournament.startsOn?.trim()
  const end = tournament.endsOn?.trim()
  if (!start || !end) return null
  if (matchDate < start || matchDate > end) {
    const startLabel = formatPeriodDay(start)
    const endLabel = formatPeriodDay(end)
    return `Sets deste torneio só podem ser registrados entre ${startLabel} e ${endLabel}.`
  }
  return null
}

export function isTodayInTournamentPeriod(tournament: {
  startsOn?: string
  endsOn?: string
}): boolean {
  const start = tournament.startsOn?.trim()
  const end = tournament.endsOn?.trim()
  if (!start || !end) return true
  const today = localDateString()
  return today >= start && today <= end
}

function formatPeriodDay(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`)
  if (Number.isNaN(d.getTime())) return isoDate
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
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
  return 'Vitórias → saldo de games → confronto direto'
}

function headToHeadWins(
  matches: Match[],
  playerId: string,
  opponentId: string,
): number {
  let wins = 0
  for (const match of matches) {
    const isPair =
      (match.playerAId === playerId && match.playerBId === opponentId) ||
      (match.playerAId === opponentId && match.playerBId === playerId)
    if (!isPair) continue
    const playerIsA = match.playerAId === playerId
    const playerGames = playerIsA ? match.gamesA : match.gamesB
    const opponentGames = playerIsA ? match.gamesB : match.gamesA
    if (playerGames > opponentGames) wins += 1
  }
  return wins
}

export function countPairMatches(
  matches: Match[],
  playerAId: string,
  playerBId: string,
): number {
  return matches.filter(
    (m) =>
      (m.playerAId === playerAId && m.playerBId === playerBId) ||
      (m.playerAId === playerBId && m.playerBId === playerAId),
  ).length
}

export function tournamentPairLimitError(
  tournament: {
    structure?: TournamentStructure
  } | null | undefined,
  existingMatches: Match[],
  playerAId: string,
  playerBId: string,
): string | null {
  const limit = matchesPerPairLimit(tournament?.structure)
  if (limit == null) return null
  const played = countPairMatches(existingMatches, playerAId, playerBId)
  if (played >= limit) {
    return `Neste torneio cada dupla joga no máximo ${limit} sets. Vocês já registraram ${played}.`
  }
  return null
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

  if (scoring === 'classic') {
    ranking.sort((x, y) => {
      if (y.points !== x.points) return y.points - x.points
      if (y.played !== x.played) return y.played - x.played
      if (y.winRate !== x.winRate) return y.winRate - x.winRate
      const diffX = x.gamesFor - x.gamesAgainst
      const diffY = y.gamesFor - y.gamesAgainst
      if (diffY !== diffX) return diffY - diffX
      return x.name.localeCompare(y.name, 'pt-BR')
    })
  } else {
    // Vitórias → saldo de games → games a favor → confronto direto
    ranking.sort((x, y) => {
      if (y.wins !== x.wins) return y.wins - x.wins
      const diffX = x.gamesFor - x.gamesAgainst
      const diffY = y.gamesFor - y.gamesAgainst
      if (diffY !== diffX) return diffY - diffX
      if (y.gamesFor !== x.gamesFor) return y.gamesFor - x.gamesFor
      const h2hX = headToHeadWins(matches, x.playerId, y.playerId)
      const h2hY = headToHeadWins(matches, y.playerId, x.playerId)
      if (h2hY !== h2hX) return h2hY - h2hX
      return x.name.localeCompare(y.name, 'pt-BR')
    })
  }

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

/**
 * Corrida a N sets: vencedor com exatamente `target`, perdedor 0..(target-1).
 * Ex.: target 2 → 2–0, 2–1 · target 4 → 4–0 … 4–3.
 */
export function isValidRaceToScore(
  scoreA: number,
  scoreB: number,
  target: number,
): boolean {
  if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB)) return false
  if (scoreA < 0 || scoreB < 0) return false
  if (scoreA === scoreB) return false
  const high = Math.max(scoreA, scoreB)
  const low = Math.min(scoreA, scoreB)
  return high === target && low >= 0 && low < target
}

export function isValidMatchScore(
  format: TournamentFormat,
  scoreA: number,
  scoreB: number,
): boolean {
  const f = normalizeFormat(format)
  if (f === 'tb') return isValidTieBreakScore(scoreA, scoreB)
  if (f === 'fh' || f === 'bh') return isValidRaceToScore(scoreA, scoreB, 2)
  if (f === 'fifteen_forty') return isValidRaceToScore(scoreA, scoreB, 4)
  return isValidSetScore(scoreA, scoreB)
}

export function scoreUnitLabel(format: TournamentFormat): string {
  const f = normalizeFormat(format)
  if (f === 'tb') return 'pontos'
  if (f === 'fh' || f === 'bh' || f === 'fifteen_forty') return 'sets'
  return 'games'
}

export function scoreMaxForFormat(format: TournamentFormat): number {
  const f = normalizeFormat(format)
  if (f === 'tb') return 30
  if (f === 'fh' || f === 'bh') return 2
  if (f === 'fifteen_forty') return 4
  return 7
}

export function defaultScoreForFormat(
  format: TournamentFormat,
): [number, number] {
  const f = normalizeFormat(format)
  if (f === 'tb') return [10, 8]
  if (f === 'fh' || f === 'bh') return [2, 1]
  if (f === 'fifteen_forty') return [4, 2]
  return [6, 4]
}

export function scoreErrorMessage(format: TournamentFormat): string {
  const f = normalizeFormat(format)
  if (f === 'tb') {
    return 'Placar inválido. Tie-break até 10, com 2 de diferença.'
  }
  if (f === 'fh' || f === 'bh') {
    return 'Placar inválido. Sets até 2 (2–0 ou 2–1).'
  }
  if (f === 'fifteen_forty') {
    return 'Placar inválido. Sets até 4 (4–0, 4–1, 4–2 ou 4–3).'
  }
  return 'Placar inválido. Use 6-0 a 6-4, 7-5 ou 7-6.'
}

export function quickScoresForFormat(
  format: TournamentFormat,
): Array<[number, number]> {
  const f = normalizeFormat(format)
  if (f === 'tb') return TB_QUICK_SCORES
  if (f === 'fh' || f === 'bh') return FH_BH_QUICK_SCORES
  if (f === 'fifteen_forty') return FIFTEEN_FORTY_QUICK_SCORES
  return CLASSIC_QUICK_SCORES
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

export const FH_BH_QUICK_SCORES: Array<[number, number]> = [
  [2, 0],
  [2, 1],
]

export const FIFTEEN_FORTY_QUICK_SCORES: Array<[number, number]> = [
  [4, 0],
  [4, 1],
  [4, 2],
  [4, 3],
]
