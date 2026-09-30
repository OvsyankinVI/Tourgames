import { freeSpots, genderType, type Tournament } from '../domain/tournament';
import { addDays, dayKey, endOfWeek, hourInMoscow, TIME_RANGES } from './dates';

export interface Filters {
  q: string; date: string; from: string; to: string; time: string;
  clubs: string[]; formats: string[]; team: string; level: string; gender: string;
  priceMin: string; priceMax: string; ratingMin: string; ratingMax: string;
  duration: string; available: boolean; sort: string;
}
export const DEFAULT_FILTERS: Filters = {
  q: '', date: 'all', from: '', to: '', time: 'all', clubs: [], formats: [],
  team: 'all', level: '', gender: 'all', priceMin: '', priceMax: '',
  ratingMin: '', ratingMax: '', duration: 'all', available: false, sort: 'date',
};
export const DATE_OPTIONS = [['all', 'Все даты'], ['today', 'Сегодня'], ['tomorrow', 'Завтра'], ['week', 'Эта неделя'], ['custom', 'Выбрать дату'], ['range', 'Диапазон']];
export const TIME_OPTIONS = [['all', 'Любое время'], ['morning', 'Утро · до 12:00'], ['afternoon', 'День · 12–18'], ['evening', 'Вечер · после 18:00']];
export const TEAM_OPTIONS = [['all', 'Любой тип'], ['individual', 'Индивидуальные'], ['team', 'Парные / командные']];
export const GENDER_OPTIONS = [['all', 'Любой состав'], ['men', 'Мужские'], ['women', 'Женские'], ['mixed', 'Смешанные / открытые']];
export const DURATION_OPTIONS = [['all', 'Любая длительность'], ['short', 'До 90 минут'], ['120', '120 минут'], ['long', 'Более 120 минут']];
export const SORT_OPTIONS = [['date', 'Сначала ближайшие'], ['cheap', 'Сначала дешевле'], ['expensive', 'Сначала дороже'], ['spots', 'Больше свободных мест']];

const GRADE_ORDER: Record<string, number> = { D: 1, 'D+': 2, C: 3, 'C+': 4, B: 5, 'B+': 6, A: 7, 'A+': 8 };
export function gradeRank(value: string | null): number | null {
  if (!value) return null;
  if (value in GRADE_ORDER) return GRADE_ORDER[value];
  const match = /^GRADE_(\d+)$/.exec(value);
  return match ? Number(match[1]) : null;
}
export function includesLevel(t: Tournament, level: string): boolean {
  const target = gradeRank(level);
  const min = gradeRank(t.minGrade) ?? gradeRank(t.displayMinGrade);
  const max = gradeRank(t.maxGrade) ?? gradeRank(t.displayMaxGrade);
  if (target === null) return [t.minGrade, t.maxGrade, t.displayMinGrade, t.displayMaxGrade].includes(level);
  if (min === null && max === null) return false;
  return (min === null || min <= target) && (max === null || max >= target);
}
export function levelOptions(items: Tournament[]): [string, string][] {
  const levels = new Map<string, string>();
  items.forEach(t => {
    for (const [code, display] of [[t.minGrade, t.displayMinGrade], [t.maxGrade, t.displayMaxGrade]]) {
      if (code || display) levels.set(code || display!, display || code!);
    }
    const min = gradeRank(t.minGrade) ?? gradeRank(t.displayMinGrade);
    const max = gradeRank(t.maxGrade) ?? gradeRank(t.displayMaxGrade);
    if (min !== null && max !== null) {
      Object.entries(GRADE_ORDER).forEach(([label, rank]) => {
        if (rank >= min && rank <= max && !levels.has(`GRADE_${rank}`)) levels.set(`GRADE_${rank}`, label);
      });
    }
  });
  return [...levels].sort((a, b) => (gradeRank(a[0]) ?? 999) - (gradeRank(b[0]) ?? 999));
}

export function filterTournaments(items: Tournament[], f: Filters, now = new Date()): Tournament[] {
  const today = dayKey(now);
  const query = f.q.toLocaleLowerCase('ru').trim();
  return items.filter(t => {
    if (query && ![t.title, t.club.name, t.club.address, t.organizer.name, t.formatName].some(s => s.toLocaleLowerCase('ru').includes(query))) return false;
    const day = dayKey(t.startAt);
    if (f.date === 'today' && day !== today) return false;
    if (f.date === 'tomorrow' && day !== addDays(today, 1)) return false;
    if (f.date === 'week' && (day < today || day > endOfWeek(today))) return false;
    if (f.date === 'custom' && f.from && day !== f.from) return false;
    if (f.date === 'range' && ((f.from && day < f.from) || (f.to && day > f.to))) return false;
    const range = TIME_RANGES[f.time];
    if (range && (hourInMoscow(t.startAt) < range[0] || hourInMoscow(t.startAt) >= range[1])) return false;
    if (f.clubs.length && !f.clubs.includes(t.club.id)) return false;
    if (f.formats.length && !f.formats.includes(t.formatCode)) return false;
    if (f.team === 'team' && t.isTeam !== true) return false;
    if (f.team === 'individual' && t.isTeam !== false) return false;
    if (f.level && !includesLevel(t, f.level)) return false;
    if (f.gender !== 'all' && genderType(t.genders) !== f.gender) return false;
    if (f.available && (freeSpots(t) ?? 0) <= 0) return false;
    if (f.priceMin && (t.price === null || t.price < Number(f.priceMin))) return false;
    if (f.priceMax && (t.price === null || t.price > Number(f.priceMax))) return false;
    // Rating range overlaps the tournament's allowed range; unknown ranges are excluded.
    if ((f.ratingMin || f.ratingMax) && t.minRating === null && t.maxRating === null) return false;
    if (f.ratingMin && t.maxRating !== null && t.maxRating < Number(f.ratingMin)) return false;
    if (f.ratingMax && t.minRating !== null && t.minRating > Number(f.ratingMax)) return false;
    if (f.duration === 'short' && (t.durationMinutes === null || t.durationMinutes > 90)) return false;
    if (f.duration === '120' && t.durationMinutes !== 120) return false;
    if (f.duration === 'long' && (t.durationMinutes === null || t.durationMinutes <= 120)) return false;
    return true;
  });
}
export function sortTournaments(items: Tournament[], sort: string): Tournament[] {
  return [...items].sort((a, b) => {
    let delta = 0;
    if (sort === 'cheap' || sort === 'expensive') {
      if (a.price === null && b.price !== null) return 1;
      if (b.price === null && a.price !== null) return -1;
      delta = ((a.price ?? 0) - (b.price ?? 0)) * (sort === 'expensive' ? -1 : 1);
    }
    if (sort === 'spots') delta = (freeSpots(b) ?? -1) - (freeSpots(a) ?? -1);
    return delta || Date.parse(a.startAt) - Date.parse(b.startAt) || a.id.localeCompare(b.id);
  });
}

