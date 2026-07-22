import type {
  AppData,
  Match,
  MatchEditPayload,
  MatchEditRequest,
  ProfileUpdateInput,
  Tournament,
  TournamentFormat,
  User,
} from '../types'

export type AuthResult =
  | { ok: true; user: User }
  | { ok: false; error: string }

export type MutationOk = { ok: true } | { ok: false; error: string }

export type ProfileResult =
  | { ok: true; user: User }
  | { ok: false; error: string }

export type MatchEditResult =
  | { ok: true; request: MatchEditRequest }
  | { ok: false; error: string }

export type TournamentResult =
  | { ok: true; tournament: Tournament }
  | { ok: false; error: string }

export interface DataRepository {
  readonly mode: 'local' | 'supabase'
  bootstrap(): Promise<{ data: AppData; userId: string | null }>
  register(input: {
    name: string
    password: string
    nickname?: string
  }): Promise<AuthResult>
  login(input: { name: string; password: string }): Promise<AuthResult>
  logout(): Promise<void>
  updateProfile(
    userId: string,
    input: ProfileUpdateInput,
  ): Promise<ProfileResult>
  createTournament(input: {
    name: string
    createdById: string
    format?: TournamentFormat
    structure?: import('../types').TournamentStructure
    startsOn?: string
    endsOn?: string
  }): Promise<TournamentResult>
  joinTournament(
    tournamentId: string,
    userId: string,
  ): Promise<MutationOk>
  finishTournament(
    tournamentId: string,
    requesterId: string,
    options?: { auto?: boolean },
  ): Promise<TournamentResult>
  addMatch(match: Omit<Match, 'id' | 'createdAt'>): Promise<MutationOk>
  deleteMatch(matchId: string, requesterId: string): Promise<MutationOk>
  requestMatchEdit(
    matchId: string,
    requesterId: string,
    payload: MatchEditPayload,
  ): Promise<MatchEditResult>
  withdrawMatchEdit(
    requestId: string,
    requesterId: string,
  ): Promise<MutationOk>
  resolveMatchEdit(
    requestId: string,
    resolverId: string,
    decision: 'approved' | 'rejected',
  ): Promise<MutationOk>
  /** Recarrega snapshot completo (após mutação ou realtime). */
  fetchAll(): Promise<AppData>
}
