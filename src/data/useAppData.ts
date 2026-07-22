import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import type {
  AppData,
  Match,
  MatchEditPayload,
  ProfileUpdateInput,
  Session,
  Tournament,
  User,
} from '../types'
import { getBackendMode, getRepository } from './backend'

const EMPTY: AppData = {
  users: [],
  tournaments: [],
  matches: [],
  matchEditRequests: [],
}

let dataSnapshot: AppData = EMPTY
let sessionSnapshot: Session | null = null
let readySnapshot = false
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

async function refreshFromRepo() {
  const repo = getRepository()
  dataSnapshot = await repo.fetchAll()
  emit()
}

export function useAppData() {
  const [booting, setBooting] = useState(!readySnapshot)

  const data = useSyncExternalStore(
    subscribe,
    () => dataSnapshot,
    () => dataSnapshot,
  )
  const session = useSyncExternalStore(
    subscribe,
    () => sessionSnapshot,
    () => sessionSnapshot,
  )
  const ready = useSyncExternalStore(
    subscribe,
    () => readySnapshot,
    () => readySnapshot,
  )

  useEffect(() => {
    let cancelled = false

    async function boot() {
      try {
        const repo = getRepository()
        const { data: nextData, userId } = await repo.bootstrap()
        if (cancelled) return
        dataSnapshot = nextData
        sessionSnapshot = userId ? { userId } : null
        readySnapshot = true
        setBooting(false)
        emit()
      } catch (err) {
        console.error('Falha ao iniciar dados', err)
        if (cancelled) return
        dataSnapshot = EMPTY
        sessionSnapshot = null
        readySnapshot = true
        setBooting(false)
        emit()
      }
    }

    if (!readySnapshot) {
      void boot()
    } else {
      setBooting(false)
    }

    return () => {
      cancelled = true
    }
  }, [])

  const currentUser: User | null =
    data.users.find((u) => u.id === session?.userId) ?? null

  const register = useCallback(
    async (input: { name: string; password: string; nickname?: string }) => {
      const repo = getRepository()
      const result = await repo.register(input)
      if (result.ok) {
        sessionSnapshot = { userId: result.user.id }
        await refreshFromRepo()
      }
      return result
    },
    [],
  )

  const login = useCallback(
    async (input: { name: string; password: string }) => {
      const repo = getRepository()
      const result = await repo.login(input)
      if (result.ok) {
        sessionSnapshot = { userId: result.user.id }
        await refreshFromRepo()
      }
      return result
    },
    [],
  )

  const logout = useCallback(async () => {
    await getRepository().logout()
    sessionSnapshot = null
    await refreshFromRepo()
  }, [])

  const create = useCallback(
    async (
      name: string,
      format?: import('../types').TournamentFormat,
      options?: {
        structure?: import('../types').TournamentStructure
        startsOn?: string
        endsOn?: string
      },
    ): Promise<{ ok: true; tournament: Tournament } | { ok: false; error: string }> => {
      if (!sessionSnapshot?.userId) {
        return { ok: false, error: 'Faça login para criar um torneio.' }
      }
      const result = await getRepository().createTournament({
        name,
        createdById: sessionSnapshot.userId,
        format,
        structure: options?.structure,
        startsOn: options?.startsOn,
        endsOn: options?.endsOn,
      })
      if (result.ok) await refreshFromRepo()
      return result
    },
    [],
  )

  const join = useCallback(async (tournamentId: string) => {
    if (!sessionSnapshot?.userId) {
      return { ok: false as const, error: 'Faça login para participar.' }
    }
    const result = await getRepository().joinTournament(
      tournamentId,
      sessionSnapshot.userId,
    )
    if (result.ok) await refreshFromRepo()
    return result
  }, [])

  const finish = useCallback(async (tournamentId: string) => {
    if (!sessionSnapshot?.userId) {
      return { ok: false as const, error: 'Faça login para encerrar.' }
    }
    const result = await getRepository().finishTournament(
      tournamentId,
      sessionSnapshot.userId,
    )
    if (result.ok) await refreshFromRepo()
    return result
  }, [])

  const recordMatch = useCallback(
    async (match: Omit<Match, 'id' | 'createdAt'>) => {
      const result = await getRepository().addMatch(match)
      if (!result.ok) {
        alert(result.error)
        return
      }
      await refreshFromRepo()
    },
    [],
  )

  const removeMatch = useCallback(async (matchId: string) => {
    if (!sessionSnapshot?.userId) return
    const result = await getRepository().deleteMatch(
      matchId,
      sessionSnapshot.userId,
    )
    if (!result.ok) {
      alert(result.error)
      return
    }
    await refreshFromRepo()
  }, [])

  const updateProfile = useCallback(
    async (input: ProfileUpdateInput) => {
      if (!sessionSnapshot?.userId) {
        return { ok: false as const, error: 'Faça login para editar o perfil.' }
      }
      const result = await getRepository().updateProfile(
        sessionSnapshot.userId,
        input,
      )
      if (result.ok) await refreshFromRepo()
      return result
    },
    [],
  )

  const requestMatchEdit = useCallback(
    async (matchId: string, payload: MatchEditPayload) => {
      if (!sessionSnapshot?.userId) {
        return { ok: false as const, error: 'Faça login para solicitar edição.' }
      }
      const result = await getRepository().requestMatchEdit(
        matchId,
        sessionSnapshot.userId,
        payload,
      )
      if (result.ok) await refreshFromRepo()
      return result
    },
    [],
  )

  const withdrawMatchEdit = useCallback(async (requestId: string) => {
    if (!sessionSnapshot?.userId) {
      return { ok: false as const, error: 'Faça login para retirar o pedido.' }
    }
    const result = await getRepository().withdrawMatchEdit(
      requestId,
      sessionSnapshot.userId,
    )
    if (result.ok) await refreshFromRepo()
    return result
  }, [])

  const resolveMatchEdit = useCallback(
    async (requestId: string, decision: 'approved' | 'rejected') => {
      if (!sessionSnapshot?.userId) {
        return { ok: false as const, error: 'Faça login para responder o pedido.' }
      }
      const result = await getRepository().resolveMatchEdit(
        requestId,
        sessionSnapshot.userId,
        decision,
      )
      if (result.ok) await refreshFromRepo()
      return result
    },
    [],
  )

  return {
    data: data as AppData,
    session: session as Session | null,
    currentUser,
    booting: booting || !ready,
    backendMode: getBackendMode(),
    register,
    login,
    logout,
    createTournament: create,
    joinTournament: join,
    finishTournament: finish,
    recordMatch,
    removeMatch,
    updateProfile,
    requestMatchEdit,
    withdrawMatchEdit,
    resolveMatchEdit,
  }
}
