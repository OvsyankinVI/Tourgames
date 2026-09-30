import { DevelopmentTournamentProvider, LocalSnapshotProvider } from './DevelopmentTournamentProvider';
import { LundaTournamentProvider } from './LundaTournamentProvider';
import type { TournamentProvider } from './TournamentProvider';

export function createProvider(): TournamentProvider {
  if (import.meta.env.DEV && new URLSearchParams(location.search).get('source') === 'local') {
    return new LocalSnapshotProvider();
  }
  const proxy = import.meta.env.VITE_TOURNAMENT_PROXY_URL;
  if (proxy) {
    const url = new URL(proxy);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.hostname === 'appcloud.lundapadel.ru') {
      throw new Error('Configure a public HTTPS catalog proxy');
    }
    return new LundaTournamentProvider(url.href);
  }
  return new DevelopmentTournamentProvider();
}
