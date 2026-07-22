import { ballLabel, formatDuration, surfaceLabel } from '../data/ranking'
import type { Match, User } from '../types'

interface MatchHistoryProps {
  matches: Match[]
  users: User[]
  currentUserId: string
  onDelete: (matchId: string) => void
}

function userName(users: User[], id: string) {
  return users.find((u) => u.id === id)?.name ?? '?'
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function MatchHistory({
  matches,
  users,
  currentUserId,
  onDelete,
}: MatchHistoryProps) {
  return (
    <section className="panel history-panel">
      <div className="panel-head">
        <h2>Histórico</h2>
        <p>
          {matches.length} set{matches.length === 1 ? '' : 's'}
        </p>
      </div>

      {matches.length === 0 ? (
        <p className="empty">Nenhum set registrado ainda.</p>
      ) : (
        <ul className="history-list">
          {matches.map((match) => {
            const aWon = match.gamesA > match.gamesB
            const nameA = userName(users, match.playerAId)
            const nameB = userName(users, match.playerBId)
            const canDelete = match.recordedById === currentUserId
            const duration = formatDuration(match.durationMinutes)
            const ball = ballLabel(match.ball)

            return (
              <li
                key={match.id}
                className={`history-item surface-${match.surface}`}
              >
                <div className="history-top">
                  <time dateTime={match.date}>{formatDate(match.date)}</time>
                  <span className={`surface-chip ${match.surface}`}>
                    {surfaceLabel(match.surface)}
                  </span>
                </div>
                <div className="history-score">
                  <span className={aWon ? 'winner' : ''}>{nameA}</span>
                  <strong>
                    {match.gamesA}–{match.gamesB}
                  </strong>
                  <span className={!aWon ? 'winner' : ''}>{nameB}</span>
                </div>
                {duration || ball ? (
                  <div className="history-extras">
                    {duration ? <span>{duration}</span> : null}
                    {ball ? <span>{ball}</span> : null}
                  </div>
                ) : null}
                {canDelete ? (
                  <button
                    type="button"
                    className="link-btn danger"
                    onClick={() => {
                      if (confirm('Apagar este set?')) onDelete(match.id)
                    }}
                  >
                    Apagar
                  </button>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
