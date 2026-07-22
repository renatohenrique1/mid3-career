import type { PlayerStats } from '../types'

interface RankingProps {
  ranking: PlayerStats[]
  currentUserId?: string
  emptyText?: string
  pointsHint?: string
  onRegister?: () => void
}

export function Ranking({
  ranking,
  currentUserId,
  emptyText = 'Ainda sem sets. Registre a primeira partida.',
  pointsHint = '1 ponto por set vencido',
  onRegister,
}: RankingProps) {
  const hasMatches = ranking.some((r) => r.played > 0)

  return (
    <section className="panel ranking-panel">
      <div className="panel-head">
        <h2>Ranking</h2>
        <p>{pointsHint}</p>
      </div>

      {!hasMatches ? (
        <div className="empty-register">
          <p className="empty">{emptyText}</p>
          {onRegister ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={onRegister}
            >
              Registrar primeiro set
            </button>
          ) : null}
        </div>
      ) : (
        <ol className="ranking-list">
          {ranking.map((row, index) => (
            <li
              key={row.playerId}
              className={`rank-row rank-${Math.min(index + 1, 3)}${
                row.playerId === currentUserId ? ' is-you' : ''
              }`}
            >
              <span className="rank-pos" aria-hidden>
                {index + 1}
              </span>
              <div className="rank-main">
                <strong>
                  {row.name}
                  {row.playerId === currentUserId ? (
                    <span className="you-tag"> você</span>
                  ) : null}
                </strong>
                <span className="rank-meta">
                  {row.wins}V · {row.losses}D · {Math.round(row.winRate * 100)}%
                </span>
              </div>
              <div className="rank-points">
                <span className="pts-value">{row.points}</span>
                <span className="pts-label">pts</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
