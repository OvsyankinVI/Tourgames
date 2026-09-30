import { describe, expect, it, vi } from 'vitest';
import { normalizeTournament, parseLundaPage } from '../src/api/normalize';
import { freeSpots, genderType, teamType } from '../src/domain/tournament';
import { demoTournaments } from '../src/fixtures/demo';
import { DEFAULT_FILTERS, filterTournaments, includesLevel, readFilters, sortTournaments, writeFilters } from '../src/utils/filters';
import { dayKey, hourInMoscow } from '../src/utils/dates';
import { LundaTournamentProvider } from '../src/providers/LundaTournamentProvider';

const now = new Date('2026-10-02T09:00:00+03:00');
const items = demoTournaments(now);
const raw = {
  uid: 'public-event', title: 'Парный в названии, но индивидуальный', plannedDate: '2026-10-02T09:00:00',
  duration: 120, price: 2000, kind: 'NEW_KIND', kindName: 'Новый формат', teamType: 'INDIVIDUAL',
  countPlayers: 7, playersLimit: 9, minGrade: 'GRADE_1', maxGrade: 'GRADE_3',
  displayMinGrade: 'D', displayMaxGrade: 'C', genders: ['MAN', 'WOMAN'],
  club: { uid: 'club-id', caption: 'Клуб' }, clubInfo: { address: 'Адрес', city: { caption: 'Москва' } },
  organizerInfo: { uid: 'org', name: 'Организатор', brandView: { displayName: 'Бренд клуба' } },
  owner: { displayName: 'DO_NOT_KEEP', details: 'PRIVATE' }, bottomAdvertisement: 'AD',
};

describe('LUNDA normalization', () => {
  it('whitelists catalog fields, keeps future formats, merges club fallbacks', () => {
    const result = normalizeTournament(raw)!;
    expect(result).toMatchObject({ id: 'public-event', isTeam: false, durationMinutes: 120, formatCode: 'NEW_KIND', formatName: 'Новый формат', club: { id: 'club-id', name: 'Клуб', address: 'Адрес', city: 'Москва' }, organizer: { name: 'Бренд клуба' } });
    expect(JSON.stringify(result)).not.toMatch(/DO_NOT_KEEP|PRIVATE|Advertisement|owner/);
    expect(result.startAt).toBe('2026-10-02T06:00:00.000Z');
  });
  it('skips invalid and private events', () => {
    expect(normalizeTournament({ ...raw, uid: '' })).toBeNull();
    expect(normalizeTournament({ ...raw, plannedDate: 'bad' })).toBeNull();
    expect(normalizeTournament({ ...raw, privateTourGame: true })).toBeNull();
    expect(normalizeTournament(null)).toBeNull();
  });
  it('does not turn missing numbers into zero', () => {
    const result = normalizeTournament({ ...raw, duration: null, price: '', countPlayers: null, playersLimit: -1 })!;
    expect(result.durationMinutes).toBeNull();
    expect(result.price).toBeNull();
    expect(freeSpots(result)).toBeNull();
  });
  it('validates page envelope and reports skipped records', () => {
    expect(() => parseLundaPage({ result: { infos: [] } })).toThrow();
    expect(parseLundaPage({ result: { hasNext: false, infos: [raw, null] } })).toMatchObject({ rawCount: 2, skipped: 1, hasNext: false });
  });
  it('derives team membership only from a recognized teamType', () => {
    expect(teamType('TEAM')).toBe(true);
    expect(teamType('INDIVIDUAL')).toBe(false);
    expect(teamType('FUTURE_TYPE')).toBeNull();
    expect(normalizeTournament(raw)?.isTeam).toBe(false);
  });
  it('clamps overbooked free spots and preserves unknown capacity', () => {
    expect(freeSpots(normalizeTournament(raw)!)).toBe(2);
    expect(freeSpots({ ...items[0], playersCount: 15, playersLimit: 12 })).toBe(0);
    expect(freeSpots({ ...items[0], playersLimit: null })).toBeNull();
  });
  it('isolates gender interpretation', () => {
    expect(genderType(['WOMAN'])).toBe('women');
    expect(genderType(['MAN'])).toBe('men');
    expect(genderType(['MAN', 'WOMAN'])).toBe('mixed');
    expect(genderType([])).toBe('unknown');
  });
});

