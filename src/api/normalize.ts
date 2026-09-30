import { teamType, type Tournament } from '../domain/tournament.ts';

export function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
const str = (v: unknown): string => typeof v === 'string' ? v.trim() : '';
const nullableStr = (v: unknown) => str(v) || null;
const num = (v: unknown): number | null => {
  if (typeof v !== 'number' && (typeof v !== 'string' || !v.trim())) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

// LUNDA timezone-less plannedDate is interpreted as Moscow time.
export function normalizeDate(value: unknown): string | null {
  let date = str(value).replace(' ', 'T');
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) date += 'T00:00:00';
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(date)) date += '+03:00';
  const timestamp = Date.parse(date);
  return date && Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

export function normalizeTournament(value: unknown): Tournament | null {
  const raw = record(value);
  const id = str(raw.uid);
  const startAt = normalizeDate(raw.plannedDate);
  if (!id || !startAt || raw.privateTourGame === true) return null;
  const club = record(raw.club);
  const info = record(raw.clubInfo);
  const organizer = record(raw.organizerInfo);
  const city = record(info.city);
  return {
    id,
    title: str(raw.title) || 'Падел-турнир',
    startAt,
    durationMinutes: num(raw.duration),
    price: num(raw.price),
    currency: 'RUB',
    status: str(raw.tournamentStatus) || 'UNKNOWN',
    formatCode: str(raw.kind) || 'UNKNOWN',
    formatName: str(raw.kindName) || str(raw.kind) || 'Другой формат',
    isTeam: teamType(raw.teamType),
    playersCount: num(raw.countPlayers),
    playersLimit: num(raw.playersLimit),
    teamsCount: num(raw.countParticipantTeams),
    teamsLimit: num(raw.teamsLimit),
    minGrade: nullableStr(raw.minGrade),
    maxGrade: nullableStr(raw.maxGrade),
    displayMinGrade: nullableStr(raw.displayMinGrade),
    displayMaxGrade: nullableStr(raw.displayMaxGrade),
    minRating: num(raw.minRating),
    maxRating: num(raw.maxRating),
    genders: Array.isArray(raw.genders) ? raw.genders.filter((g): g is string => typeof g === 'string') : [],
    ranking: typeof raw.ranking === 'boolean' ? raw.ranking : null,
    club: {
      id: str(info.uid) || str(club.uid),
      name: str(info.displayName) || str(club.caption) || 'Клуб уточняется',
      address: str(info.address),
      city: str(info.city) || str(city.caption) || str(city.name),
    },
    organizer: { id: str(organizer.uid), name: str(record(organizer.brandView).displayName) || str(organizer.name) },
  };
}

export function parseLundaPage(value: unknown): { items: Tournament[]; hasNext: boolean; rawCount: number; skipped: number } {
  const result = record(record(value).result);
  if (!Array.isArray(result.infos) || typeof result.hasNext !== 'boolean') throw new Error('Invalid catalog response');
  const items = result.infos.map(normalizeTournament).filter((t): t is Tournament => t !== null);
  return { items, hasNext: result.hasNext, rawCount: result.infos.length, skipped: result.infos.length - items.length };
}
