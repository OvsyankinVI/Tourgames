import type { Tournament } from '../domain/tournament';

export type DataSource = 'demo' | 'snapshot' | 'live';
export interface Catalog {
  items: Tournament[];
  source: DataSource;
  complete: boolean;
  skipped: number;
}
export interface LoadOptions {
  signal?: AbortSignal;
  onProgress?: (count: number) => void;
}
export interface TournamentProvider {
  loadTournaments(options?: LoadOptions): Promise<Catalog>;
}
