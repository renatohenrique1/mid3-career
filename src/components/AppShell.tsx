import { useEffect, useMemo, useState } from 'react'
import { buildFeed } from '../data/feed'
import { computeCareerStats } from '../data/career'
import {
  buildRoundRobinFixtures,
  computeRanking,
  formatLabel,
  isTodayInTournamentPeriod,
  localDateString,
  normalizeFormat,
  rankingHint,
  structureLabel,
  tournamentMatchDateError,
} from '../data/ranking'
import type {
  AppArea,
  AppData,
  Match,
  MatchEditPayload,
  ProfileUpdateInput,
  Tournament,
  User,
} from '../types'
import { CareerRanking } from './CareerRanking'
import { Feed } from './Feed'
import { MatchDetailModal } from './MatchDetailModal'
import { MatchForm } from './MatchForm'
import { MatchHistory } from './MatchHistory'
import {
  PendingEditsModal,
  type PendingApprovalItem,
} from './PendingEditsModal'
import { PlayerAvatar } from './PlayerAvatar'
import { ProfileModal } from './ProfileModal'
import { ProfilePage } from './ProfilePage'
import { Ranking } from './Ranking'
import { Stats } from './Stats'
import { TournamentFixtures } from './TournamentFixtures'
import { TournamentList } from './TournamentList'
import { TournamentSummary } from './TournamentSummary'

