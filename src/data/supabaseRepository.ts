import { computeRanking, normalizeFormat, normalizeStructure, shouldAutoFinishTournament, tournamentMatchDateError, tournamentPairLimitError } from './ranking'
import type {
  AppData,
  AvatarId,
  BackhandType,
  BallBrand,
  Match,
  MatchEditPayload,
  MatchEditRequest,
  MatchEditStatus,
  RacketModel,
  Tournament,
  TournamentFormat,
  TournamentStructure,
  User,
} from '../types'
import { nameKey, normalizeName } from './auth'
import {
  isValidNickname,
  nameChangesLeft,
  nicknameCooldownMs,
  normalizeNickname,
} from './profile'
import { getSupabase, toAuthEmail } from '../lib/supabase'
import type {
  AuthResult,
  DataRepository,
  MatchEditResult,
  MutationOk,
  ProfileResult,
  TournamentResult,
} from './repository'

type ProfileRow = {
  id: string
  name: string
  name_key: string
  nickname: string | null
  name_changes_used: number | null
  name_changes_max: number | null
  nickname_changed_at: string | null
  avatar_id: string | null
  height_cm: number | null
  age: number | null
  backhand: string | null
  rackets: string[] | null
  primary_racket: string | null
  created_at: string
}

type TournamentRow = {
  id: string
  name: string
  created_by_id: string
  created_at: string
  status: 'active' | 'finished'
  format: TournamentFormat
  structure: TournamentStructure | null
  starts_on: string | null
  ends_on: string | null
  winner_id: string | null
  finished_at: string | null
}

type MatchRow = {
  id: string
  tournament_id: string | null
  match_date: string
  surface: 'hard' | 'clay'
  player_a_id: string
  player_b_id: string
  games_a: number
  games_b: number
  duration_minutes: number | null
  ball: string | null
  racket_a: string | null
  racket_b: string | null
  created_at: string
  recorded_by_id: string
}

type MatchEditRequestRow = {
  id: string
  match_id: string
  requested_by_id: string
  status: MatchEditStatus
  payload: MatchEditPayload
  created_at: string
  resolved_at: string | null
  resolved_by_id: string | null
}

function mapUser(row: ProfileRow): User {
  return {
    id: row.id,
    name: row.name,
    username: row.name_key,
    nickname: row.nickname ?? null,
    passwordHash: '',
    createdAt: row.created_at,
    nameChangesUsed: row.name_changes_used ?? 0,
    nameChangesMax: row.name_changes_max ?? 3,
    nicknameChangedAt: row.nickname_changed_at ?? null,
    avatarId: (row.avatar_id as AvatarId | null) ?? 'initial',
    heightCm: row.height_cm ?? null,
    age: row.age ?? null,
    backhand: (row.backhand as BackhandType | null) ?? null,
    rackets: (row.rackets as RacketModel[] | null) ?? [],
    primaryRacket: (row.primary_racket as RacketModel | null) ?? null,
  }
}

function mapTournament(
  row: TournamentRow,
  participantIds: string[],
): Tournament {
  const structure = normalizeStructure(row.structure)
  return {
    id: row.id,
    name: row.name,
    createdById: row.created_by_id,
    createdAt: row.created_at,
    participantIds,
    status: row.status,
    format: normalizeFormat(row.format),
    ...(structure ? { structure } : {}),
    ...(row.starts_on ? { startsOn: row.starts_on } : {}),
    ...(row.ends_on ? { endsOn: row.ends_on } : {}),
    winnerId: row.winner_id ?? undefined,
    finishedAt: row.finished_at ?? undefined,
  }
}

function mapMatch(row: MatchRow): Match {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    date: row.match_date,
    surface: row.surface,
    playerAId: row.player_a_id,
    playerBId: row.player_b_id,
    gamesA: row.games_a,
    gamesB: row.games_b,
    durationMinutes: row.duration_minutes,
    ball: (row.ball as BallBrand | null) ?? null,
    racketA: (row.racket_a as RacketModel | null) ?? null,
    racketB: (row.racket_b as RacketModel | null) ?? null,
    createdAt: row.created_at,
    recordedById: row.recorded_by_id,
  }
}

function mapMatchEditRequest(row: MatchEditRequestRow): MatchEditRequest {
  return {
    id: row.id,
    matchId: row.match_id,
    requestedById: row.requested_by_id,
    status: row.status,
    payload: row.payload,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at ?? undefined,
    resolvedById: row.resolved_by_id ?? undefined,
  }
}

