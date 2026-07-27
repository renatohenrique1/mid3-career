import { useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { computeCareerStats } from '../data/career'
import {
  backhandLabel,
  countSetWinsSplit,
  racketLabel,
} from '../data/profile'
import type { AppData } from '../types'
import { PlayerAvatar } from './PlayerAvatar'

interface ProfileModalProps {
  data: AppData
  userId: string
  onClose: () => void
}

export function ProfileModal({ data, userId, onClose }: ProfileModalProps) {
  const user = data.users.find((u) => u.id === userId) ?? null

  const career = useMemo(() => {
    if (!user) return null
    return computeCareerStats(data).find((c) => c.playerId === user.id) ?? null
  }, [data, user])

  const setWins = useMemo(() => {
    if (!user) return { total: 0, casual: 0, tournament: 0 }
    return countSetWinsSplit(user.id, data.matches)
  }, [data.matches, user])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!user) return null

  return createPortal(
    <div
      className="app-modal-overlay"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="app-modal-card profile-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="app-modal-head">
          <div>
            <p className="tourney-kicker">Jogador</p>
            <h3 id="profile-modal-title">{user.name}</h3>
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

        <div className="player-card-top">
          <PlayerAvatar user={user} size="lg" />
          <div>
            <p className="player-handle">
              {user.nickname ? `@${user.nickname}` : 'Sem nickname'}
            </p>
          </div>
        </div>

        <dl className="match-detail-stats">
          <div>
            <dt>Altura</dt>
            <dd>{user.heightCm ? `${user.heightCm} cm` : '—'}</dd>
          </div>
          <div>
            <dt>Idade</dt>
            <dd>{user.age ?? '—'}</dd>
          </div>
          <div>
            <dt>Backhand</dt>
            <dd>{backhandLabel(user.backhand)}</dd>
          </div>
          <div>
            <dt>Raquete</dt>
            <dd>{racketLabel(user.primaryRacket)}</dd>
          </div>
          <div>
            <dt>Títulos</dt>
            <dd>{career?.titles ?? 0}</dd>
          </div>
          <div>
            <dt>Pontos</dt>
            <dd>{career?.points ?? 0}</dd>
          </div>
          <div>
            <dt>Sets vencidos</dt>
            <dd>
              {setWins.total}
              <span className="muted-inline">
                {' '}
                ({setWins.casual} avulsos · {setWins.tournament} torneio)
              </span>
            </dd>
          </div>
          <div>
            <dt>V / D</dt>
            <dd>
              {career?.setWins ?? 0}–{career?.setLosses ?? 0}
            </dd>
          </div>
        </dl>
      </div>
    </div>,
    document.body,
  )
}
