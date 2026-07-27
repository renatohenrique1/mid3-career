import type { PlayerStats } from '../types'

interface RankingProps {
  ranking: PlayerStats[]
  currentUserId?: string
  emptyText?: string
  pointsHint?: string
  /** `null` omite o título (útil quando a página já tem "Ranking"). */
  title?: string | null
  onRegister?: () => void
}

export function Ranking({
  ranking,
  currentUserId,
  emptyText = 'Ainda sem sets. Registre a primeira partida.',
  pointsHint,
  title = 'Ranking',
  onRegister,
}: RankingProps) {
  const hasMatches = ranking.some((r) => r.played > 0)
  const hint =
    pointsHint === undefined
      ? title === null
        ? null
        : '1 ponto por set vencido'
      : pointsHint
  const showHead = title !== null || Boolean(hint)

  return (
    <section className="panel ranking-panel">
      {showHead ? (
        <div className={`panel-head${title === null ? ' panel-head-quiet' : ''}`}>
          {title !== null ? <h2>{title}</h2> : null}
          {hint ? <p>{hint}</p> : null}
        </div>
      ) : null}

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