function authErrorMessage(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('already registered') || m.includes('already been registered')) {
    return 'Já existe uma conta com esse nome.'
  }
  if (m.includes('invalid login') || m.includes('invalid credentials')) {
    return 'Nome ou senha inválidos.'
  }
  if (m.includes('password')) {
    return 'Senha inválida. Use ao menos 6 caracteres (exigência do Supabase).'
  }
  return message || 'Falha na autenticação.'
}

/** Escapa valor para uso em filtros `.or()` do PostgREST. */
function escapeOrValue(v: string): string {
  return `"${v.replace(/"/g, '\\"')}"`
}

async function fetchAllData(): Promise<AppData> {
  const sb = getSupabase()

  const [profilesRes, tournamentsRes, partsRes, matchesRes, matchEditsRes] =
    await Promise.all([
      sb.from('profiles').select('*').order('created_at', { ascending: true }),
      sb.from('tournaments').select('*').order('created_at', { ascending: false }),
      sb.from('tournament_participants').select('*'),
      sb.from('matches').select('*').order('created_at', { ascending: false }),
      sb
        .from('match_edit_requests')
        .select('*')
        .order('created_at', { ascending: false }),
    ])

  if (profilesRes.error) throw profilesRes.error
  if (tournamentsRes.error) throw tournamentsRes.error
  if (partsRes.error) throw partsRes.error
  if (matchesRes.error) throw matchesRes.error
  if (matchEditsRes.error) throw matchEditsRes.error

  const participantsByTournament = new Map<string, string[]>()
  for (const row of partsRes.data ?? []) {
    const list = participantsByTournament.get(row.tournament_id) ?? []
    list.push(row.user_id)
    participantsByTournament.set(row.tournament_id, list)
  }

  return {
    users: (profilesRes.data ?? []).map((row) => mapUser(row as ProfileRow)),
    tournaments: (tournamentsRes.data ?? []).map((row) =>
      mapTournament(
        row as TournamentRow,
        participantsByTournament.get(row.id) ?? [],
      ),
    ),
    matches: (matchesRes.data ?? []).map((row) => mapMatch(row as MatchRow)),
    matchEditRequests: (matchEditsRes.data ?? []).map((row) =>
      mapMatchEditRequest(row as MatchEditRequestRow),
    ),
  }
}

