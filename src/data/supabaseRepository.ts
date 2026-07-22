import { computeRanking, normalizeFormat } from './ranking'
import type {
  AppData,
  BallBrand,
  Match,
  Tournament,
  TournamentFormat,
  User,
} from '../types'
import { nameKey, normalizeName } from './auth'
import { getSupabase, toAuthEmail } from '../lib/supabase'
import type { AuthResult, DataRepository, MutationOk, TournamentResult } from './repository'

type ProfileRow = {
  id: string
  name: string
  name_key: string
  created_at: string
}

type TournamentRow = {
  id: string
  name: string
  created_by_id: string
  created_at: string
  status: 'active' | 'finished'
  format: TournamentFormat
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
  created_at: string
  recorded_by_id: string
}

function mapUser(row: ProfileRow): User {
  return {
    id: row.id,
    name: row.name,
    username: row.name_key,
    passwordHash: '',
    createdAt: row.created_at,
  }
}

function mapTournament(
  row: TournamentRow,
  participantIds: string[],
): Tournament {
  return {
    id: row.id,
    name: row.name,
    createdById: row.created_by_id,
    createdAt: row.created_at,
    participantIds,
    status: row.status,
    format: normalizeFormat(row.format),
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
    createdAt: row.created_at,
    recordedById: row.recorded_by_id,
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

async function fetchAllData(): Promise<AppData> {
  const sb = getSupabase()

  const [profilesRes, tournamentsRes, partsRes, matchesRes] = await Promise.all([
    sb.from('profiles').select('*').order('created_at', { ascending: true }),
    sb.from('tournaments').select('*').order('created_at', { ascending: false }),
    sb.from('tournament_participants').select('*'),
    sb.from('matches').select('*').order('created_at', { ascending: false }),
  ])

  if (profilesRes.error) throw profilesRes.error
  if (tournamentsRes.error) throw tournamentsRes.error
  if (partsRes.error) throw partsRes.error
  if (matchesRes.error) throw matchesRes.error

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
  }
}

export const supabaseRepository: DataRepository = {
  mode: 'supabase',

  async bootstrap() {
    const sb = getSupabase()
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

    const sb = getSupabase()
    const email = toAuthEmail(name)
    const { data, error } = await sb.auth.signUp({
      email,
      password: input.password,
      options: { data: { name } },
    })

    if (error) return { ok: false, error: authErrorMessage(error.message) }
    if (!data.user) return { ok: false, error: 'Não foi possível criar a conta.' }

    // Garante profile (trigger pode atrasar um instante)
    await sb.from('profiles').upsert({
      id: data.user.id,
      name,
      name_key: key,
    })

    const user: User = {
      id: data.user.id,
      name,
      username: key,
      passwordHash: '',
      createdAt: data.user.created_at,
    }
    return { ok: true, user }
  },

  async login(input): Promise<AuthResult> {
    const name = normalizeName(input.name)
    if (name.length < 2) return { ok: false, error: 'Nome ou senha inválidos.' }

    const sb = getSupabase()
    const email = toAuthEmail(name)
    const { data, error } = await sb.auth.signInWithPassword({
      email,
      password: input.password,
    })

    if (error) return { ok: false, error: authErrorMessage(error.message) }
    if (!data.user) return { ok: false, error: 'Nome ou senha inválidos.' }

    const { data: profile } = await sb
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .maybeSingle()

    const user = profile
      ? mapUser(profile as ProfileRow)
      : {
          id: data.user.id,
          name,
          username: nameKey(name),
          passwordHash: '',
          createdAt: data.user.created_at,
        }

    return { ok: true, user }
  },

  async logout() {
    await getSupabase().auth.signOut()
  },

  async createTournament(input): Promise<TournamentResult> {
    const name = input.name.trim()
    if (name.length < 2) {
      return { ok: false, error: 'Nome do torneio muito curto.' }
    }
    const format = normalizeFormat(input.format)

    const sb = getSupabase()
    const { data: row, error } = await sb
      .from('tournaments')
      .insert({
        name,
        created_by_id: input.createdById,
        status: 'active',
        format,
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

  async finishTournament(tournamentId, requesterId): Promise<TournamentResult> {
    const sb = getSupabase()
    const data = await fetchAllData()
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
      recorded_by_id: match.recordedById,
    })

    if (error) return { ok: false, error: error.message }

    if (match.tournamentId) {
      await sb.from('tournament_participants').upsert([
        { tournament_id: match.tournamentId, user_id: match.playerAId },
        { tournament_id: match.tournamentId, user_id: match.playerBId },
      ])
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

  async fetchAll() {
    return fetchAllData()
  },
}
