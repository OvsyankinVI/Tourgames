import { describe, expect, it, vi } from 'vitest';
import { createWorker, type Env } from '../proxy/worker';
import { parseLundaPage } from '../src/api/normalize';

const env: Env = { ALLOWED_ORIGIN: 'https://catalog.example', LUNDA_AUTH_TOKEN: 'test-only-token', LUNDA_PROFILE_ID: 'test-only-profile' };
const event = { uid: 'event-1', title: 'Tournament', plannedDate: '2026-10-04T12:00:00+03:00', teamType: 'TEAM', countPlayers: 8, playersLimit: 12, owner: { name: 'PRIVATE_OWNER' }, players: ['PRIVATE_PLAYER'], bottomAdvertisement: 'ADVERTISEMENT' };
const request = (parameters = { offset: 0, limit: 30 }, origin = env.ALLOWED_ORIGIN) => new Request('https://worker.example/tournaments', {
  method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ parameters }),
});
const upstream = () => vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ result: { hasNext: false, infos: [event, { ...event, uid: 'private', privateTourGame: true }] } }), { headers: { 'Set-Cookie': 'do-not-forward', 'X-Auth-Token': 'do-not-forward' } }));

describe('LUNDA proxy', () => {
  it('adds credentials only upstream and returns a sanitized compatible envelope', async () => {
    const fetcher = upstream();
    const response = await createWorker(fetcher).fetch(request(), env);
    expect(response.status).toBe(200);
    expect(fetcher.mock.calls[0][0]).toBe('https://appcloud.lundapadel.ru/api/tourgame/load-list');
    expect(fetcher.mock.calls[0][1]).toMatchObject({ redirect: 'error', headers: { 'X-Auth-Token': env.LUNDA_AUTH_TOKEN, Cookie: `auth-token=${env.LUNDA_AUTH_TOKEN}`, 'X-Profile-Id': env.LUNDA_PROFILE_ID } });
    const text = await response.text();
    expect(text).not.toMatch(/PRIVATE_|ADVERTISEMENT|test-only|do-not-forward|owner|players"/);
    const page = parseLundaPage(JSON.parse(text));
    expect(page.items).toHaveLength(1);
    expect(page.skipped).toBe(1);
    expect(page.items[0]).toMatchObject({ isTeam: true, playersCount: 8, playersLimit: 12 });
    expect(response.headers.get('Set-Cookie')).toBeNull();
    expect(response.headers.get('X-Auth-Token')).toBeNull();
  });
  it('rejects other origins and handles preflight without credentials', async () => {
    const fetcher = upstream(); const worker = createWorker(fetcher);
    expect((await worker.fetch(request(undefined, 'https://other.example'), env)).status).toBe(403);
    const result = await worker.fetch(new Request('https://worker.example/tournaments', { method: 'OPTIONS', headers: { Origin: env.ALLOWED_ORIGIN, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' } }), { ...env, LUNDA_AUTH_TOKEN: '' });
    expect(result.status).toBe(204);
    expect(result.headers.get('Access-Control-Allow-Origin')).toBe(env.ALLOWED_ORIGIN);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('enforces bounded pagination and request body size', async () => {
    const fetcher = upstream(); const worker = createWorker(fetcher);
    for (const parameters of [{ offset: -1, limit: 30 }, { offset: 1500, limit: 30 }, { offset: 1, limit: 30 }, { offset: 0, limit: 1000 }]) {
      expect((await worker.fetch(request(parameters), env)).status).toBe(400);
    }
    const large = new Request('https://worker.example/tournaments', { method: 'POST', headers: { Origin: env.ALLOWED_ORIGIN, 'Content-Type': 'application/json' }, body: ' '.repeat(5000) });
    expect((await worker.fetch(large, env)).status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('ignores client scope and caches only sanitized successful responses', async () => {
    const fetcher = upstream(); const worker = createWorker(fetcher);
    const req = new Request('https://worker.example/tournaments', { method: 'POST', headers: { Origin: env.ALLOWED_ORIGIN, 'Content-Type': 'application/json' }, body: JSON.stringify({ parameters: { offset: 0, limit: 30, onlyMyInvite: true, url: 'https://evil.example' } }) });
    await worker.fetch(req, env);
    await worker.fetch(request(), env);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetcher.mock.calls[0][1]!.body as string).parameters).toMatchObject({ onlyMyInvite: false, inMyCity: true, hideFilled: false });
  });
  it('never exposes upstream error bodies or exception messages', async () => {
    for (const fetcher of [vi.fn<typeof fetch>().mockResolvedValue(new Response('PRIVATE_ERROR', { status: 401 })), vi.fn<typeof fetch>().mockRejectedValue(new Error('PRIVATE_EXCEPTION'))]) {
      const response = await createWorker(fetcher).fetch(request(), env);
      expect(response.status).toBe(502);
      expect(await response.text()).toBe('{"error":"Catalog temporarily unavailable"}');
    }
  });
  it('fails closed without secrets', async () => {
    const fetcher = upstream();
    expect((await createWorker(fetcher).fetch(request(), { ...env, LUNDA_AUTH_TOKEN: '' })).status).toBe(503);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
