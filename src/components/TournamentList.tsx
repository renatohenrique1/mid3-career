import { useMemo, useState } from 'react'
import {
  formatShortLabel,
  TOURNAMENT_FORMATS,
} from '../data/ranking'
import type { Match, Tournament, TournamentFormat, User } from '../types'

interface TournamentListProps {
  currentUser: User
  users: User[]
  tournaments: Tournament[]
  matches: Match[]
  onCreate: (
    name: string,
    format: TournamentFormat,
  ) =>
    | { ok: true; tournament: Tournament }
    | { ok: false; error: string }
    | Promise<
        | { ok: true; tournament: Tournament }
        | { ok: false; error: string }
      >
  onOpen: (tournamentId: string) => void
  onJoin: (
    tournamentId: string,
  ) =>
    | { ok: true }
    | { ok: false; error: string }
    | Promise<{ ok: true } | { ok: false; error: string }>
}

function formatDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  })
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

export function TournamentList({
  currentUser,
  users,
  tournaments,
  matches,
  onCreate,
  onOpen,
  onJoin,
}: TournamentListProps) {
  const [name, setName] = useState('')
  const [format, setFormat] = useState<TournamentFormat>('classic')
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)

  const matchCountByTournament = useMemo(() => {
    const map = new Map<string, number>()
    for (const match of matches) {
      if (!match.tournamentId) continue
      map.set(match.tournamentId, (map.get(match.tournamentId) ?? 0) + 1)
    }
    return map
  }, [matches])

  const myTournaments = tournaments.filter((t) =>
    t.participantIds.includes(currentUser.id),
  ).length

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const result = await onCreate(name, format)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setName('')
    setFormat('classic')
    setCreating(false)
    onOpen(result.tournament.id)
  }

  return (
    <section className="tournament-home">
      <header className="tourney-hero">
        <div className="tourney-hero-copy">
          <p className="tourney-kicker">Sua temporada</p>
          <h2>Torneios</h2>
          <p>
            Organize disputas entre amigos. Cada torneio tem ranking próprio e
            partidas registradas ali dentro.
          </p>
        </div>
        <div className="tourney-court" aria-hidden>
          <span className="court-line court-line-h" />
          <span className="court-line court-line-v" />
          <span className="court-net" />
          <span className="court-ball" />
        </div>
      </header>

      <div className="tourney-stats" aria-label="Resumo">
        <div>
          <strong>{tournaments.length}</strong>
          <span>torneios</span>
        </div>
        <div>
          <strong>{matches.length}</strong>
          <span>sets</span>
        </div>
        <div>
          <strong>{myTournaments}</strong>
          <span>participando</span>
        </div>
      </div>

      {creating ? (
        <form className="panel create-tournament" onSubmit={handleCreate}>
          <div className="create-tournament-head">
            <h3>Novo torneio</h3>
            <p>Dê um nome fácil de achar depois — parque, mês ou grupo.</p>
          </div>
          <label>
            <span>Nome do torneio</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Parque Ibirapuera — Julho"
              maxLength={48}
              required
              autoFocus
            />
          </label>

          <fieldset className="format-field">
            <legend>Formato</legend>
            <div className="format-grid" role="group">
              {TOURNAMENT_FORMATS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={format === option.id ? 'active' : ''}
                  onClick={() => setFormat(option.id)}
                >
                  <strong>{option.label}</strong>
                  <span>{option.blurb}</span>
                </button>
              ))}
            </div>
          </fieldset>

          {error ? <p className="form-error">{error}</p> : null}
          <div className="create-actions">
            <button type="submit" className="btn btn-primary">
              Criar e abrir
            </button>
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setCreating(false)
                setError('')
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <div className="tourney-cta panel">
          <div>
            <h3>Começar um torneio</h3>
            <p>Ranking zerado, partidas novas, disputa entre quem entrar.</p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setCreating(true)}
          >
            Criar torneio
          </button>
        </div>
      )}

      <div className="tourney-section-head">
        <h3>{tournaments.length === 0 ? 'Ainda vazio' : 'Todos os torneios'}</h3>
        {tournaments.length > 0 ? (
          <span>
            {tournaments.length} ativo{tournaments.length === 1 ? '' : 's'}
          </span>
        ) : null}
      </div>

      {tournaments.length === 0 ? (
        <div className="tourney-empty panel">
          <ol className="tourney-steps">
            <li>
              <span>1</span>
              <div>
                <strong>Crie o torneio</strong>
                <p>Escolha um nome para o grupo ou o parque.</p>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <strong>Chame o pessoal</strong>
                <p>Cada um entra com a própria conta e participa.</p>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <strong>Registre os sets</strong>
                <p>Placar, quadra e ranking atualizam na hora.</p>
              </div>
            </li>
          </ol>
        </div>
      ) : (
        <ul className="tournament-list">
          {tournaments.map((tournament, index) => {
            const isIn = tournament.participantIds.includes(currentUser.id)
            const creator =
              users.find((u) => u.id === tournament.createdById)?.name ?? '?'
            const sets = matchCountByTournament.get(tournament.id) ?? 0
            const participantUsers = tournament.participantIds
              .map((id) => users.find((u) => u.id === id))
              .filter((u): u is User => Boolean(u))
            const shown = participantUsers.slice(0, 4)
            const extra = participantUsers.length - shown.length

            return (
              <li
                key={tournament.id}
                className="tournament-card panel"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <button
                  type="button"
                  className="tournament-open"
                  onClick={() => onOpen(tournament.id)}
                >
                  <div className="tournament-card-top">
                    <strong>{tournament.name}</strong>
                    {tournament.status === 'finished' ? (
                      <span className="joined-tag">Encerrado</span>
                    ) : isIn ? (
                      <span className="joined-tag">Participando</span>
                    ) : null}
                  </div>

                  <div className="tournament-chips">
                    <span className="format-chip">
                      {formatShortLabel(tournament.format ?? 'classic')}
                    </span>
                    <span>
                      {participantUsers.length} jogador
                      {participantUsers.length === 1 ? '' : 'es'}
                    </span>
                    <span>
                      {sets} set{sets === 1 ? '' : 's'}
                    </span>
                    <span>{formatDate(tournament.createdAt)}</span>
                    {tournament.status === 'finished' && tournament.winnerId ? (
                      <span>
                        Campeão:{' '}
                        {users.find((u) => u.id === tournament.winnerId)?.name ??
                          '?'}
                      </span>
                    ) : null}
                  </div>

                  <div className="tournament-card-foot">
                    <div className="avatar-stack" aria-hidden>
                      {shown.map((u) => (
                        <span key={u.id} title={u.name}>
                          {initials(u.name)}
                        </span>
                      ))}
                      {extra > 0 ? (
                        <span className="avatar-extra">+{extra}</span>
                      ) : null}
                    </div>
                    <span className="tournament-creator">por {creator}</span>
                  </div>
                </button>

                <div className="tournament-actions">
                  {!isIn && tournament.status === 'active' ? (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={async () => {
                        const result = await onJoin(tournament.id)
                        if (!result.ok) alert(result.error)
                      }}
                    >
                      Participar
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => onOpen(tournament.id)}
                  >
                    Abrir
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
