import { useMemo, useState } from 'react'
import { computeCareerStats } from '../data/career'
import {
  BACKHAND_OPTIONS,
  backhandLabel,
  countSetWinsSplit,
  formatCooldown,
  nameChangesLeft,
  nicknameCooldownMs,
  RACKET_MODELS,
  racketLabel,
} from '../data/profile'
import type {
  AppData,
  AvatarId,
  BackhandType,
  ProfileUpdateInput,
  RacketModel,
  User,
} from '../types'
import { AvatarPicker, PlayerAvatar } from './PlayerAvatar'

interface ProfilePageProps {
  data: AppData
  currentUser: User
  viewingUserId?: string
  onUpdateProfile: (
    input: ProfileUpdateInput,
  ) => Promise<{ ok: true; user?: User } | { ok: false; error: string }>
}

export function ProfilePage({
  data,
  currentUser,
  viewingUserId,
  onUpdateProfile,
}: ProfilePageProps) {
  const userId = viewingUserId ?? currentUser.id
  const user = data.users.find((u) => u.id === userId) ?? currentUser
  const isOwn = user.id === currentUser.id

  const career = useMemo(() => {
    const all = computeCareerStats(data)
    return all.find((c) => c.playerId === user.id)
  }, [data, user.id])

  const setWins = useMemo(
    () => countSetWinsSplit(user.id, data.matches),
    [data.matches, user.id],
  )

  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(user.name)
  const [nickname, setNickname] = useState(user.nickname ?? '')
  const [avatarId, setAvatarId] = useState<AvatarId>(user.avatarId)
  const [heightCm, setHeightCm] = useState(user.heightCm?.toString() ?? '')
  const [age, setAge] = useState(user.age?.toString() ?? '')
  const [backhand, setBackhand] = useState<BackhandType | ''>(
    user.backhand ?? '',
  )
  const [rackets, setRackets] = useState<RacketModel[]>(user.rackets)
  const [primaryRacket, setPrimaryRacket] = useState<RacketModel | ''>(
    user.primaryRacket ?? '',
  )
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const cooldown = nicknameCooldownMs(user)
  const namesLeft = nameChangesLeft(user)

  function toggleRacket(id: RacketModel) {
    setRackets((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((r) => r !== id)
        if (primaryRacket === id) setPrimaryRacket(next[0] ?? '')
        return next
      }
      return [...prev, id]
    })
  }

  function startEdit() {
    setName(user.name)
    setNickname(user.nickname ?? '')
    setAvatarId(user.avatarId)
    setHeightCm(user.heightCm?.toString() ?? '')
    setAge(user.age?.toString() ?? '')
    setBackhand(user.backhand ?? '')
    setRackets(user.rackets)
    setPrimaryRacket(user.primaryRacket ?? '')
    setError('')
    setEditing(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)

    const height =
      heightCm.trim() === '' ? null : Number(heightCm)
    const ageVal = age.trim() === '' ? null : Number(age)

    if (height != null && (!Number.isFinite(height) || height < 120 || height > 230)) {
      setSaving(false)
      setError('Altura inválida (120–230 cm).')
      return
    }
    if (ageVal != null && (!Number.isFinite(ageVal) || ageVal < 10 || ageVal > 90)) {
      setSaving(false)
      setError('Idade inválida (10–90).')
      return
    }
    if (primaryRacket && !rackets.includes(primaryRacket)) {
      setSaving(false)
      setError('A raquete principal precisa estar na sua lista.')
      return
    }

    const result = await onUpdateProfile({
      name: name.trim(),
      nickname: nickname.trim() || undefined,
      avatarId,
      heightCm: height,
      age: ageVal,
      backhand: backhand || null,
      rackets,
      primaryRacket: primaryRacket || null,
    })
    setSaving(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setEditing(false)
  }

  return (
    <section className="profile-page">
      <header className="detail-hero">
        <p className="tourney-kicker">{isOwn ? 'Seu card' : 'Jogador'}</p>
        <h2>Perfil</h2>
      </header>

      <article className="panel player-card">
        <div className="player-card-top">
          <PlayerAvatar user={user} size="lg" />
          <div>
            <h3>{user.name}</h3>
            <p className="player-handle">
              {user.nickname ? `@${user.nickname}` : 'Sem nickname'}
            </p>
          </div>
        </div>

        <dl className="player-card-stats">
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
            <dt>Sets vencidos</dt>
            <dd>
              {setWins.total}
              <span className="muted-inline">
                {' '}
                ({setWins.casual} avulsos · {setWins.tournament} torneio)
              </span>
            </dd>
          </div>
        </dl>

        {isOwn && !editing ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={startEdit}
          >
            Editar perfil
          </button>
        ) : null}
      </article>

      {isOwn && editing ? (
        <form className="panel profile-edit" onSubmit={handleSave}>
          <h3>Editar</h3>

          <AvatarPicker value={avatarId} name={name} onChange={setAvatarId} />

          <label>
            <span>
              Nome{' '}
              <em className="field-hint">
                ({namesLeft} troca{namesLeft === 1 ? '' : 's'} restante
                {namesLeft === 1 ? '' : 's'})
              </em>
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={32}
              required
              disabled={namesLeft === 0 && name === user.name}
            />
          </label>

          <label>
            <span>
              Nickname{' '}
              <em className="field-hint">
                ({formatCooldown(cooldown)})
              </em>
            </span>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={20}
              required
              disabled={cooldown > 0 && nickname === (user.nickname ?? '')}
            />
          </label>

          <div className="date-range-grid">
            <label>
              <span>Altura (cm)</span>
              <input
                type="number"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                min={120}
                max={230}
                placeholder="ex: 178"
              />
            </label>
            <label>
              <span>Idade</span>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                min={10}
                max={90}
                placeholder="ex: 28"
              />
            </label>
          </div>

          <fieldset className="format-field">
            <legend>Backhand</legend>
            <div className="format-grid" role="group">
              {BACKHAND_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={backhand === opt.id ? 'active' : ''}
                  onClick={() => setBackhand(opt.id)}
                >
                  <strong>{opt.label}</strong>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="format-field">
            <legend>Suas raquetes</legend>
            <div className="format-grid" role="group">
              {RACKET_MODELS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={rackets.includes(opt.id) ? 'active' : ''}
                  onClick={() => toggleRacket(opt.id)}
                >
                  <strong>{opt.label}</strong>
                  {primaryRacket === opt.id ? (
                    <span>Principal</span>
                  ) : null}
                </button>
              ))}
            </div>
          </fieldset>

          {rackets.length > 0 ? (
            <label>
              <span>Raquete principal (no card e no set)</span>
              <select
                value={primaryRacket}
                onChange={(e) =>
                  setPrimaryRacket((e.target.value as RacketModel) || '')
                }
                required
              >
                <option value="">Escolha</option>
                {rackets.map((id) => (
                  <option key={id} value={id}>
                    {racketLabel(id)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {error ? <p className="form-error">{error}</p> : null}

          <div className="create-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
            <button
              type="button"
              className="link-btn"
              onClick={() => setEditing(false)}
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : null}
    </section>
  )
}
