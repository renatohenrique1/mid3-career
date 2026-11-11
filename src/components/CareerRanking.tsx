import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { buildRankingTimeline } from '../data/analytics'
import {
  computeCareerStats,
  computeH2H,
  formatDiff,
  h2HForPlayer,
} from '../data/career'
import {
  seasonMedalForIndex,
  seasonMedalLabel,
  type SeasonMedal,
} from '../data/ranking'
import type { AppData, User } from '../types'
import { MedalInsignia, SeasonMedalArt } from './MedalInsignia'
import { AvatarPhoto } from './PlayerAvatar'
import { RankingLineChart } from './Stats'

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

function face(users: User[], playerId: string, name: string) {
  const url = users.find((user) => user.id === playerId)?.avatarUrl
  if (!url) return initials(name)
  return (
    <span className="career-avatar-clip">
      <AvatarPhoto url={url} />
    </span>
  )
}

function userName(users: User[], id: string) {
  return users.find((u) => u.id === id)?.name ?? '?'
}

const PODIUM = [
  { label: 'Ouro', className: 'medal-gold' },
  { label: 'Prata', className: 'medal-silver' },
  { label: 'Bronze', className: 'medal-bronze' },
] as const

function podiumMedal(index: number) {
  return PODIUM[index] ?? null
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? name
}

type CeremonyStep = {
  id: string
  name: string
  medal: SeasonMedal
  role: string
}

function ceremonySteps(
  players: Array<{ playerId: string; name: string }>,
  viewerId: string,
): CeremonyStep[] {
  const steps: CeremonyStep[] = []
  const champion = players[0]
  if (champion) {
    steps.push({
      id: 'champion',
      name: champion.name,
      medal: 'gold',
      role: 'Campeão',
    })
  }
  const awardIndex = players.findIndex((player) => player.playerId === viewerId)
  const medal = seasonMedalForIndex(awardIndex)
  const viewer = awardIndex >= 0 ? players[awardIndex] : undefined
  if (viewer && medal) {
    steps.push({
      id: `${viewer.playerId}-${medal}`,
      name: viewer.name,
      medal,
      role: seasonMedalLabel(medal),
    })
  }
  return steps
}

function Ceremony({
  players,
  viewerId,
  onDone,
}: {
  players: Array<{ playerId: string; name: string }>
  viewerId: string
  onDone: () => void
}) {
  const rosterKey = `${viewerId}:${players.map((player) => player.playerId).join('|')}`
  // A identidade nova de `players` a cada render zeraria o timer. `rosterKey` é o que muda de verdade.
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  const steps = useMemo(() => ceremonySteps(players, viewerId), [rosterKey])
  const [index, setIndex] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const step = steps[index]
  const last = index >= steps.length - 1

  useEffect(() => {
    const current = steps[index]
    if (!current) return
    const isLast = index >= steps.length - 1
    const hold = current.role === 'Campeão' ? 2600 : 2200
    const advanceTimer = window.setTimeout(() => {
      if (isLast) setLeaving(true)
      else setIndex((value) => value + 1)
    }, hold)
    const doneTimer = isLast
      ? window.setTimeout(onDone, hold + 480)
      : undefined
    return () => {
      window.clearTimeout(advanceTimer)
      if (doneTimer) window.clearTimeout(doneTimer)
    }
  }, [index, onDone, steps])

  if (!step) return null

  return createPortal(
    <button
      type="button"
      className={`champ-intro tone-${step.medal}${leaving ? ' is-leaving' : ''}`}
      onClick={() => {
        if (last) onDone()
        else setIndex((current) => current + 1)
      }}
    >
      <div key={step.id} className="champ-card">
        <SeasonMedalArt
          medal={step.medal}
          className={`champ-medal tone-${step.medal}`}
        />
        <p className="champ-kicker">Temporada 2026</p>
        <p className="champ-name">{firstName(step.name)}</p>
        <p className="champ-role">{step.role}</p>
        <p className="champ-skip">Toque para continuar</p>
      </div>
    </button>,
    document.body,
  )
}

