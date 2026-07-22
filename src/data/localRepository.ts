import type { AppData, Match, TournamentFormat } from '../types'
import type {
  AuthResult,
  DataRepository,
  MutationOk,
  TournamentResult,
} from './repository'
import {
  addMatch,
  autoFinishDueTournaments,
  createTournament,
  deleteMatch,
  finishTournament,
  joinTournament,
  loadData,
  loadSession,
  loginUser,
  logoutUser,
  registerUser,
  saveSession,
} from './storage'

export const localRepository: DataRepository = {
  mode: 'local',

  async bootstrap() {
    autoFinishDueTournaments()
    const data = loadData()
    const session = loadSession()
    return { data, userId: session?.userId ?? null }
  },

  async register(input) {
    return registerUser(input)
  },

  async login(input) {
    return loginUser(input)
  },

  async logout() {
    logoutUser()
  },

  async createTournament(input) {
    return createTournament(input)
  },

  async joinTournament(tournamentId, userId) {
    return joinTournament(tournamentId, userId)
  },

  async finishTournament(tournamentId, requesterId, options) {
    return finishTournament(tournamentId, requesterId, options)
  },

  async addMatch(match) {
    return addMatch(match)
  },

  async deleteMatch(matchId, requesterId) {
    deleteMatch(matchId, requesterId)
    return { ok: true }
  },

  async fetchAll(): Promise<AppData> {
    autoFinishDueTournaments()
    return loadData()
  },
}

/** Mantém sessão local alinhada após login/register local. */
export function ensureLocalSession(userId: string | null) {
  saveSession(userId ? { userId } : null)
}

export type { AuthResult, MutationOk, TournamentResult, TournamentFormat, Match }
