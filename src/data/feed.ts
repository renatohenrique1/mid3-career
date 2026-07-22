import type { AppData, FeedItem, Match, Tournament } from '../types'

export function buildFeed(data: AppData): FeedItem[] {
  const items: FeedItem[] = []
  const tournamentById = new Map(
    data.tournaments.map((t) => [t.id, t] as const),
  )

  for (const match of data.matches) {
    if (!match.tournamentId) {
      items.push({
        id: `set-${match.id}`,
        kind: 'casual_set',
        at: match.createdAt,
        match,
      })
      continue
    }

    const tournament = tournamentById.get(match.tournamentId)
    if (!tournament) continue

    items.push({
      id: `tset-${match.id}`,
      kind: 'tournament_set',
      at: match.createdAt,
      match,
      tournament,
    })
  }

  for (const tournament of data.tournaments) {
    if (tournament.status !== 'finished' || !tournament.winnerId) continue
    items.push({
      id: `win-${tournament.id}`,
      kind: 'tournament_won',
      at: tournament.finishedAt ?? tournament.createdAt,
      tournament,
      winnerId: tournament.winnerId,
    })
  }

  items.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
  return items
}

export function matchWinnerId(match: Match): string {
  return match.gamesA > match.gamesB ? match.playerAId : match.playerBId
}

export function formatFeedWhen(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function countFinishedWins(tournaments: Tournament[], userId: string) {
  return tournaments.filter(
    (t) => t.status === 'finished' && t.winnerId === userId,
  ).length
}
