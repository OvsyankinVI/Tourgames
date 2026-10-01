import { normalizeTournament, record } from '../src/api/normalize';

export interface Env {
  LUNDA_AUTH_TOKEN: string;
  LUNDA_PROFILE_ID: string;
  ALLOWED_ORIGIN: string;
}

const UPSTREAM = 'https://appcloud.lundapadel.ru/api/tourgame/load-list';
const LIMIT = 30;
const MAX_PAGES = 50;

// Return the existing provider's envelope, but only whitelisted catalog fields.
// Never forward raw upstream JSON, headers, cookies, owner or participant identities.
export function publicInfo(raw: unknown) {
  const t = normalizeTournament(raw);
  if (!t) return null;
  return {
    uid: t.id, title: t.title, plannedDate: t.startAt, duration: t.durationMinutes,
    price: t.price, tournamentStatus: t.status, kind: t.formatCode, kindName: t.formatName,
    teamType: t.isTeam === null ? null : t.isTeam ? 'TEAM' : 'INDIVIDUAL',
    countPlayers: t.playersCount, playersLimit: t.playersLimit,
    countParticipantTeams: t.teamsCount, teamsLimit: t.teamsLimit,
    minGrade: t.minGrade, maxGrade: t.maxGrade,
    displayMinGrade: t.displayMinGrade, displayMaxGrade: t.displayMaxGrade,
    minRating: t.minRating, maxRating: t.maxRating, genders: t.genders, ranking: t.ranking,
    clubInfo: { uid: t.club.id, displayName: t.club.name, address: t.club.address, city: t.club.city },
    organizerInfo: { uid: t.organizer.id, name: t.organizer.name },
  };
}

async function boundedText(body: ReadableStream<Uint8Array> | null, maxBytes: number): Promise<string> {
  if (!body) throw new Error('Missing body');
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) { await reader.cancel(); throw new Error('Body too large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total);
  let position = 0;
  for (const chunk of chunks) { bytes.set(chunk, position); position += chunk.length; }
  return new TextDecoder().decode(bytes);
}

export function createWorker(upstreamFetch: typeof fetch = fetch) {
  // Bounded, short-lived cache and request coalescing per Worker isolate.
  const cache = new Map<number, { until: number; body: string }>();
  const pending = new Map<number, Promise<string>>();
  return {
    async fetch(request: Request, env: Env): Promise<Response> {
      const url = new URL(request.url);
      const origin = request.headers.get('Origin');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json', 'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff', Vary: 'Origin',
      };
      const reply = (status: number, message: string) => new Response(JSON.stringify({ error: message }), { status, headers });
      if (!env.ALLOWED_ORIGIN || origin !== env.ALLOWED_ORIGIN) return reply(403, 'Origin not allowed');
      headers['Access-Control-Allow-Origin'] = env.ALLOWED_ORIGIN;
      if (url.pathname !== '/tournaments' || url.search) return reply(404, 'Not found');
      if (request.method === 'OPTIONS') {
        if (request.headers.get('Access-Control-Request-Method') !== 'POST') return reply(405, 'Method not allowed');
        const requested = (request.headers.get('Access-Control-Request-Headers') || '').toLowerCase().split(',').map(x => x.trim()).filter(Boolean);
        if (requested.some(x => !['content-type', 'accept'].includes(x))) return reply(403, 'Header not allowed');
        return new Response(null, { status: 204, headers: {
          ...headers, 'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Accept', 'Access-Control-Max-Age': '600',
        } });
      }
      if (request.method !== 'POST') return reply(405, 'Method not allowed');
      if (!env.LUNDA_AUTH_TOKEN || !env.LUNDA_PROFILE_ID) return reply(503, 'Catalog not configured');
      if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) return reply(415, 'JSON required');
      let offset: number;
      try {
        const parameters = record(record(JSON.parse(await boundedText(request.body, 4096))).parameters);
        offset = parameters.offset as number;
        if (!Number.isInteger(offset) || offset < 0 || offset >= LIMIT * MAX_PAGES || offset % LIMIT !== 0 || parameters.limit !== LIMIT) {
          return reply(400, 'Invalid pagination');
        }
      } catch { return reply(400, 'Invalid request'); }

      const cached = cache.get(offset);
      if (cached && cached.until > Date.now()) return new Response(cached.body, { headers });
      if (!pending.has(offset)) {
        if (pending.size >= 2) return reply(429, 'Try again later');
        const load = async () => {
          const response = await upstreamFetch(UPSTREAM, {
            method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15_000),
            headers: {
              Accept: 'application/json', 'Content-Type': 'application/json',
              'X-Auth-Token': env.LUNDA_AUTH_TOKEN,
              Cookie: `auth-token=${env.LUNDA_AUTH_TOKEN}`,
              'X-Profile-Id': env.LUNDA_PROFILE_ID,
              'X-App-Version': '38.0.5', 'X-Current-App-Page': 'capacitor://localhost/play',
              'Accept-Language': 'ru', Origin: 'capacitor://localhost',
            },
            // Clients may only choose the page, never the target URL, profile, or scope.
            body: JSON.stringify({ parameters: {
              offset, limit: LIMIT, onlyMyRating: false, onlyMyPartners: false,
              onlyMyInvite: false, onlyTournament: false, gameSortBy: 'PLANNED_DATE',
              show: 'TOURNAMENTS', hideFilled: false, onlyFavoriteClubs: false, inMyCity: true,
            } }),
          });
          if (!response.ok) { await response.body?.cancel(); throw new Error('Upstream unavailable'); }
          const result = record(record(JSON.parse(await boundedText(response.body, 2_000_000))).result);
          if (!Array.isArray(result.infos) || result.infos.length > LIMIT || typeof result.hasNext !== 'boolean') throw new Error('Invalid upstream');
          const body = JSON.stringify({ result: {
            hasNext: result.hasNext,
            // Preserve page positions as null for skipped entries. Existing normalizer
            // reports skipped records and won't mistake a private-only page for EOF.
            infos: result.infos.map(publicInfo),
          } });
          cache.set(offset, { until: Date.now() + 60_000, body });
          return body;
        };
        pending.set(offset, load());
      }
      try { return new Response(await pending.get(offset)!, { headers }); }
      catch { return reply(502, 'Catalog temporarily unavailable'); }
      finally { pending.delete(offset); }
    },
  };
}

export default createWorker();
