// Runs the Vercel handler with Sanity mocked by the fixture.
import { readFileSync } from 'node:fs';
const data = JSON.parse(readFileSync(new URL('../fixtures/sanity.json', import.meta.url)));
globalThis.fetch = async url => { if (!/apicdn\.sanity\.io/.test(url)) throw new Error('unexpected ' + url); return { ok: true, json: async () => ({ result: data }) }; };
const { default: handler } = await import('../api/index.js');
for (const url of ['/api/index?path=v1/endpoints-manifest', '/api/index?path=feeds/shows/lioness/seasons/3&limit=2', '/api/index?path=feeds/titles&kind=movie&genre=animation', '/api/index?path=feeds/nope']) {
  let status, body, headers = {};
  const res = { setHeader: (k, v) => headers[k] = v, status(s) { status = s; return this; }, json(o) { body = JSON.stringify(o); return this; }, send(s) { body = s; return this; } };
  await handler({ url, headers: { host: 'base-feeds.vercel.app' } }, res);
  const o = JSON.parse(body);
  console.log(status, url, o.entry ? `${o.title}: ${o.entry.map(e => e.title).join(' | ')}` : Object.keys(o.endpoints || o).slice(0, 3).join(' | '));
}
