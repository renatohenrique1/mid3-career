import type { AppData, Match } from '../types'
import { computeCareerStats, computeH2H } from './career'
import { pointsForWin, sortMatchesChronologically } from './ranking'
import { venueLabel } from './venues'

export interface ChartSlice {
  id: string
  label: string
  value: number
  share: number
  color?: string
}

export interface PlayerBar {
  playerId: string
  name: string
  wins: number
  losses: number
  points: number
}

export interface RivalryChart {
  playerAName: string
  playerBName: string
  winsA: number
  winsB: number
  played: number
}

export interface RankingSeries {
  playerId: string
  name: string
  color: string
  values: number[]
}

export interface RankingTimeline {
  dates: string[]
  series: RankingSeries[]
}

export interface AnalyticsSummary {
  totalSets: number
  casualSets: number
  tournamentSets: number
  avgGamesPerSet: number
  tightSets: number
  blowouts: number
  surfaces: ChartSlice[]
  scoreLines: ChartSlice[]
  venues: ChartSlice[]
  players: PlayerBar[]
  rivalry: RivalryChart | null
  rankingTimeline: RankingTimeline
}

const PLAYER_COLORS = [
  'var(--accent)',
  'var(--gold)',
  '#38bdf8',
  '#a78bfa',
  '#34d399',
  '#fb7185',
]

function margin(match: Match) {
  return Math.abs(match.gamesA - match.gamesB)
}

function isTight(match: Match) {
  return (
    (Math.max(match.gamesA, match.gamesB) === 7 &&
      (Math.min(match.gamesA, match.gamesB) === 5 ||
        Math.min(match.gamesA, match.gamesB) === 6)) ||
    (Math.max(match.gamesA, match.gamesB) === 6 &&
      Math.min(match.gamesA, match.gamesB) === 4)
  )
}

function isBlowout(match: Match) {
  return Math.max(match.gamesA, match.gamesB) === 6 && margin(match) >= 4
}

function scoreLineKey(match: Match) {
  const high = Math.max(match.gamesA, match.gamesB)
  const low = Math.min(match.gamesA, match.gamesB)
  return `${high}–${low}`
}

function toSlices(
  rows: Array<{ id: string; label: string; value: number; color?: string }>,
  total: number,
): ChartSlice[] {
  return rows.map((row) => ({
    ...row,
    share: total === 0 ? 0 : row.value / total,
  }))
}

function formatShortDate(iso: string) {
  const [, m, d] = iso.split('-')
  if (!m || !d) return iso
  return `${d}/${m}`
}

function buildRankingTimeline(data: AppData): RankingTimeline {
  const sorted = sortMatchesChronologically(data.matches)

  if (sorted.length === 0) {
    return { dates: [], series: [] }
  }

  const points = new Map<string, number>()
  const wins = new Map<string, number>()
  const played = new Map<string, number>()
  const gamesFor = new Map<string, number>()
  const gamesAgainst = new Map<string, number>()
  for (const user of data.users) {
    points.set(user.id, 0)
    wins.set(user.id, 0)
    played.set(user.id, 0)
    gamesFor.set(user.id, 0)
    gamesAgainst.set(user.id, 0)
  }

  const dates: string[] = []
  const snapshots: number[][] = []
  const playerIds = data.users.map((u) => u.id)

  let day = sorted[0].date
  const flushDay = () => {
    dates.push(day)
    snapshots.push(playerIds.map((id) => points.get(id) ?? 0))
  }

  for (const match of sorted) {
    if (match.date !== day) {
      flushDay()
      day = match.date
    }
    const winnerId =
      match.gamesA > match.gamesB ? match.playerAId : match.playerBId
    const loserId =
      winnerId === match.playerAId ? match.playerBId : match.playerAId
    const standings = data.users.map((user) => ({
      playerId: user.id,
      name: user.name,
      points: points.get(user.id) ?? 0,
      wins: wins.get(user.id) ?? 0,
      played: played.get(user.id) ?? 0,
      gamesFor: gamesFor.get(user.id) ?? 0,
      gamesAgainst: gamesAgainst.get(user.id) ?? 0,
    }))
    const pts = pointsForWin('classic', match.gamesA, match.gamesB, {
      standings,
      winnerId,
      loserId,
    })

    played.set(match.playerAId, (played.get(match.playerAId) ?? 0) + 1)
    played.set(match.playerBId, (played.get(match.playerBId) ?? 0) + 1)
    gamesFor.set(
      match.playerAId,
      (gamesFor.get(match.playerAId) ?? 0) + match.gamesA,
    )
    gamesAgainst.set(
      match.playerAId,
      (gamesAgainst.get(match.playerAId) ?? 0) + match.gamesB,
    )
    gamesFor.set(
      match.playerBId,
      (gamesFor.get(match.playerBId) ?? 0) + match.gamesB,
    )
    gamesAgainst.set(
      match.playerBId,
      (gamesAgainst.get(match.playerBId) ?? 0) + match.gamesA,
    )
    wins.set(winnerId, (wins.get(winnerId) ?? 0) + 1)
    points.set(winnerId, (points.get(winnerId) ?? 0) + pts)
  }
  flushDay()

  const activeIds = playerIds.filter((_, index) =>
    snapshots.some((snap) => (snap[index] ?? 0) > 0),
  )

  const series: RankingSeries[] = activeIds.map((playerId, i) => {
    const user = data.users.find((u) => u.id === playerId)
    const idx = playerIds.indexOf(playerId)
    return {
      playerId,
      name: user?.name ?? '?',
      color: PLAYER_COLORS[i % PLAYER_COLORS.length],
      values: snapshots.map((snap) => snap[idx] ?? 0),
    }
  })

  return {
    dates: dates.map(formatShortDate),
    series,
  }
}

