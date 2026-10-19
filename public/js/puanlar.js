'use strict';
// Kart ekrana yaklaşınca: IMDb kimliği + yönetmen (TMDB) + OMDb puanları + eksikse İngilizce özet
async function fetchIds(it) {
  if (it.imdb !== undefined && it.director !== undefined && it.age !== undefined && (it.type !== 'movie' || it.collection !== undefined)) return;
  try {
    const d = await tmdb(`/${it.type}/${it.id}`, { append_to_response:'external_ids,credits,videos,' + (it.type === 'movie' ? 'release_dates' : 'content_ratings'), include_video_language:'tr,en,null', language:LOCALE });
    it.age = ageOf(d, it.type);
    it.trailer = pickTrailer(d.videos?.results) || '';
    it.imdb = d.external_ids?.imdb_id || d.imdb_id || null;
    it.director = directorOf(d, it.type);
    if (it.type === 'movie') it.collection = collRef(d);
    if (!it.originalTitle) it.originalTitle = d.original_title || d.original_name || '';
    if (!it.overview) it.overview = d.overview || '';
  } catch {}
}
// Yaş derecelendirmesi: önce Türkiye, yoksa ABD, İngiltere, Almanya, Hollanda, Fransa… sırayla ilk okunabilen yaşa çevrilir
// (TMDB'de çoğu yapımda TR/ABD boş, Avrupa dolu). Döner: { a:'13+' | 'Genel', src:'TR' | 'US' | …, raw } ya da null.
const US_AGE = { 'G':0, 'PG':7, 'PG-13':13, 'R':18, 'NC-17':18, 'TV-Y':0, 'TV-G':0, 'TV-Y7':7, 'TV-PG':7, 'TV-14':14, 'TV-MA':18 };
const GB_AGE = { 'U':0, 'PG':7, '12A':12, '12':12, '15':15, '18':18, 'R18':18 };
const AGE_ORDER = ['TR', 'US', 'GB', 'DE', 'NL', 'FR', 'ES', 'IT', 'SE', 'DK', 'NO', 'FI', 'AT', 'CH', 'BR', 'AU', 'CA', 'KR', 'JP', 'RU'];
function certAge(c, v) {
  v = String(v || '').trim();
  if (!v) return null;
  if (c === 'US') return US_AGE[v] ?? null;
  if (c === 'GB') return GB_AGE[v] ?? null;
  if (/^(G|U|AL|TP|L|A|0|Genel İzleyici|Genel)$/i.test(v)) return 0;
  const m = /(\d{1,2})/.exec(v);
  return m && +m[1] <= 21 ? +m[1] : null;
}
function ageOf(d, type) {
  const list = type === 'movie'
    ? (d.release_dates?.results || []).map(r => ({ c:r.iso_3166_1, vs:(r.release_dates || []).map(x => x.certification) }))
    : (d.content_ratings?.results || []).map(r => ({ c:r.iso_3166_1, vs:[r.rating] }));
  const rank = c => { const i = AGE_ORDER.indexOf(c); return i < 0 ? 99 : i; };
  for (const x of list.sort((p, q) => rank(p.c) - rank(q.c))) {
    for (const v of x.vs) {
      const n = certAge(x.c, v);
      if (n != null) return { a:n ? n + '+' : 'Genel', src:x.c, raw:v };
    }
  }
  return null;
}
const ageHTML = it => it.age ? `<span class="age" title="${esc(t('Yaş sınırı') + ' · ' + it.age.src + ' ' + it.age.raw)}">${esc(it.age.a === 'Genel' ? t('Genel') : it.age.a)}</span>` : '';
// Film: yönetmen(ler); dizi: yaratıcı(lar). En fazla iki isim.
function directorOf(d, type) {
  const names = type === 'movie'
    ? (d.credits?.crew || []).filter(c => c.job === 'Director').map(c => c.name)
    : (d.created_by || []).map(c => c.name);
  return [...new Set(names)].slice(0, 2).join(', ') || null;
}
const directorHTML = it => it.director
  ? `${it.type === 'movie' ? t('Yönetmen') : t('Yaratıcı')}: <b>${esc(it.director)}</b>` : '';
