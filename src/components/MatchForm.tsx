import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BALL_OPTIONS,
  classicTiebreakErrorMessage,
  classicTiebreakMatchesSet,
  defaultScoreForFormat,
  formatBlurb,
  formatLabel,
  formatMatchScore,
  isValidMatchScore,
  localDateString,
  needsClassicTiebreak,
  normalizeFormat,
  pointsForWin,
  quickScoresForFormat,
  rankingHint,
  resolveTiebreakFields,
  scoreErrorMessage,
  scoreMaxForFormat,
  scoreUnitLabel,
  surfaceLabel,
  tournamentMatchDateError,
} from '../data/ranking'
import { RACKET_MODELS } from '../data/profile'
import {
  courtsForVenueSurface,
  defaultCourtForVenueSurface,
  isValidVenueCourt,
  lockedSurfaceForVenue,
  resolveSurfaceForVenue,
  VENUE_OPTIONS,
} from '../data/venues'
import type {
  BallBrand,
  CourtId,
  Match,
  MatchEditPayload,
  RacketModel,
  Surface,
  TournamentFormat,
  User,
  VenueId,
} from '../types'

type MatchDraft = Omit<Match, 'id' | 'createdAt'>

type SessionSavedSet = {
  matchId: string
  draft: MatchDraft
  winnerName: string
  loserName: string
  score: string
  points: number
}

interface MatchFormProps {
  tournamentId?: string | null
  tournamentName?: string
  startsOn?: string
  endsOn?: string
  format?: TournamentFormat
  users: User[]
  currentUser: User
  onSubmit: (
    match: MatchDraft,
  ) => Promise<{ ok: true; matchId: string } | { ok: false; error: string }>
  onUpdate: (
    matchId: string,
    payload: MatchEditPayload,
  ) => Promise<{ ok: true } | { ok: false; error: string }>
  onDelete: (
    matchId: string,
  ) => Promise<{ ok: true } | { ok: false; error: string } | void>
  onClose: () => void
}

function userById(users: User[], id: string) {
  return users.find((u) => u.id === id)
}

function summaryFromDraft(
  draft: MatchDraft,
  users: User[],
  format: TournamentFormat,
) {
  const aWon = draft.gamesA > draft.gamesB
  const winnerName = aWon
    ? (userById(users, draft.playerAId)?.name ?? 'Jogador A')
    : (userById(users, draft.playerBId)?.name ?? 'Jogador B')
  const loserName = aWon
    ? (userById(users, draft.playerBId)?.name ?? 'Jogador B')
    : (userById(users, draft.playerAId)?.name ?? 'Jogador A')
  const score = aWon
    ? formatMatchScore(
        draft.gamesA,
        draft.gamesB,
        draft.tiebreakA,
        draft.tiebreakB,
      )
    : formatMatchScore(
        draft.gamesB,
        draft.gamesA,
        draft.tiebreakB,
        draft.tiebreakA,
      )
  const points = pointsForWin(format, draft.gamesA, draft.gamesB)
  return { winnerName, loserName, score, points }
}

