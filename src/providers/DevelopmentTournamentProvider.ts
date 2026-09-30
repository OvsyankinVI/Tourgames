import type { Catalog, LoadOptions, TournamentProvider } from './TournamentProvider';
import { demoTournaments } from '../fixtures/demo';

export class DevelopmentTournamentProvider implements TournamentProvider {
  async loadTournaments({ signal }: LoadOptions = {}): Promise<Catalog> {
    signal?.throwIfAborted();
    return { items: demoTournaments(), source: 'demo', complete: true, skipped: 0 };
  }
}

export class LocalSnapshotProvider implements TournamentProvider {
  async loadTournaments({ signal }: LoadOptions = {}): Promise<Catalog> {
    const response = await fetch(`${import.meta.env.BASE_URL}__local/tournaments`, { signal, cache: 'no-store' });
    if (!response.ok) throw new Error('Snapshot unavailable');
    const data = await response.json() as Catalog;
    if (!Array.isArray(data.items) || data.source !== 'snapshot') throw new Error('Invalid snapshot');
    return data;
  }
}
