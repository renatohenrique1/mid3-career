import type {
  AppData,
  Match,
  Session,
  Tournament,
  User,
} from '../types'
import { hashPassword, nameKey, normalizeName } from './auth'
import { computeRanking } from './ranking'

const DATA_KEY = 'mid3-career-data'
const SESSION_KEY = 'mid3-career-session'
/** One-shot wipe: remove dados legados na próxima abertura do app. */
const WIPE_KEY = 'mid3-career-wipe-2026-07-21'

const EMPTY_DATA: AppData = { users: [], tournaments: [], matches: [] }

function wipeLegacyIfNeeded(): void {
  if (typeof localStorage === 'undefined') return
  if (localStorage.getItem(WIPE_KEY) === '1') return
  localStorage.removeItem(DATA_KEY)
  localStorage.removeItem(SESSION_KEY)
  localStorage.setItem(WIPE_KEY, '1')
}

export function clearAllData(): void {
  localStorage.removeItem(DATA_KEY)
  localStorage.removeItem(SESSION_KEY)
}

function migrate(raw: unknown): AppData {
  if (!raw || typeof raw !== 'object') return EMPTY_DATA
  const data = raw as Record<string, unknown>

  if (Array.isArray(data.players) && !Array.isArray(data.users)) {
    return EMPTY_DATA
  }

  if (!Array.isArray(data.users)) return EMPTY_DATA

  const tournaments = Array.isArray(data.tournaments)
    ? (data.tournaments as Tournament[]).map((t) => ({
        ...t,
        status: t.status ?? 'active',
        participantIds: t.participantIds ?? [],
        format: t.format ?? 'classic',
      }))
    : []

  const matches = Array.isArray(data.matches)
    ? (data.matches as Match[]).map((m) => ({
        ...m,
        tournamentId: m.tournamentId ?? null,
      }))
    : []

  return {
    users: data.users as User[],
    tournaments,
    matches,
  }
}

export function loadData(): AppData {
  try {
    wipeLegacyIfNeeded()
    const raw = localStorage.getItem(DATA_KEY)
    if (!raw) return EMPTY_DATA
    return migrate(JSON.parse(raw))
  } catch {
    return EMPTY_DATA
  }
}

export function saveData(data: AppData): void {
  localStorage.setItem(DATA_KEY, JSON.stringify(data))
}

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const session = JSON.parse(raw) as Session
    if (!session?.userId) return null
    const data = loadData()
    return data.users.some((u) => u.id === session.userId) ? session : null
  } catch {
    return null
  }
}

