export type Surface = 'hard' | 'clay'

export type BallBrand =
  | 'inni_tournament'
  | 'inni_clay'
  | 'wilson_rg'
  | 'wilson_us_open'

export type UserId = string
export type TournamentId = string

export interface User {
  id: UserId
  name: string
  username: string
  passwordHash: string
  createdAt: string
}

export type TournamentStatus = 'active' | 'finished'

/** Um formato por torneio — define regra de jogo e pontuação. */
export type TournamentFormat =
  | 'classic'
  | 'tb'
  | 'fh'
  | 'bh'
  | 'fifteen_forty'

export interface Tournament {
  id: TournamentId
  name: string
  createdById: UserId
  createdAt: string
  participantIds: UserId[]
  status: TournamentStatus
  /** Regra do torneio (legado sem campo = classic) */
  format: TournamentFormat
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
  createdAt: string
  recordedById: UserId
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
}

export interface Session {
  userId: UserId
}

export type AppArea = 'feed' | 'ranking' | 'stats' | 'tournaments' | 'sets'

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
