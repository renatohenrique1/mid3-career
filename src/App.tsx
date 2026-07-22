import { AuthScreen } from './components/AuthScreen'
import { AppShell } from './components/AppShell'
import { useAppData } from './data/useAppData'
import './App.css'

export default function App() {
  const {
    data,
    currentUser,
    booting,
    backendMode,
    register,
    login,
    logout,
    createTournament,
    joinTournament,
    finishTournament,
    recordMatch,
    removeMatch,
  } = useAppData()

  if (booting) {
    return (
      <div className="app">
        <div className="atmosphere" aria-hidden />
        <div className="boot-screen">
          <p className="brand">MID3</p>
          <p>Carregando…</p>
          <p className="boot-mode">
            Backend: {backendMode === 'supabase' ? 'Supabase' : 'local'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <div className="atmosphere" aria-hidden />

      {!currentUser ? (
        <AuthScreen onLogin={login} onRegister={register} />
      ) : (
        <AppShell
          data={data}
          currentUser={currentUser}
          onLogout={logout}
          onCreateTournament={createTournament}
          onJoinTournament={joinTournament}
          onFinishTournament={finishTournament}
          onRecordMatch={recordMatch}
          onDeleteMatch={removeMatch}
        />
      )}
    </div>
  )
}
