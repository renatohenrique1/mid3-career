import { describeMatchEditChanges } from '../data/matchEdits'
import { surfaceLabel } from '../data/ranking'
import type { Match, MatchEditRequest, User } from '../types'

function userName(users: User[], id: string) {
  return users.find((u) => u.id === id)?.name ?? '?'
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export type PendingApprovalItem = {
  request: MatchEditRequest
  match: Match
}

interface PendingEditsModalProps {
  items: PendingApprovalItem[]
  users: User[]
  onResolve: (
    requestId: string,
    decision: 'approved' | 'rejected',
  ) => Promise<{ ok: true } | { ok: false; error: string }>
  onClose: () => void
}

export function PendingEditsModal({
  items,
  users,
  onResolve,
  onClose,
}: PendingEditsModalProps) {
  if (items.length === 0) return null

  return (
    <div
      className="app-modal-overlay"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="app-modal-card pending-edits-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pending-edits-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="app-modal-head">
          <div>
            <p className="tourney-kicker">Aguardando você</p>
            <h3 id="pending-edits-title">
              {items.length === 1
                ? 'Pedido de alteração'
                : `${items.length} pedidos de alteração`}
            </h3>
          </div>
          <button type="button" className="link-btn" onClick={onClose}>
            Depois
          </button>
        </header>

        <p className="muted-inline">
          Aceite ou recuse as alterações propostas nos seus sets.
        </p>

        <ul className="pending-edits-list">
          {items.map(({ request, match }) => {
            const changes = describeMatchEditChanges(
              match,
              request.payload,
              users,
            )
            const nameA = userName(users, match.playerAId)
            const nameB = userName(users, match.playerBId)

            return (
              <li key={request.id} className="pending-edit-card">
                <p>
                  <strong>
                    {nameA} × {nameB}
                  </strong>
                  <span className="muted-inline">
                    {' '}
                    · {formatDate(match.date)} · {surfaceLabel(match.surface)}{' '}
                    · {match.gamesA}–{match.gamesB}
                  </span>
                </p>
                <p className="muted-inline">
                  Pedido de {userName(users, request.requestedById)}
                </p>
                <ul className="pending-edit-changes">
                  {changes.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
                <div className="history-actions">
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
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
