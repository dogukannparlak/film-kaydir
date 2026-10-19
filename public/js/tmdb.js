'use strict';
/* ================= TMDB ================= */
class AuthError extends Error {}
// Kendi anahtarı varsa TMDB'ye doğrudan, yoksa sitenin ara katmanından (ortak bağlantı) gider
const tmdbReady = () => !!S.apiKey || (!!TMDB_PROXY && !S.proxyDown);
async function tmdb(path, params = {}) {
  const own = !!S.apiKey;
  const url = own ? new URL(API + path) : new URL(TMDB_PROXY + path, location.origin);
  const headers = { accept: 'application/json' };
  // v4 "okuma erişim jetonu" (eyJ...) Bearer ile, v3 anahtar api_key ile gider
  if (own && S.apiKey.startsWith('eyJ')) headers.Authorization = 'Bearer ' + S.apiKey;
  else if (own) url.searchParams.set('api_key', S.apiKey);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  // Ortak bağlantıda hız sınırı (429): bekleyip en çok 3 kez yeniden dene
  let r;
  for (let attempt = 0; ; attempt++) {
    r = await fetch(url, { headers });
    if (r.status !== 429 || attempt >= 3) break;
    await new Promise(res => setTimeout(res, (+r.headers.get('retry-after') || 2 + attempt * 3) * 1000));
  }
  // Ortak bağlantı çalışmıyor (sunucu anahtarı yok/geçersiz, ara katman yok): kendi anahtarını isteyelim
  if (!own && [401, 403, 404, 503].includes(r.status)) { S.proxyDown = true; throw new AuthError('proxy'); }
  if (r.status === 401) throw new AuthError('auth');
  if (!r.ok) throw new Error('TMDB ' + r.status);
  return r.json();
}
function norm(r, type) {
  return {
    key: `${type}:${r.id}`, id: r.id, type,
    title: r.title || r.name || r.original_title || r.original_name || '—',
    originalTitle: r.original_title || r.original_name || '',
    poster: r.poster_path, date: r.release_date || r.first_air_date || '',
    rating: r.vote_average || 0, votes: r.vote_count || 0,
    genres: r.genre_ids || [], overview: r.overview || '',
  };
}
// Boş seçim = hepsi
const selRegions = f => f.regions.length ? REGIONS.filter(r => f.regions.includes(r.id)) : [REGIONS[0]];
const selPeriods = f => f.periods.length ? PERIODS.filter(p => f.periods.includes(p.id)) : [PERIODS[0]];
function periodRange(p, f) {
  if (p.id === 'custom') {
    const a = clamp(+f.from || 1900, 1900, NOW_Y), b = clamp(+f.to || NOW_Y, 1900, NOW_Y);
    return [Math.min(a, b), Math.max(a, b)];
  }
  return [p.from, p.to];
}
function genreIds(type, sel) {
  if (!sel.length) return [];
  const ids = new Set();
  GENRES.filter(g => sel.includes(g.id)).forEach(g => (type === 'movie' ? g.m : g.t).forEach(i => ids.add(i)));
  return ids.size ? [...ids] : null; // null: seçilen türlerin bu içerik tipinde karşılığı yok
}
function baseParams(type, reg) {
  const f = S.filters;
  const g = genreIds(type, f.genres);
  if (g === null) return null;
  const p = { language:LOCALE, include_adult:false, 'vote_count.gte': f.minVotes, ...reg.p };
  if (f.minRating > 0) p['vote_average.gte'] = f.minRating;
  if (g.length) p.with_genres = g.join('|');
  else if (reg.anime) p.with_genres = '16';
  if (f.providers.length) {
    p.with_watch_providers = f.providers.join('|');
    p.with_watch_monetization_types = 'flatrate|free|ads';
  }
  if (type === 'tv') p.include_null_first_air_dates = false;
  return p;
}
function dateParams(type, y0, y1) {
  const pre = type === 'movie' ? 'primary_release_date' : 'first_air_date';
  const p = {};
  if (y0) p[pre + '.gte'] = `${y0}-01-01`;
  const lte = y1 ? `${y1}-12-31` : TODAY;
  p[pre + '.lte'] = lte < TODAY ? lte : TODAY; // henüz çıkmamışları gösterme
  return p;
}
// Her kaynak ayrı bir TMDB akışıdır: dönemler ve bölgeler tek sorguda "ya da" ile birleşemez
function sources() {
  const f = S.filters, out = [];
  for (const type of f.type === 'both' ? ['movie', 'tv'] : [f.type])
    for (const reg of selRegions(f)) {
      const base = baseParams(type, reg);
      if (!base) continue;
      // Platform seçiliyse her ülke ayrı akış (platform herhangi bir ülkede varsa gelir); seçili değilse ülke önemsiz
      for (const c of f.providers.length ? WATCH_REGIONS : [null])
        for (const p of selPeriods(f))
          out.push({ key:`${type}|${reg.id}|${p.id}|${c || '-'}`, type, reg, pid:p.id, range:periodRange(p, f),
            base: c ? { ...base, watch_region:c } : base });
    }
  return out;
}
function accept(it) {
  if (!it.poster || it.votes < S.filters.minVotes) return false;
  if (S.seen.has(it.key) || S.queued.has(it.key)) return false;
  return true;
}
