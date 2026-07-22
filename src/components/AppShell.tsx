import { useMemo, useState } from 'react'
import { buildFeed } from '../data/feed'
import {
  computeRanking,
  formatLabel,
  normalizeFormat,
  rankingHint,
} from '../data/ranking'
import type { AppArea, AppData, Match, Tournament, User } from '../types'
import { CareerRanking } from './CareerRanking'
import { Feed } from './Feed'
import { MatchForm } from './MatchForm'
import { MatchHistory } from './MatchHistory'
import { Ranking } from './Ranking'
import { Stats } from './Stats'
import { TournamentList } from './TournamentList'

interface AppShellProps {
  data: AppData
  currentUser: User
  onLogout: () => void | Promise<void>
  onCreateTournament: (
    name: string,
    format?: import('../types').TournamentFormat,
  ) =>
    | { ok: true; tournament: Tournament }
    | { ok: false; error: string }
    | Promise<
        | { ok: true; tournament: Tournament }
        | { ok: false; error: string }
      >
  onJoinTournament: (
    tournamentId: string,
  ) =>
    | { ok: true }
    | { ok: false; error: string }
    | Promise<{ ok: true } | { ok: false; error: string }>
  onFinishTournament: (
    tournamentId: string,
  ) =>
    | { ok: true; tournament: Tournament }
    | { ok: false; error: string }
    | Promise<
        | { ok: true; tournament: Tournament }
        | { ok: false; error: string }
      >
  onRecordMatch: (match: Omit<Match, 'id' | 'createdAt'>) => void | Promise<void>
  onDeleteMatch: (matchId: string) => void | Promise<void>
}

