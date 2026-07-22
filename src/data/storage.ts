import type {
  AppData,
  Match,
  MatchEditPayload,
  MatchEditRequest,
  ProfileUpdateInput,
  Session,
  Tournament,
  User,
} from '../types'
import { hashPassword, nameKey, normalizeName } from './auth'
import {
  isValidNickname,
  nameChangesLeft,
  nicknameCooldownMs,
  normalizeNickname,
} from './profile'
import {
  computeRanking,
  shouldAutoFinishTournament,
  tournamentMatchDateError,
  tournamentPairLimitError,
} from './ranking'

const DATA_KEY = 'mid3-career-data'
const SESSION_KEY = 'mid3-career-session'
/** One-shot wipe: remove dados legados na próxima abertura do app. */
const WIPE_KEY = 'mid3-career-wipe-2026-07-21'

const EMPTY_DATA: AppData = {
  users: [],
  tournaments: [],
  matches: [],
  matchEditRequests: [],
}

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
        structure: t.structure,
        startsOn: t.startsOn,
        endsOn: t.endsOn,
      }))
    : []

  const users = (data.users as User[]).map((u) => ({
    ...u,
    nickname: u.nickname ?? null,
    nameChangesUsed: u.nameChangesUsed ?? 0,
    nameChangesMax: u.nameChangesMax ?? 3,
    nicknameChangedAt: u.nicknameChangedAt ?? null,
    avatarId: u.avatarId ?? 'initial',
    heightCm: u.heightCm ?? null,
    age: u.age ?? null,
    backhand: u.backhand ?? null,
    rackets: u.rackets ?? [],
    primaryRacket: u.primaryRacket ?? null,
  }))

  const matches = Array.isArray(data.matches)
    ? (data.matches as Match[]).map((m) => ({
        ...m,
        tournamentId: m.tournamentId ?? null,
        racketA: m.racketA ?? null,
        racketB: m.racketB ?? null,
      }))
    : []

  const matchEditRequests = Array.isArray(data.matchEditRequests)
    ? (data.matchEditRequests as MatchEditRequest[])
    : []

  return {
    users,
    tournaments,
    matches,
    matchEditRequests,
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
  nickname?: string
}): Promise<{ ok: true; user: User } | { ok: false; error: string }> {
  const name = normalizeName(input.name)
  const password = input.password
  const key = nameKey(name)
  const rawNickname = input.nickname?.trim()
  const nickname = rawNickname ? normalizeNickname(rawNickname) : null

  if (name.length < 2) return { ok: false, error: 'Nome muito curto.' }
  if (password.length < 4) {
    return { ok: false, error: 'Senha precisa ter ao menos 4 caracteres.' }
  }
  if (nickname && !isValidNickname(nickname)) {
    return {
      ok: false,
      error: 'Apelido inválido. Use 3–20 letras minúsculas, números ou _.',
    }
  }

  const data = loadData()
  if (
    data.users.some(
      (u) => nameKey(u.name) === key || u.username.toLowerCase() === key,
    )
  ) {
    return { ok: false, error: 'Já existe uma conta com esse nome.' }
  }
  if (
    nickname &&
    data.users.some((u) => u.nickname?.toLowerCase() === nickname)
  ) {
    return { ok: false, error: 'Esse apelido já está em uso.' }
  }

  const now = new Date().toISOString()
  const user: User = {
    id: crypto.randomUUID(),
    name,
    username: key,
    nickname,
    passwordHash: await hashPassword(password, key),
    createdAt: now,
    nameChangesUsed: 0,
    nameChangesMax: 2,
    nicknameChangedAt: nickname ? now : null,
    avatarId: 'initial',
    heightCm: null,
    age: null,
    backhand: null,
    rackets: [],
    primaryRacket: null,
  }

  saveData({ ...data, users: [...data.users, user] })
  saveSession({ userId: user.id })
  return { ok: true, user }
}

