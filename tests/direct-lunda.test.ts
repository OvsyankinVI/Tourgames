import { afterEach, describe, expect, it, vi } from 'vitest';
import { DirectLundaTournamentProvider, LUNDA_ENDPOINT } from '../src/providers/DirectLundaTournamentProvider';
import { createProvider } from '../src/providers';

const credentials = { token: 'test-only-token', profileId: 'test-only-profile' };
const event = { uid: 'event', title: 'Test', plannedDate: '2026-10-04T12:00:00+03:00' };
afterEach(() => vi.unstubAllEnvs());

describe('direct browser LUNDA connection', () => {
  it('requests LUNDA directly with tab credentials and retains pagination', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: { hasNext: true, infos: [event] } })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: { hasNext: false, infos: [{ ...event, uid: 'second' }] } })));
    const result = await new DirectLundaTournamentProvider(credentials, fetcher).loadTournaments();
    expect(result.items).toHaveLength(2);
    expect(result.source).toBe('live');
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([LUNDA_ENDPOINT, LUNDA_ENDPOINT]);
    for (const [, init] of fetcher.mock.calls) {
      expect(init).toMatchObject({ method: 'POST', redirect: 'error', credentials: 'omit', headers: { 'X-Auth-Token': credentials.token, 'X-Profile-Id': credentials.profileId } });
      expect(init!.headers).not.toHaveProperty('Cookie');
      expect(init!.headers).not.toHaveProperty('Origin');
      expect(JSON.parse(init!.body as string).parameters).toMatchObject({ inMyCity: true, onlyMyRating: false, hideFilled: false });
    }
    expect(fetcher.mock.calls.map(([, init]) => JSON.parse(init!.body as string).parameters.offset)).toEqual([0, 30]);
    expect(JSON.stringify(result)).not.toContain(credentials.token);
  });
  it('uses the direct provider even when a proxy URL is configured', () => {
    vi.stubEnv('VITE_TOURNAMENT_PROXY_URL', 'https://proxy.example/tournaments');
    expect(createProvider(credentials)).toBeInstanceOf(DirectLundaTournamentProvider);
  });
  it('does not expose authentication error bodies or silently return demo data', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('private upstream error', { status: 401 }));
    await expect(new DirectLundaTournamentProvider(credentials, fetcher).loadTournaments()).rejects.toThrow('Catalog unavailable');
  });
});
