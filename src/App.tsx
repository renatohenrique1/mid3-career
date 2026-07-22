import { AuthScreen } from './components/AuthScreen'
import { AppShell } from './components/AppShell'
import { NicknameSetup } from './components/NicknameSetup'
import { useAppData } from './data/useAppData'
import { needsNicknameSetup } from './data/profile'
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
    updateProfile,
    requestMatchEdit,
    withdrawMatchEdit,
    resolveMatchEdit,
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
      ) : needsNicknameSetup(currentUser) ? (
        <NicknameSetup name={currentUser.name} onSave={updateProfile} />
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
          onUpdateProfile={updateProfile}
          onRequestMatchEdit={requestMatchEdit}
          onWithdrawMatchEdit={withdrawMatchEdit}
          onResolveMatchEdit={resolveMatchEdit}
        />
      )}
    </div>
  )
}
