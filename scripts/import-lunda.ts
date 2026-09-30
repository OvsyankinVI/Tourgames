import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseLundaPage } from '../src/api/normalize.ts';

// Read saved JSON responses from OUTSIDE the repo. Only whitelisted normalized fields
// are written to an ignored local directory; raw data is never copied or logged.
async function main() {
  const paths = process.argv.slice(2);
  if (!paths.length) throw new Error('Usage: npm run import:lunda -- /outside/repo/page-0.json [page-30.json ...]');
  const pages = [];
  for (const path of paths) pages.push(parseLundaPage(JSON.parse(await readFile(resolve(path), 'utf8'))));
  const unique = new Map(pages.flatMap(p => p.items).map(t => [t.id, t]));
  await mkdir('.local', { recursive: true, mode: 0o700 });
  await writeFile('.local/tournaments.json', JSON.stringify({
    items: [...unique.values()], source: 'snapshot',
    complete: pages.at(-1)?.hasNext === false,
    skipped: pages.reduce((n, p) => n + p.skipped, 0),
  }), { mode: 0o600 });
  console.log(`Imported ${unique.size} tournaments. Open /Tourgames/?source=local in npm run dev.`);
}
main().catch(() => { console.error('Import failed. Check file paths and result.infos / result.hasNext structure.'); process.exitCode = 1; });