const enumFields: Partial<Record<keyof Filters, string[]>> = {
  date: DATE_OPTIONS.map(o => o[0]), time: TIME_OPTIONS.map(o => o[0]), team: TEAM_OPTIONS.map(o => o[0]),
  gender: GENDER_OPTIONS.map(o => o[0]), duration: DURATION_OPTIONS.map(o => o[0]), sort: SORT_OPTIONS.map(o => o[0]),
};
export function readFilters(search: string): Filters {
  const params = new URLSearchParams(search);
  const f = { ...DEFAULT_FILTERS, clubs: params.getAll('club').filter(Boolean), formats: params.getAll('format').filter(Boolean) };
  for (const key of Object.keys(DEFAULT_FILTERS) as (keyof Filters)[]) {
    if (key === 'clubs' || key === 'formats' || key === 'available') continue;
    const value = params.get(key);
    if (value !== null && (!enumFields[key] || enumFields[key]?.includes(value))) f[key] = value;
  }
  for (const key of ['priceMin', 'priceMax', 'ratingMin', 'ratingMax'] as const) {
    if (!Number.isFinite(Number(f[key])) || Number(f[key]) < 0) f[key] = '';
  }
  for (const key of ['from', 'to'] as const) if (!/^\d{4}-\d{2}-\d{2}$/.test(f[key])) f[key] = '';
  f.available = params.get('available') === '1';
  return f;
}
export function writeFilters(f: Filters, currentSearch = ''): string {
  const params = new URLSearchParams();
  const source = new URLSearchParams(currentSearch).get('source');
  if (source === 'local') params.set('source', source);
  Object.entries(f).forEach(([key, value]) => {
    if (key === 'clubs' || key === 'formats') (value as string[]).forEach(v => params.append(key === 'clubs' ? 'club' : 'format', v));
    else if (key === 'available') { if (value) params.set(key, '1'); }
    else if (value !== DEFAULT_FILTERS[key as keyof Filters]) params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `?${query}` : '';
}

export interface FilterChip { id: string; label: string; remove: (f: Filters) => Filters }
export function filterChips(f: Filters, items: Tournament[]): FilterChip[] {
  const chips: FilterChip[] = [];
  const add = (key: keyof Filters, label: string) => chips.push({ id: key, label, remove: state => ({ ...state, [key]: DEFAULT_FILTERS[key] }) });
  if (f.q) add('q', `Поиск: ${f.q}`);
  if (f.date !== 'all') chips.push({ id: 'date', label: f.date === 'custom' ? f.from || 'Выбрать дату' : f.date === 'range' ? `${f.from || '…'} — ${f.to || '…'}` : DATE_OPTIONS.find(o => o[0] === f.date)![1], remove: s => ({ ...s, date: 'all', from: '', to: '' }) });
  f.clubs.forEach(id => chips.push({ id: `club-${id}`, label: items.find(t => t.club.id === id)?.club.name || id, remove: s => ({ ...s, clubs: s.clubs.filter(v => v !== id) }) }));
  f.formats.forEach(id => chips.push({ id: `format-${id}`, label: items.find(t => t.formatCode === id)?.formatName || id, remove: s => ({ ...s, formats: s.formats.filter(v => v !== id) }) }));
  for (const [key, options] of [['time', TIME_OPTIONS], ['team', TEAM_OPTIONS], ['gender', GENDER_OPTIONS], ['duration', DURATION_OPTIONS]] as const) {
    if (f[key] !== 'all') add(key, options.find(o => o[0] === f[key])![1]);
  }
  if (f.level) add('level', levelOptions(items).find(o => o[0] === f.level)?.[1] || f.level);
  if (f.available) add('available', 'Есть места');
  for (const [key, label] of [['priceMin', 'Цена от'], ['priceMax', 'Цена до'], ['ratingMin', 'Рейтинг от'], ['ratingMax', 'Рейтинг до']] as const) {
    if (f[key]) add(key, `${label} ${f[key]}${key.startsWith('price') ? ' ₽' : ''}`);
  }
  return chips;
}