describe('catalog filters', () => {
  it('filters clubs by stable IDs, never by ambiguous names', () => {
    const sameName = [{ ...items[0], club: { ...items[0].club, id: 'a', name: 'Клуб' } }, { ...items[1], club: { ...items[1].club, id: 'b', name: 'Клуб' } }];
    expect(filterTournaments(sameName, { ...DEFAULT_FILTERS, clubs: ['a'] }, now)).toEqual([sameName[0]]);
  });
  it('uses Moscow dates even when local device timezone differs', () => {
    expect(dayKey('2026-10-01T22:00:00Z')).toBe('2026-10-02');
    expect(hourInMoscow('2026-10-01T22:00:00Z')).toBe(1);
    expect(filterTournaments(items, { ...DEFAULT_FILTERS, date: 'today' }, now)).toHaveLength(3);
    expect(filterTournaments(items, { ...DEFAULT_FILTERS, date: 'tomorrow' }, now)).toHaveLength(2);
  });
  it('handles week boundary and inclusive custom ranges', () => {
    expect(filterTournaments(items, { ...DEFAULT_FILTERS, date: 'week' }, now)).toHaveLength(7);
    expect(filterTournaments(items, { ...DEFAULT_FILTERS, date: 'range', from: '2026-10-03', to: '2026-10-04' }, now)).toHaveLength(4);
    expect(filterTournaments(items, { ...DEFAULT_FILTERS, date: 'custom', from: '2026-10-04' }, now)).toHaveLength(2);
  });
  it('uses codes for formats, supports multiple selections', () => {
    const result = filterTournaments(items, { ...DEFAULT_FILTERS, formats: ['ESCALERA', 'KING_OF_COURT'] }, now);
    expect(result).toHaveLength(3);
    expect(result.every(t => ['ESCALERA', 'KING_OF_COURT'].includes(t.formatCode))).toBe(true);
  });
  it('matches a level inside a range including its boundaries', () => {
    const t = normalizeTournament(raw)!;
    expect(includesLevel(t, 'GRADE_2')).toBe(true);
    expect(includesLevel(t, 'D')).toBe(true);
    expect(includesLevel(t, 'C')).toBe(true);
    expect(includesLevel(t, 'GRADE_4')).toBe(false);
    expect(includesLevel({ ...t, minGrade: 'FUTURE', maxGrade: 'FUTURE' }, 'FUTURE')).toBe(true);
  });
  it('searches every intended field, case insensitive', () => {
    for (const q of ['FIRST PADEL', 'шарикоподшипниковская', 'команда клуба', 'americano flex', 'утро начинается']) {
      expect(filterTournaments(items, { ...DEFAULT_FILTERS, q }, now).length).toBeGreaterThan(0);
    }
  });
  it('combines team, date, level, price, time and available spots', () => {
    const result = filterTournaments(items, { ...DEFAULT_FILTERS, date: 'today', team: 'team', level: 'GRADE_2', time: 'evening', priceMin: '5000', priceMax: '8000', available: true }, now);
    expect(result.map(t => t.id)).toEqual(['demo-1']);
  });
  it('filters genders, duration, rating and missing values', () => {
    expect(filterTournaments(items, { ...DEFAULT_FILTERS, gender: 'women' }, now).map(t => t.id)).toEqual(['demo-3']);
    expect(filterTournaments(items, { ...DEFAULT_FILTERS, duration: 'short' }, now)).toHaveLength(2);
    expect(filterTournaments(items, { ...DEFAULT_FILTERS, ratingMin: '5', ratingMax: '5' }, now).every(t => t.maxRating! >= 5)).toBe(true);
    expect(filterTournaments([{ ...items[0], minRating: null, maxRating: null }], { ...DEFAULT_FILTERS, ratingMin: '3' }, now)).toHaveLength(0);
    expect(filterTournaments(items, { ...DEFAULT_FILTERS, priceMax: '5000' }, now).some(t => t.price === null)).toBe(false);
  });
  it('sorts stably without mutation and always puts unknown prices last', () => {
    const original = [...items];
    expect(sortTournaments(items, 'cheap')[0].price).toBe(2000);
    expect(sortTournaments(items, 'expensive')[0].price).toBe(8000);
    expect(sortTournaments(items, 'cheap').at(-1)?.price).toBeNull();
    expect(sortTournaments(items, 'expensive').at(-1)?.price).toBeNull();
    expect(freeSpots(sortTournaments(items, 'spots')[0])).toBe(8);
    expect(sortTournaments([...items].reverse(), 'date')[0].id).toBe('demo-0');
    expect(items).toEqual(original);
  });
  it('restores shareable URL state including multiselects', () => {
    const f = { ...DEFAULT_FILTERS, q: 'тест & падел', clubs: ['a', 'b'], formats: ['NEW'], available: true, sort: 'cheap', level: 'GRADE_2' };
    expect(readFilters(writeFilters(f))).toEqual(f);
    expect(readFilters('?sort=invalid&time=invalid&priceMin=-20').sort).toBe('date');
    expect(readFilters('?priceMax=NaN').priceMax).toBe('');
    expect(writeFilters(DEFAULT_FILTERS, '?source=local')).toBe('?source=local');
  });
});

