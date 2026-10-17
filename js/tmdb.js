'use strict';
/* ================= TMDB ================= */
class AuthError extends Error {}
async function tmdb(path, params = {}) {
  const url = new URL(API + path);
  const headers = { accept: 'application/json' };
  // v4 "okuma erişim jetonu" (eyJ...) Bearer ile, v3 anahtar api_key ile gider
  if (S.apiKey.startsWith('eyJ')) headers.Authorization = 'Bearer ' + S.apiKey;
  else url.searchParams.set('api_key', S.apiKey);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  const r = await fetch(url, { headers });
  if (r.status === 401) throw new AuthError('auth');
  if (!r.ok) throw new Error('TMDB ' + r.status);
  return r.json();
}
function norm(r, type) {
  return {
    key: `${type}:${r.id}`, id: r.id, type,
    title: r.title || r.name || r.original_title || r.original_name || '—',
    poster: r.poster_path, date: r.release_date || r.first_air_date || '',
    rating: r.vote_average || 0, votes: r.vote_count || 0,
    genres: r.genre_ids || [], overview: r.overview || '',
  };
}
const region = () => REGIONS.find(r => r.id === S.filters.region) || REGIONS[0];
function periodRange(f) {
  if (f.period === 'custom') {
    const a = clamp(+f.from || 1900, 1900, NOW_Y), b = clamp(+f.to || NOW_Y, 1900, NOW_Y);
    return [Math.min(a, b), Math.max(a, b)];
  }
  const p = PERIODS.find(x => x.id === f.period) || PERIODS[0];
  return [p.from, p.to];
}
function genreIds(type, sel) {
  if (!sel.length) return [];
  const ids = new Set();
  GENRES.filter(g => sel.includes(g.id)).forEach(g => (type === 'movie' ? g.m : g.t).forEach(i => ids.add(i)));
  return ids.size ? [...ids] : null; // null: seçilen türlerin bu içerik tipinde karşılığı yok
}
function baseParams(type) {
  const f = S.filters, reg = region();
  const g = genreIds(type, f.genres);
  if (g === null) return null;
  const p = { language:'tr-TR', include_adult:false, 'vote_count.gte': f.minVotes, ...reg.p };
  if (f.minRating > 0) p['vote_average.gte'] = f.minRating;
  if (g.length) p.with_genres = g.join('|');
  else if (reg.anime) p.with_genres = '16';
  if (f.providers.length) {
    p.with_watch_providers = f.providers.join('|');
    p.watch_region = 'TR';
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
function activeTypes() {
  const t = S.filters.type === 'both' ? ['movie', 'tv'] : [S.filters.type];
  return t.filter(x => baseParams(x));
}
function accept(it) {
  if (!it.poster || it.votes < S.filters.minVotes) return false;
  if (S.seen.has(it.key) || S.queued.has(it.key)) return false;
  if (region().anime && !it.genres.includes(16)) return false;
  return true;
}