export async function loginUser(input: {
  name: string
  password: string
}): Promise<{ ok: true; user: User } | { ok: false; error: string }> {
  const identifier = input.name
  const key = nameKey(identifier)
  const nick = normalizeNickname(identifier)
  const data = loadData()
  const user = data.users.find(
    (u) =>
      nameKey(u.name) === key ||
      u.username.toLowerCase() === key ||
      (u.nickname && u.nickname.toLowerCase() === nick),
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

export function updateProfile(
  userId: string,
  input: ProfileUpdateInput,
): { ok: true; user: User } | { ok: false; error: string } {
  const data = loadData()
  const user = data.users.find((u) => u.id === userId)
  if (!user) return { ok: false, error: 'Usuário não encontrado.' }

  const next: User = { ...user }

  if (input.name !== undefined) {
    const name = normalizeName(input.name)
    if (name.length < 2) return { ok: false, error: 'Nome muito curto.' }
    if (name !== user.name) {
      if (nameChangesLeft(user) <= 0) {
        return {
          ok: false,
          error: 'Você já usou todas as trocas de nome disponíveis.',
        }
      }
      next.name = name
      next.nameChangesUsed = user.nameChangesUsed + 1
    }
  }

  if (input.nickname !== undefined) {
    const nickname = normalizeNickname(input.nickname)
    if (!isValidNickname(nickname)) {
      return {
        ok: false,
        error: 'Apelido inválido. Use 3–20 letras minúsculas, números ou _.',
      }
    }
    if (nickname !== user.nickname) {
      const isFirstSetup = !user.nickname
      if (!isFirstSetup && nicknameCooldownMs(user) > 0) {
        return {
          ok: false,
          error: 'Aguarde o prazo para trocar de apelido novamente.',
        }
      }
      const dupe = data.users.some(
        (u) =>
          u.id !== userId && u.nickname?.toLowerCase() === nickname,
      )
      if (dupe) return { ok: false, error: 'Esse apelido já está em uso.' }
      next.nickname = nickname
      next.nicknameChangedAt = new Date().toISOString()
    }
  }

  if (input.avatarId !== undefined) next.avatarId = input.avatarId
  if (input.heightCm !== undefined) next.heightCm = input.heightCm
  if (input.age !== undefined) next.age = input.age
  if (input.backhand !== undefined) next.backhand = input.backhand
  if (input.rackets !== undefined) next.rackets = input.rackets
  if (input.primaryRacket !== undefined) {
    next.primaryRacket = input.primaryRacket
  }

  const rackets = next.rackets ?? []
  if (next.primaryRacket && !rackets.includes(next.primaryRacket)) {
    return {
      ok: false,
      error: 'A raquete principal precisa estar na sua lista de raquetes.',
    }
  }

  const nextUsers = data.users.map((u) => (u.id === userId ? next : u))
  saveData({ ...data, users: nextUsers })
  return { ok: true, user: next }
}

export function requestMatchEdit(
  matchId: string,
  requesterId: string,
  payload: MatchEditPayload,
): { ok: true; request: MatchEditRequest } | { ok: false; error: string } {
  const data = loadData()
  const match = data.matches.find((m) => m.id === matchId)
  if (!match) return { ok: false, error: 'Set não encontrado.' }
  if (match.playerAId !== requesterId && match.playerBId !== requesterId) {
    return { ok: false, error: 'Você não participou deste set.' }
  }

  const hasPending = data.matchEditRequests.some(
    (r) => r.matchId === matchId && r.status === 'pending',
  )
  if (hasPending) {
    return {
      ok: false,
      error: 'Já existe uma solicitação de edição pendente para este set.',
    }
  }

  const request: MatchEditRequest = {
    id: crypto.randomUUID(),
    matchId,
    requestedById: requesterId,
    status: 'pending',
    payload,
    createdAt: new Date().toISOString(),
  }

  saveData({
    ...data,
    matchEditRequests: [request, ...data.matchEditRequests],
  })
  return { ok: true, request }
}

export function withdrawMatchEdit(
  requestId: string,
  requesterId: string,
): { ok: true } | { ok: false; error: string } {
  const data = loadData()
  const request = data.matchEditRequests.find((r) => r.id === requestId)
  if (!request) return { ok: false, error: 'Solicitação não encontrada.' }
  if (request.requestedById !== requesterId) {
    return { ok: false, error: 'Só quem solicitou pode retirar o pedido.' }
  }
  if (request.status !== 'pending') {
    return { ok: false, error: 'Esta solicitação já foi resolvida.' }
  }

  const nextRequests = data.matchEditRequests.map((r) =>
    r.id === requestId ? { ...r, status: 'withdrawn' as const } : r,
  )
  saveData({ ...data, matchEditRequests: nextRequests })
  return { ok: true }
}

export function resolveMatchEdit(
  requestId: string,
  resolverId: string,
  decision: 'approved' | 'rejected',
): { ok: true } | { ok: false; error: string } {
  const data = loadData()
  const request = data.matchEditRequests.find((r) => r.id === requestId)
  if (!request) return { ok: false, error: 'Solicitação não encontrada.' }
  if (request.status !== 'pending') {
    return { ok: false, error: 'Esta solicitação já foi resolvida.' }
  }

  const match = data.matches.find((m) => m.id === request.matchId)
  if (!match) return { ok: false, error: 'Set não encontrado.' }

  const otherPlayerId =
    match.playerAId === request.requestedById
      ? match.playerBId
      : match.playerAId
  if (resolverId !== otherPlayerId) {
    return {
      ok: false,
      error: 'Só o outro participante do set pode responder a este pedido.',
    }
  }

  const resolvedAt = new Date().toISOString()
  const nextRequests = data.matchEditRequests.map((r) =>
    r.id === requestId
      ? { ...r, status: decision, resolvedAt, resolvedById: resolverId }
      : r,
  )

  const nextMatches =
    decision === 'approved'
      ? data.matches.map((m) =>
          m.id === request.matchId ? { ...m, ...request.payload } : m,
        )
      : data.matches

  saveData({
    ...data,
    matchEditRequests: nextRequests,
    matches: nextMatches,
  })
  return { ok: true }
}

export function createTournament(input: {
  name: string
  createdById: string
  format?: import('../types').TournamentFormat
  structure?: import('../types').TournamentStructure
  startsOn?: string
  endsOn?: string
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

  let structure: import('../types').TournamentStructure | undefined
  let startsOn: string | undefined
  let endsOn: string | undefined

  startsOn = input.startsOn?.trim()
  endsOn = input.endsOn?.trim()
  if (!startsOn || !endsOn) {
    return { ok: false, error: 'Informe data de início e de fim.' }
  }
  if (endsOn < startsOn) {
    return { ok: false, error: 'A data de fim deve ser após o início.' }
  }

  if (format === 'classic') {
    if (
      input.structure !== 'round_robin' &&
      input.structure !== 'points_league'
    ) {
      return {
        ok: false,
        error: 'Escolha a estrutura: todos contra todos ou liga por pontos.',
      }
    }
    structure = input.structure
  } else {
    structure = 'round_robin_double'
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
    structure,
    startsOn,
    endsOn,
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
  options?: { auto?: boolean },
): { ok: true; tournament: Tournament } | { ok: false; error: string } {
  const data = loadData()
  const tournament = data.tournaments.find((t) => t.id === tournamentId)
  if (!tournament) return { ok: false, error: 'Torneio não encontrado.' }
  if (tournament.status === 'finished') {
    return { ok: false, error: 'Torneio já encerrado.' }
  }
  if (!options?.auto && tournament.createdById !== requesterId) {
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

function tryAutoFinishTournament(tournamentId: string): void {
  const data = loadData()
  const tournament = data.tournaments.find((t) => t.id === tournamentId)
  if (!tournament || tournament.status === 'finished') return

  const tournamentMatches = data.matches.filter(
    (m) => m.tournamentId === tournamentId,
  )
  const participants = data.users.filter((u) =>
    tournament.participantIds.includes(u.id),
  )

  if (
    !shouldAutoFinishTournament(tournament, participants, tournamentMatches)
  ) {
    return
  }

  finishTournament(tournamentId, tournament.createdById, { auto: true })
}

/** Encerra torneios ativos cujo período já passou (ou confrontos completos). */
export function autoFinishDueTournaments(): void {
  const data = loadData()
  for (const tournament of data.tournaments) {
    if (tournament.status !== 'active') continue
    tryAutoFinishTournament(tournament.id)
  }
}

export function addMatch(
  match: Omit<Match, 'id' | 'createdAt'>,
): { ok: true } | { ok: false; error: string } {
  const data = loadData()

  // Set avulso: só grava a partida.
  if (!match.tournamentId) {
    const nextMatch: Match = {
      ...match,
      racketA: match.racketA ?? null,
      racketB: match.racketB ?? null,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    }
    saveData({ ...data, matches: [nextMatch, ...data.matches] })
    return { ok: true }
  }

  const tournament = data.tournaments.find((t) => t.id === match.tournamentId)
  const windowError = tournamentMatchDateError(tournament, match.date)
  if (windowError) return { ok: false, error: windowError }
  if (!tournament) return { ok: false, error: 'Torneio não encontrado.' }

  const tournamentMatches = data.matches.filter(
    (m) => m.tournamentId === match.tournamentId,
  )
  const pairError = tournamentPairLimitError(
    tournament,
    tournamentMatches,
    match.playerAId,
    match.playerBId,
  )
  if (pairError) return { ok: false, error: pairError }

  const nextMatch: Match = {
    ...match,
    racketA: match.racketA ?? null,
    racketB: match.racketB ?? null,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  }

  const participantIds = new Set(tournament.participantIds)
  participantIds.add(match.playerAId)
  participantIds.add(match.playerBId)

  const nextTournaments = data.tournaments.map((t) =>
    t.id === match.tournamentId
      ? { ...t, participantIds: [...participantIds] }
      : t,
  )

  saveData({
    ...data,
    tournaments: nextTournaments,
    matches: [nextMatch, ...data.matches],
  })
  tryAutoFinishTournament(match.tournamentId)
  return { ok: true }
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