describe('safe sequential pagination', () => {
  function responder(pages: unknown[]) {
    return vi.fn<typeof fetch>().mockImplementation(async () => new Response(JSON.stringify(pages.shift()), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  }
  it('loads all pages with fixed offsets and deduplicates IDs', async () => {
    const request = responder([
      { result: { hasNext: true, infos: [raw] } },
      { result: { hasNext: true, infos: [raw, { ...raw, uid: 'second' }] } },
      { result: { hasNext: false, infos: [{ ...raw, uid: 'third' }] } },
    ]);
    const result = await new LundaTournamentProvider('https://example.test', request).loadTournaments();
    expect(result.items).toHaveLength(3);
    expect(result.complete).toBe(true);
    expect(request.mock.calls.map(([, init]) => JSON.parse(init!.body as string).parameters.offset)).toEqual([0, 30, 60]);
    expect(request.mock.calls[0][1]?.credentials).toBe('omit');
    expect(request.mock.calls[0][1]?.headers).not.toHaveProperty('X-Auth-Token');
  });
  it('marks repeated pages as partial instead of looping forever', async () => {
    const request = responder([0, 1].map(() => ({ result: { hasNext: true, infos: [raw] } })));
    expect((await new LundaTournamentProvider('https://example.test', request).loadTournaments()).complete).toBe(false);
    expect(request).toHaveBeenCalledTimes(2);
  });
  it('stops at a safety cap and reports incomplete catalog', async () => {
    const request = responder([{ result: { hasNext: true, infos: [raw] } }]);
    expect((await new LundaTournamentProvider('https://example.test', request, 1).loadTournaments()).complete).toBe(false);
  });
  it('handles empty hasNext pages and upstream failures', async () => {
    const request = responder([{ result: { hasNext: true, infos: [] } }]);
    expect((await new LundaTournamentProvider('https://example.test', request).loadTournaments()).complete).toBe(false);
    const failure = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 401 }));
    await expect(new LundaTournamentProvider('https://example.test', failure).loadTournaments()).rejects.toThrow('Catalog unavailable');
  });
  it('does not request after cancellation', async () => {
    const controller = new AbortController(); controller.abort();
    const request = responder([]);
    await expect(new LundaTournamentProvider('https://example.test', request).loadTournaments({ signal: controller.signal })).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });
});
