// One Vercel function for every route (vercel.json sends /feeds/* and /v1/* here).
import { SANITY, QUERY, route, manifest } from '../lib/feeds.mjs';

let cache = { at: 0, data: null };
const TTL = 60 * 1000; // re-read Sanity at most once a minute per warm instance

async function load() {
  if (cache.data && Date.now() - cache.at < TTL) return cache.data;
  const url = `https://${SANITY.projectId}.apicdn.sanity.io/v${SANITY.apiVersion}/data/query/${SANITY.dataset}?query=${encodeURIComponent(QUERY)}&perspective=published`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Sanity answered ${r.status}`);
  const { result } = await r.json();
  cache = { at: Date.now(), data: result };
  return result;
}

export default async function handler(req, res) {
  const u = new URL(req.url, `https://${req.headers.host}`);
  const path = u.searchParams.get('path') ? `/${u.searchParams.get('path')}` : u.pathname;
  const base = `https://${req.headers['x-forwarded-host'] || req.headers.host}`;
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
  try {
    if (/^\/v1\/endpoints-manifest\/?$/.test(path)) return res.status(200).json(manifest(base));
    const query = Object.fromEntries(u.searchParams);
    const out = route(path, query, await load(), { base });
    if (!out) return res.status(404).json({ error: `No feed at ${path}` });
    res.setHeader('Content-Type', 'application/vnd+applicaster.pipes2+json; charset=utf-8');
    return res.status(200).send(JSON.stringify(out));
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
}
