import { computeCareerStats } from './career'
import {
  matchCountsForRanking,
  pointsForWin,
  sortMatchesChronologically,
} from './ranking'
import { venueLabel } from './venues'
import type { AppData, UserId } from '../types'

const MONTH_SHORT = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
]

const MONTH_LONG = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

export type SeasonMonth = {
  key: string
  label: string
  count: number
}

export type SeasonVenue = {
  label: string
  count: number
}

export type SeasonPlayer = {
  name: string
  short: string
  sets: number
  wins: number
  losses: number
  points: number
  pointsPerSet: string
  minutesLabel: string
}

export type SeasonPair = {
  label: string
  sets: number
  score: string
  leftName: string
  rightName: string
  leftWins: number
  rightWins: number
}

export type PointsTimeline = {
  series: Array<{ name: string; short: string; values: number[] }>
  ticks: Array<{ index: number; label: string }>
}

export type SeasonEdge = {
  leaderShort: string
  leaderPoints: number
  leaderWins: number
  rivalShort: string
  rivalNote: string
}

export type SeasonRecap = {
  rangeLabel: string
  sets: number
  games: number
  playDays: number
  cast: string[]
  minutesLabel: string
  recordedMinutes: number
  tubeEstimate: number | null
  proTrainingDays: number | null
  missingDuration: number
  medianLabel: string
  medianMinutes: number | null
  closeLabel: string | null
  closeMinutes: number | null
  closeCount: number
  blowoutLabel: string | null
  blowoutMinutes: number | null
  blowoutCount: number
  modeScore: string
  modeCount: number
  meanMinutesLabel: string | null
  exact60: number
  months: SeasonMonth[]
  peakLabel: string
  peakCount: number
  restNote: string
  topPair: SeasonPair
  otherPairs: SeasonPair[]
  podium: SeasonPlayer[]
  timeline: PointsTimeline
  edge: SeasonEdge | null
  topVenue: string
  topVenueCount: number
  venues: SeasonVenue[]
  venueNote: string
  surfaceNote: string
  outingNote: string
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid]
  return Math.round((sorted[mid - 1] + sorted[mid]) / 2)
}

function shortName(name: string) {
  return name.split(' ')[0] || name
}

const TUBE_MINUTES = 120
const PRO_TRAINING_MINUTES = 180