export const supabaseRepository: DataRepository = {
  mode: 'supabase',

  async bootstrap() {
    const sb = getSupabase()
    await autoFinishDueSupabaseTournaments()
    const { data: sessionData } = await sb.auth.getSession()
    const userId = sessionData.session?.user.id ?? null
    const data = await fetchAllData()
    return { data, userId }
  },

  async register(input) {
    const name = normalizeName(input.name)
    const key = nameKey(name)
    if (name.length < 2) return { ok: false, error: 'Nome muito curto.' }
    if (input.password.length < 6) {
      return {
        ok: false,
        error: 'Senha precisa ter ao menos 6 caracteres (Supabase).',
      }
    }

    const rawNickname = input.nickname?.trim()
    const nickname = rawNickname ? normalizeNickname(rawNickname) : null
    if (nickname && !isValidNickname(nickname)) {
      return {
        ok: false,
        error: 'Apelido inválido. Use 3–20 letras minúsculas, números ou _.',
      }
    }

    const sb = getSupabase()

    if (nickname) {
      const { data: existing } = await sb
        .from('profiles')
        .select('id')
        .ilike('nickname', nickname)
        .maybeSingle()
      if (existing) return { ok: false, error: 'Esse apelido já está em uso.' }
    }

    const email = toAuthEmail(name)
    const { data, error } = await sb.auth.signUp({
      email,
      password: input.password,
      options: { data: { name, nickname, avatar_id: 'initial' } },
    })

    if (error) return { ok: false, error: authErrorMessage(error.message) }
    if (!data.user) return { ok: false, error: 'Não foi possível criar a conta.' }

    const now = new Date().toISOString()
    // Garante profile (trigger pode atrasar um instante)
    await sb.from('profiles').upsert({
      id: data.user.id,
      name,
      name_key: key,
      nickname,
      name_changes_max: 2,
      avatar_id: 'initial',
      nickname_changed_at: nickname ? now : null,
    })

    const user: User = {
      id: data.user.id,
      name,
      username: key,
      nickname,
      passwordHash: '',
      createdAt: data.user.created_at,
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
    return { ok: true, user }
  },

  async login(input): Promise<AuthResult> {
    const identifier = input.name?.trim() ?? ''
    if (identifier.length < 2) {
      return { ok: false, error: 'Nome ou senha inválidos.' }
    }

    const sb = getSupabase()
    const key = nameKey(identifier)
    const nickname = normalizeNickname(identifier)

    const { data: profile } = await sb
      .from('profiles')
      .select('*')
      .or(
        `name_key.eq.${escapeOrValue(key)},nickname.eq.${escapeOrValue(nickname)}`,
      )
      .maybeSingle()

    const loginName = profile
      ? (profile as ProfileRow).name
      : normalizeName(identifier)
    const email = toAuthEmail(loginName)

    const { data, error } = await sb.auth.signInWithPassword({
      email,
      password: input.password,
    })

    if (error) return { ok: false, error: authErrorMessage(error.message) }
    if (!data.user) return { ok: false, error: 'Nome ou senha inválidos.' }

    const { data: freshProfile } = await sb
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .maybeSingle()

    const user = freshProfile
      ? mapUser(freshProfile as ProfileRow)
      : {
          id: data.user.id,
          name: loginName,
          username: nameKey(loginName),
          nickname: null,
          passwordHash: '',
          createdAt: data.user.created_at,
          nameChangesUsed: 0,
          nameChangesMax: 3,
          nicknameChangedAt: null,
          avatarId: 'initial' as const,
          heightCm: null,
          age: null,
          backhand: null,
          rackets: [],
          primaryRacket: null,
        }

    return { ok: true, user }
  },

  async logout() {
    await getSupabase().auth.signOut()
  },

  async updateProfile(userId, input): Promise<ProfileResult> {
    const sb = getSupabase()
    const { data: row, error: fetchError } = await sb
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (fetchError || !row) {
      return { ok: false, error: 'Usuário não encontrado.' }
    }
    const user = mapUser(row as ProfileRow)

    const update: Record<string, unknown> = {}

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
        update.name = name
        update.name_changes_used = user.nameChangesUsed + 1
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
        const { data: dupe } = await sb
          .from('profiles')
          .select('id')
          .ilike('nickname', nickname)
          .neq('id', userId)
          .maybeSingle()
        if (dupe) return { ok: false, error: 'Esse apelido já está em uso.' }
        update.nickname = nickname
        update.nickname_changed_at = new Date().toISOString()
      }
    }

    if (input.avatarId !== undefined) update.avatar_id = input.avatarId
    if (input.heightCm !== undefined) update.height_cm = input.heightCm
    if (input.age !== undefined) update.age = input.age
    if (input.backhand !== undefined) update.backhand = input.backhand
    if (input.rackets !== undefined) update.rackets = input.rackets
    if (input.primaryRacket !== undefined) {
      update.primary_racket = input.primaryRacket
    }

    const nextRackets = input.rackets ?? user.rackets
    const nextPrimary =
      input.primaryRacket !== undefined
        ? input.primaryRacket
        : user.primaryRacket
    if (nextPrimary && !nextRackets.includes(nextPrimary)) {
      return {
        ok: false,
        error: 'A raquete principal precisa estar na sua lista de raquetes.',
      }
    }

    if (Object.keys(update).length === 0) {
      return { ok: true, user }
    }

    const { data: updatedRow, error } = await sb
      .from('profiles')
      .update(update)
      .eq('id', userId)
      .select('*')
      .single()

    if (error || !updatedRow) {
      return { ok: false, error: error?.message ?? 'Falha ao atualizar perfil.' }
    }

    return { ok: true, user: mapUser(updatedRow as ProfileRow) }
  },

  async createTournament(input): Promise<TournamentResult> {
    const name = input.name.trim()
    if (name.length < 2) {
      return { ok: false, error: 'Nome do torneio muito curto.' }
    }
    const format = normalizeFormat(input.format)

    let structure: TournamentStructure | null = null
    const startsOn = input.startsOn?.trim() || null
    const endsOn = input.endsOn?.trim() || null

    if (!startsOn || !endsOn) {
      return { ok: false, error: 'Informe data de início e de fim.' }
    }
    if (endsOn < startsOn) {
      return { ok: false, error: 'A data de fim deve ser após o início.' }
    }

    if (format === 'classic') {
      const normalized = normalizeStructure(input.structure)
      if (normalized !== 'round_robin' && normalized !== 'points_league') {
        return {
          ok: false,
          error: 'Escolha a estrutura: todos contra todos ou liga por pontos.',
        }
      }
      structure = normalized
    } else {
      structure = 'round_robin_double'
    }

    const sb = getSupabase()
    const { data: row, error } = await sb
      .from('tournaments')
      .insert({
        name,
        created_by_id: input.createdById,
        status: 'active',
        format,
        structure,
        starts_on: startsOn,
        ends_on: endsOn,
      })
      .select('*')
      .single()

    if (error || !row) {
      return { ok: false, error: error?.message ?? 'Falha ao criar torneio.' }
    }

    const { error: partError } = await sb
      .from('tournament_participants')
      .insert({
        tournament_id: row.id,
        user_id: input.createdById,
      })

    if (partError) {
      return { ok: false, error: partError.message }
    }

    return {
      ok: true,
      tournament: mapTournament(row as TournamentRow, [input.createdById]),
    }
  },

  async joinTournament(tournamentId, userId): Promise<MutationOk> {
    const sb = getSupabase()
    const { data: tournament, error: tError } = await sb
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .maybeSingle()

    if (tError || !tournament) {
      return { ok: false, error: 'Torneio não encontrado.' }
    }
    if (tournament.status === 'finished') {
      return { ok: false, error: 'Este torneio já foi encerrado.' }
    }

    const { error } = await sb.from('tournament_participants').upsert({
      tournament_id: tournamentId,
      user_id: userId,
    })

    if (error) return { ok: false, error: error.message }
    return { ok: true }
  },

  async finishTournament(tournamentId, requesterId, options): Promise<TournamentResult> {
    const sb = getSupabase()
    const data = await fetchAllData()
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
      tournament.format,
    )
    const winnerId = ranking.find((r) => r.played > 0)?.playerId
    if (!winnerId) {
      return { ok: false, error: 'Não foi possível definir um vencedor.' }
    }

    const finishedAt = new Date().toISOString()
    const { data: row, error } = await sb
      .from('tournaments')
      .update({
        status: 'finished',
        winner_id: winnerId,
        finished_at: finishedAt,
      })
      .eq('id', tournamentId)
      .select('*')
      .single()

    if (error || !row) {
      return { ok: false, error: error?.message ?? 'Falha ao encerrar.' }
    }

    return {
      ok: true,
      tournament: mapTournament(row as TournamentRow, tournament.participantIds),
    }
  },

  async addMatch(match): Promise<MutationOk> {
    const sb = getSupabase()

    if (match.tournamentId) {
      const { data: row, error: tError } = await sb
        .from('tournaments')
        .select('status, starts_on, ends_on, structure')
        .eq('id', match.tournamentId)
        .maybeSingle()

      if (tError) return { ok: false, error: tError.message }
      const windowError = tournamentMatchDateError(
        row
          ? {
              status: row.status,
              startsOn: row.starts_on ?? undefined,
              endsOn: row.ends_on ?? undefined,
            }
          : null,
        match.date,
      )
      if (windowError) return { ok: false, error: windowError }

      const { data: existingRows, error: mError } = await sb
        .from('matches')
        .select('player_a_id, player_b_id, games_a, games_b')
        .eq('tournament_id', match.tournamentId)

      if (mError) return { ok: false, error: mError.message }

      const existingMatches = (existingRows ?? []).map((r) => ({
        playerAId: r.player_a_id as string,
        playerBId: r.player_b_id as string,
        gamesA: r.games_a as number,
        gamesB: r.games_b as number,
      })) as Match[]

      const pairError = tournamentPairLimitError(
        {
          structure: normalizeStructure(row?.structure),
        },
        existingMatches,
        match.playerAId,
        match.playerBId,
      )
      if (pairError) return { ok: false, error: pairError }
    }

    const { error } = await sb.from('matches').insert({
      tournament_id: match.tournamentId,
      match_date: match.date,
      surface: match.surface,
      player_a_id: match.playerAId,
      player_b_id: match.playerBId,
      games_a: match.gamesA,
      games_b: match.gamesB,
      duration_minutes: match.durationMinutes ?? null,
      ball: match.ball ?? null,
      racket_a: match.racketA ?? null,
      racket_b: match.racketB ?? null,
      recorded_by_id: match.recordedById,
    })

    if (error) return { ok: false, error: error.message }

    if (match.tournamentId) {
      await sb.from('tournament_participants').upsert([
        { tournament_id: match.tournamentId, user_id: match.playerAId },
        { tournament_id: match.tournamentId, user_id: match.playerBId },
      ])
      await tryAutoFinishSupabaseTournament(match.tournamentId)
    }

    return { ok: true }
  },

  async deleteMatch(matchId, requesterId): Promise<MutationOk> {
    const sb = getSupabase()
    const { error } = await sb
      .from('matches')
      .delete()
      .eq('id', matchId)
      .eq('recorded_by_id', requesterId)

    if (error) return { ok: false, error: error.message }
    return { ok: true }
  },

  async requestMatchEdit(matchId, requesterId, payload): Promise<MatchEditResult> {
    const sb = getSupabase()
    const { data: matchRow, error: matchError } = await sb
      .from('matches')
      .select('player_a_id, player_b_id')
      .eq('id', matchId)
      .maybeSingle()

    if (matchError || !matchRow) {
      return { ok: false, error: 'Set não encontrado.' }
    }
    if (
      matchRow.player_a_id !== requesterId &&
      matchRow.player_b_id !== requesterId
    ) {
      return { ok: false, error: 'Você não participou deste set.' }
    }

    const { data: pending } = await sb
      .from('match_edit_requests')
      .select('id')
      .eq('match_id', matchId)
      .eq('status', 'pending')
      .maybeSingle()
    if (pending) {
      return {
        ok: false,
        error: 'Já existe uma solicitação de edição pendente para este set.',
      }
    }

    const { data: row, error } = await sb
      .from('match_edit_requests')
      .insert({
        match_id: matchId,
        requested_by_id: requesterId,
        status: 'pending',
        payload,
      })
      .select('*')
      .single()

    if (error || !row) {
      return { ok: false, error: error?.message ?? 'Falha ao solicitar edição.' }
    }

    return {
      ok: true,
      request: mapMatchEditRequest(row as MatchEditRequestRow),
    }
  },

  async withdrawMatchEdit(requestId, requesterId): Promise<MutationOk> {
    const sb = getSupabase()
    const { data: row, error: fetchError } = await sb
      .from('match_edit_requests')
      .select('*')
      .eq('id', requestId)
      .maybeSingle()

    if (fetchError || !row) {
      return { ok: false, error: 'Solicitação não encontrada.' }
    }
    if (row.requested_by_id !== requesterId) {
      return { ok: false, error: 'Só quem solicitou pode retirar o pedido.' }
    }
    if (row.status !== 'pending') {
      return { ok: false, error: 'Esta solicitação já foi resolvida.' }
    }

    const { error } = await sb
      .from('match_edit_requests')
      .update({ status: 'withdrawn' })
      .eq('id', requestId)

    if (error) return { ok: false, error: error.message }
    return { ok: true }
  },

  async resolveMatchEdit(requestId, resolverId, decision): Promise<MutationOk> {
    const sb = getSupabase()
    const { data: row, error: fetchError } = await sb
      .from('match_edit_requests')
      .select('*')
      .eq('id', requestId)
      .maybeSingle()

    if (fetchError || !row) {
      return { ok: false, error: 'Solicitação não encontrada.' }
    }
    if (row.status !== 'pending') {
      return { ok: false, error: 'Esta solicitação já foi resolvida.' }
    }

    const { data: matchRow, error: matchError } = await sb
      .from('matches')
      .select('*')
      .eq('id', row.match_id)
      .maybeSingle()
    if (matchError || !matchRow) {
      return { ok: false, error: 'Set não encontrado.' }
    }

    const otherPlayerId =
      matchRow.player_a_id === row.requested_by_id
        ? matchRow.player_b_id
        : matchRow.player_a_id
    if (resolverId !== otherPlayerId) {
      return {
        ok: false,
        error: 'Só o outro participante do set pode responder a este pedido.',
      }
    }

    const resolvedAt = new Date().toISOString()
    const { error } = await sb
      .from('match_edit_requests')
      .update({
        status: decision,
        resolved_at: resolvedAt,
        resolved_by_id: resolverId,
      })
      .eq('id', requestId)

    if (error) return { ok: false, error: error.message }

    if (decision === 'approved') {
      const payload = row.payload as MatchEditPayload
      const { error: updateError } = await sb
        .from('matches')
        .update({
          match_date: payload.date,
          surface: payload.surface,
          player_a_id: payload.playerAId,
          player_b_id: payload.playerBId,
          games_a: payload.gamesA,
          games_b: payload.gamesB,
          duration_minutes: payload.durationMinutes ?? null,
          ball: payload.ball ?? null,
          racket_a: payload.racketA ?? null,
          racket_b: payload.racketB ?? null,
        })
        .eq('id', row.match_id)

      if (updateError) return { ok: false, error: updateError.message }
    }

    return { ok: true }
  },

  async fetchAll() {
    await autoFinishDueSupabaseTournaments()
    return fetchAllData()
  },
}

async function tryAutoFinishSupabaseTournament(tournamentId: string) {
  const data = await fetchAllData()
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

  await supabaseRepository.finishTournament(
    tournamentId,
    tournament.createdById,
    { auto: true },
  )
}

async function autoFinishDueSupabaseTournaments() {
  const data = await fetchAllData()
  for (const tournament of data.tournaments) {
    if (tournament.status !== 'active') continue
    await tryAutoFinishSupabaseTournament(tournament.id)
  }
}
