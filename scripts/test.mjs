// Checks every feed has the shape the platform's sample feeds use.
import { readFileSync } from 'node:fs';
import { route } from '../lib/feeds.mjs';
const data = JSON.parse(readFileSync(new URL('../fixtures/sanity.json', import.meta.url)));
const ctx = { base: 'https://x' }; let bad = 0, n = 0;
const check = (p, f) => {
  if (!f || !Array.isArray(f.entry) || !f.title || f.type?.value !== 'feed') { console.log('BAD FEED', p); bad++; return; }
  for (const e of f.entry) { n++;
    const miss = ['id', 'title', 'type', 'media_group', 'extensions'].filter(k => e[k] === undefined);
    if (miss.length || !e.media_group[0]?.media_item?.some(m => m.key === 'image_base')) { console.log('BAD ENTRY', p, e.id, miss); bad++; }
  }
};
for (const t of data.titles) {
  check(`/feeds/titles/${t.slug}`, route(`/feeds/titles/${t.slug}`, {}, data, ctx));
  if (t.kind === 'series') {
    check(`/feeds/shows/${t.slug}/seasons`, route(`/feeds/shows/${t.slug}/seasons`, {}, data, ctx));
    for (const s of t.seasons) check(`season ${s.number}`, route(`/feeds/shows/${t.slug}/seasons/${s.number}`, {}, data, ctx));
  }
}
for (const c of data.collections) check(c.name, route(`/feeds/collections/${c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, {}, data, ctx));
console.log(bad ? `${bad} problems` : `OK: ${n} entries across every title, show, season and collection feed`);
process.exit(bad ? 1 : 0);
