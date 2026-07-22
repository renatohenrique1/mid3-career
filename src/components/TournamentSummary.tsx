import type { PlayerStats } from '../types'

interface TournamentSummaryProps {
  tournamentName: string
  winnerName: string
  setsPlayed: number
  playerCount: number
  ranking: PlayerStats[]
  finishedAt?: string
}

function formatFinishedAt(iso?: string) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function TournamentSummary({
  tournamentName,
  winnerName,
  setsPlayed,
  playerCount,
  ranking,
  finishedAt,
}: TournamentSummaryProps) {
  const finishedLabel = formatFinishedAt(finishedAt)
  const podium = ranking.filter((r) => r.played > 0).slice(0, 3)

  return (
    <section className="panel tournament-summary">
      <div className="summary-hero">
        <p className="tourney-kicker">Resultado final</p>
        <h3>{tournamentName}</h3>
        <p className="summary-champion">
          Campeão: <strong>{winnerName}</strong>
        </p>
        <p className="summary-meta">
          {setsPlayed} set{setsPlayed === 1 ? '' : 's'} jogados · {playerCount}{' '}
          jogador{playerCount === 1 ? '' : 'es'}
          {finishedLabel ? ` · encerrado em ${finishedLabel}` : ''}
        </p>
      </div>

      {podium.length > 0 ? (
        <ol className="summary-podium">
          {podium.map((row, index) => (
            <li key={row.playerId}>
              <span className="summary-pos">{index + 1}º</span>
              <div>
                <strong>{row.name}</strong>
                <span>
                  {row.wins}V · {row.losses}D · {row.points} pts · saldo{' '}
                  {row.gamesFor - row.gamesAgainst >= 0 ? '+' : ''}
                  {row.gamesFor - row.gamesAgainst}
                </span>
              </div>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  )
}
