import { DevelopmentTournamentProvider, LocalSnapshotProvider } from './DevelopmentTournamentProvider';
import { LundaTournamentProvider } from './LundaTournamentProvider';
import type { TournamentProvider } from './TournamentProvider';
import { DirectLundaTournamentProvider, type LundaCredentials } from './DirectLundaTournamentProvider';

export function createProvider(credentials: LundaCredentials | null = null): TournamentProvider {
  if (credentials) return new DirectLundaTournamentProvider(credentials);
  if (import.meta.env.DEV && new URLSearchParams(location.search).get('source') === 'local') {
    return new LocalSnapshotProvider();
  }
  const proxy = import.meta.env.VITE_TOURNAMENT_PROXY_URL;
  if (proxy) {
    const url = new URL(proxy);
    const localDev = import.meta.env.DEV && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
    if ((!localDev && url.protocol !== 'https:') || url.username || url.password || url.search || url.hash || url.hostname === 'appcloud.lundapadel.ru') {
      throw new Error('Configure a public HTTPS catalog proxy');
    }
    return new LundaTournamentProvider(url.href);
  }
  return new DevelopmentTournamentProvider();
}