export function computeAnalytics(data: AppData): AnalyticsSummary {
  const { matches } = data
  const totalSets = matches.length
  const casualSets = matches.filter((m) => !m.tournamentId).length
  const tournamentSets = totalSets - casualSets

  const totalGames = matches.reduce(
    (sum, m) => sum + m.gamesA + m.gamesB,
    0,
  )
  const avgGamesPerSet = totalSets === 0 ? 0 : totalGames / totalSets
  const tightSets = matches.filter(isTight).length
  const blowouts = matches.filter(isBlowout).length

  const hard = matches.filter((m) => m.surface === 'hard').length
  const clay = matches.filter((m) => m.surface === 'clay').length
  const surfaces = toSlices(
    [
      { id: 'hard', label: 'Rápida', value: hard, color: 'var(--hard)' },
      { id: 'clay', label: 'Saibro', value: clay, color: 'var(--accent)' },
    ],
    totalSets,
  )

  const scoreCounts = new Map<string, number>()
  for (const match of matches) {
    const key = scoreLineKey(match)
    scoreCounts.set(key, (scoreCounts.get(key) ?? 0) + 1)
  }
  const scoreLines = toSlices(
    [...scoreCounts.entries()]
      .sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1]
        return a[0].localeCompare(b[0])
      })
      .map(([label, value]) => ({
        id: label,
        label,
        value,
        color: 'var(--accent)',
      })),
    totalSets,
  )

  const venueCounts = new Map<string, number>()
  for (const match of matches) {
    const label = venueLabel(match.venue)
    if (label === '—') continue
    venueCounts.set(label, (venueCounts.get(label) ?? 0) + 1)
  }
  const venueTotal = [...venueCounts.values()].reduce((s, n) => s + n, 0)
  const venues = toSlices(
    [...venueCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({
        id: label,
        label,
        value,
        color: 'var(--gold)',
      })),
    venueTotal,
  )

  const career = computeCareerStats(data)
  const players: PlayerBar[] = career
    .filter((p) => p.setPlayed > 0)
    .map((p) => ({
      playerId: p.playerId,
      name: p.name,
      wins: p.setWins,
      losses: p.setLosses,
      points: p.points,
    }))

  const h2h = computeH2H(data.users, data.matches)
  const hottest = [...h2h]
    .filter((r) => r.played > 0)
    .sort((a, b) => {
      if (b.played !== a.played) return b.played - a.played
      return Math.min(b.winsA, b.winsB) - Math.min(a.winsA, a.winsB)
    })[0]

  const nameOf = (id: string) =>
    data.users.find((u) => u.id === id)?.name ?? '?'

  const rivalry: RivalryChart | null = hottest
    ? {
        playerAName: nameOf(hottest.playerAId),
        playerBName: nameOf(hottest.playerBId),
        winsA: hottest.winsA,
        winsB: hottest.winsB,
        played: hottest.played,
      }
    : null

  return {
    totalSets,
    casualSets,
    tournamentSets,
    avgGamesPerSet,
    tightSets,
    blowouts,
    surfaces,
    scoreLines,
    venues,
    players,
    rivalry,
    rankingTimeline: buildRankingTimeline(data),
  }
}