const scoreSort = s => s === 'imdb' || s === 'rt' ? s : null;
// Puansızlar sona: -1
const scoreVal = (s, by) => (by === 'imdb' ? parseFloat(s?.imdb) : parseInt(s?.rt, 10)) || -1;
async function pool(arr, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, arr.length) }, async () => { while (i < arr.length) await fn(arr[i++]); }));
}
async function ensureExtra(it) {
  if (it._extra) return;
  it._extra = true;
  try {
    await fetchIds(it);
    if (!it.overview) {
      const d = await tmdb(`/${it.type}/${it.id}`, { language:'en-US' });
      it.overview = d.overview || '';
    }
  } catch {}
  const el = $(keySel(it.key));
  if (el) {
    $('.overview', el).textContent = it.overview || t('Özet yok.');
    $('.director', el).innerHTML = directorHTML(it);
    const ag = $('.age-slot', el); if (ag) ag.innerHTML = ageHTML(it);
  }
  refreshCollTag(it);
  await loadScores(it);
  refreshScores(it);
}
async function loadScores(it) {
  if (!it.imdb || !S.omdbKey || it.scores) return;
  const c = S.omdbCache[it.imdb];
  if (c && Date.now() - c.at < 14 * 864e5) { it.scores = c; return; }
  try {
    const r = await fetch(`https://www.omdbapi.com/?apikey=${encodeURIComponent(S.omdbKey)}&i=${encodeURIComponent(it.imdb)}`);
    const d = await r.json();
    if (d.Response === 'False') {
      if (/api key|limit/i.test(d.Error || '')) { omdbWarn(d.Error); }
      return;
    }
    const src = n => (d.Ratings || []).find(x => x.Source === n)?.Value || null;
    it.scores = { imdb: d.imdbRating !== 'N/A' ? d.imdbRating : null, votes: d.imdbVotes !== 'N/A' ? d.imdbVotes : null,
      rt: src('Rotten Tomatoes'), mc: src('Metacritic'), at: Date.now() };
    S.omdbCache[it.imdb] = it.scores;
    const keys = Object.keys(S.omdbCache);
    if (keys.length > 3000) keys.sort((a, b) => S.omdbCache[a].at - S.omdbCache[b].at).slice(0, 500).forEach(k => delete S.omdbCache[k]);
    store.set(K.omdbCache, S.omdbCache);
  } catch {}
}
let omdbWarned = false;
function omdbWarn(msg) {
  if (omdbWarned) return;
  omdbWarned = true;
  toast(/limit/i.test(msg) ? t('OMDb: günlük istek sınırı doldu.') : t('OMDb: anahtar geçersiz.'), null, null, 4000);
}
function scoresHTML(it) {
  const s = it.scores || {};
  let h = it.imdb ? `<a class="score score-imdb" href="https://www.imdb.com/title/${encodeURIComponent(it.imdb)}/" target="_blank" rel="noopener"><b>IMDb</b>${s.imdb ? ' ' + esc(s.imdb.replace('.', ',')) : ''}</a>` : '';
  if (s.rt) h += `<span class="score" title="${t('Rotten Tomatoes')}">🍅 ${esc(s.rt)}</span>`;
  if (s.mc) h += `<span class="score" title="Metacritic">MC ${esc(s.mc.split('/')[0])}</span>`;
  if (it.trailer) h += `<a class="score score-trailer" href="${trailerURL(it.trailer)}" target="_blank" rel="noopener">${ico('trailer')} ${t('Fragman')}</a>`;
  return h;
}
function refreshScores(it) {
  const box = $(keySel(it.key) + ' .scores');
  if (box) box.innerHTML = scoresHTML(it);
  if (S.items[it.key] && (it.imdb || it.scores)) {
    S.items[it.key].imdb = it.imdb;
    if (it.originalTitle) S.items[it.key].originalTitle = it.originalTitle;
    if (it.director !== undefined) S.items[it.key].director = it.director;
    if (it.age !== undefined) S.items[it.key].age = it.age;
    if (it.collection !== undefined) S.items[it.key].collection = it.collection;
    if (it.trailer !== undefined) S.items[it.key].trailer = it.trailer;
    if (it.scores) Object.assign(S.items[it.key], { imdbRating: it.scores.imdb || null, rt: it.scores.rt || null, scoreAt: Date.now() });
    saveItems();
  }
}
