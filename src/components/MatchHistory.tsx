import { useMemo, useState } from 'react'
import { racketLabel } from '../data/profile'
import {
  BALL_OPTIONS,
  ballLabel,
  formatDuration,
  isValidMatchScore,
  normalizeFormat,
  surfaceLabel,
} from '../data/ranking'
import type {
  BallBrand,
  Match,
  MatchEditPayload,
  MatchEditRequest,
  RacketModel,
  Surface,
  User,
} from '../types'

interface MatchHistoryProps {
  matches: Match[]
  users: User[]
  currentUserId: string
  editRequests?: MatchEditRequest[]
  /** Formato do torneio ou classic para validar placar */
  scoreFormat?: import('../types').TournamentFormat
  onDelete: (matchId: string) => void
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
  scoreFormat = 'classic',
  onDelete,
  onRequestEdit,
  onWithdrawEdit,
  onResolveEdit,
}: MatchHistoryProps) {
  const pendingByMatch = useMemo(() => {
    const map = new Map<string, MatchEditRequest>()
    for (const req of editRequests) {
      if (req.status === 'pending') map.set(req.matchId, req)
    }
    return map
  }, [editRequests])

  return (
    <section className="panel history-panel">
      <div className="panel-head">
        <h2>Histórico</h2>
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
            const racketBits = [
              match.racketA ? `${nameA}: ${racketLabel(match.racketA)}` : null,
              match.racketB ? `${nameB}: ${racketLabel(match.racketB)}` : null,
            ].filter(Boolean)

            return (
              <li
                key={match.id}
                className={`history-item surface-${match.surface}`}
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
                    {match.gamesA}–{match.gamesB}
                  </strong>
                  <span className={!aWon ? 'winner' : ''}>{nameB}</span>
                </div>
                {duration || ball || racketBits.length ? (
                  <div className="history-extras">
                    {duration ? <span>{duration}</span> : null}
                    {ball ? <span>{ball}</span> : null}
                    {racketBits.map((t) => (
                      <span key={t!}>{t}</span>
                    ))}
                  </div>
                ) : null}

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
                  {isParticipant && onRequestEdit && !pending ? (
                    <MatchEditForm
                      match={match}
                      users={users}
                      scoreFormat={scoreFormat}
                      onSubmit={async (payload) => {
                        const result = await onRequestEdit(match.id, payload)
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
  const p = request.payload

  return (
    <div className="match-edit-pending">
      <p>
        <strong>Pedido de alteração</strong> por{' '}
        {userName(users, request.requestedById)}
      </p>
      <p className="muted-inline">
        Novo placar: {p.gamesA}–{p.gamesB} · {formatDate(p.date)} ·{' '}
        {surfaceLabel(p.surface)}
      </p>
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
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(match.date)
  const [surface, setSurface] = useState<Surface>(match.surface)
  const [gamesA, setGamesA] = useState(match.gamesA)
  const [gamesB, setGamesB] = useState(match.gamesB)
  const [durationMinutes, setDurationMinutes] = useState(
    match.durationMinutes?.toString() ?? '',
  )
  const [ball, setBall] = useState<BallBrand | ''>(match.ball ?? '')
  const [racketA] = useState<RacketModel | ''>(match.racketA ?? '')
  const [racketB] = useState<RacketModel | ''>(match.racketB ?? '')
  const [error, setError] = useState('')

  if (!open) {
    return (
      <button
        type="button"
        className="link-btn"
        onClick={() => setOpen(true)}
      >
        Pedir alteração
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
          playerAId: match.playerAId,
          playerBId: match.playerBId,
          gamesA,
          gamesB,
          durationMinutes: duration,
          ball: ball || null,
          racketA: racketA || null,
          racketB: racketB || null,
        })
        setOpen(false)
      }}
    >
      <p className="quick-label">Solicitar alteração</p>
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
          <span>Quadra</span>
          <select
            value={surface}
            onChange={(e) => setSurface(e.target.value as Surface)}
          >
            <option value="hard">{surfaceLabel('hard')}</option>
            <option value="clay">{surfaceLabel('clay')}</option>
          </select>
        </label>
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
          Enviar pedido
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
