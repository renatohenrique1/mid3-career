export type Surface = 'hard' | 'clay'

export type BallBrand =
  | 'inni_tournament'
  | 'inni_clay'
  | 'wilson_rg'
  | 'wilson_us_open'

export type RacketModel =
  | 'wilson_blade_98'
  | 'yonex_ezone_98'
  | 'yonex_vcore_95'

export type AvatarId = 'ball' | 'racket' | 'crossed' | 'initial'

export type BackhandType = 'one_handed' | 'two_handed'

export type UserId = string
export type TournamentId = string

export interface User {
  id: UserId
  /** Nome de exibição */
  name: string
  /** Login imutável (chave do e-mail sintético) */
  username: string
  /** Apelido único (@) — obrigatório após onboarding */
  nickname: string | null
  passwordHash: string
  createdAt: string
  nameChangesUsed: number
  nameChangesMax: number
  nicknameChangedAt: string | null
  avatarId: AvatarId
  heightCm: number | null
  age: number | null
  backhand: BackhandType | null
  rackets: RacketModel[]
  primaryRacket: RacketModel | null
}

export type TournamentStatus = 'active' | 'finished'

/** Um formato por torneio — define regra de jogo e pontuação. */
export type TournamentFormat =
  | 'classic'
  | 'tb'
  | 'fh'
  | 'bh'
  | 'fifteen_forty'

/** Estrutura da competição. */
export type TournamentStructure =
  | 'round_robin'
  | 'points_league'
  | 'round_robin_double'

export interface Tournament {
  id: TournamentId
  name: string
  createdById: UserId
  createdAt: string
  participantIds: UserId[]
  status: TournamentStatus
  /** Regra do torneio (legado sem campo = classic) */
  format: TournamentFormat
  /**
   * classic: round_robin | points_league
   * outros formatos: round_robin_double (2 jogos entre cada par)
   */
  structure?: TournamentStructure
  /** YYYY-MM-DD */
  startsOn?: string
  /** YYYY-MM-DD */
  endsOn?: string
  winnerId?: UserId
  finishedAt?: string
}

export interface Match {
  id: string
  /** null = set avulso (fora de torneio) */
  tournamentId: TournamentId | null
  date: string
  surface: Surface
  playerAId: UserId
  playerBId: UserId
  gamesA: number
  gamesB: number
  /** minutos totais de aquecimento + set (opcional) */
  durationMinutes?: number | null
  /** bola usada (opcional) */
  ball?: BallBrand | null
  racketA?: RacketModel | null
  racketB?: RacketModel | null
  createdAt: string
  recordedById: UserId
}

export type MatchEditStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'withdrawn'

/** Campos editáveis de um set (pedido de alteração). */
export type MatchEditPayload = {
  date: string
  surface: Surface
  playerAId: UserId
  playerBId: UserId
  gamesA: number
  gamesB: number
  durationMinutes?: number | null
  ball?: BallBrand | null
  racketA?: RacketModel | null
  racketB?: RacketModel | null
}

export interface MatchEditRequest {
  id: string
  matchId: string
  requestedById: UserId
  status: MatchEditStatus
  payload: MatchEditPayload
  createdAt: string
  resolvedAt?: string
  resolvedById?: UserId
}

export interface PlayerStats {
  playerId: UserId
  name: string
  played: number
  wins: number
  losses: number
  points: number
  gamesFor: number
  gamesAgainst: number
  winRate: number
}

export interface AppData {
  users: User[]
  tournaments: Tournament[]
  matches: Match[]
  matchEditRequests: MatchEditRequest[]
}

export interface Session {
  userId: UserId
}

export type AppArea =
  | 'feed'
  | 'ranking'
  | 'stats'
  | 'tournaments'
  | 'sets'
  | 'profile'

export interface CareerStats {
  playerId: UserId
  name: string
  username: string
  setWins: number
  setLosses: number
  setPlayed: number
  titles: number
  gamesFor: number
  gamesAgainst: number
  gameDiff: number
  winRate: number
}

export interface H2HRecord {
  playerAId: UserId
  playerBId: UserId
  winsA: number
  winsB: number
  played: number
  gamesForA: number
  gamesForB: number
}

export type FeedItem =
  | {
      id: string
      kind: 'casual_set'
      at: string
      match: Match
    }
  | {
      id: string
      kind: 'tournament_set'
      at: string
      match: Match
      tournament: Tournament
    }
  | {
      id: string
      kind: 'tournament_won'
      at: string
      tournament: Tournament
      winnerId: UserId
    }

export type ProfileUpdateInput = {
  name?: string
  nickname?: string
  avatarId?: AvatarId
  heightCm?: number | null
  age?: number | null
  backhand?: BackhandType | null
  rackets?: RacketModel[]
  primaryRacket?: RacketModel | null
}