export function saveSession(session: Session | null): void {
  if (!session) {
    localStorage.removeItem(SESSION_KEY)
    return
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export async function registerUser(input: {
  name: string
  password: string
}): Promise<{ ok: true; user: User } | { ok: false; error: string }> {
  const name = normalizeName(input.name)
  const password = input.password
  const key = nameKey(name)

  if (name.length < 2) return { ok: false, error: 'Nome muito curto.' }
  if (password.length < 4) {
    return { ok: false, error: 'Senha precisa ter ao menos 4 caracteres.' }
  }

  const data = loadData()
  if (
    data.users.some(
      (u) => nameKey(u.name) === key || u.username.toLowerCase() === key,
    )
  ) {
    return { ok: false, error: 'Já existe uma conta com esse nome.' }
  }

  const user: User = {
    id: crypto.randomUUID(),
    name,
    username: key,
    passwordHash: await hashPassword(password, key),
    createdAt: new Date().toISOString(),
  }

  saveData({ ...data, users: [...data.users, user] })
  saveSession({ userId: user.id })
  return { ok: true, user }
}

export async function loginUser(input: {
  name: string
  password: string
}): Promise<{ ok: true; user: User } | { ok: false; error: string }> {
  const key = nameKey(input.name)
  const data = loadData()
  const user = data.users.find(
    (u) => nameKey(u.name) === key || u.username.toLowerCase() === key,
  )

  if (!user) return { ok: false, error: 'Nome ou senha inválidos.' }

  const candidates = Array.from(
    new Set([user.username.toLowerCase(), nameKey(user.name), key]),
  )
  let matched = false
  for (const salt of candidates) {
    const passwordHash = await hashPassword(input.password, salt)
    if (passwordHash === user.passwordHash) {
      matched = true
      break
    }
  }

  if (!matched) return { ok: false, error: 'Nome ou senha inválidos.' }

  saveSession({ userId: user.id })
  return { ok: true, user }
}

export function logoutUser(): void {
  saveSession(null)
}

export function createTournament(input: {
  name: string
  createdById: string
  format?: import('../types').TournamentFormat
}): { ok: true; tournament: Tournament } | { ok: false; error: string } {
  const name = input.name.trim()
  if (name.length < 2) return { ok: false, error: 'Nome do torneio muito curto.' }

  const format = input.format ?? 'classic'
  const allowed = [
    'classic',
    'tb',
    'fh',
    'bh',
    'fifteen_forty',
  ] as const
  if (!allowed.includes(format as (typeof allowed)[number])) {
    return { ok: false, error: 'Formato de torneio inválido.' }
  }

  const data = loadData()
  const tournament: Tournament = {
    id: crypto.randomUUID(),
    name,
    createdById: input.createdById,
    createdAt: new Date().toISOString(),
    participantIds: [input.createdById],
    status: 'active',
    format,
  }

  saveData({ ...data, tournaments: [tournament, ...data.tournaments] })
  return { ok: true, tournament }
}

export function joinTournament(
  tournamentId: string,
  userId: string,
): { ok: true } | { ok: false; error: string } {
  const data = loadData()
  const tournament = data.tournaments.find((t) => t.id === tournamentId)
  if (!tournament) return { ok: false, error: 'Torneio não encontrado.' }
  if (tournament.status === 'finished') {
    return { ok: false, error: 'Este torneio já foi encerrado.' }
  }

  if (tournament.participantIds.includes(userId)) {
    return { ok: true }
  }

  const nextTournaments = data.tournaments.map((t) =>
    t.id === tournamentId
      ? { ...t, participantIds: [...t.participantIds, userId] }
      : t,
  )
  saveData({ ...data, tournaments: nextTournaments })
  return { ok: true }
}

export function finishTournament(
  tournamentId: string,
  requesterId: string,
): { ok: true; tournament: Tournament } | { ok: false; error: string } {
  const data = loadData()
  const tournament = data.tournaments.find((t) => t.id === tournamentId)
  if (!tournament) return { ok: false, error: 'Torneio não encontrado.' }
  if (tournament.status === 'finished') {
    return { ok: false, error: 'Torneio já encerrado.' }
  }
  if (tournament.createdById !== requesterId) {
    return { ok: false, error: 'Só quem criou o torneio pode encerrar.' }
  }

  const tournamentMatches = data.matches.filter(
    (m) => m.tournamentId === tournamentId,
  )
  if (tournamentMatches.length === 0) {
    return { ok: false, error: 'Registre ao menos um set antes de encerrar.' }
  }

  const participants = data.users.filter((u) =>
    tournament.participantIds.includes(u.id),
  )
  const ranking = computeRanking(
    participants,
    tournamentMatches,
    tournament.format ?? 'classic',
  )
  const winnerId = ranking.find((r) => r.played > 0)?.playerId

  if (!winnerId) {
    return { ok: false, error: 'Não foi possível definir um vencedor.' }
  }

  const finished: Tournament = {
    ...tournament,
    status: 'finished',
    winnerId,
    finishedAt: new Date().toISOString(),
  }

  const nextTournaments = data.tournaments.map((t) =>
    t.id === tournamentId ? finished : t,
  )
  saveData({ ...data, tournaments: nextTournaments })
  return { ok: true, tournament: finished }
}

export function addMatch(match: Omit<Match, 'id' | 'createdAt'>): AppData {
  const data = loadData()

  const nextMatch: Match = {
    ...match,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  }

  // Set avulso: só grava a partida.
  if (!match.tournamentId) {
    const next = { ...data, matches: [nextMatch, ...data.matches] }
    saveData(next)
    return next
  }

  const tournament = data.tournaments.find((t) => t.id === match.tournamentId)
  if (!tournament) return data
  if (tournament.status === 'finished') return data

  const participantIds = new Set(tournament.participantIds)
  participantIds.add(match.playerAId)
  participantIds.add(match.playerBId)

  const nextTournaments = data.tournaments.map((t) =>
    t.id === match.tournamentId
      ? { ...t, participantIds: [...participantIds] }
      : t,
  )

  const next = {
    ...data,
    tournaments: nextTournaments,
    matches: [nextMatch, ...data.matches],
  }
  saveData(next)
  return next
}

export function deleteMatch(matchId: string, requesterId: string): AppData {
  const data = loadData()
  const next = {
    ...data,
    matches: data.matches.filter(
      (m) => !(m.id === matchId && m.recordedById === requesterId),
    ),
  }
  saveData(next)
  return next
}
