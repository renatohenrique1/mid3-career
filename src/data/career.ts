import type {
  AppData,
  CareerStats,
  H2HRecord,
  Match,
  Tournament,
  User,
  UserId,
} from '../types'

function pairKey(a: UserId, b: UserId) {
  return a < b ? `${a}::${b}` : `${b}::${a}`
}

export function computeCareerStats(data: AppData): CareerStats[] {
  const stats = new Map<string, CareerStats>()

  for (const user of data.users) {
    stats.set(user.id, {
      playerId: user.id,
      name: user.name,
      username: user.username,
      setWins: 0,
      setLosses: 0,
      setPlayed: 0,
      titles: 0,
      gamesFor: 0,
      gamesAgainst: 0,
      gameDiff: 0,
      winRate: 0,
    })
  }

  for (const match of data.matches) {
    const a = stats.get(match.playerAId)
    const b = stats.get(match.playerBId)
    if (!a || !b) continue

    a.setPlayed += 1
    b.setPlayed += 1
    a.gamesFor += match.gamesA
    a.gamesAgainst += match.gamesB
    b.gamesFor += match.gamesB
    b.gamesAgainst += match.gamesA

    if (match.gamesA > match.gamesB) {
      a.setWins += 1
      b.setLosses += 1
    } else {
      b.setWins += 1
      a.setLosses += 1
    }
  }

  for (const tournament of data.tournaments) {
    if (tournament.status !== 'finished' || !tournament.winnerId) continue
    const winner = stats.get(tournament.winnerId)
    if (winner) winner.titles += 1
  }

  const list = [...stats.values()].map((s) => ({
    ...s,
    gameDiff: s.gamesFor - s.gamesAgainst,
    winRate: s.setPlayed === 0 ? 0 : s.setWins / s.setPlayed,
  }))

  list.sort((x, y) => {
    if (y.setWins !== x.setWins) return y.setWins - x.setWins
    if (y.titles !== x.titles) return y.titles - x.titles
    if (y.gameDiff !== x.gameDiff) return y.gameDiff - x.gameDiff
    if (y.winRate !== x.winRate) return y.winRate - x.winRate
    return x.name.localeCompare(y.name, 'pt-BR')
  })

  return list
}

export function computeH2H(users: User[], matches: Match[]): H2HRecord[] {
  const map = new Map<string, H2HRecord>()

  for (let i = 0; i < users.length; i += 1) {
    for (let j = i + 1; j < users.length; j += 1) {
      const a = users[i]
      const b = users[j]
      const key = pairKey(a.id, b.id)
      const [playerAId, playerBId] = a.id < b.id ? [a.id, b.id] : [b.id, a.id]
      map.set(key, {
        playerAId,
        playerBId,
        winsA: 0,
        winsB: 0,
        played: 0,
        gamesForA: 0,
        gamesForB: 0,
      })
    }
  }

  for (const match of matches) {
    const key = pairKey(match.playerAId, match.playerBId)
    const record = map.get(key)
    if (!record) continue

    record.played += 1

    const aIsFirst = match.playerAId === record.playerAId
    const gamesFirst = aIsFirst ? match.gamesA : match.gamesB
    const gamesSecond = aIsFirst ? match.gamesB : match.gamesA

    record.gamesForA += gamesFirst
    record.gamesForB += gamesSecond

    if (gamesFirst > gamesSecond) record.winsA += 1
    else record.winsB += 1
  }

  return [...map.values()].sort((x, y) => y.played - x.played)
}

export function leadersFromCareer(stats: CareerStats[]) {
  const withSets = stats.filter((s) => s.setPlayed > 0)
  const withTitles = stats.filter((s) => s.titles > 0)

  const byWins = [...stats].sort((a, b) => {
    if (b.setWins !== a.setWins) return b.setWins - a.setWins
    return a.name.localeCompare(b.name, 'pt-BR')
  })[0]

  const byTitles = [...stats].sort((a, b) => {
    if (b.titles !== a.titles) return b.titles - a.titles
    if (b.setWins !== a.setWins) return b.setWins - a.setWins
    return a.name.localeCompare(b.name, 'pt-BR')
  })[0]

  const byDiff = [...withSets].sort((a, b) => {
    if (b.gameDiff !== a.gameDiff) return b.gameDiff - a.gameDiff
    if (b.setWins !== a.setWins) return b.setWins - a.setWins
    return a.name.localeCompare(b.name, 'pt-BR')
  })[0]

  return {
    mostWins: byWins?.setWins ? byWins : null,
    mostTitles: byTitles?.titles ? byTitles : null,
    bestDiff: byDiff ?? null,
    activePlayers: withSets.length,
    titledPlayers: withTitles.length,
  }
}

export function h2HForPlayer(
  records: H2HRecord[],
  playerId: UserId,
): Array<H2HRecord & { opponentId: UserId; wins: number; losses: number }> {
  return records
    .filter((r) => r.playerAId === playerId || r.playerBId === playerId)
    .map((r) => {
      const isA = r.playerAId === playerId
      return {
        ...r,
        opponentId: isA ? r.playerBId : r.playerAId,
        wins: isA ? r.winsA : r.winsB,
        losses: isA ? r.winsB : r.winsA,
      }
    })
    .sort((a, b) => {
      if (b.played !== a.played) return b.played - a.played
      return b.wins - a.wins
    })
}

export function formatDiff(n: number) {
  if (n > 0) return `+${n}`
  return String(n)
}

export function countTitles(tournaments: Tournament[], userId: UserId) {
  return tournaments.filter(
    (t) => t.status === 'finished' && t.winnerId === userId,
  ).length
}
