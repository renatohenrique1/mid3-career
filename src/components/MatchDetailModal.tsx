import { racketLabel } from '../data/profile'
import { ballLabel, formatDuration, surfaceLabel } from '../data/ranking'
import type { Match, Tournament, User } from '../types'

function userName(users: User[], id: string) {
  return users.find((u) => u.id === id)?.name ?? '?'
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

interface MatchDetailModalProps {
  match: Match
  users: User[]
  tournaments?: Tournament[]
  onClose: () => void
}

export function MatchDetailModal({
  match,
  users,
  tournaments = [],
  onClose,
}: MatchDetailModalProps) {
  const nameA = userName(users, match.playerAId)
  const nameB = userName(users, match.playerBId)
  const aWon = match.gamesA > match.gamesB
  const duration = formatDuration(match.durationMinutes)
  const ball = ballLabel(match.ball)
  const tournament = match.tournamentId
    ? tournaments.find((t) => t.id === match.tournamentId)
    : null
  const recordedBy = userName(users, match.recordedById)

  return (
    <div
      className="app-modal-overlay"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="app-modal-card match-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="match-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="app-modal-head">
          <div>
            <p className="tourney-kicker">Detalhes do set</p>
            <h3 id="match-detail-title">
              {nameA} × {nameB}
            </h3>
          </div>
          <button
            type="button"
            className="link-btn"
            onClick={onClose}
            aria-label="Fechar"
          >
            Fechar
          </button>
        </header>

        <div className="match-detail-score">
          <span className={aWon ? 'winner' : ''}>{nameA}</span>
          <strong>
            {match.gamesA}–{match.gamesB}
          </strong>
          <span className={!aWon ? 'winner' : ''}>{nameB}</span>
        </div>

        <dl className="match-detail-stats">
          <div>
            <dt>Data</dt>
            <dd>{formatDate(match.date)}</dd>
          </div>
          <div>
            <dt>Superfície</dt>
            <dd>
              <span className={`surface-chip ${match.surface}`}>
                {surfaceLabel(match.surface)}
              </span>
            </dd>
          </div>
          <div>
            <dt>Duração</dt>
            <dd>{duration ?? '—'}</dd>
          </div>
          <div>
            <dt>Bola</dt>
            <dd>{ball ?? '—'}</dd>
          </div>
          <div>
            <dt>Raquete {nameA}</dt>
            <dd>{racketLabel(match.racketA)}</dd>
          </div>
          <div>
            <dt>Raquete {nameB}</dt>
            <dd>{racketLabel(match.racketB)}</dd>
          </div>
          <div>
            <dt>Contexto</dt>
            <dd>{tournament ? tournament.name : 'Set avulso'}</dd>
          </div>
          <div>
            <dt>Registrado por</dt>
            <dd>{recordedBy}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
