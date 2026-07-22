import { useState } from 'react'
import {
  isValidNickname,
  normalizeNickname,
} from '../data/profile'
import type { ProfileUpdateInput } from '../types'

interface NicknameSetupProps {
  name: string
  onSave: (
    input: ProfileUpdateInput,
  ) => Promise<{ ok: true } | { ok: false; error: string }>
}

export function NicknameSetup({ name, onSave }: NicknameSetupProps) {
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!isValidNickname(nickname)) {
      setError('Nickname: 3–20 caracteres (a-z, 0-9, _).')
      return
    }
    setLoading(true)
    const result = await onSave({ nickname: normalizeNickname(nickname) })
    setLoading(false)
    if (!result.ok) setError(result.error)
  }

  return (
    <div className="auth-screen">
      <header className="hero hero-auth">
        <p className="brand">MID3</p>
        <h1>Career</h1>
        <p className="tagline">
          Olá, {name}! Escolha um nickname único para continuar.
        </p>
      </header>
      <section className="panel auth-panel">
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            <span>Nickname</span>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="ex: renato_bh"
              required
              maxLength={20}
              autoFocus
            />
          </label>
          <p className="register-format-hint muted">
            Depois você poderá trocar 1 vez por semana.
          </p>
          {error ? <p className="form-error">{error}</p> : null}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? 'Salvando…' : 'Continuar'}
          </button>
        </form>
      </section>
    </div>
  )
}
