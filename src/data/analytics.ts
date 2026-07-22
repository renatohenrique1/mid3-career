import type { AppData, Match, Surface } from '../types'
import { computeCareerStats, computeH2H, formatDiff } from './career'
import { matchWinnerId } from './feed'

export interface InsightCard {
  id: string
  topic: string
  headline: string
  detail: string
  accent: 'orange' | 'gold' | 'gray'
}

export interface SurfaceSplit {
  surface: Surface
  label: string
  played: number
  share: number
}

export interface AnalyticsSummary {
  totalSets: number
  casualSets: number
  tournamentSets: number
  avgGamesPerSet: number
  tightSets: number
  blowouts: number
  surfaces: SurfaceSplit[]
  insights: InsightCard[]
}

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
  const surfaces: SurfaceSplit[] = [
    {
      surface: 'hard',
      label: 'Rápida',
      played: hard,
      share: totalSets === 0 ? 0 : hard / totalSets,
    },
    {
      surface: 'clay',
      label: 'Saibro',
      played: clay,
      share: totalSets === 0 ? 0 : clay / totalSets,
    },
  ]

  const insights = buildInsights(data, {
    totalSets,
    casualSets,
    tournamentSets,
    avgGamesPerSet,
    tightSets,
    blowouts,
    hard,
    clay,
  })

  return {
    totalSets,
    casualSets,
    tournamentSets,
    avgGamesPerSet,
    tightSets,
    blowouts,
    surfaces,
    insights,
  }
}

