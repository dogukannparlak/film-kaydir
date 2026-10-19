# Kaydır · Movies & TV

English · [Türkçe](docs/README.tr.md)

**Live:** https://kaydir.dogukanparlak.com · **Author:** [Doğukan Parlak](https://dogukanparlak.com) · **License:** [PolyForm Noncommercial 1.0.0](LICENSE) (no commercial use)

Tinder-style movie and TV discovery: swipe a card right for "want", left for "pass", up for "watched".
Data comes from TMDB; IMDb / Rotten Tomatoes / Metacritic scores come from OMDb (optional).
No build step and no packages. The site lives in `public/`: open `public/index.html` in a browser.
Production runs on Cloudflare Workers, connected to GitHub: `wrangler.jsonc` serves `public/`, and `src/worker.js` is a small TMDB proxy.

The interface is available in **English and Turkish** (Settings › Language). On first visit it follows the browser language.

## Getting started

1. Open https://kaydir.dogukanparlak.com. No TMDB key is needed: the site uses its shared connection
   (`/api/tmdb/*`, see below). When `public/index.html` is opened from disk there is no shared connection, so step 2 is required.
2. Optional: Settings → paste your own TMDB key (requests then go straight to TMDB). Either works:
   - "API Read Access Token" (`eyJ...`): sent as `Authorization: Bearer`.
   - v3 "API Key" (32 characters): sent as `api_key=`.
   Get one at themoviedb.org → Settings → API.
3. Optional: Settings → OMDb key. Free key: omdbapi.com/apikey.aspx (1,000 requests a day; activate it from the e-mail link).

Your keys stay in the browser's `localStorage`. If you sign in and turn on the setting, they are also stored **encrypted** in your account (see below).

### Shared TMDB connection (Cloudflare Worker)

- `src/worker.js` serves `public/` and forwards `/api/tmdb/<path>` to `api.themoviedb.org/3/<path>`.
- The site's TMDB key is a **Cloudflare secret** (`TMDB_KEY`): it is not in the code, the repo or the browser.
- Only GET requests from the site's own pages are accepted (`Sec-Fetch-Site` / Origin / Referer), only the TMDB paths
  the site uses are allowed (`ALLOWED`), and each IP is limited to 600 requests a minute (`wrangler.jsonc › ratelimits`).
  Responses are cached at the edge for 6 hours.
- If the secret is missing or invalid, the site says the shared connection is down and asks for your own key.
- For local testing put the key in `.dev.vars` (`TMDB_KEY=…`); the file is git-ignored.

## Features

- Swipe with mouse, touch or keyboard (← → ↑), with undo.
- On phones the card fills the screen; the top bar, summary and action buttons float over it.
- Floating glass tab bars; swipe sideways to switch tabs. Sheets close by dragging down.
- Search (🔍 or `/`) across all of TMDB, including people (their known work) and film collections
  ("Move all" adds a whole collection in one step, undoable).
- Filters: movie/TV, decade, genre, region/language, minimum rating, minimum votes, streaming services
  (searched across 14 countries at once). Multiple choices mean "any of".
- Sorting: random, popular, top rated, newest, **IMDb**, **RT**.
- Titles: original title first, localized title below (when different). Non-Latin original titles show the localized title first.
- Cards show the TMDB rating, IMDb link, OMDb scores, director (creator for TV) and overview.
- Collections: card label, grouped rows in Want and Watched, and a Collections tab with progress and missing films.
- Three lists (Want, Watched, Passed) with search, filters and sorting.
- Progress marks in Watched: new season (TV) or dropped. New seasons of watched shows are detected every 12 hours.
- Watching (TV): remember season and episode, "+1 episode" jumps to the next aired episode.
- Trailers (YouTube), JSON backup export/import, Letterboxd import (zip or `watched.csv` / `watchlist.csv`).

## Account and sync (Supabase)

