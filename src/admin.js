// Yönetim sayfası (public/admin.html) için sunucu tarafı: Cloudflare ve Umami verisi gizli anahtar ister,
// bu yüzden tarayıcı doğrudan değil bu uçlardan alır. Her istekte çağıranın Supabase oturumu ve admin olduğu
// (public.is_admin()) Supabase'e sorularak doğrulanır.
//
// Cloudflare panelinde (Workers & Pages › kaydir › Settings › Variables and secrets):
//   CF_API_TOKEN   (Secret) My Profile › API Tokens › Create › izinler: Account › Account Analytics › Read
//   CF_ACCOUNT_ID  (Text)   Workers & Pages sayfasının sağındaki "Account ID"
//   CF_SITE_TAG    (Text, isteğe bağlı) Web Analytics site etiketi; token site listesini okuyamazsa elle
//   UMAMI_API_KEY  (Secret) cloud.umami.is › Settings › API keys › Create key
// Eksik olan kaynak sayfada "bağlı değil" görünür; site etkilenmez.
const SB_URL = 'https://zungbtgtlrltowkvjqso.supabase.co';
const SB_KEY = 'sb_publishable_Bgg9ZLBOaQe4nn904kRYTQ_mcy-SMYS'; // herkese açık anahtar (js/hesap.js ile aynı)
const UMAMI_ID = '08f74919-6681-4aa7-a12c-4a37ecfa130c';
const SITE_HOST = 'kaydir.dogukanparlak.com';
const SCRIPT = 'kaydir';
const DAY = 86400000;

export async function adminApi(request, url, env) {
  if (request.method !== 'GET') return json({ error:'method' }, 405);
  const auth = request.headers.get('authorization') || '';
  if (!/^Bearer \S+$/.test(auth) || !(await isAdmin(auth))) return json({ error:'not_admin' }, 403);
  const days = Math.min(90, Math.max(1, parseInt(url.searchParams.get('days'), 10) || 30));
  const route = url.pathname.slice('/api/admin/'.length);
  try {
    if (route === 'cloudflare') return json(await cloudflare(env, days));
    if (route === 'umami') return json(await umami(env, days));
  } catch (e) {
    return json({ error:'upstream', message:String(e.message || e).slice(0, 300) }, 502);
  }
  return json({ error:'route' }, 404);
}

