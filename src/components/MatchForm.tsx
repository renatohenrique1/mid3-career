import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BALL_OPTIONS,
  defaultScoreForFormat,
  formatBlurb,
  formatLabel,
  isValidMatchScore,
  localDateString,
  normalizeFormat,
  pointsForWin,
  quickScoresForFormat,
  rankingHint,
  scoreErrorMessage,
  scoreMaxForFormat,
  scoreUnitLabel,
  surfaceLabel,
  tournamentMatchDateError,
} from '../data/ranking'
import { RACKET_MODELS } from '../data/profile'
import type {
  BallBrand,
  Match,
  RacketModel,
  Surface,
  TournamentFormat,
  User,
} from '../types'

interface MatchFormProps {
  tournamentId?: string | null
  tournamentName?: string
  startsOn?: string
  endsOn?: string
  format?: TournamentFormat
  users: User[]
  currentUser: User
  onSubmit: (match: Omit<Match, 'id' | 'createdAt'>) => void
  onClose: () => void
}

function userById(users: User[], id: string) {
  return users.find((u) => u.id === id)
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
  const [surface, setSurface] = useState<Surface>('hard')
  const [playerAId, setPlayerAId] = useState(currentUser.id)
  const [playerBId, setPlayerBId] = useState(others[0]?.id ?? '')
  const [gamesA, setGamesA] = useState(defaultA)
  const [gamesB, setGamesB] = useState(defaultB)
  const [durationMinutes, setDurationMinutes] = useState('')
  const [ball, setBall] = useState<BallBrand | ''>('')
  const [racketA, setRacketA] = useState<RacketModel | ''>(
    () => userById(users, currentUser.id)?.primaryRacket ?? '',
  )
  const [racketB, setRacketB] = useState<RacketModel | ''>(
    () => others[0]?.primaryRacket ?? '',
  )
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<{
    winnerName: string
    loserName: string
    score: string
    points: number
  } | null>(null)

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
      if (e.key === 'Escape' && !success) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, success])

  const playerA = userById(users, playerAId)
  const playerB = userById(users, playerBId)
  const scoreValid = isValidMatchScore(matchFormat, gamesA, gamesB)
  const winnerId =
    scoreValid && gamesA !== gamesB
      ? gamesA > gamesB
        ? playerAId
        : playerBId
      : null

  const opponentsForA = users.filter((u) => u.id !== playerAId)
  const opponentsForB = users.filter((u) => u.id !== playerBId)

  function bump(side: 'a' | 'b', delta: number) {
    setError('')
    if (side === 'a') {
      setGamesA((v) => Math.min(scoreMax, Math.max(0, v + delta)))
    } else {
      setGamesB((v) => Math.min(scoreMax, Math.max(0, v + delta)))
    }
  }

  function applyQuick(a: number, b: number, favor: 'a' | 'b') {
    setError('')
    if (favor === 'a') {
      setGamesA(a)
      setGamesB(b)
    } else {
      setGamesA(b)
      setGamesB(a)
    }
  }

  function swapPlayers() {
    setPlayerAId(playerBId)
    setPlayerBId(playerAId)
    setGamesA(gamesB)
    setGamesB(gamesA)
    setError('')
  }

  function resetForNext() {
    const [nextA, nextB] = defaultScoreForFormat(matchFormat)
    setGamesA(nextA)
    setGamesB(nextB)
    setDate(defaultDate)
    setDurationMinutes('')
    setBall('')
    setSuccess(null)
    setError('')
    window.scrollTo(0, 0)
  }

  function handleSubmit(e: React.FormEvent) {
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

    const aWon = gamesA > gamesB
    const winnerName = aWon
      ? (userById(users, playerAId)?.name ?? 'Jogador A')
      : (userById(users, playerBId)?.name ?? 'Jogador B')
    const loserName = aWon
      ? (userById(users, playerBId)?.name ?? 'Jogador B')
      : (userById(users, playerAId)?.name ?? 'Jogador A')
    const score = aWon ? `${gamesA}–${gamesB}` : `${gamesB}–${gamesA}`
    const points = pointsForWin(matchFormat, gamesA, gamesB)

    onSubmit({
      tournamentId: tournamentId ?? null,
      date,
      surface,
      playerAId,
      playerBId,
      gamesA,
      gamesB,
      durationMinutes: parsedDuration,
      ball: ball || null,
      racketA: racketA || null,
      racketB: racketB || null,
      recordedById: currentUser.id,
    })

    setSuccess({ winnerName, loserName, score, points })
    window.scrollTo(0, 0)
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

  if (success) {
    return (
      <section className="register-page register-page-done">
        <div className="register-success panel">
          <p className="tourney-kicker">Registrado</p>
          <h2>Set salvo</h2>
          <p className="register-success-match">
            <strong>{success.winnerName}</strong>
            <span>{success.score}</span>
            <strong>{success.loserName}</strong>
          </p>
          <p className="register-success-detail">
            +{success.points} pt{success.points === 1 ? '' : 's'}
            {' · '}
            {isTournament && tournamentName
              ? `${tournamentName} · ${formatLabel(matchFormat)}`
              : 'Set avulso · Clássico'}
          </p>
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
        <p className="tourney-kicker">Novo set</p>
        <h2>Registrar partida</h2>
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

          <p className={`register-winner ${winnerId ? '' : 'muted'}`}>
            {winnerId && playerA && playerB
              ? `Vencedor: ${winnerId === playerAId ? playerA.name : playerB.name}`
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

            <fieldset className="surface-field">
              <legend>Quadra</legend>
              <div className="surface-toggle" role="group">
                <button
                  type="button"
                  className={surface === 'hard' ? 'active hard' : 'hard'}
                  onClick={() => setSurface('hard')}
                >
                  {surfaceLabel('hard')}
                </button>
                <button
                  type="button"
                  className={surface === 'clay' ? 'active clay' : 'clay'}
                  onClick={() => setSurface('clay')}
                >
                  {surfaceLabel('clay')}
                </button>
              </div>
            </fieldset>
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
          disabled={!scoreValid || playerAId === playerBId}
        >
          Salvar set
        </button>
      </form>
    </section>
  )
}
