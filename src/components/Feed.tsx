import { useMemo, useState } from 'react'
import {
  buildFeed,
  formatFeedWhen,
  matchWinnerId,
} from '../data/feed'
import { ballLabel, formatDuration, formatShortLabel, surfaceLabel } from '../data/ranking'
import type { AppData, FeedItem, Match, User } from '../types'

type FeedFilter = 'all' | 'casual' | 'tournament' | 'wins'

interface FeedProps {
  data: AppData
  currentUser: User
  onOpenTournament: (tournamentId: string) => void
  onRegisterSet?: () => void
}

function userName(users: User[], id: string) {
  return users.find((u) => u.id === id)?.name ?? '?'
}

function matchesFilter(item: FeedItem, filter: FeedFilter) {
  if (filter === 'all') return true
  if (filter === 'wins') return item.kind === 'tournament_won'
  if (filter === 'casual') return item.kind === 'casual_set'
  return item.kind === 'tournament_set'
}

function scoreLine(match: Match, users: User[]) {
  const nameA = userName(users, match.playerAId)
  const nameB = userName(users, match.playerBId)
  const winnerId = matchWinnerId(match)
  const aWon = winnerId === match.playerAId

  return {
    winnerId,
    winner: aWon ? nameA : nameB,
    loser: aWon ? nameB : nameA,
    score: aWon
      ? `${match.gamesA}–${match.gamesB}`
      : `${match.gamesB}–${match.gamesA}`,
  }
}

export function Feed({
  data,
  currentUser,
  onOpenTournament,
  onRegisterSet,
}: FeedProps) {
  const [filter, setFilter] = useState<FeedFilter>('all')
  const feed = useMemo(() => buildFeed(data), [data])
  const visible = feed.filter((item) => matchesFilter(item, filter))

  const casualCount = feed.filter((i) => i.kind === 'casual_set').length
  const tournamentSetCount = feed.filter(
    (i) => i.kind === 'tournament_set',
  ).length
  const winCount = feed.filter((i) => i.kind === 'tournament_won').length

  return (
    <section className="feed-home">
      <header className="sets-hero">
        <p className="tourney-kicker">Atividade</p>
        <h2>Feed</h2>
        <p>
          Sets avulsos, partidas de torneio e títulos conquistados por todo
          mundo.
        </p>
        {onRegisterSet ? (
          <button
            type="button"
            className="btn btn-primary register-inline-cta"
            onClick={onRegisterSet}
          >
            Registrar set
          </button>
        ) : null}
      </header>

      <div className="tourney-stats" aria-label="Resumo do feed">
        <div>
          <strong>{casualCount}</strong>
          <span>avulsos</span>
        </div>
        <div>
          <strong>{tournamentSetCount}</strong>
          <span>em torneio</span>
        </div>
        <div>
          <strong>{winCount}</strong>
          <span>títulos</span>
        </div>
      </div>

      <div className="feed-filters feed-filters-4" role="tablist" aria-label="Filtro do feed">
        <button
          type="button"
          className={filter === 'all' ? 'active' : ''}
          onClick={() => setFilter('all')}
        >
          Tudo
        </button>
        <button
          type="button"
          className={filter === 'casual' ? 'active' : ''}
          onClick={() => setFilter('casual')}
        >
          Avulsos
        </button>
        <button
          type="button"
          className={filter === 'tournament' ? 'active' : ''}
          onClick={() => setFilter('tournament')}
        >
          Torneio
        </button>
        <button
          type="button"
          className={filter === 'wins' ? 'active' : ''}
          onClick={() => setFilter('wins')}
        >
          Títulos
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="panel empty-register">
          <p className="empty">
            Ainda sem atividade. Registre um set ou encerre um torneio para
            aparecer aqui.
          </p>
          {onRegisterSet ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={onRegisterSet}
            >
              Registrar set
            </button>
          ) : null}
        </div>
      ) : (
        <ul className="feed-list">
          {visible.map((item) => (
            <li key={item.id} className={`feed-item panel feed-${item.kind}`}>
              <FeedCard
                item={item}
                users={data.users}
                currentUserId={currentUser.id}
                onOpenTournament={onOpenTournament}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function FeedCard({
  item,
  users,
  currentUserId,
  onOpenTournament,
}: {
  item: FeedItem
  users: User[]
  currentUserId: string
  onOpenTournament: (tournamentId: string) => void
}) {
  if (item.kind === 'tournament_won') {
    const winner = userName(users, item.winnerId)
    const isYou = item.winnerId === currentUserId

    return (
      <div className="feed-title-card">
        <div className="feed-title-banner">
          <span className="feed-badge gold">Campeão</span>
          <time dateTime={item.at}>{formatFeedWhen(item.at)}</time>
        </div>
        <div className="feed-title-body">
          <span className="feed-title-mark" aria-hidden>
            ★
          </span>
          <div>
            <p className="feed-title-kicker">Título conquistado</p>
            <p className="feed-title">
              <strong className={isYou ? 'is-you' : ''}>{winner}</strong> venceu{' '}
              <strong>{item.tournament.name}</strong>
              <span className="feed-format-inline">
                {' '}
                · {formatShortLabel(item.tournament.format ?? 'classic')}
              </span>
            </p>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-compact"
          onClick={() => onOpenTournament(item.tournament.id)}
        >
          Ver torneio
        </button>
      </div>
    )
  }

  const { match } = item
  const { winnerId, winner, loser, score } = scoreLine(match, users)
  const isTournament = item.kind === 'tournament_set'

  return (
    <div className={`feed-set-card ${isTournament ? 'is-tournament' : 'is-casual'}`}>
      <div className="feed-item-top">
        <span className={`feed-badge ${isTournament ? 'orange' : 'gray'}`}>
          {isTournament
            ? `Set · ${formatShortLabel(item.tournament.format ?? 'classic')}`
            : 'Set · Avulso'}
        </span>
        <time dateTime={item.at}>{formatFeedWhen(item.at)}</time>
      </div>

      <p className="feed-title">
        <strong className={winnerId === currentUserId ? 'is-you' : ''}>
          {winner}
        </strong>{' '}
        venceu <span className="feed-loser">{loser}</span>
      </p>

      <p className="feed-scoreline" aria-label="Placar">
        {score}
      </p>

      <div className="feed-meta">
        <span className={`surface-chip ${match.surface}`}>
          {surfaceLabel(match.surface)}
        </span>
        {formatDuration(match.durationMinutes) ? (
          <span className="feed-context-chip casual">
            {formatDuration(match.durationMinutes)}
          </span>
        ) : null}
        {ballLabel(match.ball) ? (
          <span className="feed-context-chip casual">{ballLabel(match.ball)}</span>
        ) : null}
        {isTournament ? (
          <button
            type="button"
            className="feed-context-chip tournament"
            onClick={() => onOpenTournament(item.tournament.id)}
          >
            {item.tournament.name}
          </button>
        ) : (
          <span className="feed-context-chip casual">Fora de torneio</span>
        )}
      </div>
    </div>
  )
}
