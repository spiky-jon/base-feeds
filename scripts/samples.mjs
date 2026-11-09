// Writes example responses from the fixture (a snapshot of Sanity) to samples/, for review and the preview.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { route, manifest } from '../lib/feeds.mjs';
const data = JSON.parse(readFileSync(new URL('../fixtures/sanity.json', import.meta.url)));
const base = process.argv[2] || 'https://base-feeds.vercel.app';
const out = new URL('../samples/', import.meta.url); mkdirSync(out, { recursive: true });
const paths = ['/feeds/collections', ...data.collections.map(c => `/feeds/collections/${c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`),
  '/feeds/titles', '/feeds/titles?kind=movie', '/feeds/titles?kind=series', '/feeds/titles/project-hail-mary', '/feeds/titles/hijack/related',
  '/feeds/shows/stranger-things/seasons', '/feeds/shows/stranger-things/seasons/1', '/feeds/shows/hijack/seasons', '/feeds/shows/hijack/seasons/2', '/feeds/shows/east-of-eden/episodes'];
for (const p of paths) {
  const [path, qs] = p.split('?');
  const feed = route(path, Object.fromEntries(new URLSearchParams(qs || '')), data, { base });
  const name = p.replace(/^\/feeds\//, '').replace(/[/?=]+/g, '_') + '.json';
  writeFileSync(new URL(name, out), JSON.stringify(feed, null, 2));
  console.log(`${p.padEnd(44)} ${feed ? feed.entry.length + ' entries' : 'NOT FOUND'}  → samples/${name}`);
}
writeFileSync(new URL('endpoints-manifest.json', out), JSON.stringify(manifest(base), null, 2));
