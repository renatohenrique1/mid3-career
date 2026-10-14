import { useMemo, useState } from 'react'
import {
  describeMatchEditChanges,
  requiresMatchEditApproval,
} from '../data/matchEdits'
import { racketLabel } from '../data/profile'
import {
  BALL_OPTIONS,
  ballLabel,
  classicTiebreakErrorMessage,
  classicTiebreakMatchesSet,
  formatDuration,
  formatMatchScore,
  isValidMatchScore,
  needsClassicTiebreak,
  normalizeFormat,
  resolveTiebreakFields,
  surfaceLabel,
} from '../data/ranking'
import {
  courtLabel,
  courtsForVenueSurface,
  defaultCourtForVenueSurface,
  isValidVenueCourt,
  lockedSurfaceForVenue,
  resolveSurfaceForVenue,
  venueLabel,
  VENUE_OPTIONS,
} from '../data/venues'
import type {
  BallBrand,
  CourtId,
  Match,
  MatchEditPayload,
  MatchEditRequest,
  RacketModel,
  Surface,
  Tournament,
  User,
  VenueId,
} from '../types'
import { MatchDetailModal } from './MatchDetailModal'

interface MatchHistoryProps {
  matches: Match[]
  users: User[]
  currentUserId: string
  editRequests?: MatchEditRequest[]
  tournaments?: Tournament[]
  /** Formato do torneio ou classic para validar placar */
  scoreFormat?: import('../types').TournamentFormat
  title?: string
  onDelete: (matchId: string) => void
  onUpdateMatch?: (
    matchId: string,
    payload: MatchEditPayload,
  ) => Promise<{ ok: true } | { ok: false; error: string }>
  onRequestEdit?: (
    matchId: string,
    payload: MatchEditPayload,
  ) => Promise<{ ok: true } | { ok: false; error: string }>
  onWithdrawEdit?: (
    requestId: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>
  onResolveEdit?: (
    requestId: string,
    decision: 'approved' | 'rejected',
  ) => Promise<{ ok: true } | { ok: false; error: string }>
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
  editRequests = [],
  tournaments = [],
  scoreFormat = 'classic',
  title = 'Histórico',
  onDelete,
  onUpdateMatch,
  onRequestEdit,
  onWithdrawEdit,
  onResolveEdit,
}: MatchHistoryProps) {
  const [detailMatchId, setDetailMatchId] = useState<string | null>(null)

  const pendingByMatch = useMemo(() => {
    const map = new Map<string, MatchEditRequest>()
    for (const req of editRequests) {
      if (req.status === 'pending') map.set(req.matchId, req)
    }
    return map
  }, [editRequests])

  const detailMatch = detailMatchId
    ? matches.find((m) => m.id === detailMatchId) ?? null
    : null

  return (
    <section className="panel history-panel">
      <div className="panel-head">
        <h2>{title}</h2>
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
            const isParticipant =
              match.playerAId === currentUserId ||
              match.playerBId === currentUserId
            const duration = formatDuration(match.durationMinutes)
            const ball = ballLabel(match.ball)
            const pending = pendingByMatch.get(match.id)
            const venue = venueLabel(match.venue)
            const court =
              match.venue === 'ceret' ? courtLabel(match.court) : null
            const racketBits = [
              match.racketA ? `${nameA}: ${racketLabel(match.racketA)}` : null,
              match.racketB ? `${nameB}: ${racketLabel(match.racketB)}` : null,
            ].filter(Boolean)

            return (
              <li
                key={match.id}
                className={`history-item history-item-clickable surface-${match.surface} court-surface court-${match.surface}`}
              >
                <button
                  type="button"
                  className="history-item-main"
                  onClick={() => setDetailMatchId(match.id)}
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
                      {formatMatchScore(
                        match.gamesA,
                        match.gamesB,
                        match.tiebreakA,
                        match.tiebreakB,
                      )}
                    </strong>
                    <span className={!aWon ? 'winner' : ''}>{nameB}</span>
                  </div>
                  {match.venue ||
                  duration ||
                  ball ||
                  racketBits.length ? (
                    <div className="history-extras">
                      {match.venue ? (
                        <span>
                          {venue}
                          {court && court !== '—' ? ` · ${court}` : ''}
                        </span>
                      ) : null}
                      {duration ? <span>{duration}</span> : null}
                      {ball ? <span>{ball}</span> : null}
                      {racketBits.map((t) => (
                        <span key={t!}>{t}</span>
                      ))}
                    </div>
                  ) : null}
                  <span className="history-detail-hint">Ver detalhes</span>
                </button>

                {pending ? (
                  <MatchEditPending
                    request={pending}
                    match={match}
                    users={users}
                    currentUserId={currentUserId}
                    onWithdraw={onWithdrawEdit}
                    onResolve={onResolveEdit}
                  />
                ) : null}

                <div className="history-actions">
                  {isParticipant &&
                  (onUpdateMatch || onRequestEdit) &&
                  !pending ? (
                    <MatchEditForm
                      match={match}
                      users={users}
                      scoreFormat={scoreFormat}
                      onSubmit={async (payload) => {
                        const needsApproval = requiresMatchEditApproval(
                          match,
                          payload,
                        )
                        if (needsApproval) {
                          if (!onRequestEdit) {
                            alert(
                              'Mudança de placar precisa de aprovação do outro jogador.',
                            )
                            return
                          }
                          const result = await onRequestEdit(match.id, payload)
                          if (!result.ok) alert(result.error)
                          return
                        }
                        if (!onUpdateMatch) {
                          alert('Não foi possível salvar a edição.')
                          return
                        }
                        const result = await onUpdateMatch(match.id, payload)
                        if (!result.ok) alert(result.error)
                      }}
                    />
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
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {detailMatch ? (
        <MatchDetailModal
          match={detailMatch}
          users={users}
          tournaments={tournaments}
          onClose={() => setDetailMatchId(null)}
        />
      ) : null}
    </section>
  )
}

function MatchEditPending({
  request,
  match,
  users,
  currentUserId,
  onWithdraw,
  onResolve,
}: {
  request: MatchEditRequest
  match: Match
  users: User[]
  currentUserId: string
  onWithdraw?: MatchHistoryProps['onWithdrawEdit']
  onResolve?: MatchHistoryProps['onResolveEdit']
}) {
  const isRequester = request.requestedById === currentUserId
  const isOther =
    (match.playerAId === currentUserId || match.playerBId === currentUserId) &&
    !isRequester
  const changes = describeMatchEditChanges(match, request.payload, users)

  return (
    <div className="match-edit-pending">
      <p>
        <strong>Pedido de alteração</strong> por{' '}
        {userName(users, request.requestedById)}
      </p>
      <ul className="pending-edit-changes">
        {changes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <div className="history-actions">
        {isRequester && onWithdraw ? (
          <button
            type="button"
            className="link-btn"
            onClick={async () => {
              const result = await onWithdraw(request.id)
              if (!result.ok) alert(result.error)
            }}
          >
            Retirar pedido
          </button>
        ) : null}
        {isOther && onResolve ? (
          <>
            <button
              type="button"
              className="btn btn-primary"
              onClick={async () => {
                const result = await onResolve(request.id, 'approved')
                if (!result.ok) alert(result.error)
              }}
            >
              Aprovar
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={async () => {
                const result = await onResolve(request.id, 'rejected')
                if (!result.ok) alert(result.error)
              }}
            >
              Recusar
            </button>
          </>
        ) : null}
      </div>
    </div>
  )
}

function MatchEditForm({
  match,
  users,
  scoreFormat,
  onSubmit,
}: {
  match: Match
  users: User[]
  scoreFormat: import('../types').TournamentFormat
  onSubmit: (payload: MatchEditPayload) => Promise<void>
}) {
  const initialVenue: VenueId = match.venue ?? 'ceret'
  const initialSurface = resolveSurfaceForVenue(initialVenue, match.surface)
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(match.date)
  const [venue, setVenue] = useState<VenueId>(initialVenue)
  const [surface, setSurface] = useState<Surface>(initialSurface)
  const [court, setCourt] = useState<CourtId | ''>(
    match.court ??
      defaultCourtForVenueSurface(initialVenue, initialSurface) ??
      '',
  )
  const [gamesA, setGamesA] = useState(match.gamesA)
  const [gamesB, setGamesB] = useState(match.gamesB)
  const [tiebreakA, setTiebreakA] = useState(match.tiebreakA ?? 7)
  const [tiebreakB, setTiebreakB] = useState(match.tiebreakB ?? 5)
  const [durationMinutes, setDurationMinutes] = useState(
    match.durationMinutes?.toString() ?? '',
  )
  const [ball, setBall] = useState<BallBrand | ''>(match.ball ?? '')
  const [racketA] = useState<RacketModel | ''>(match.racketA ?? '')
  const [racketB] = useState<RacketModel | ''>(match.racketB ?? '')
  const [error, setError] = useState('')

  const surfaceLocked = lockedSurfaceForVenue(venue) !== null
  const courtOptions = courtsForVenueSurface(venue, surface)
  const showCourt = venue === 'ceret'
  const classicFormat = normalizeFormat(scoreFormat) === 'classic'
  const showClassicTiebreak =
    classicFormat && needsClassicTiebreak(gamesA, gamesB)

  function applyVenue(nextVenue: VenueId) {
    const nextSurface = resolveSurfaceForVenue(nextVenue, surface)
    setVenue(nextVenue)
    setSurface(nextSurface)
    setCourt(defaultCourtForVenueSurface(nextVenue, nextSurface) ?? '')
  }

  function applySurface(nextSurface: Surface) {
    if (surfaceLocked) return
    setSurface(nextSurface)
    setCourt(defaultCourtForVenueSurface(venue, nextSurface) ?? '')
  }

  if (!open) {
    return (
      <button
        type="button"
        className="link-btn"
        onClick={() => setOpen(true)}
      >
        Editar
      </button>
    )
  }

  return (
    <form
      className="match-edit-form"
      onSubmit={async (e) => {
        e.preventDefault()
        setError('')
        if (!isValidMatchScore(normalizeFormat(scoreFormat), gamesA, gamesB)) {
          setError('Placar inválido para este formato.')
          return
        }
        if (
          classicFormat &&
          needsClassicTiebreak(gamesA, gamesB) &&
          !classicTiebreakMatchesSet(gamesA, gamesB, tiebreakA, tiebreakB)
        ) {
          setError(classicTiebreakErrorMessage())
          return
        }
        const tb = resolveTiebreakFields(
          gamesA,
          gamesB,
          classicFormat ? tiebreakA : null,
          classicFormat ? tiebreakB : null,
        )
        const resolvedCourt = showCourt ? court || null : null
        if (!isValidVenueCourt(venue, surface, resolvedCourt)) {
          setError(
            showCourt
              ? 'Escolha a quadra do CERET.'
              : 'Local ou superfície inválidos.',
          )
          return
        }
        let duration: number | null = null
        if (durationMinutes.trim()) {
          const v = Number(durationMinutes)
          if (!Number.isFinite(v) || v <= 0 || v > 600) {
            setError('Duração inválida.')
            return
          }
          duration = Math.round(v)
        }
        await onSubmit({
          date,
          surface,
          venue,
          court: resolvedCourt,
          playerAId: match.playerAId,
          playerBId: match.playerBId,
          gamesA,
          gamesB,
          tiebreakA: tb.tiebreakA,
          tiebreakB: tb.tiebreakB,
          durationMinutes: duration,
          ball: ball || null,
          racketA: racketA || null,
          racketB: racketB || null,
        })
        setOpen(false)
      }}
    >
      <p className="quick-label">Editar set</p>
      <p className="quick-hint">
        Local, quadra, superfície e extras salvam na hora. Mudança de placar
        pede aprovação do outro jogador.
      </p>
      <div className="form-row">
        <label>
          <span>Data</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </label>
        <label>
          <span>Local</span>
          <select
            value={venue}
            onChange={(e) => applyVenue(e.target.value as VenueId)}
            required
          >
            {VENUE_OPTIONS.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="form-row">
        <label>
          <span>Superfície</span>
          <select
            value={surface}
            onChange={(e) => applySurface(e.target.value as Surface)}
            disabled={surfaceLocked}
          >
            <option value="hard">{surfaceLabel('hard')}</option>
            <option value="clay">{surfaceLabel('clay')}</option>
          </select>
        </label>
        {showCourt ? (
          <label>
            <span>Quadra</span>
            <select
              value={court}
              onChange={(e) => setCourt((e.target.value as CourtId) || '')}
              required
            >
              {courtOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <div className="form-row">
        <label>
          <span>{userName(users, match.playerAId)}</span>
          <input
            type="number"
            value={gamesA}
            onChange={(e) => setGamesA(Number(e.target.value))}
            min={0}
          />
        </label>
        <label>
          <span>{userName(users, match.playerBId)}</span>
          <input
            type="number"
            value={gamesB}
            onChange={(e) => setGamesB(Number(e.target.value))}
            min={0}
          />
        </label>
      </div>
      {showClassicTiebreak ? (
        <div className="form-row">
          <label>
            <span>TB · {userName(users, match.playerAId)}</span>
            <input
              type="number"
              value={tiebreakA}
              onChange={(e) => setTiebreakA(Number(e.target.value))}
              min={0}
            />
          </label>
          <label>
            <span>TB · {userName(users, match.playerBId)}</span>
            <input
              type="number"
              value={tiebreakB}
              onChange={(e) => setTiebreakB(Number(e.target.value))}
              min={0}
            />
          </label>
        </div>
      ) : null}
      <div className="form-row">
        <label>
          <span>Duração</span>
          <input
            type="number"
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
          />
        </label>
        <label>
          <span>Bola</span>
          <select
            value={ball}
            onChange={(e) => setBall((e.target.value as BallBrand) || '')}
          >
            <option value="">—</option>
            {BALL_OPTIONS.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="create-actions">
        <button type="submit" className="btn btn-primary">
          Salvar
        </button>
        <button
          type="button"
          className="link-btn"
          onClick={() => setOpen(false)}
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