function buildInsights(
  data: AppData,
  meta: {
    totalSets: number
    casualSets: number
    tournamentSets: number
    avgGamesPerSet: number
    tightSets: number
    blowouts: number
    hard: number
    clay: number
  },
): InsightCard[] {
  const insights: InsightCard[] = []
  const stats = computeCareerStats(data)
  const h2h = computeH2H(data.users, data.matches)
  const nameOf = (id: string) =>
    data.users.find((u) => u.id === id)?.name ?? '?'

  if (meta.totalSets === 0) {
    return [
      {
        id: 'empty',
        topic: 'Amostra',
        headline: 'Ainda sem dados para analisar',
        detail:
          'Registre sets avulsos ou de torneio para liberar leituras de forma, superfície e rivalidade.',
        accent: 'gray',
      },
    ]
  }

  // Theme: competitive intensity
  const tightRate = meta.tightSets / meta.totalSets
  const blowoutRate = meta.blowouts / meta.totalSets
  if (tightRate >= 0.4) {
    insights.push({
      id: 'intensity-tight',
      topic: 'Intensidade',
      headline: 'Os sets estão apertados',
      detail: `${meta.tightSets} de ${meta.totalSets} sets terminaram em placares fechados (6–4, 7–5 ou 7–6). O grupo joga equilibrado.`,
      accent: 'orange',
    })
  } else if (blowoutRate >= 0.35) {
    insights.push({
      id: 'intensity-blowout',
      topic: 'Intensidade',
      headline: 'Muitas goleadas no placar',
      detail: `${meta.blowouts} sets com diferença grande (6–0 a 6–2). Há um desnível claro entre alguns jogadores.`,
      accent: 'orange',
    })
  } else {
    insights.push({
      id: 'intensity-mix',
      topic: 'Intensidade',
      headline: 'Mistura de finais apertadas e folgadas',
      detail: `Média de ${meta.avgGamesPerSet.toFixed(1)} games por set · ${meta.tightSets} apertados · ${meta.blowouts} goleadas.`,
      accent: 'orange',
    })
  }

  // Theme: surface preference
  if (meta.hard + meta.clay > 0) {
    const favorite = meta.hard >= meta.clay ? 'rápida' : 'saibro'
    const favoriteCount = Math.max(meta.hard, meta.clay)
    const share = Math.round((favoriteCount / meta.totalSets) * 100)
    insights.push({
      id: 'surface',
      topic: 'Superfície',
      headline: `A temporada pende para quadra ${favorite}`,
      detail: `${favoriteCount} sets (${share}%) em ${favorite}. ${
        meta.hard === meta.clay
          ? 'Distribuição empatada entre as duas.'
          : `Rápida ${meta.hard} · Saibro ${meta.clay}.`
      }`,
      accent: 'gray',
    })
  }

  // Theme: form / hierarchy
  const active = stats.filter((s) => s.setPlayed > 0)
  if (active.length >= 2) {
    const top = active[0]
    const second = active[1]
    const gap = top.setWins - second.setWins
    insights.push({
      id: 'hierarchy',
      topic: 'Hierarquia',
      headline:
        gap >= 3
          ? `${top.name} abre vantagem clara`
          : `${top.name} lidera por pouco`,
      detail: `${top.name} tem ${top.setWins}V e saldo ${formatDiff(top.gameDiff)} (${Math.round(top.winRate * 100)}%). ${second.name} vem logo atrás com ${second.setWins}V.`,
      accent: 'gold',
    })
  }

  // Theme: rivalry
  const hottest = [...h2h].filter((r) => r.played > 0).sort((a, b) => {
    if (b.played !== a.played) return b.played - a.played
    return Math.min(b.winsA, b.winsB) - Math.min(a.winsA, a.winsB)
  })[0]
  if (hottest) {
    const close =
      Math.abs(hottest.winsA - hottest.winsB) <= 1 && hottest.played >= 2
    insights.push({
      id: 'rivalry',
      topic: 'Rivalidade',
      headline: close
        ? `${nameOf(hottest.playerAId)} × ${nameOf(hottest.playerBId)} é o duelo mais quente`
        : `O H2H mais jogado: ${nameOf(hottest.playerAId)} × ${nameOf(hottest.playerBId)}`,
      detail: `${hottest.played} sets · placar ${hottest.winsA}–${hottest.winsB} · games ${hottest.gamesForA}–${hottest.gamesForB}.`,
      accent: 'gold',
    })
  }

  // Theme: context split casual vs tournament
  if (meta.casualSets > 0 && meta.tournamentSets > 0) {
    const casualShare = Math.round((meta.casualSets / meta.totalSets) * 100)
    insights.push({
      id: 'context',
      topic: 'Contexto',
      headline:
        meta.tournamentSets >= meta.casualSets
          ? 'O ritmo vem dos torneios'
          : 'Os avulsos ainda dominam a agenda',
      detail: `${meta.tournamentSets} sets em torneio · ${meta.casualSets} avulsos (${casualShare}% fora de torneio).`,
      accent: 'orange',
    })
  } else if (meta.tournamentSets === 0) {
    insights.push({
      id: 'context-casual',
      topic: 'Contexto',
      headline: 'Temporada 100% avulsa até agora',
      detail:
        'Nenhum set de torneio registrado. Encerrar um torneio vai revelar quem rende sob disputa formal.',
      accent: 'gray',
    })
  }

  // Theme: efficiency / games conversion
  if (active.length > 0) {
    const byEfficiency = [...active].sort((a, b) => {
      const effA = a.setPlayed === 0 ? 0 : a.gamesFor / a.setPlayed
      const effB = b.setPlayed === 0 ? 0 : b.gamesFor / b.setPlayed
      return effB - effA
    })[0]
    const gpg = byEfficiency.gamesFor / byEfficiency.setPlayed
    insights.push({
      id: 'efficiency',
      topic: 'Eficiência',
      headline: `${byEfficiency.name} marca mais games por set`,
      detail: `Média de ${gpg.toFixed(1)} games a favor por set jogado · saldo ${formatDiff(byEfficiency.gameDiff)}.`,
      accent: 'gold',
    })
  }

  // Theme: clutch on favorite surface for top player
  if (active[0] && meta.totalSets >= 3) {
    const topId = active[0].playerId
    const onHard = data.matches.filter(
      (m) =>
        m.surface === 'hard' &&
        (m.playerAId === topId || m.playerBId === topId),
    )
    const onClay = data.matches.filter(
      (m) =>
        m.surface === 'clay' &&
        (m.playerAId === topId || m.playerBId === topId),
    )
    const winRateOn = (list: Match[]) => {
      if (list.length === 0) return null
      const wins = list.filter((m) => matchWinnerId(m) === topId).length
      return wins / list.length
    }
    const hardWr = winRateOn(onHard)
    const clayWr = winRateOn(onClay)
    if (hardWr !== null || clayWr !== null) {
      let best: 'rápida' | 'saibro' | null = null
      let wr = 0
      if (hardWr !== null && clayWr !== null) {
        best = hardWr >= clayWr ? 'rápida' : 'saibro'
        wr = Math.max(hardWr, clayWr)
      } else if (hardWr !== null) {
        best = 'rápida'
        wr = hardWr
      } else if (clayWr !== null) {
        best = 'saibro'
        wr = clayWr
      }
      if (best) {
        insights.push({
          id: 'surface-ace',
          topic: 'Terreno',
          headline: `${active[0].name} rende mais no ${best}`,
          detail: `Aproveitamento de ${Math.round(wr * 100)}% nessa superfície (${
            best === 'rápida' ? onHard.length : onClay.length
          } sets).`,
          accent: 'orange',
        })
      }
    }
  }

  return insights.slice(0, 6)
}
