import { useState } from 'react'
import { isValidNickname, normalizeNickname } from '../data/profile'

type AuthMode = 'login' | 'register'

interface AuthScreenProps {
  onLogin: (input: {
    name: string
    password: string
  }) => Promise<{ ok: true } | { ok: false; error: string }>
  onRegister: (input: {
    name: string
    password: string
    nickname?: string
  }) => Promise<{ ok: true } | { ok: false; error: string }>
}

export function AuthScreen({ onLogin, onRegister }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>('login')
  const [name, setName] = useState('')
  const [nickname, setNickname] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (mode === 'register') {
      if (!isValidNickname(nickname)) {
        setLoading(false)
        setError('Nickname: 3–20 caracteres (a-z, 0-9, _).')
        return
      }
      const result = await onRegister({
        name,
        password,
        nickname: normalizeNickname(nickname),
      })
      setLoading(false)
      if (!result.ok) setError(result.error)
      return
    }

    const result = await onLogin({ name, password })
    setLoading(false)
    if (!result.ok) setError(result.error)
  }

  function switchMode(next: AuthMode) {
    setMode(next)
    setError('')
  }

  return (
    <div className="auth-screen">
      <header className="hero hero-auth">
        <p className="brand">MID3</p>
        <h1>Career</h1>
        <p className="tagline">
          Ranking, torneios e sets avulsos — tudo claro, no mesmo lugar.
        </p>
      </header>

      <section className="panel auth-panel">
        <div className="auth-tabs" role="tablist" aria-label="Acesso">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            className={mode === 'login' ? 'active' : ''}
            onClick={() => switchMode('login')}
          >
            Entrar
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'register'}
            className={mode === 'register' ? 'active' : ''}
            onClick={() => switchMode('register')}
          >
            Criar conta
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === 'register' ? (
            <>
              <label>
                <span>Nome</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Como aparece no ranking"
                  autoComplete="name"
                  required
                  maxLength={32}
                  autoFocus
                />
              </label>
              <label>
                <span>Nickname</span>
                <input
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="ex: renato_bh"
                  autoComplete="username"
                  required
                  maxLength={20}
                />
              </label>
            </>
          ) : (
            <label>
              <span>Nickname ou nome</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nickname ou nome"
                autoComplete="username"
                required
                maxLength={32}
                autoFocus
              />
            </label>
          )}

          <label>
            <span>Senha</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={
                mode === 'login' ? 'current-password' : 'new-password'
              }
              required
              minLength={6}
            />
          </label>

          {error ? <p className="form-error">{error}</p> : null}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading
              ? 'Aguarde…'
              : mode === 'login'
                ? 'Entrar'
                : 'Criar conta'}
          </button>
        </form>
      </section>
    </div>
  )
}