async function isAdmin(auth) {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/is_admin`, {
    method:'POST', headers:{ apikey:SB_KEY, authorization:auth, 'content-type':'application/json' }, body:'{}',
  });
  return r.ok && (await r.json()) === true;
}

/* ---- Cloudflare: Web Analytics (RUM) + Worker istekleri, GraphQL ---- */
async function cloudflare(env, days) {
  if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) return { connected:false, missing:['CF_API_TOKEN', 'CF_ACCOUNT_ID'].filter(k => !env[k]) };
  const since = new Date(Date.now() - (days - 1) * DAY).toISOString().slice(0, 10);
  const out = { connected:true, days, since };
  // Web Analytics site etiketi: alan adına göre listeden bulunur (elle girmeye gerek yok)
  const sites = await cfRest(env, `/accounts/${env.CF_ACCOUNT_ID}/rum/site_info/list?per_page=50`).catch(e => ({ error:e.message }));
  const site = (sites.result || []).find(s => s.host === SITE_HOST || s.ruleset?.zone_name === SITE_HOST) || (sites.result || [])[0];
  out.siteTag = env.CF_SITE_TAG || site?.site_tag || null; // CF_SITE_TAG (Text): liste izni yoksa elle
  if (sites.error) out.rumError = sites.error;
  const q = `query($acc: string!, $since: Date!, $sinceT: Time!, $site: string, $script: string) {
    viewer { accounts(filter: { accountTag: $acc }) {
      ${out.siteTag ? `
      daily: rumPageloadEventsAdaptiveGroups(limit: 100, filter: { siteTag: $site, date_geq: $since }, orderBy: [date_ASC]) {
        count sum { visits } dimensions { date } }
      countries: rumPageloadEventsAdaptiveGroups(limit: 8, filter: { siteTag: $site, date_geq: $since }, orderBy: [count_DESC]) {
        count dimensions { countryName } }
      referers: rumPageloadEventsAdaptiveGroups(limit: 8, filter: { siteTag: $site, date_geq: $since }, orderBy: [count_DESC]) {
        count dimensions { refererHost } }
      devices: rumPageloadEventsAdaptiveGroups(limit: 5, filter: { siteTag: $site, date_geq: $since }, orderBy: [count_DESC]) {
        count dimensions { deviceType } }` : ''}
      worker: workersInvocationsAdaptive(limit: 100, filter: { scriptName: $script, datetime_geq: $sinceT }, orderBy: [date_ASC]) {
        sum { requests errors subrequests } quantiles { cpuTimeP50 } dimensions { date } }
    } } }`;
  const r = await cfRest(env, '/graphql', { query:q, variables:{ acc:env.CF_ACCOUNT_ID, since, sinceT:since + 'T00:00:00Z', site:out.siteTag, script:SCRIPT } });
  if (r.errors?.length) out.graphqlErrors = r.errors.map(e => e.message).slice(0, 3);
  const a = r.data?.viewer?.accounts?.[0] || {};
  out.daily = (a.daily || []).map(g => ({ day:g.dimensions.date, pageviews:g.count, visits:g.sum.visits }));
  out.countries = (a.countries || []).map(g => ({ k:g.dimensions.countryName || '?', n:g.count }));
  out.referers = (a.referers || []).map(g => ({ k:g.dimensions.refererHost || '(doğrudan)', n:g.count }));
  out.devices = (a.devices || []).map(g => ({ k:g.dimensions.deviceType || '?', n:g.count }));
  // Worker: aynı gün birden çok satır gelebilir (sürüm/durum), güne topla
  const w = {};
  for (const g of a.worker || []) {
    const d = (w[g.dimensions.date] ||= { day:g.dimensions.date, requests:0, errors:0, subrequests:0 });
    d.requests += g.sum.requests; d.errors += g.sum.errors; d.subrequests += g.sum.subrequests;
  }
  out.worker = Object.values(w).sort((x, y) => x.day < y.day ? -1 : 1);
  return out;
}
async function cfRest(env, path, body) {
  const r = await fetch('https://api.cloudflare.com/client/v4' + path, {
    method:body ? 'POST' : 'GET',
    headers:{ authorization:'Bearer ' + env.CF_API_TOKEN, 'content-type':'application/json' },
    body:body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok && !d.errors) throw new Error('Cloudflare ' + r.status);
  if (!r.ok) throw new Error('Cloudflare ' + r.status + ': ' + (d.errors?.[0]?.message || ''));
  return d;
}

/* ---- Umami Cloud API ---- */
async function umami(env, days) {
  if (!env.UMAMI_API_KEY) return { connected:false, missing:['UMAMI_API_KEY'] };
  const endAt = Date.now(), startAt = endAt - days * DAY;
  const base = `https://api.umami.is/v1/websites/${UMAMI_ID}`, range = `startAt=${startAt}&endAt=${endAt}`;
  const get = p => fetch(base + p, { headers:{ authorization:'Bearer ' + env.UMAMI_API_KEY, accept:'application/json' } })
    .then(async r => { if (!r.ok) throw new Error('Umami ' + r.status + ' ' + p.split('?')[0]); return r.json(); });
  const metric = type => get(`/metrics?${range}&type=${type}&limit=8`).catch(() => []);
  const [stats, series, active, pages, refs, countries, browsers, devices] = await Promise.all([
    get(`/stats?${range}`),
    get(`/pageviews?${range}&unit=day&timezone=Europe/Istanbul`).catch(() => ({})),
    get('/active').catch(() => ({})),
    metric('path').then(x => x.length ? x : metric('url')), metric('referrer'), metric('country'), metric('browser'), metric('device'),
  ]);
  // Eski sürüm yanıtı { pageviews: { value, prev } } biçimindeydi; ikisini de düz sayıya indir
  const num = v => typeof v === 'object' && v ? +v.value || 0 : +v || 0;
  const xy = arr => (arr || []).map(p => ({ k:p.x, n:p.y }));
  return {
    connected:true, days,
    stats:{ pageviews:num(stats.pageviews), visitors:num(stats.visitors), visits:num(stats.visits), bounces:num(stats.bounces), totaltime:num(stats.totaltime) },
    active:num(active.visitors ?? active.x ?? 0),
    daily:(series.pageviews || []).map((p, i) => ({ day:String(p.x).slice(0, 10), pageviews:p.y, sessions:series.sessions?.[i]?.y ?? null })),
    pages:xy(pages), referrers:xy(refs), countries:xy(countries), browsers:xy(browsers), devices:xy(devices),
  };
}

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers:{ 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store' } });