export function AppShell({
  data,
  currentUser,
  onLogout,
  onCreateTournament,
  onJoinTournament,
  onFinishTournament,
  onRecordMatch,
  onDeleteMatch,
}: AppShellProps) {
  const { users, tournaments, matches } = data
  const [area, setArea] = useState<AppArea>('feed')
  const [activeTournamentId, setActiveTournamentId] = useState<string | null>(
    null,
  )
  const [registerOpen, setRegisterOpen] = useState(false)

  const casualMatches = useMemo(
    () => matches.filter((m) => !m.tournamentId),
    [matches],
  )

  const feedCount = useMemo(() => buildFeed(data).length, [data])

  const activeTournament =
    tournaments.find((t) => t.id === activeTournamentId) ?? null

  const tournamentMatches = useMemo(
    () =>
      activeTournament
        ? matches.filter((m) => m.tournamentId === activeTournament.id)
        : [],
    [matches, activeTournament],
  )

  const participants = useMemo(() => {
    if (!activeTournament) return []
    return users.filter((u) =>
      activeTournament.participantIds.includes(u.id),
    )
  }, [users, activeTournament])

  const tournamentFormat = normalizeFormat(activeTournament?.format)

  const tournamentRanking = useMemo(
    () =>
      computeRanking(participants, tournamentMatches, tournamentFormat),
    [participants, tournamentMatches, tournamentFormat],
  )

  const casualPlayers = useMemo(() => {
    const ids = new Set<string>()
    for (const match of casualMatches) {
      ids.add(match.playerAId)
      ids.add(match.playerBId)
    }
    ids.add(currentUser.id)
    return users.filter((u) => ids.has(u.id))
  }, [casualMatches, users, currentUser.id])

  const casualRanking = useMemo(
    () => computeRanking(casualPlayers, casualMatches, 'classic'),
    [casualPlayers, casualMatches],
  )

  const isParticipant = Boolean(
    activeTournament?.participantIds.includes(currentUser.id),
  )
  const isCreator = activeTournament?.createdById === currentUser.id
  const isFinished = activeTournament?.status === 'finished'
  const winnerName = activeTournament?.winnerId
    ? users.find((u) => u.id === activeTournament.winnerId)?.name
    : null

  const canRegisterInTournament = Boolean(
    activeTournament && !isFinished && isParticipant,
  )

  const registerTournamentId = canRegisterInTournament
    ? activeTournament!.id
    : null
  const registerTournamentName = canRegisterInTournament
    ? activeTournament!.name
    : undefined

  function switchArea(next: AppArea) {
    setRegisterOpen(false)
    setArea(next)
    setActiveTournamentId(null)
  }

  function openTournament(id: string) {
    setRegisterOpen(false)
    setArea('tournaments')
    setActiveTournamentId(id)
  }

  function openRegister() {
    setRegisterOpen(true)
  }

  function closeRegister() {
    setRegisterOpen(false)
  }

  return (
    <div className={`shell${registerOpen ? '' : ' shell-with-fab'}`}>
      <div className="shell-chrome">
        <header className="topbar frame">
          <div className="topbar-brand">
            <span className="brand-mark">MID3</span>
            <span className="brand-sub">Career</span>
          </div>
          <div className="topbar-user">
            <span className="user-name">{currentUser.name}</span>
            <button type="button" className="link-btn" onClick={onLogout}>
              Sair
            </button>
          </div>
        </header>

        {!activeTournament && !registerOpen ? (
          <nav className="area-tabs area-tabs-5 frame" aria-label="Áreas">
            <button
              type="button"
              className={area === 'feed' ? 'active' : ''}
              onClick={() => switchArea('feed')}
            >
              Feed
              <span>{feedCount}</span>
            </button>
            <button
              type="button"
              className={area === 'ranking' ? 'active' : ''}
              onClick={() => switchArea('ranking')}
            >
              Ranking
              <span>{users.length}</span>
            </button>
            <button
              type="button"
              className={area === 'stats' ? 'active' : ''}
              onClick={() => switchArea('stats')}
            >
              Stats
              <span>{matches.length}</span>
            </button>
            <button
              type="button"
              className={area === 'tournaments' ? 'active' : ''}
              onClick={() => switchArea('tournaments')}
            >
              Torneios
              <span>{tournaments.length}</span>
            </button>
            <button
              type="button"
              className={area === 'sets' ? 'active' : ''}
              onClick={() => switchArea('sets')}
            >
              Sets
              <span>{casualMatches.length}</span>
            </button>
          </nav>
        ) : null}
      </div>

      <main className="layout">
        {registerOpen ? (
          <MatchForm
            onClose={closeRegister}
            tournamentId={registerTournamentId}
            tournamentName={registerTournamentName}
            format={
              canRegisterInTournament ? tournamentFormat : 'classic'
            }
            users={
              canRegisterInTournament
                ? participants.length >= 2
                  ? participants
                  : users
                : users
            }
            currentUser={currentUser}
            onSubmit={onRecordMatch}
          />
        ) : null}

        {!registerOpen && area === 'feed' && !activeTournament ? (
          <Feed
            data={data}
            currentUser={currentUser}
            onOpenTournament={openTournament}
            onRegisterSet={openRegister}
          />
        ) : null}

        {!registerOpen && area === 'ranking' && !activeTournament ? (
          <CareerRanking data={data} currentUser={currentUser} />
        ) : null}

        {!registerOpen && area === 'stats' && !activeTournament ? (
          <Stats data={data} />
        ) : null}

        {!registerOpen && area === 'tournaments' && !activeTournament ? (
          <TournamentList
            tournaments={tournaments}
            matches={matches}
            users={users}
            currentUser={currentUser}
            onCreate={onCreateTournament}
            onJoin={onJoinTournament}
            onOpen={openTournament}
          />
        ) : null}

        {!registerOpen && activeTournament ? (
          <>
            <header className="detail-hero">
              <button
                type="button"
                className="link-btn back-link"
                onClick={() => setActiveTournamentId(null)}
              >
                ← Torneios
              </button>
              <p className="tourney-kicker">
                {isFinished ? 'Encerrado' : 'Em andamento'} ·{' '}
                {formatLabel(tournamentFormat)}
              </p>
              <h2>{activeTournament.name}</h2>
              <p>
                {participants.length} jogador
                {participants.length === 1 ? '' : 'es'}
                {winnerName ? ` · Campeão: ${winnerName}` : ''}
                {' · '}
                {rankingHint(tournamentFormat)}
              </p>

              {!isFinished && isParticipant ? (
                <button
                  type="button"
                  className="btn btn-primary register-inline-cta"
                  onClick={openRegister}
                >
                  Registrar set
                </button>
              ) : null}
            </header>

            {isCreator && !isFinished ? (
              <div className="panel tourney-cta">
                <div>
                  <h3>Encerrar torneio</h3>
                  <p>O 1º do ranking vira campeão</p>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={async () => {
                    const result = await onFinishTournament(activeTournament.id)
                    if (!result.ok) alert(result.error)
                  }}
                >
                  Encerrar
                </button>
              </div>
            ) : null}

            <Ranking
              ranking={tournamentRanking}
              currentUserId={currentUser.id}
              emptyText="Ainda sem sets neste torneio."
              pointsHint={rankingHint(tournamentFormat)}
              onRegister={
                !isFinished && isParticipant ? openRegister : undefined
              }
            />
            <MatchHistory
              matches={tournamentMatches}
              users={users}
              currentUserId={currentUser.id}
              onDelete={onDeleteMatch}
            />
          </>
        ) : null}

        {!registerOpen && area === 'sets' && !activeTournament ? (
          <>
            <header className="sets-hero">
              <p className="tourney-kicker">Fora de torneio</p>
              <h2>Sets avulsos</h2>
              <p>
                Registre partidas soltas sem criar torneio. O ranking aqui conta
                só esses sets.
              </p>
              <button
                type="button"
                className="btn btn-primary register-inline-cta"
                onClick={openRegister}
              >
                Registrar set
              </button>
            </header>

            <Ranking
              ranking={casualRanking}
              currentUserId={currentUser.id}
              emptyText="Ainda sem sets avulsos."
              pointsHint={rankingHint('classic')}
              onRegister={openRegister}
            />
            <MatchHistory
              matches={casualMatches}
              users={users}
              currentUserId={currentUser.id}
              onDelete={onDeleteMatch}
            />
          </>
        ) : null}
      </main>

      {!registerOpen ? (
        <button
          type="button"
          className="register-fab"
          onClick={openRegister}
          aria-label={
            canRegisterInTournament
              ? `Registrar set no torneio ${activeTournament?.name ?? ''}`
              : 'Registrar set avulso'
          }
        >
          <span className="register-fab-plus" aria-hidden>
            +
          </span>
          <span className="register-fab-label">
            {canRegisterInTournament ? 'Registrar no torneio' : 'Registrar set'}
          </span>
        </button>
      ) : null}
    </div>
  )
}
