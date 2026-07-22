import { useEffect, useMemo, useState } from 'react'
import { buildFeed } from '../data/feed'
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
  onRecordMatch: (match: Omit<Match, 'id' | 'createdAt'>) => void | Promise<void>
  onDeleteMatch: (matchId: string) => void | Promise<void>
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

  const casualMatches = useMemo(
    () => matches.filter((m) => !m.tournamentId),
    [matches],
  )

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
              className={area === 'sets' ? 'active' : ''}
              onClick={() => switchArea('sets')}
            >
              Sets
              <span>{casualMatches.length}</span>
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
            onSubmit={onRecordMatch}
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
              onRequestEdit={onRequestMatchEdit}
              onWithdrawEdit={onWithdrawMatchEdit}
              onResolveEdit={onResolveMatchEdit}
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
              editRequests={matchEditRequests}
              tournaments={tournaments}
              scoreFormat="classic"
              onDelete={onDeleteMatch}
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
