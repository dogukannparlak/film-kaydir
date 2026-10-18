// Cloudflare Worker: public/ klasörünü statik site olarak sunar, /api/tmdb/* isteklerini TMDB'ye iletir.
// TMDB anahtarı Cloudflare'de gizli değişken (secret) TMDB_KEY olarak durur: koda, repoya ve tarayıcıya hiç girmez.
// Panelden: Workers & Pages › kaydir › Settings › Variables and secrets › Add › Secret › TMDB_KEY
const TMDB = 'https://api.themoviedb.org/3';
const CACHE_SECONDS = 6 * 3600; // aynı liste/detay isteği 6 saat kenar önbellekten döner
// Yalnız sitenin kullandığı TMDB yolları: ara katman genel amaçlı TMDB vekili olmasın
const ALLOWED = [
  /^\/configuration$/,
  /^\/search\/(movie|tv|multi|collection|person)$/,
  /^\/discover\/(movie|tv)$/,
  /^\/(movie|tv)\/\d+(\/videos)?$/,
  /^\/collection\/\d+$/,
  /^\/watch\/providers\/(movie|tv)$/,
  /^\/genre\/(movie|tv)\/list$/,
];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/tmdb/')) {
      try { return await tmdbProxy(request, url, env, ctx); }
      catch (e) { console.error('tmdb proxy', e); return json({ error:'upstream' }, 502); }
    }
    return env.ASSETS.fetch(request);
  },
};

async function tmdbProxy(request, url, env, ctx) {
  if (request.method !== 'GET') return json({ error:'method' }, 405);
  if (!fromOwnSite(request, url)) return json({ error:'origin' }, 403);
  // IP başına hız sınırı (wrangler.jsonc › ratelimits): köken başlığı taklit edilebildiği için asıl koruma bu
  if (env.TMDB_RL) {
    const { success } = await env.TMDB_RL.limit({ key: request.headers.get('cf-connecting-ip') || 'yok' });
    if (!success) return new Response(JSON.stringify({ error:'rate' }), { status:429, headers:{ 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store', 'retry-after':'10' } });
  }
  if (!env.TMDB_KEY) return json({ error:'no_key' }, 503);
  const path = url.pathname.slice('/api/tmdb'.length); // /discover/movie
  if (!ALLOWED.some(re => re.test(path))) return json({ error:'path' }, 400);

  // Önbellek anahtarı anahtarsız genel adres: aynı istek herkese aynı yanıtı verir
  const cache = caches.default, cacheKey = new Request(url.toString());
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  const target = new URL(TMDB + path);
  for (const [k, v] of url.searchParams) if (k !== 'api_key') target.searchParams.set(k, v);
  const headers = { accept:'application/json' };
  // v4 okuma erişim jetonu (eyJ...) Bearer ile, v3 anahtar api_key ile gider
  if (env.TMDB_KEY.startsWith('eyJ')) headers.Authorization = 'Bearer ' + env.TMDB_KEY;
  else target.searchParams.set('api_key', env.TMDB_KEY);

  const up = await fetch(target, { headers });
  const res = new Response(up.body, { status:up.status, headers:{
    'content-type':'application/json; charset=utf-8',
    'cache-control': up.ok ? `public, max-age=${CACHE_SECONDS}` : 'no-store',
  } });
  if (up.ok) ctx.waitUntil(cache.put(cacheKey, res.clone()));
  return res;
}

// Yalnız sitenin kendi sayfalarından gelen istekler: tarayıcı aynı kaynaktan gelen isteği Sec-Fetch-Site ile,
// eski tarayıcılar Origin/Referer ile bildirir. Tarayıcı dışı araçlar bunu taklit edebilir; amaç gelişigüzel kullanımı kesmek.
function fromOwnSite(request, url) {
  if (request.headers.get('sec-fetch-site') === 'same-origin') return true;
  const src = request.headers.get('origin') || request.headers.get('referer');
  try { return !!src && new URL(src).host === url.host; } catch { return false; }
}

const json = (body, status) => new Response(JSON.stringify(body), { status, headers:{ 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store' } });
