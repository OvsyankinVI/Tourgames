import { parseLundaPage } from '../api/normalize';
import type { Tournament } from '../domain/tournament';
import type { Catalog, LoadOptions, TournamentProvider } from './TournamentProvider';

// Public catalog request, intentionally removes personal rating/city and time restrictions
// from the sample cURL. City selection/authorization belong in the future trusted proxy.
export const CATALOG_PARAMETERS = {
  onlyMyRating: false, onlyMyPartners: false, onlyMyInvite: false,
  onlyTournament: false, gameSortBy: 'PLANNED_DATE', show: 'TOURNAMENTS',
  hideFilled: false, onlyFavoriteClubs: false, inMyCity: false,
};

export class LundaTournamentProvider implements TournamentProvider {
  constructor(private endpoint: string, private request: typeof fetch = fetch, private maxPages = 50) {}

  async loadTournaments({ signal, onProgress }: LoadOptions = {}): Promise<Catalog> {
    const limit = 30;
    const items = new Map<string, Tournament>();
    let skipped = 0;
    for (let page = 0; page < this.maxPages; page++) {
      signal?.throwIfAborted();
      const timeout = AbortSignal.timeout(20_000);
      const response = await this.request(this.endpoint, {
        method: 'POST', credentials: 'omit',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ parameters: { ...CATALOG_PARAMETERS, offset: page * limit, limit } }),
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
      if (!response.ok) throw new Error('Catalog unavailable');
      const data = parseLundaPage(await response.json());
      const previousCount = items.size;
      data.items.forEach(t => items.set(t.id, t));
      skipped += data.skipped;
      onProgress?.(items.size);
      if (!data.hasNext) return { items: [...items.values()], source: 'live', complete: true, skipped };
      if (data.rawCount === 0 || (data.items.length > 0 && items.size === previousCount)) {
        return { items: [...items.values()], source: 'live', complete: false, skipped };
      }
    }
    return { items: [...items.values()], source: 'live', complete: false, skipped };
  }
}
