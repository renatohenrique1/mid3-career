import { useMemo, useState } from 'react'
import {
  computeCareerStats,
  computeH2H,
  formatDiff,
  h2HForPlayer,
} from '../data/career'
import type { AppData, User } from '../types'

interface CareerRankingProps {
  data: AppData
  currentUser: User
  onOpenProfile?: (userId: string) => void
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

export function CareerRanking({
  data,
  currentUser,
  onOpenProfile,
}: CareerRankingProps) {
  const stats = useMemo(() => computeCareerStats(data), [data])
  const h2h = useMemo(
    () => computeH2H(data.users, data.matches),
    [data.users, data.matches],
  )
  const [selectedId, setSelectedId] = useState<string | null>(currentUser.id)

  const selected =
    stats.find((s) => s.playerId === selectedId) ?? stats[0] ?? null

  const selectedH2H = useMemo(() => {
    if (!selected) return []
    return h2HForPlayer(h2h, selected.playerId)
  }, [h2h, selected])

  return (
    <section className="career-home">
      <header className="sets-hero sets-hero-compact">
        <h2>Ranking</h2>
        <p>Classificação por pontos (3 + diferença de games por set vencido).</p>
      </header>

      {stats.length === 0 ? (
        <div className="panel">
          <p className="empty">Nenhum usuário cadastrado.</p>
        </div>
      ) : (
        <div className="panel table-panel">
          <ul className="career-mobile-list">
            {stats.map((player, index) => (
              <li key={player.playerId}>
                <div
                  className={`career-mobile-row${
                    selected?.playerId === player.playerId ? ' is-selected' : ''
                  }${player.playerId === currentUser.id ? ' is-you' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedId(player.playerId)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setSelectedId(player.playerId)
                    }
                  }}
                >
                  <span className="career-mobile-rank">{index + 1}</span>
                  <button
                    type="button"
                    className="career-avatar sm career-avatar-link"
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpenProfile?.(player.playerId)
                    }}
                    aria-label={`Ver perfil de ${player.name}`}
                  >
                    {initials(player.name)}
                  </button>
                  <span className="career-mobile-main">
                    <button
                      type="button"
                      className="career-name-link"
                      onClick={(e) => {
                        e.stopPropagation()
                        onOpenProfile?.(player.playerId)
                      }}
                    >
                      {player.name}
                      {player.playerId === currentUser.id ? (
                        <span className="you-tag"> você</span>
                      ) : null}
                    </button>
                    <span>
                      {player.setWins}V · {player.setLosses}D ·{' '}
                      {player.titles} tít. · {formatDiff(player.gameDiff)}
                    </span>
                  </span>
                  <span className="career-mobile-pts">
                    <strong>{player.points}</strong>
                    <span>pts</span>
                  </span>
                </div>
              </li>
            ))}
          </ul>

          <div className="table-scroll career-table-desktop">
            <table className="career-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Jogador</th>
                  <th>Pts</th>
                  <th>V</th>
                  <th>D</th>
                  <th>Sets</th>
                  <th>Tít.</th>
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
                      <button
                        type="button"
                        className="career-player-open"
                        onClick={(e) => {
                          e.stopPropagation()
                          onOpenProfile?.(player.playerId)
                        }}
                      >
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
                      </button>
                    </td>
                    <td className="num pts-cell">{player.points}</td>
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
          <p className="table-hint">Toque num jogador para ver o H2H.</p>
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
                  <li
                    key={`${row.playerAId}-${row.playerBId}`}
                    className="h2h-row"
                  >
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
                    <span className={row.winsA > row.winsB ? 'winner' : ''}>
                      {nameA}
                    </span>
                    <strong>
                      {row.winsA}–{row.winsB}
                    </strong>
                    <span className={row.winsB > row.winsA ? 'winner' : ''}>
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