export function formatClock(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest} min`
  if (rest === 0) return `${hours} h`
  return `${hours} h ${String(rest).padStart(2, '0')}`
}

function formatDay(iso: string) {
  const [, month, day] = iso.split('-').map(Number)
  return `${day} de ${MONTH_LONG[month - 1]}`
}

function pointsTimeline(data: AppData): PointsTimeline {
  const players = data.users.map((user) => ({
    playerId: user.id,
    name: user.name,
    short: shortName(user.name),
    points: 0,
    wins: 0,
    played: 0,
    gamesFor: 0,
    gamesAgainst: 0,
  }))
  const byId = new Map(players.map((player) => [player.playerId, player]))
  const steps = players.map(() => [0])
  const dates = [sortMatchesChronologically(data.matches)[0]?.date ?? '']

  for (const match of sortMatchesChronologically(data.matches)) {
    const home = byId.get(match.playerAId)
    const away = byId.get(match.playerBId)
    if (!home || !away || !matchCountsForRanking(match)) continue
    const winnerId = match.gamesA > match.gamesB ? match.playerAId : match.playerBId
    const loserId = winnerId === match.playerAId ? match.playerBId : match.playerAId
    const pts = pointsForWin('classic', match.gamesA, match.gamesB, {
      standings: players.map((player) => ({
        playerId: player.playerId,
        name: player.name,
        points: player.points,
        wins: player.wins,
        played: player.played,
        gamesFor: player.gamesFor,
        gamesAgainst: player.gamesAgainst,
      })),
      winnerId,
      loserId,
    })
    home.played += 1
    away.played += 1
    home.gamesFor += match.gamesA
    home.gamesAgainst += match.gamesB
    away.gamesFor += match.gamesB
    away.gamesAgainst += match.gamesA
    const winner = winnerId === home.playerId ? home : away
    winner.wins += 1
    winner.points += pts
    dates.push(match.date)
    players.forEach((player, index) => steps[index].push(player.points))
  }

  const ranked = players
    .map((player, index) => ({ player, values: steps[index] }))
    .filter((row) => row.player.played > 0)
    .sort((a, b) => b.player.points - a.player.points)

  const ticks: PointsTimeline['ticks'] = []
  let lastMonth = ''
  dates.forEach((date, index) => {
    if (!date) return
    const month = date.slice(5, 7)
    if (month === lastMonth) return
    lastMonth = month
    ticks.push({
      index,
      label: MONTH_SHORT[Number(month) - 1] ?? month,
    })
  })

  return {
    series: ranked.map((row) => ({
      name: row.player.name,
      short: row.player.short,
      values: row.values,
    })),
    ticks,
  }
}

function pointsPerSet(points: number, sets: number) {
  if (sets === 0) return '0'
  return (points / sets).toFixed(1).replace('.', ',')
}

export function buildSeasonRecap(data: AppData): SeasonRecap | null {
  const matches = [...data.matches].sort((a, b) => a.date.localeCompare(b.date))
  if (matches.length === 0) return null

  const names = new Map(data.users.map((user) => [user.id, user.name]))
  const nameOf = (id: UserId) => names.get(id) ?? 'Jogador'

  const from = matches[0].date
  const to = matches[matches.length - 1].date
  const year = to.slice(0, 4)
  const rangeLabel =
    from.slice(0, 4) === year
      ? `${formatDay(from)} a ${formatDay(to)} de ${year}`
      : `${formatDay(from)} de ${from.slice(0, 4)} a ${formatDay(to)} de ${year}`

  const games = matches.reduce((sum, match) => sum + match.gamesA + match.gamesB, 0)
  const timed = matches.filter((match) => match.durationMinutes != null)
  const minutes = timed.reduce((sum, match) => sum + (match.durationMinutes ?? 0), 0)
  const medianMinutes = median(timed.map((match) => match.durationMinutes ?? 0))
  const closeTimed = timed.filter((match) => Math.abs(match.gamesA - match.gamesB) <= 2)
  const blowoutTimed = timed.filter((match) => Math.abs(match.gamesA - match.gamesB) >= 4)
  const closeMedian = median(closeTimed.map((match) => match.durationMinutes ?? 0))
  const blowoutMedian = median(blowoutTimed.map((match) => match.durationMinutes ?? 0))
  const exact60 = timed.filter((match) => match.durationMinutes === 60).length
  const scoreCounts = new Map<string, number>()
  for (const match of matches) {
    const high = Math.max(match.gamesA, match.gamesB)
    const low = Math.min(match.gamesA, match.gamesB)
    const score = `${high}–${low}`
    scoreCounts.set(score, (scoreCounts.get(score) ?? 0) + 1)
  }
  let modeScore = '—'
  let modeCount = 0
  for (const [score, count] of scoreCounts) {
    if (count > modeCount) {
      modeScore = score
      modeCount = count
    }
  }
  const meanMinutes = timed.length === 0 ? null : minutes / timed.length
  const meanMinutesLabel =
    meanMinutes == null
      ? null
      : Number.isInteger(Math.round(meanMinutes * 10) / 10)
        ? String(Math.round(meanMinutes))
        : (Math.round(meanMinutes * 10) / 10).toFixed(1).replace('.', ',')

  const start = new Date(`${from.slice(0, 7)}-01T12:00:00Z`)
  const end = new Date(`${to.slice(0, 7)}-01T12:00:00Z`)
  const months: SeasonMonth[] = []
  for (let cursor = start; cursor <= end; cursor.setUTCMonth(cursor.getUTCMonth() + 1)) {
    const key = cursor.toISOString().slice(0, 7)
    const monthIndex = Number(key.slice(5, 7)) - 1
    months.push({
      key,
      label: MONTH_SHORT[monthIndex],
      count: matches.filter((match) => match.date.startsWith(key)).length,
    })
  }
  const peak = months.reduce((best, month) =>
    month.count > best.count ? month : best,
  )
  const peakName = MONTH_LONG[Number(peak.key.slice(5, 7)) - 1]
  const restNote = months
    .filter((month) => month.key !== peak.key)
    .map((month) => `${month.label} ${month.count}`)
    .join(', ')

  const pairs = new Map<
    string,
    { ids: [UserId, UserId]; sets: number; wins: Map<UserId, number> }
  >()
  for (const match of matches) {
    const ids = [match.playerAId, match.playerBId].sort() as [UserId, UserId]
    const key = ids.join('::')
    const pair = pairs.get(key) ?? { ids, sets: 0, wins: new Map() }
    pair.sets += 1
    const winner = match.gamesA > match.gamesB ? match.playerAId : match.playerBId
    pair.wins.set(winner, (pair.wins.get(winner) ?? 0) + 1)
    pairs.set(key, pair)
  }
  const pairRows: SeasonPair[] = [...pairs.values()]
    .sort((a, b) => b.sets - a.sets)
    .map((pair) => {
      const winsA = pair.wins.get(pair.ids[0]) ?? 0
      const winsB = pair.wins.get(pair.ids[1]) ?? 0
      const aLeads = winsA >= winsB
      const leftId = aLeads ? pair.ids[0] : pair.ids[1]
      const rightId = aLeads ? pair.ids[1] : pair.ids[0]
      const leftWins = aLeads ? winsA : winsB
      const rightWins = aLeads ? winsB : winsA
      const leftName = shortName(nameOf(leftId))
      const rightName = shortName(nameOf(rightId))
      return {
        label: `${leftName} × ${rightName}`,
        sets: pair.sets,
        score:
          leftWins === rightWins
            ? 'empate'
            : `${leftWins}–${rightWins} ${leftName}`,
        leftName,
        rightName,
        leftWins,
        rightWins,
      }
    })

  const minutesByPlayer = new Map<UserId, number>()
  for (const match of timed) {
    const add = match.durationMinutes ?? 0
    minutesByPlayer.set(match.playerAId, (minutesByPlayer.get(match.playerAId) ?? 0) + add)
    minutesByPlayer.set(match.playerBId, (minutesByPlayer.get(match.playerBId) ?? 0) + add)
  }

  const timeline = pointsTimeline(data)

  const rivalries = new Map<
    UserId,
    Array<{ name: string; wins: number; losses: number }>
  >()
  for (const pair of pairs.values()) {
    const [first, second] = pair.ids
    const firstWins = pair.wins.get(first) ?? 0
    const secondWins = pair.wins.get(second) ?? 0
    const firstList = rivalries.get(first) ?? []
    firstList.push({
      name: shortName(nameOf(second)),
      wins: firstWins,
      losses: secondWins,
    })
    rivalries.set(first, firstList)
    const secondList = rivalries.get(second) ?? []
    secondList.push({
      name: shortName(nameOf(first)),
      wins: secondWins,
      losses: firstWins,
    })
    rivalries.set(second, secondList)
  }

  const podium: SeasonPlayer[] = computeCareerStats(data)
    .filter((row) => row.setPlayed > 0)
    .slice(0, 3)
    .map((row) => ({
      name: row.name,
      short: shortName(row.name),
      sets: row.setPlayed,
      wins: row.setWins,
      losses: row.setLosses,
      points: row.points,
      pointsPerSet: pointsPerSet(row.points, row.setPlayed),
      minutesLabel: formatClock(minutesByPlayer.get(row.playerId) ?? 0),
    }))

  const leader = podium[0]
  const unbeaten = [...rivalries.entries()].find(
    ([, list]) => list.length >= 2 && list.every((row) => row.wins > row.losses),
  )
  const edge: SeasonEdge | null =
    leader && unbeaten
      ? {
          leaderShort: leader.short,
          leaderPoints: leader.points,
          leaderWins: leader.wins,
          rivalShort: shortName(nameOf(unbeaten[0])),
          rivalNote: unbeaten[1]
            .map((row) => `${row.wins}–${row.losses} no ${row.name}`)
            .join(' · '),
        }
      : null

  const venues = new Map<string, number>()
  for (const match of matches) {
    const label = match.venue ? venueLabel(match.venue) : 'Sem local'
    venues.set(label, (venues.get(label) ?? 0) + 1)
  }
  const venueRows = [...venues.entries()].sort((a, b) => b[1] - a[1])
  const [topVenue, topVenueCount] = venueRows[0] ?? ['—', 0]
  const venueNote = venueRows
    .slice(1)
    .filter(([, count]) => count > 0)
    .map(([label, count]) => `${label} ${count}`)
    .join(', ')

  const played = new Map<UserId, number>()
  const byDay = new Map<string, number>()
  for (const match of matches) {
    byDay.set(match.date, (byDay.get(match.date) ?? 0) + 1)
    played.set(match.playerAId, (played.get(match.playerAId) ?? 0) + 1)
    played.set(match.playerBId, (played.get(match.playerBId) ?? 0) + 1)
  }
  const cast = [...played.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => shortName(nameOf(id)))
  const dayCounts = [...byDay.values()]
  const one = dayCounts.filter((count) => count === 1).length
  const two = dayCounts.filter((count) => count === 2).length
  const three = dayCounts.filter((count) => count >= 3).length
  if (!pairRows[0]) return null

  const hard = matches.filter((match) => match.surface === 'hard').length
  const clay = matches.filter((match) => match.surface === 'clay').length

  return {
    rangeLabel,
    sets: matches.length,
    games,
    playDays: dayCounts.length,
    cast,
    minutesLabel: formatClock(minutes),
    recordedMinutes: minutes,
    tubeEstimate: minutes > 0 ? Math.max(1, Math.round(minutes / TUBE_MINUTES)) : null,
    proTrainingDays:
      minutes > 0 ? Math.max(1, Math.round(minutes / PRO_TRAINING_MINUTES)) : null,
    missingDuration: matches.length - timed.length,
    medianLabel: medianMinutes == null ? '—' : `${medianMinutes} min`,
    medianMinutes,
    closeLabel: closeMedian == null ? null : `${closeMedian} min`,
    closeMinutes: closeMedian,
    closeCount: closeTimed.length,
    blowoutLabel: blowoutMedian == null ? null : `${blowoutMedian} min`,
    blowoutMinutes: blowoutMedian,
    blowoutCount: blowoutTimed.length,
    modeScore,
    modeCount,
    meanMinutesLabel,
    exact60,
    months,
    peakLabel: peakName.charAt(0).toUpperCase() + peakName.slice(1),
    peakCount: peak.count,
    restNote,
    topPair: pairRows[0],
    otherPairs: pairRows.slice(1, 3),
    podium,
    timeline,
    edge,
    topVenue,
    topVenueCount,
    venues: venueRows.map(([label, count]) => ({ label, count })),
    venueNote,
    surfaceNote: `Rápida ${hard}, saibro ${clay}.`,
    outingNote: `Em ${dayCounts.length} dias de jogo, ${one} tiveram um set, ${two} tiveram dois e ${three} tiveram três.`,
  }
}
