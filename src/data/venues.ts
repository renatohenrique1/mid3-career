import type { CourtId, Surface, VenueId } from '../types'

export const VENUE_OPTIONS: Array<{ id: VenueId; label: string }> = [
  { id: 'ceret', label: 'CERET' },
  { id: 'ibirapuera', label: 'Ibirapuera' },
  { id: 'parque_manchester', label: 'Parque Manchester' },
  { id: 'parque_da_mooca', label: 'Parque da Mooca' },
]

export const COURT_OPTIONS: Array<{
  id: CourtId
  label: string
  surface: Surface
}> = [
  { id: 'coliseu', label: 'Coliseu', surface: 'hard' },
  { id: 'anexa', label: 'Anexa', surface: 'hard' },
  { id: 'rachadura', label: 'Rachadura', surface: 'hard' },
  { id: 'saibro', label: 'Saibro', surface: 'clay' },
]

/** Superfície fixa do local, ou null se o usuário escolhe (CERET). */
export function lockedSurfaceForVenue(venue: VenueId): Surface | null {
  if (venue === 'ibirapuera') return 'clay'
  if (venue === 'parque_manchester' || venue === 'parque_da_mooca') {
    return 'hard'
  }
  return null
}

export function surfacesForVenue(venue: VenueId): Surface[] {
  const locked = lockedSurfaceForVenue(venue)
  return locked ? [locked] : ['hard', 'clay']
}

export function courtsForVenueSurface(
  venue: VenueId,
  surface: Surface,
): Array<{ id: CourtId; label: string }> {
  if (venue !== 'ceret') return []
  return COURT_OPTIONS.filter((c) => c.surface === surface).map((c) => ({
    id: c.id,
    label: c.label,
  }))
}

export function defaultCourtForVenueSurface(
  venue: VenueId,
  surface: Surface,
): CourtId | null {
  const courts = courtsForVenueSurface(venue, surface)
  return courts[0]?.id ?? null
}

export function resolveSurfaceForVenue(
  venue: VenueId,
  current: Surface,
): Surface {
  return lockedSurfaceForVenue(venue) ?? current
}

export function venueLabel(id: VenueId | null | undefined): string {
  if (!id) return '—'
  return VENUE_OPTIONS.find((v) => v.id === id)?.label ?? id
}

export function courtLabel(id: CourtId | null | undefined): string {
  if (!id) return '—'
  return COURT_OPTIONS.find((c) => c.id === id)?.label ?? id
}

export function isValidVenueCourt(
  venue: VenueId,
  surface: Surface,
  court: CourtId | null,
): boolean {
  if (!surfacesForVenue(venue).includes(surface)) return false
  if (venue !== 'ceret') return court == null
  if (!court) return false
  return courtsForVenueSurface(venue, surface).some((c) => c.id === court)
}