export function CareerRanking({
  data,
  currentUser,
  onOpenProfile,
}: CareerRankingProps) {
  const stats = useMemo(() => computeCareerStats(data), [data])
  const timeline = useMemo(() => buildRankingTimeline(data), [data])
  const h2h = useMemo(
    () => computeH2H(data.users, data.matches),
    [data.users, data.matches],
  )
  const [selectedId, setSelectedId] = useState<string | null>(currentUser.id)
  const [showChampion, setShowChampion] = useState(true)
  const dismissChampion = useCallback(() => setShowChampion(false), [])

  const selected =
    stats.find((s) => s.playerId === selectedId) ?? stats[0] ?? null

  const selectedH2H = useMemo(() => {
    if (!selected) return []
    return h2HForPlayer(h2h, selected.playerId, data.matches)
  }, [h2h, selected, data.matches])

  return (
    <section className="career-home">
      {showChampion && stats.length > 0 ? (
        <Ceremony
          players={stats.slice(0, 3).map((player) => ({
            playerId: player.playerId,
            name: player.name,
          }))}
          viewerId={currentUser.id}
          onDone={dismissChampion}
        />
      ) : null}
      <header className="sets-hero sets-hero-compact">
        <p className="tourney-kicker">Temporada 2026</p>
        <h2>Ranking encerrado</h2>
        <p>
          {stats.length >= 3
            ? `${firstName(stats[0].name)} no ouro, ${firstName(stats[1].name)} na prata e ${firstName(stats[2].name)} no bronze.`
            : 'Classificação fechada.'}
        </p>
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
                  <span
                    className={`career-mobile-rank${
                      podiumMedal(index)
                        ? ` ${podiumMedal(index)!.className}`
                        : ''
                    }`}
                  >
                    {index + 1}
                  </span>
                  <button
                    type="button"
                    className="career-avatar sm career-avatar-link"
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpenProfile?.(player.playerId)
                    }}
                    aria-label={`Ver perfil de ${player.name}`}
                  >
                    {face(data.users, player.playerId, player.name)}
                    {seasonMedalForIndex(index) ? (
                      <MedalInsignia medal={seasonMedalForIndex(index)!} />
                    ) : null}
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
                      {podiumMedal(index) ? (
                        <em className={`medal ${podiumMedal(index)!.className}`}>
                          {podiumMedal(index)!.label}
                        </em>
                      ) : null}
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
                    <td
                      className={`num rank-cell${
                        podiumMedal(index)
                          ? ` ${podiumMedal(index)!.className}`
                          : ''
                      }`}
                    >
                      {index + 1}
                    </td>
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
                          {face(data.users, player.playerId, player.name)}
                          {seasonMedalForIndex(index) ? (
                            <MedalInsignia medal={seasonMedalForIndex(index)!} />
                          ) : null}
                        </span>
                        <span>
                          <strong>
                            {player.name}
                            {player.playerId === currentUser.id ? (
                              <span className="you-tag"> você</span>
                            ) : null}
                          </strong>
                          {podiumMedal(index) ? (
                            <em className={`medal ${podiumMedal(index)!.className}`}>
                              {podiumMedal(index)!.label}
                            </em>
                          ) : null}
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

      <article className="panel stats-chart-card">
        <div className="panel-head">
          <h2>Ranking</h2>
          <p>pontos acumulados por data</p>
        </div>
        <RankingLineChart timeline={timeline} />
      </article>

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
                    <div
                      className="h2h-score-block"
                      aria-label="Placar moda"
                    >
                      <span className="h2h-score-label">Placar moda</span>
                      <div className="h2h-score">
                        {row.modeFor == null || row.modeAgainst == null ? (
                          <span>—</span>
                        ) : (
                          <>
                            <span>{row.modeFor}</span>
                            <span className="h2h-sep">–</span>
                            <span>{row.modeAgainst}</span>
                          </>
                        )}
                      </div>
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