- Settings › Account: e-mail + password. Works without an account too (data stays in the browser).
- Signed in, your lists, seen titles and filters are saved to the account and shared between devices.
  Local first: changes go up after 1.5 s (immediately when the tab is hidden); the app pulls on open, on tab focus,
  when back online and every 30 s.
- **API keys** (Settings › "Store my API keys in my account", off by default): when on, keys are stored **encrypted**
  (`user_state.keys_enc`). The encryption key is derived from your account password in the browser
  (PBKDF2-SHA256, 310,000 rounds → AES-GCM, `js/kasa.js`); neither the plain keys nor the derived key reach the server.
  On a new device, signing in with your password brings the keys over; if the session came from an e-mail link,
  Settings asks for the password once. After a password reset the old copy cannot be opened and the keys must be entered again.
  When off, keys stay on the device only and the account copy is deleted.
- Signing out first saves everything; keys stored in the account are removed from the device (they come back on sign-in),
  keys that are not stored in the account stay on the device.
- Supabase project `kaydir` (eu-central-1). Row level security: every row is visible only to its owner.

## Analytics and admin

- Own counter (`js/istatistik.js`, table `visits`): a visit starts on load and pings every 30 s while the tab is visible →
  visits, visitors, time on site, device type, language, referrer. No cookies, no IP addresses.
  A random anonymous ID is kept in `localStorage` so return visits can be counted (no banner, on by default).
- Umami Cloud: loaded only when `UMAMI_ID` in `js/istatistik.js` is set. Cloudflare Web Analytics is also on.
- Admin panel (Settings › Admin): visible only to accounts in the `admins` table; 7/30/90-day visit summary, daily chart,
  account and list-item counts. Data comes from `admin_stats()`, which checks permissions on the server.
  Add an admin in Supabase SQL: `insert into public.admins (user_id) select id from auth.users where email = '…';`

## Security

- Security headers in `public/_headers`: CSP (scripts only from this site, jsDelivr, Cloudflare Insights and Umami),
  no framing, nosniff, referrer policy. No inline scripts or inline event handlers.
- The Supabase library is loaded with SRI (`integrity`).
- Database limits (sign-up is open): item data ≤ 16 KB, ≤ 20,000 items per user, ≤ 100,000 seen titles,
  ≤ 200 visits per visitor per day.

## Known limits

- IMDb/RT sorting in the deck is approximate: TMDB cannot search by these scores, so each batch (20–40 cards) is sorted by its OMDb score. List sorting is exact.
- Without an account data is tied to the browser: sign in or move the JSON backup.
- Streaming search covers 14 countries, not every country. Collections cover movies only.
- Titles already in your lists keep the language they were added in.

## Development

Structure (html/ fragments, css/, js/ modules), database functions and the test method: [docs/mimari.md](docs/mimari.md) (Turkish).
Tests run in headless Brave/Chromium over CDP (Node's built-in `WebSocket`) with mocked `fetch` and Supabase.

## License

[PolyForm Noncommercial License 1.0.0](LICENSE) · © 2026 Doğukan Parlak ([dogukanparlak.com](https://dogukanparlak.com)).

- **Allowed:** personal use, learning, research, modification and non-commercial sharing (keep the license text and the `Required Notice` line).
- **Not allowed:** commercial use (selling, paid services, ad-funded hosting, etc.). Ask for permission.

## Credits

- Movie and TV data and posters: [TMDB](https://www.themoviedb.org). *This product uses the TMDB API but is not endorsed or certified by TMDB.*
- Streaming availability: [JustWatch](https://www.justwatch.com) (via TMDB).
- IMDb / Rotten Tomatoes / Metacritic scores: [OMDb API](https://www.omdbapi.com). Names and logos belong to their owners.
- Trailers: YouTube. Kaydır is not affiliated with these services or with Letterboxd.

## Contact

Bugs, ideas or account deletion: via [dogukanparlak.com](https://dogukanparlak.com) or open a GitHub issue.
