// Sanity (App Transitions project) -> Zapp Pipes2 feeds.
// Pure functions: give them the Sanity data, get back feed JSON. No network here, so the same code
// runs in the Vercel function, in tests and in the sample builder.

export const SANITY = { projectId: '9fphvkc2', dataset: 'production', apiVersion: '2025-02-19' };

// One GROQ query for everything the feeds need (17 titles and 4 collections today, well under a request's limits).
export const QUERY = `{
  "titles": *[_type == "title"] | order(name asc){
    _id, name, slug, kind, badge, synopsis, genres, year, runtimeMinutes, imdbRating, ageRating, features,
    "poster": poster.asset->url, "keyArt": keyArt.asset->url, "still": still.asset->url, "logo": logo.asset->url,
    "trailer": trailer.asset->url, "heroClip": heroClip.asset->url, "related": related[]->slug,
    seasons[]{ number, "episodes": episodes[]{ number, name, runtimeMinutes, synopsis } }
  },
  "collections": *[_type == "collection"]{ _id, name, layout, opensAs, "titles": titles[]->slug }
}`;

export const slugify = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const img = (url, w) => (url ? `${url}?w=${w}&auto=format` : null);
const fmtRuntime = m => (m ? (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60 ? `${m % 60}m` : ''}`.trim() : `${m}m`) : '');
const clock = m => (m ? `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` : '');
const seasonsLabel = n => `${n} Season${n === 1 ? '' : 's'}`;
const join = parts => parts.filter(Boolean).join('  ·  ');

// Image keys: the Zapp ones (image_base, thumb_1..3) plus named keys a cell can ask for by name.
function media(t, base) {
  const items = [
    ['image_base', img(base, 1600)],
    ['thumb_1', img(t.logo, 800)],
    ['thumb_2', img(t.poster, 1000)],
    ['thumb_3', img(t.still, 1600)],
    ['key_art', img(t.keyArt, 1600)],
    ['poster', img(t.poster, 1000)],
    ['still', img(t.still, 1600)],
    ['logo', img(t.logo, 800)],
  ];
  return [{ type: 'image', media_item: items.map(([key, src]) => ({ key, src })) }];
}

const playable = t => t.trailer || t.heroClip || null;

// A movie or series as an entry. Movies open the "movie" screen, series the "tv-show" screen (layout content_types).
export function titleEntry(t, ctx) {
  const series = t.kind === 'series';
  const seasons = (t.seasons || []).length;
  const eps = (t.seasons || []).reduce((n, s) => n + (s.episodes || []).length, 0);
  const genre = (t.genres || [])[0] || '';
  const src = playable(t);
  return {
    id: t.slug,
    title: t.name,
    summary: t.synopsis || '',
    type: { value: series ? 'tv-show' : 'movie' },
    ...(src ? { content: { src, type: 'video/mp4' } } : {}),
    media_group: media(t, t.keyArt || t.still || t.poster),
    extensions: {
      slug: t.slug,
      contentType: series ? 'TV Show' : 'Movie',
      cta: t.badge || (t.year >= new Date().getFullYear() ? 'New' : ''),
      tag: series ? 'TV Show' : 'Movie',
      genre,
      genres: (t.genres || []).join(', '),
      year: t.year ? String(t.year) : '',
      rating: t.ageRating || '',
      imdb: t.imdbRating ? String(t.imdbRating) : '',
      features: (t.features || []).join(','),
      meta: join([genre, t.year, series ? seasonsLabel(seasons) : fmtRuntime(t.runtimeMinutes)]),
      runtime: series ? seasonsLabel(seasons) : fmtRuntime(t.runtimeMinutes),
      formattedRuntime: series ? '' : clock(t.runtimeMinutes),
      ...(series ? { seasons: String(seasons), episodes: String(eps) } : { duration: (t.runtimeMinutes || 0) * 60 }),
      ...(t.heroClip || t.trailer ? { preview_playback: t.heroClip || t.trailer } : {}),
      // feeds the show screen can load for this entry
      ...(series ? { seasons_feed_url: `${ctx.base}/feeds/shows/${t.slug}/seasons`, episodes_feed_url: `${ctx.base}/feeds/shows/${t.slug}/episodes` } : {}),
      related_feed_url: `${ctx.base}/feeds/titles/${t.slug}/related`,
    },
  };
}

// A season as an entry that links to its episode feed (e.g. a tab in the Tabs component: "Season 1").
export function seasonEntry(t, s, ctx) {
  const n = (s.episodes || []).length;
  return {
    id: `${t.slug}-s${s.number}`,
    title: `Season ${s.number}`,
    summary: `${n} episode${n === 1 ? '' : 's'}`,
    type: { value: 'feed' },
    link: { href: `${ctx.base}/feeds/shows/${t.slug}/seasons/${s.number}`, type: 'feed' },
    media_group: media(t, t.still || t.keyArt),
    extensions: { show: t.name, slug: t.slug, season: String(s.number), episodes: String(n), meta: `${n} Episodes` },
  };
}

export function episodeEntry(t, s, e, ctx) {
  const src = playable(t);
  const code = `S${s.number}:E${e.number}`;
  return {
    id: `${t.slug}-s${s.number}e${e.number}`,
    title: e.name || `Episode ${e.number}`,
    summary: e.synopsis || t.synopsis || '',
    type: { value: 'video' },
    ...(src ? { content: { src, type: 'video/mp4' } } : {}),
    media_group: media(t, t.still || t.keyArt),
    extensions: {
      show: t.name, slug: t.slug, season: String(s.number), episode: String(e.number),
      'episode-name': e.name || `Episode ${e.number}`,
      'episode-number': code,
      runtime: fmtRuntime(e.runtimeMinutes),
      formattedRuntime: clock(e.runtimeMinutes),
      duration: (e.runtimeMinutes || 0) * 60,
      meta: join([code, fmtRuntime(e.runtimeMinutes)]),
    },
  };
}

const feed = (id, title, entry, extensions = {}) => ({ id, title, type: { value: 'feed' }, extensions, entry });

// Routes. Everything returns a feed, or null when the thing asked for doesn't exist.
export function route(path, query, data, ctx) {
  const bySlug = new Map(data.titles.map(t => [t.slug, t]));
  const p = path.replace(/\/+$/, '').split('/').filter(Boolean);
  const limit = Math.max(0, parseInt(query.limit, 10) || 0);
  const cap = list => (limit ? list.slice(0, limit) : list);

  if (p[0] !== 'feeds') return null;
  // /feeds/collections and /feeds/collections/:slug
  if (p[1] === 'collections' && !p[2]) {
    return feed('collections', 'Collections', data.collections.map(c => ({
      id: slugify(c.name), title: c.name, type: { value: 'feed' },
      link: { href: `${ctx.base}/feeds/collections/${slugify(c.name)}`, type: 'feed' },
      extensions: { layout: c.layout || '', opensAs: c.opensAs || '', count: String((c.titles || []).length) },
    })));
  }
  if (p[1] === 'collections' && p[2]) {
    const c = data.collections.find(x => slugify(x.name) === p[2] || x._id === p[2]);
    if (!c) return null;
    const list = (c.titles || []).map(s => bySlug.get(s)).filter(Boolean);
    return feed(slugify(c.name), c.name, cap(list).map(t => titleEntry(t, ctx)), { layout: c.layout || '' });
  }
  // /feeds/titles?kind=movie|series&genre=Drama, /feeds/titles/:slug, /feeds/titles/:slug/related
  if (p[1] === 'titles' && !p[2]) {
    const kind = query.kind === 'series' || query.kind === 'tv-show' ? 'series' : query.kind === 'movie' ? 'movie' : null;
    const genre = (query.genre || '').toLowerCase();
    const list = data.titles.filter(t => (!kind || t.kind === kind) && (!genre || (t.genres || []).some(g => g.toLowerCase() === genre)));
    return feed(['titles', kind, genre].filter(Boolean).join('-'), kind === 'series' ? 'TV Shows' : kind === 'movie' ? 'Movies' : 'All titles', cap(list).map(t => titleEntry(t, ctx)));
  }
  if (p[1] === 'titles' && p[2]) {
    const t = bySlug.get(p[2]);
    if (!t) return null;
    if (p[3] === 'related') return feed(`${t.slug}-related`, 'More Like This', cap((t.related || []).map(s => bySlug.get(s)).filter(Boolean)).map(x => titleEntry(x, ctx)));
    return feed(t.slug, t.name, [titleEntry(t, ctx)]);
  }
  // /feeds/shows/:slug/seasons, /feeds/shows/:slug/seasons/:n, /feeds/shows/:slug/episodes
  if (p[1] === 'shows' && p[2]) {
    const t = bySlug.get(p[2]);
    if (!t || t.kind !== 'series') return null;
    const seasons = [...(t.seasons || [])].sort((a, b) => a.number - b.number);
    if (p[3] === 'seasons' && !p[4]) return feed(`${t.slug}-seasons`, t.name, seasons.map(s => seasonEntry(t, s, ctx)), { show: t.name, seasons: String(seasons.length) });
    if (p[3] === 'seasons' && p[4]) {
      const s = seasons.find(x => String(x.number) === p[4]);
      if (!s) return null;
      return feed(`${t.slug}-s${s.number}`, `Season ${s.number}`, cap((s.episodes || []).map(e => episodeEntry(t, s, e, ctx))), { show: t.name, season: String(s.number) });
    }
    if (p[3] === 'episodes') return feed(`${t.slug}-episodes`, t.name, cap(seasons.flatMap(s => (s.episodes || []).map(e => episodeEntry(t, s, e, ctx)))), { show: t.name });
  }
  return null;
}

// The endpoints manifest Zapp reads to list this service's feeds in Data Sources -> Endpoints.
export function manifest(base) {
  const P2 = 'application/vnd+applicaster.pipes2+json';
  const ep = (path, name, modifiers) => [`${base}${path}`, { name, method: 'get', mime_type: P2, context_obj: [], ...(modifiers ? { modifiers } : {}) }];
  const limit = { key: 'limit', type: 'number', label: 'Item limit', required: false };
  return {
    endpoints: Object.fromEntries([
      ep('/feeds/collections', 'Collections (list)'),
      ep('/feeds/collections/{{collection}}', 'Collection by name (image-hero, video-hero, most-popular, rail)', [limit]),
      ep('/feeds/titles', 'Titles', [
        { key: 'kind', type: 'select', label: 'Type', options: [{ label: 'All', value: '' }, { label: 'Movies', value: 'movie' }, { label: 'TV Shows', value: 'series' }], required: false },
        { key: 'genre', type: 'text', label: 'Genre', required: false }, limit,
      ]),
      ep('/feeds/titles/{{slug}}', 'Title by id (one entry, for a detail hero)'),
      ep('/feeds/titles/{{slug}}/related', 'More like this', [limit]),
      ep('/feeds/shows/{{slug}}/seasons', 'Show seasons (one entry per season, linking to its episodes)'),
      ep('/feeds/shows/{{slug}}/seasons/{{season}}', 'Season episodes', [limit]),
      ep('/feeds/shows/{{slug}}/episodes', 'All episodes of a show', [limit]),
    ]),
  };
}