export function MatchForm({
  tournamentId = null,
  tournamentName,
  startsOn,
  endsOn,
  format = 'classic',
  users,
  currentUser,
  onSubmit,
  onUpdate,
  onDelete,
  onClose,
}: MatchFormProps) {
  const matchFormat = normalizeFormat(format)
  const isTournament = Boolean(tournamentId)
  const today = localDateString()
  const dateMin = startsOn || undefined
  const dateMax = endsOn || undefined
  const defaultDate =
    dateMin && today < dateMin
      ? dateMin
      : dateMax && today > dateMax
        ? dateMax
        : today
  const quickScores = quickScoresForFormat(matchFormat)
  const scoreMax = scoreMaxForFormat(matchFormat)
  const [defaultA, defaultB] = defaultScoreForFormat(matchFormat)
  const others = useMemo(
    () => users.filter((u) => u.id !== currentUser.id),
    [users, currentUser.id],
  )
  const initialized = useRef(false)

  const [date, setDate] = useState(defaultDate)
  const [venue, setVenue] = useState<VenueId>('ceret')
  const [surface, setSurface] = useState<Surface>('hard')
  const [court, setCourt] = useState<CourtId | ''>('coliseu')
  const [playerAId, setPlayerAId] = useState(currentUser.id)
  const [playerBId, setPlayerBId] = useState(others[0]?.id ?? '')
  const [gamesA, setGamesA] = useState(defaultA)
  const [gamesB, setGamesB] = useState(defaultB)
  const [tiebreakA, setTiebreakA] = useState(7)
  const [tiebreakB, setTiebreakB] = useState(5)
  const [durationMinutes, setDurationMinutes] = useState('')
  const [ball, setBall] = useState<BallBrand | ''>('')
  const [racketA, setRacketA] = useState<RacketModel | ''>(
    () => userById(users, currentUser.id)?.primaryRacket ?? '',
  )
  const [racketB, setRacketB] = useState<RacketModel | ''>(
    () => others[0]?.primaryRacket ?? '',
  )
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedSets, setSavedSets] = useState<SessionSavedSet[]>([])
  const [showDone, setShowDone] = useState(false)
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null)

  useEffect(() => {
    const a = userById(users, playerAId)
    const b = userById(users, playerBId)
    setRacketA(a?.primaryRacket ?? '')
    setRacketB(b?.primaryRacket ?? '')
  }, [playerAId, playerBId, users])

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !showDone) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, showDone])

  const playerA = userById(users, playerAId)
  const playerB = userById(users, playerBId)
  const scoreValid = isValidMatchScore(matchFormat, gamesA, gamesB)
  const showClassicTiebreak =
    matchFormat === 'classic' && needsClassicTiebreak(gamesA, gamesB)
  const tiebreakValid =
    !showClassicTiebreak ||
    classicTiebreakMatchesSet(gamesA, gamesB, tiebreakA, tiebreakB)
  const winnerId =
    scoreValid && tiebreakValid && gamesA !== gamesB
      ? gamesA > gamesB
        ? playerAId
        : playerBId
      : null

  const opponentsForA = users.filter((u) => u.id !== playerAId)
  const opponentsForB = users.filter((u) => u.id !== playerBId)

  const surfaceLocked = lockedSurfaceForVenue(venue) !== null
  const courtOptions = courtsForVenueSurface(venue, surface)
  const showCourt = venue === 'ceret'

  function applyVenue(nextVenue: VenueId) {
    const nextSurface = resolveSurfaceForVenue(nextVenue, surface)
    setVenue(nextVenue)
    setSurface(nextSurface)
    setCourt(defaultCourtForVenueSurface(nextVenue, nextSurface) ?? '')
    setError('')
  }

  function applySurface(nextSurface: Surface) {
    if (surfaceLocked) return
    setSurface(nextSurface)
    setCourt(defaultCourtForVenueSurface(venue, nextSurface) ?? '')
    setError('')
  }

  function defaultTiebreakForSet(nextA: number, nextB: number) {
    if (nextA > nextB) {
      setTiebreakA(7)
      setTiebreakB(5)
    } else {
      setTiebreakA(5)
      setTiebreakB(7)
    }
  }

  function applyGames(nextA: number, nextB: number) {
    const wasTb = needsClassicTiebreak(gamesA, gamesB)
    const nowTb = needsClassicTiebreak(nextA, nextB)
    const winnerFlipped = gamesA > gamesB !== nextA > nextB
    setGamesA(nextA)
    setGamesB(nextB)
    if (nowTb && (!wasTb || winnerFlipped)) {
      defaultTiebreakForSet(nextA, nextB)
    }
  }

  function bump(side: 'a' | 'b', delta: number) {
    setError('')
    const nextA =
      side === 'a'
        ? Math.min(scoreMax, Math.max(0, gamesA + delta))
        : gamesA
    const nextB =
      side === 'b'
        ? Math.min(scoreMax, Math.max(0, gamesB + delta))
        : gamesB
    applyGames(nextA, nextB)
  }

  function bumpTiebreak(side: 'a' | 'b', delta: number) {
    setError('')
    if (side === 'a') {
      setTiebreakA((v) => Math.min(30, Math.max(0, v + delta)))
    } else {
      setTiebreakB((v) => Math.min(30, Math.max(0, v + delta)))
    }
  }

  function applyQuick(a: number, b: number, favor: 'a' | 'b') {
    setError('')
    if (favor === 'a') applyGames(a, b)
    else applyGames(b, a)
  }

  function swapPlayers() {
    setPlayerAId(playerBId)
    setPlayerBId(playerAId)
    setGamesA(gamesB)
    setGamesB(gamesA)
    setTiebreakA(tiebreakB)
    setTiebreakB(tiebreakA)
    setError('')
  }

  function applyDraft(draft: MatchDraft) {
    setDate(draft.date)
    setVenue(draft.venue ?? 'ceret')
    setSurface(draft.surface)
    setCourt(draft.court ?? '')
    setPlayerAId(draft.playerAId)
    setPlayerBId(draft.playerBId)
    setGamesA(draft.gamesA)
    setGamesB(draft.gamesB)
    if (needsClassicTiebreak(draft.gamesA, draft.gamesB)) {
      if (draft.tiebreakA != null && draft.tiebreakB != null) {
        setTiebreakA(draft.tiebreakA)
        setTiebreakB(draft.tiebreakB)
      } else {
        defaultTiebreakForSet(draft.gamesA, draft.gamesB)
      }
    }
    setDurationMinutes(draft.durationMinutes?.toString() ?? '')
    setBall(draft.ball ?? '')
    setRacketA(draft.racketA ?? '')
    setRacketB(draft.racketB ?? '')
  }

  function resetForNext() {
    const [nextA, nextB] = defaultScoreForFormat(matchFormat)
    setGamesA(nextA)
    setGamesB(nextB)
    defaultTiebreakForSet(7, 6)
    setDate(defaultDate)
    setDurationMinutes('')
    setBall('')
    setEditingMatchId(null)
    setShowDone(false)
    setError('')
    window.scrollTo(0, 0)
  }

  function startEdit(set: SessionSavedSet) {
    applyDraft(set.draft)
    setEditingMatchId(set.matchId)
    setShowDone(false)
    setError('')
    window.scrollTo(0, 0)
  }

  async function removeSaved(matchId: string) {
    if (!confirm('Apagar este set?')) return
    const result = await onDelete(matchId)
    if (result && !result.ok) {
      alert(result.error)
      return
    }
    setSavedSets((prev) => {
      const next = prev.filter((s) => s.matchId !== matchId)
      if (next.length === 0) setShowDone(false)
      return next
    })
    if (editingMatchId === matchId) {
      setEditingMatchId(null)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (users.length < 2) {
      setError('Precisa haver pelo menos 2 contas cadastradas.')
      return
    }
    if (!playerBId || playerAId === playerBId) {
      setError('Escolha dois jogadores diferentes.')
      return
    }
    if (!isValidMatchScore(matchFormat, gamesA, gamesB)) {
      setError(scoreErrorMessage(matchFormat))
      return
    }
    if (
      matchFormat === 'classic' &&
      needsClassicTiebreak(gamesA, gamesB) &&
      !classicTiebreakMatchesSet(gamesA, gamesB, tiebreakA, tiebreakB)
    ) {
      setError(classicTiebreakErrorMessage())
      return
    }

    const tb = resolveTiebreakFields(
      gamesA,
      gamesB,
      matchFormat === 'classic' ? tiebreakA : null,
      matchFormat === 'classic' ? tiebreakB : null,
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

    if (isTournament && (startsOn || endsOn)) {
      const windowError = tournamentMatchDateError(
        { status: 'active', startsOn, endsOn },
        date,
      )
      if (windowError) {
        setError(windowError)
        return
      }
    }

    let parsedDuration: number | null = null
    if (durationMinutes.trim() !== '') {
      const value = Number(durationMinutes)
      if (!Number.isFinite(value) || value <= 0 || value > 600) {
        setError('Duração inválida. Use minutos entre 1 e 600 (opcional).')
        return
      }
      parsedDuration = Math.round(value)
    }

    const draft: MatchDraft = {
      tournamentId: tournamentId ?? null,
      date,
      surface,
      venue,
      court: resolvedCourt,
      playerAId,
      playerBId,
      gamesA,
      gamesB,
      tiebreakA: tb.tiebreakA,
      tiebreakB: tb.tiebreakB,
      durationMinutes: parsedDuration,
      ball: ball || null,
      racketA: racketA || null,
      racketB: racketB || null,
      recordedById: currentUser.id,
    }
    const summary = summaryFromDraft(draft, users, matchFormat)

    setSaving(true)
    try {
      if (editingMatchId) {
        const result = await onUpdate(editingMatchId, {
          date: draft.date,
          surface: draft.surface,
          venue: draft.venue!,
          court: draft.court ?? null,
          playerAId: draft.playerAId,
          playerBId: draft.playerBId,
          gamesA: draft.gamesA,
          gamesB: draft.gamesB,
          tiebreakA: draft.tiebreakA ?? null,
          tiebreakB: draft.tiebreakB ?? null,
          durationMinutes: draft.durationMinutes ?? null,
          ball: draft.ball ?? null,
          racketA: draft.racketA ?? null,
          racketB: draft.racketB ?? null,
        })
        if (!result.ok) {
          setError(result.error)
          return
        }
        setSavedSets((prev) =>
          prev.map((s) =>
            s.matchId === editingMatchId
              ? { ...s, draft, ...summary }
              : s,
          ),
        )
        setEditingMatchId(null)
      } else {
        const result = await onSubmit(draft)
        if (!result.ok) {
          setError(result.error)
          return
        }
        setSavedSets((prev) => [
          ...prev,
          {
            matchId: result.matchId,
            draft,
            ...summary,
          },
        ])
      }
      setShowDone(true)
      window.scrollTo(0, 0)
    } finally {
      setSaving(false)
    }
  }

  if (users.length < 2) {
    return (
      <section className="register-page">
        <header className="register-page-head">
          <button type="button" className="link-btn" onClick={onClose}>
            ← Voltar
          </button>
          <h2>Registrar partida</h2>
        </header>
        <div className="panel">
          <p className="empty">
            Precisa de pelo menos 2 contas no app para registrar um set
            {isTournament ? ' neste torneio' : ''}.
          </p>
        </div>
      </section>
    )
  }

  if (showDone && savedSets.length > 0) {
    const totalPoints = savedSets.reduce((sum, s) => sum + s.points, 0)
    const contextLabel =
      isTournament && tournamentName
        ? `${tournamentName} · ${formatLabel(matchFormat)}`
        : 'Set avulso · Clássico'

    return (
      <section className="register-page register-page-done">
        <div className="register-success panel">
          <p className="tourney-kicker">Registrado</p>
          <h2>
            {savedSets.length === 1
              ? 'Set salvo'
              : `${savedSets.length} sets salvos`}
          </h2>

          <ul className="register-success-list">
            {savedSets.map((set) => (
              <li key={set.matchId} className="register-success-item">
                <p className="register-success-match">
                  <strong>{set.winnerName}</strong>
                  <span>{set.score}</span>
                  <strong>{set.loserName}</strong>
                </p>
                <p className="register-success-detail">
                  +{set.points} pt{set.points === 1 ? '' : 's'}
                  {' · '}
                  {contextLabel}
                </p>
                <div className="register-success-item-actions">
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => startEdit(set)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="link-btn danger"
                    onClick={() => void removeSaved(set.matchId)}
                  >
                    Apagar
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {savedSets.length > 1 ? (
            <p className="register-success-total">
              Total: +{totalPoints} pt{totalPoints === 1 ? '' : 's'}
            </p>
          ) : null}

          <div className="register-success-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={onClose}
            >
              Pronto
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={resetForNext}
            >
              Registrar outro
            </button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="register-page">
      <header className="register-page-head">
        <button type="button" className="link-btn" onClick={onClose}>
          ← Voltar
        </button>
        <p className="tourney-kicker">
          {editingMatchId ? 'Editar set' : 'Novo set'}
        </p>
        <h2>
          {editingMatchId ? 'Corrigir partida' : 'Registrar partida'}
        </h2>
        <p>
          {isTournament && tournamentName
            ? `${tournamentName} · ${formatLabel(matchFormat)}`
            : 'Set avulso · Clássico'}
        </p>
        <p className="register-format-hint">{formatBlurb(matchFormat)}</p>
        <p className="register-format-hint muted">{rankingHint(matchFormat)}</p>
      </header>

      <form className="register-page-form" onSubmit={handleSubmit}>
        <div className={`register-score surface-${surface}`}>
          <div className="register-players">
            <div
              className={`register-player ${winnerId === playerAId ? 'winning' : ''}`}
            >
              <label>
                <span>Jogador A</span>
                <select
                  value={playerAId}
                  onChange={(e) => {
                    const next = e.target.value
                    setPlayerAId(next)
                    if (next === playerBId) {
                      const other = users.find((u) => u.id !== next)
                      if (other) setPlayerBId(other.id)
                    }
                  }}
                >
                  {opponentsForB.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                      {u.id === currentUser.id ? ' (você)' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <div className="register-games">
                <button
                  type="button"
                  className="stepper"
                  onClick={() => bump('a', -1)}
                  aria-label={`Diminuir ${scoreUnitLabel(matchFormat)} A`}
                >
                  −
                </button>
                <strong>{gamesA}</strong>
                <button
                  type="button"
                  className="stepper"
                  onClick={() => bump('a', 1)}
                  aria-label={`Aumentar ${scoreUnitLabel(matchFormat)} A`}
                >
                  +
                </button>
              </div>
            </div>

            <div className="register-vs">
              <button
                type="button"
                className="swap-btn"
                onClick={swapPlayers}
                aria-label="Trocar lados"
                title="Trocar lados"
              >
                ⇄
              </button>
              <span>vs</span>
            </div>

            <div
              className={`register-player ${winnerId === playerBId ? 'winning' : ''}`}
            >
              <label>
                <span>Jogador B</span>
                <select
                  value={playerBId}
                  onChange={(e) => setPlayerBId(e.target.value)}
                >
                  {opponentsForA.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                      {u.id === currentUser.id ? ' (você)' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <div className="register-games">
                <button
                  type="button"
                  className="stepper"
                  onClick={() => bump('b', -1)}
                  aria-label={`Diminuir ${scoreUnitLabel(matchFormat)} B`}
                >
                  −
                </button>
                <strong>{gamesB}</strong>
                <button
                  type="button"
                  className="stepper"
                  onClick={() => bump('b', 1)}
                  aria-label={`Aumentar ${scoreUnitLabel(matchFormat)} B`}
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {showClassicTiebreak ? (
            <div className="register-tiebreak">
              <p className="quick-label">Tie-break do set</p>
              <div className="register-tiebreak-row">
                <div className="register-games register-games-tb">
                  <button
                    type="button"
                    className="stepper"
                    onClick={() => bumpTiebreak('a', -1)}
                    aria-label="Diminuir pontos TB A"
                  >
                    −
                  </button>
                  <strong>{tiebreakA}</strong>
                  <button
                    type="button"
                    className="stepper"
                    onClick={() => bumpTiebreak('a', 1)}
                    aria-label="Aumentar pontos TB A"
                  >
                    +
                  </button>
                </div>
                <span className="register-tb-sep">TB</span>
                <div className="register-games register-games-tb">
                  <button
                    type="button"
                    className="stepper"
                    onClick={() => bumpTiebreak('b', -1)}
                    aria-label="Diminuir pontos TB B"
                  >
                    −
                  </button>
                  <strong>{tiebreakB}</strong>
                  <button
                    type="button"
                    className="stepper"
                    onClick={() => bumpTiebreak('b', 1)}
                    aria-label="Aumentar pontos TB B"
                  >
                    +
                  </button>
                </div>
              </div>
              <p className="quick-hint">
                Até 7 pontos, com 2 de diferença (ex.: 7–5, 10–8)
              </p>
            </div>
          ) : null}

          <p className={`register-winner ${winnerId ? '' : 'muted'}`}>
            {winnerId && playerA && playerB
              ? `Vencedor: ${winnerId === playerAId ? playerA.name : playerB.name}`
              : showClassicTiebreak
                ? 'Ajuste games e o placar do tie-break'
                : 'Ajuste o placar do set'}
          </p>
        </div>

        <div className="panel register-meta">
          <div className="form-row">
            <label>
              <span>Data</span>
              <input
                type="date"
                value={date}
                min={dateMin}
                max={dateMax}
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
            <fieldset className="surface-field">
              <legend>Superfície</legend>
              <div className="surface-toggle" role="group">
                <button
                  type="button"
                  className={surface === 'hard' ? 'active hard' : 'hard'}
                  onClick={() => applySurface('hard')}
                  disabled={surfaceLocked && surface !== 'hard'}
                >
                  {surfaceLabel('hard')}
                </button>
                <button
                  type="button"
                  className={surface === 'clay' ? 'active clay' : 'clay'}
                  onClick={() => applySurface('clay')}
                  disabled={surfaceLocked && surface !== 'clay'}
                >
                  {surfaceLabel('clay')}
                </button>
              </div>
              {surfaceLocked ? (
                <p className="quick-hint">Travada para este local</p>
              ) : null}
            </fieldset>

            {showCourt ? (
              <label>
                <span>Quadra</span>
                <select
                  value={court}
                  onChange={(e) =>
                    setCourt((e.target.value as CourtId) || '')
                  }
                  required
                >
                  {courtOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div aria-hidden className="form-row-spacer" />
            )}
          </div>

          <div className="form-row">
            <label>
              <span>Raquete · {playerA?.name ?? 'A'}</span>
              <select
                value={racketA}
                onChange={(e) =>
                  setRacketA((e.target.value as RacketModel) || '')
                }
              >
                <option value="">—</option>
                {RACKET_MODELS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Raquete · {playerB?.name ?? 'B'}</span>
              <select
                value={racketB}
                onChange={(e) =>
                  setRacketB((e.target.value as RacketModel) || '')
                }
              >
                <option value="">—</option>
                {RACKET_MODELS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="quick-scores">
            <span className="quick-label">
              Placar rápido ({scoreUnitLabel(matchFormat)})
            </span>
            <div className="quick-grid">
              {quickScores.map(([hi, lo]) => (
                <div key={`${hi}-${lo}`} className="quick-pair">
                  <button
                    type="button"
                    onClick={() => applyQuick(hi, lo, 'a')}
                  >
                    {hi}–{lo}
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuick(hi, lo, 'b')}
                  >
                    {lo}–{hi}
                  </button>
                </div>
              ))}
            </div>
            <p className="quick-hint">
              Esquerda: {playerA?.name ?? 'A'} · Direita: {playerB?.name ?? 'B'}
            </p>
          </div>

          <div className="optional-block">
            <p className="quick-label">Opcional</p>
            <div className="form-row">
              <label>
                <span>Duração (min)</span>
                <input
                  type="number"
                  min={1}
                  max={600}
                  inputMode="numeric"
                  placeholder="minutos"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                />
              </label>
              <label>
                <span>Bola</span>
                <select
                  value={ball}
                  onChange={(e) =>
                    setBall((e.target.value || '') as BallBrand | '')
                  }
                >
                  <option value="">Não informar</option>
                  {BALL_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </div>

        {error ? <p className="form-error">{error}</p> : null}

        <button
          type="submit"
          className="btn btn-primary btn-wide btn-register"
          disabled={
            saving ||
            !scoreValid ||
            !tiebreakValid ||
            playerAId === playerBId
          }
        >
          {saving
            ? 'Salvando…'
            : editingMatchId
              ? 'Salvar alteração'
              : 'Salvar set'}
        </button>
        {editingMatchId ? (
          <button
            type="button"
            className="btn btn-ghost btn-wide"
            disabled={saving}
            onClick={() => {
              setEditingMatchId(null)
              setError('')
              setShowDone(savedSets.length > 0)
            }}
          >
            Voltar à lista
          </button>
        ) : null}
      </form>
    </section>
  )
}
