import type {
  AppData,
  Match,
  Tournament,
  TournamentFormat,
  User,
} from '../types'

export type AuthResult =
  | { ok: true; user: User }
  | { ok: false; error: string }

export type MutationOk = { ok: true } | { ok: false; error: string }

export type TournamentResult =
  | { ok: true; tournament: Tournament }
  | { ok: false; error: string }

export interface DataRepository {
  readonly mode: 'local' | 'supabase'
  bootstrap(): Promise<{ data: AppData; userId: string | null }>
  register(input: { name: string; password: string }): Promise<AuthResult>
  login(input: { name: string; password: string }): Promise<AuthResult>
  logout(): Promise<void>
  createTournament(input: {
    name: string
    createdById: string
    format?: TournamentFormat
  }): Promise<TournamentResult>
  joinTournament(
    tournamentId: string,
    userId: string,
  ): Promise<MutationOk>
  finishTournament(
    tournamentId: string,
    requesterId: string,
  ): Promise<TournamentResult>
  addMatch(match: Omit<Match, 'id' | 'createdAt'>): Promise<MutationOk>
  deleteMatch(matchId: string, requesterId: string): Promise<MutationOk>
  /** Recarrega snapshot completo (após mutação ou realtime). */
  fetchAll(): Promise<AppData>
}
