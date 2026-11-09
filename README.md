# base-feeds

Zapp Pipes2 feeds built live from the **App Transitions** Sanity dataset (project `9fphvkc2`, `production`, public).
Edit a title, season or episode in Sanity Studio and the feeds follow within a minute.

## Feeds

| Path | What it returns |
|---|---|
| `/feeds/collections` | One entry per Sanity collection, each linking to its feed |
| `/feeds/collections/:name` | A collection's titles: `image-hero`, `video-hero`, `most-popular`, `rail` |
| `/feeds/titles?kind=movie\|series&genre=Drama&limit=10` | All titles, filtered |
| `/feeds/titles/:slug` | One title (for a detail screen hero), e.g. `/feeds/titles/project-hail-mary` |
| `/feeds/titles/:slug/related` | Its "related" titles |
| `/feeds/shows/:slug/seasons` | One entry per season ("Season 1", "Season 2"…), each linking to its episodes. Made for the Tabs component and its Button Cell |
| `/feeds/shows/:slug/seasons/:n` | That season's episodes |
| `/feeds/shows/:slug/episodes` | Every episode of the show, in order |
| `/v1/endpoints-manifest` | The endpoints manifest for Zapp Studio (Data Sources → Endpoints) |

Every route takes `?limit=`. Lists of titles (all titles, collections, related) also take `?kind=series` (or `tv-show`) / `?kind=movie` and `?genre=`, e.g. `/feeds/collections/rail?kind=series` for the Rail's TV shows only. Series have as many season and episode entries as Sanity holds (Stranger Things: 5 seasons, 42 episodes).

## Entries

Shaped like the platform's sample feeds (`entry`, `media_group`, `extensions`, `type`):

- **Type:** movies are `movie` and series `tv-show`, so they open the layout's Movie and TV Show screens. Seasons are
  `feed` entries with a `link` to their episode feed. Episodes are `video`.
- **Images:** `image_base` = key art (16:9), `thumb_1` = logo, `thumb_2` = poster (2:3), `thumb_3` = still (16:9),
  plus named keys `key_art`, `poster`, `still`, `logo` for cells that pick an image by key. Episodes use the show's
  still (Sanity has no episode images yet). URLs ask Sanity's CDN for a sensible width and modern format.
- **Extensions** (match the cells' data keys):
  - titles: `cta` (badge, or "New" for this year's titles), `meta` ("Drama · 2023 · 2 Seasons" / "Sci-fi · 2026 · 2h 37m"),
    `genre`, `genres`, `year`, `rating`, `imdb`, `features`, `runtime`, `formattedRuntime`, `duration`, `tag`,
    `contentType`, `preview_playback` (hero clip or trailer), and for series `seasons`, `episodes`,
    `seasons_feed_url`, `episodes_feed_url`; all have `related_feed_url`.
  - episodes: `episode-name`, `episode-number` ("S2:E1"), `runtime` ("43m"), `formattedRuntime`, `duration`, `show`,
    `season`, `episode`, `meta`.
- **Playback:** `content.src` is the title's trailer or hero clip where Sanity has one (stand-in until real streams exist).

## Show screen by id

Point the TV Show screen's components at `/feeds/shows/{{slug}}/seasons` (tabs) and the selected tab's link, or at
`/feeds/titles/{{slug}}` for the hero. Each entry carries `extensions.slug`; how the platform binds `{{slug}}` from the
tapped entry is set in Zapp (Feed Locator dynamic segments, see the endpoints guide), so check that step with the team.

## Run and deploy

- `npm test` checks every feed has the expected shape (uses `fixtures/sanity.json`, a snapshot of the dataset).
- `npm run samples` writes example responses to `samples/`.
- `node scripts/handler-test.mjs` runs the Vercel function with Sanity mocked.
- Deploy: `vercel` from this folder (no dependencies, Node 18+). `vercel.json` routes `/feeds/*` and `/v1/*` to `api/index.js`.

## To confirm with the platform team

- The modifier format in the endpoints manifest (`kind`, `genre`, `limit`) follows the guide's description; the
  guide builds them with helper functions, so the exact JSON may differ.
- How a season entry's `link` should be shaped for the Tabs component to load its episodes.
- Whether `{{slug}}` path segments or `?id=` style parameters suit the Feed Locator better.
