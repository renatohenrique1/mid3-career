import { useMemo, useState } from 'react'
import {
  computeCareerStats,
  computeH2H,
  formatDiff,
  h2HForPlayer,
  leadersFromCareer,
} from '../data/career'
import type { AppData, CareerStats, User } from '../types'

interface CareerRankingProps {
  data: AppData
  currentUser: User
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

function userName(users: User[], id: string) {
  return users.find((u) => u.id === id)?.name ?? '?'
}

export function CareerRanking({ data, currentUser }: CareerRankingProps) {
  const stats = useMemo(() => computeCareerStats(data), [data])
  const h2h = useMemo(
    () => computeH2H(data.users, data.matches),
    [data.users, data.matches],
  )
  const leaders = useMemo(() => leadersFromCareer(stats), [stats])
  const [selectedId, setSelectedId] = useState<string | null>(
    currentUser.id,
  )

  const selected =
    stats.find((s) => s.playerId === selectedId) ?? stats[0] ?? null

  const selectedH2H = useMemo(() => {
    if (!selected) return []
    return h2HForPlayer(h2h, selected.playerId)
  }, [h2h, selected])

  return (
    <section className="career-home">
      <header className="sets-hero">
        <p className="tourney-kicker">Geral</p>
        <h2>Ranking</h2>
        <p>
          Vitórias em sets, títulos de torneio, saldo de games e o H2H entre
          todos.
        </p>
      </header>

      <div className="leader-grid">
        <LeaderCard
          label="Mais vitórias"
          empty="Sem sets ainda"
          player={leaders.mostWins}
          value={leaders.mostWins ? `${leaders.mostWins.setWins}V` : null}
          accent="orange"
        />
        <LeaderCard
          label="Mais títulos"
          empty="Nenhum torneio encerrado"
          player={leaders.mostTitles}
          value={leaders.mostTitles ? `${leaders.mostTitles.titles}` : null}
          accent="gold"
        />
        <LeaderCard
          label="Maior saldo"
          empty="Sem saldo ainda"
          player={leaders.bestDiff}
          value={
            leaders.bestDiff ? formatDiff(leaders.bestDiff.gameDiff) : null
          }
          accent="gray"
        />
      </div>

      <div className="tourney-section-head">
        <h3>Jogadores</h3>
        <span>
          {stats.length} conta{stats.length === 1 ? '' : 's'}
        </span>
      </div>

      {stats.length === 0 ? (
        <div className="panel">
          <p className="empty">Nenhum usuário cadastrado.</p>
        </div>
      ) : (
        <div className="panel table-panel">
          <div className="table-scroll">
            <table className="career-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Jogador</th>
                  <th>V</th>
                  <th>D</th>
                  <th>Sets</th>
                  <th>Títulos</th>
                  <th>Saldo</th>
                  <th>%</th>
                  <th>Games</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((player, index) => (
                  <tr
                    key={player.playerId}
                    className={`${
                      selected?.playerId === player.playerId ? 'is-selected' : ''
                    }${player.playerId === currentUser.id ? ' is-you' : ''}`}
                    onClick={() => setSelectedId(player.playerId)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setSelectedId(player.playerId)
                      }
                    }}
                    tabIndex={0}
                    aria-selected={selected?.playerId === player.playerId}
                  >
                    <td className="num">{index + 1}</td>
                    <td className="player-cell">
                      <span className="career-avatar sm" aria-hidden>
                        {initials(player.name)}
                      </span>
                      <span>
                        <strong>
                          {player.name}
                          {player.playerId === currentUser.id ? (
                            <span className="you-tag"> você</span>
                          ) : null}
                        </strong>
                      </span>
                    </td>
                    <td className="num">{player.setWins}</td>
                    <td className="num">{player.setLosses}</td>
                    <td className="num">{player.setPlayed}</td>
                    <td className="num">{player.titles}</td>
                    <td className="num">{formatDiff(player.gameDiff)}</td>
                    <td className="num">{Math.round(player.winRate * 100)}%</td>
                    <td className="num muted">
                      {player.gamesFor}/{player.gamesAgainst}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="table-hint">Toque numa linha para ver o H2H.</p>
        </div>
      )}

      {selected ? (
        <section className="panel h2h-panel">
          <div className="panel-head">
            <h2>H2H · {selected.name}</h2>
            <p>contra cada adversário</p>
          </div>

          {selectedH2H.length === 0 ? (
            <p className="empty">Cadastre mais jogadores para ver confrontos.</p>
          ) : (
            <ul className="h2h-list">
              {selectedH2H.map((row) => {
                const opponent = userName(data.users, row.opponentId)
                const lead =
                  row.wins === row.losses
                    ? 'empate'
                    : row.wins > row.losses
                      ? 'vantagem'
                      : 'desvantagem'

                return (
                  <li key={`${row.playerAId}-${row.playerBId}`} className="h2h-row">
                    <div className="h2h-names">
                      <strong>{opponent}</strong>
                      <span className={`h2h-lead ${lead}`}>
                        {row.played === 0
                          ? 'ainda sem sets'
                          : `${row.wins}–${row.losses} · ${lead}`}
                      </span>
                    </div>
                    <div className="h2h-score" aria-label="Placar H2H">
                      <span>{row.wins}</span>
                      <span className="h2h-sep">–</span>
                      <span>{row.losses}</span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      ) : null}

      <section className="panel h2h-panel">
        <div className="panel-head">
          <h2>Todos os H2H</h2>
          <p>cada par de jogadores</p>
        </div>

        {h2h.length === 0 ? (
          <p className="empty">Precisa de pelo menos 2 contas.</p>
        ) : (
          <ul className="h2h-list h2h-all">
            {h2h.map((row) => {
              const nameA = userName(data.users, row.playerAId)
              const nameB = userName(data.users, row.playerBId)

              return (
                <li
                  key={`${row.playerAId}-${row.playerBId}`}
                  className="h2h-row h2h-pair"
                >
                  <div className="h2h-pair-grid">
                    <span
                      className={
                        row.winsA > row.winsB
                          ? 'winner'
                          : row.played === 0
                            ? ''
                            : ''
                      }
                    >
                      {nameA}
                    </span>
                    <strong>
                      {row.winsA}–{row.winsB}
                    </strong>
                    <span
                      className={
                        row.winsB > row.winsA
                          ? 'winner'
                          : row.played === 0
                            ? ''
                            : ''
                      }
                    >
                      {nameB}
                    </span>
                  </div>
                  <span className="h2h-sub">
                    {row.played === 0
                      ? 'Sem confrontos'
                      : `${row.played} set${row.played === 1 ? '' : 's'} · games ${row.gamesForA}–${row.gamesForB}`}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </section>
  )
}

function LeaderCard({
  label,
  empty,
  player,
  value,
  accent,
}: {
  label: string
  empty: string
  player: CareerStats | null
  value: string | null
  accent: 'orange' | 'gold' | 'gray'
}) {
  return (
    <article className={`leader-card panel accent-${accent}`}>
      <span className="leader-label">{label}</span>
      {player && value ? (
        <>
          <strong className="leader-value">{value}</strong>
          <span className="leader-name">{player.name}</span>
        </>
      ) : (
        <p className="empty">{empty}</p>
      )}
    </article>
  )
}