interface AppShellProps {
  data: AppData
  currentUser: User
  onLogout: () => void | Promise<void>
  onCreateTournament: (
    name: string,
    format?: import('../types').TournamentFormat,
    options?: {
      structure?: import('../types').TournamentStructure
      startsOn?: string
      endsOn?: string
    },
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
  onRecordMatch: (
    match: Omit<Match, 'id' | 'createdAt'>,
  ) => Promise<{ ok: true; matchId: string } | { ok: false; error: string }>
  onDeleteMatch: (
    matchId: string,
  ) => Promise<{ ok: true } | { ok: false; error: string } | void>
  onUpdateMatch: (
    matchId: string,
    payload: MatchEditPayload,
  ) => Promise<{ ok: true } | { ok: false; error: string }>
  onUpdateProfile: (
    input: ProfileUpdateInput,
  ) => Promise<{ ok: true; user?: User } | { ok: false; error: string }>
  onRequestMatchEdit: (
    matchId: string,
    payload: MatchEditPayload,
  ) => Promise<{ ok: true } | { ok: false; error: string }>
  onWithdrawMatchEdit: (
    requestId: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>
  onResolveMatchEdit: (
    requestId: string,
    decision: 'approved' | 'rejected',
  ) => Promise<{ ok: true } | { ok: false; error: string }>
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
  onUpdateProfile,
  onUpdateMatch,
  onRequestMatchEdit,
  onWithdrawMatchEdit,
  onResolveMatchEdit,
}: AppShellProps) {
  const { users, tournaments, matches, matchEditRequests } = data
  const [area, setArea] = useState<AppArea>('feed')
  const [activeTournamentId, setActiveTournamentId] = useState<string | null>(
    null,
  )
  const [registerOpen, setRegisterOpen] = useState(false)
  const [detailMatchId, setDetailMatchId] = useState<string | null>(null)
  const [pendingModalOpen, setPendingModalOpen] = useState(false)
  const [pendingModalDismissed, setPendingModalDismissed] = useState(false)
  const [historyFilter, setHistoryFilter] = useState<
    'all' | 'casual' | 'tournament'
  >('all')
  const [profileModalUserId, setProfileModalUserId] = useState<string | null>(
    null,
  )

  const casualMatches = useMemo(
    () => matches.filter((m) => !m.tournamentId),
    [matches],
  )

  const historyMatches = useMemo(() => {
    if (historyFilter === 'casual') return casualMatches
    if (historyFilter === 'tournament') {
      return matches.filter((m) => Boolean(m.tournamentId))
    }
    return matches
  }, [historyFilter, casualMatches, matches])

  const pendingApprovals = useMemo((): PendingApprovalItem[] => {
    const items: PendingApprovalItem[] = []
    for (const request of matchEditRequests) {
      if (request.status !== 'pending') continue
      if (request.requestedById === currentUser.id) continue
      const match = matches.find((m) => m.id === request.matchId)
      if (!match) continue
      const isOther =
        match.playerAId === currentUser.id ||
        match.playerBId === currentUser.id
      if (!isOther) continue
      items.push({ request, match })
    }
    return items
  }, [matchEditRequests, matches, currentUser.id])

  useEffect(() => {
    if (pendingApprovals.length === 0) {
      setPendingModalOpen(false)
      setPendingModalDismissed(false)
      return
    }
    if (!pendingModalDismissed) setPendingModalOpen(true)
  }, [pendingApprovals.length, pendingModalDismissed])

  const detailMatch = detailMatchId
    ? matches.find((m) => m.id === detailMatchId) ?? null
    : null

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

  const careerStandings = useMemo(
    () =>
      computeCareerStats(data).map((s) => ({
        playerId: s.playerId,
        name: s.name,
        points: s.points,
        wins: s.setWins,
        played: s.setPlayed,
        gamesFor: s.gamesFor,
        gamesAgainst: s.gamesAgainst,
      })),
    [data],
  )

  const fixtures = useMemo(
    () =>
      activeTournament
        ? buildRoundRobinFixtures(
            participants,
            tournamentMatches,
            activeTournament.structure,
          )
        : null,
    [activeTournament, participants, tournamentMatches],
  )

  const leaderName = tournamentRanking.find((r) => r.played > 0)?.name

  const isParticipant = Boolean(
    activeTournament?.participantIds.includes(currentUser.id),
  )
  const isCreator = activeTournament?.createdById === currentUser.id
  const isFinished = activeTournament?.status === 'finished'
  const winnerName = activeTournament?.winnerId
    ? users.find((u) => u.id === activeTournament.winnerId)?.name
    : null

  const tournamentOpenForSets = Boolean(
    activeTournament &&
      !isFinished &&
      isTodayInTournamentPeriod(activeTournament),
  )
  const periodBlockedReason =
    activeTournament && !isFinished && !tournamentOpenForSets
      ? tournamentMatchDateError(activeTournament, localDateString())
      : null

  const canRegisterInTournament = Boolean(
    activeTournament && tournamentOpenForSets && isParticipant,
  )

  const registerStandings = useMemo(() => {
    if (canRegisterInTournament) {
      return tournamentRanking.map((s) => ({
        playerId: s.playerId,
        name: s.name,
        points: s.points,
        wins: s.wins,
        played: s.played,
        gamesFor: s.gamesFor,
        gamesAgainst: s.gamesAgainst,
      }))
    }
    return careerStandings
  }, [canRegisterInTournament, tournamentRanking, careerStandings])

  const registerTournamentId = canRegisterInTournament
    ? activeTournament!.id
    : null
  const registerTournamentName = canRegisterInTournament
    ? activeTournament!.name
    : undefined
  const registerStartsOn = canRegisterInTournament
    ? activeTournament!.startsOn
    : undefined
  const registerEndsOn = canRegisterInTournament
    ? activeTournament!.endsOn
    : undefined

  function switchArea(next: AppArea) {
    setRegisterOpen(false)
    setArea(next)
    setActiveTournamentId(null)
  }

  function openProfileModal(userId: string) {
    setProfileModalUserId(userId)
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
    <div className="shell">
      <div className="shell-chrome">
        <header className="topbar frame">
          <div className="topbar-brand">
            <img
              className="brand-logo brand-logo-topbar"
              src="/logo-mid3.png"
              alt="MID3"
              width={40}
              height={40}
            />
            <span className="brand-sub">Career</span>
          </div>
          <div className="topbar-user">
            <button
              type="button"
              className="topbar-profile"
              onClick={() => switchArea('profile')}
              title="Meu perfil"
            >
              <PlayerAvatar user={currentUser} size="sm" />
              <span className="user-name">{currentUser.name}</span>
            </button>
            <button type="button" className="link-btn" onClick={onLogout}>
              Sair
            </button>
          </div>
        </header>

        {!activeTournament && !registerOpen ? (
          <nav className="area-tabs area-tabs-6 frame" aria-label="Áreas">
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
              className={area === 'history' ? 'active' : ''}
              onClick={() => switchArea('history')}
            >
              Histórico
              <span>{matches.length}</span>
            </button>
            <button
              type="button"
              className={area === 'profile' ? 'active' : ''}
              onClick={() => switchArea('profile')}
            >
              Perfil
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
            startsOn={registerStartsOn}
            endsOn={registerEndsOn}
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
            standings={registerStandings}
            onSubmit={onRecordMatch}
            onUpdate={onUpdateMatch}
            onDelete={onDeleteMatch}
          />
        ) : null}

        {!registerOpen && pendingApprovals.length > 0 ? (
          <div className="pending-edits-banner">
            <p>
              Você tem {pendingApprovals.length} alteração
              {pendingApprovals.length === 1 ? '' : 'ões'} de set para
              revisar.
            </p>
            <button
              type="button"
              className="btn btn-primary btn-compact"
              onClick={() => {
                setPendingModalDismissed(false)
                setPendingModalOpen(true)
              }}
            >
              Revisar
            </button>
          </div>
        ) : null}

        {!registerOpen && area === 'feed' && !activeTournament ? (
          <Feed
            data={data}
            currentUser={currentUser}
            onOpenTournament={openTournament}
            onOpenMatch={setDetailMatchId}
            onRegisterSet={openRegister}
          />
        ) : null}

        {!registerOpen && area === 'ranking' && !activeTournament ? (
          <CareerRanking
            data={data}
            currentUser={currentUser}
            onOpenProfile={openProfileModal}
          />
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
                {structureLabel(activeTournament.structure)
                  ? ` · ${structureLabel(activeTournament.structure)}`
                  : ''}
              </p>
              <h2>{activeTournament.name}</h2>
              <p>
                {participants.length} jogador
                {participants.length === 1 ? '' : 'es'}
                {activeTournament.startsOn && activeTournament.endsOn
                  ? ` · ${new Date(`${activeTournament.startsOn}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} – ${new Date(`${activeTournament.endsOn}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`
                  : ''}
                {winnerName ? ` · Campeão: ${winnerName}` : ''}
                {' · '}
                {rankingHint(tournamentFormat)}
              </p>

              {!isFinished && isParticipant && tournamentOpenForSets ? (
                <button
                  type="button"
                  className="btn btn-primary register-inline-cta"
                  onClick={openRegister}
                >
                  Registrar set
                </button>
              ) : null}

              {periodBlockedReason && isParticipant ? (
                <p className="register-format-hint muted">{periodBlockedReason}</p>
              ) : null}
            </header>

            {isFinished && winnerName ? (
              <TournamentSummary
                tournamentName={activeTournament.name}
                winnerName={winnerName}
                setsPlayed={tournamentMatches.length}
                playerCount={participants.length}
                ranking={tournamentRanking}
                finishedAt={activeTournament.finishedAt}
              />
            ) : null}

            {fixtures && fixtures.length > 0 ? (
              <TournamentFixtures
                fixtures={fixtures}
                currentUserId={currentUser.id}
              />
            ) : null}

            {isCreator && !isFinished ? (
              <div className="panel tourney-cta">
                <div>
                  <h3>Encerrar torneio</h3>
                  <p>
                    {leaderName
                      ? `Campeão previsto: ${leaderName}. Também encerra sozinho ao completar os confrontos ou no dia seguinte ao fim.`
                      : 'Registre ao menos um set antes de encerrar.'}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={async () => {
                    if (!leaderName) {
                      alert('Registre ao menos um set antes de encerrar.')
                      return
                    }
                    const ok = window.confirm(
                      `Encerrar “${activeTournament.name}”?\n\nCampeão: ${leaderName}\nSets jogados: ${tournamentMatches.length}`,
                    )
                    if (!ok) return
                    const result = await onFinishTournament(activeTournament.id)
                    if (!result.ok) alert(result.error)
                  }}
                >
                  Encerrar
                </button>
              </div>
            ) : null}

            {!isFinished ? (
              <Ranking
                ranking={tournamentRanking}
                currentUserId={currentUser.id}
                emptyText="Ainda sem sets neste torneio."
                pointsHint={rankingHint(tournamentFormat)}
                onRegister={
                  !isFinished && isParticipant && tournamentOpenForSets
                    ? openRegister
                    : undefined
                }
              />
            ) : (
              <Ranking
                ranking={tournamentRanking}
                currentUserId={currentUser.id}
                emptyText="Torneio encerrado sem sets."
                pointsHint="Classificação final"
              />
            )}
            <MatchHistory
              matches={tournamentMatches}
              users={users}
              currentUserId={currentUser.id}
              editRequests={matchEditRequests}
              tournaments={tournaments}
              scoreFormat={tournamentFormat}
              onDelete={onDeleteMatch}
              onUpdateMatch={onUpdateMatch}
              onRequestEdit={onRequestMatchEdit}
              onWithdrawEdit={onWithdrawMatchEdit}
              onResolveEdit={onResolveMatchEdit}
            />
          </>
        ) : null}

        {!registerOpen && area === 'history' && !activeTournament ? (
          <>
            <header className="sets-hero">
              <p className="journey-kicker">Gerenciar</p>
              <h2>Histórico</h2>
              <p>
                Edite ou apague sets. O Feed é a linha do tempo; o Ranking
                concentra a classificação.
              </p>
            </header>

            <div
              className="feed-filters"
              role="tablist"
              aria-label="Filtro do histórico"
            >
              <button
                type="button"
                className={historyFilter === 'all' ? 'active' : ''}
                onClick={() => setHistoryFilter('all')}
              >
                Todos
              </button>
              <button
                type="button"
                className={historyFilter === 'casual' ? 'active' : ''}
                onClick={() => setHistoryFilter('casual')}
              >
                Avulsos
              </button>
              <button
                type="button"
                className={historyFilter === 'tournament' ? 'active' : ''}
                onClick={() => setHistoryFilter('tournament')}
              >
                Torneio
              </button>
            </div>

            <MatchHistory
              matches={historyMatches}
              users={users}
              currentUserId={currentUser.id}
              editRequests={matchEditRequests}
              tournaments={tournaments}
              scoreFormat="classic"
              title="Partidas"
              onDelete={onDeleteMatch}
              onUpdateMatch={onUpdateMatch}
              onRequestEdit={onRequestMatchEdit}
              onWithdrawEdit={onWithdrawMatchEdit}
              onResolveEdit={onResolveMatchEdit}
            />
          </>
        ) : null}

        {!registerOpen && area === 'profile' && !activeTournament ? (
          <ProfilePage
            data={data}
            currentUser={currentUser}
            onUpdateProfile={onUpdateProfile}
          />
        ) : null}
      </main>

      {detailMatch ? (
        <MatchDetailModal
          match={detailMatch}
          users={users}
          tournaments={tournaments}
          onClose={() => setDetailMatchId(null)}
        />
      ) : null}

      {profileModalUserId ? (
        <ProfileModal
          data={data}
          userId={profileModalUserId}
          onClose={() => setProfileModalUserId(null)}
        />
      ) : null}

      {pendingModalOpen && pendingApprovals.length > 0 ? (
        <PendingEditsModal
          items={pendingApprovals}
          users={users}
          onResolve={onResolveMatchEdit}
          onClose={() => {
            setPendingModalOpen(false)
            setPendingModalDismissed(true)
          }}
        />
      ) : null}
    </div>
  )
}
