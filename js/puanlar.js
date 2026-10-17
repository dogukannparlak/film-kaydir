'use strict';
// Kart ekrana yaklaşınca: IMDb kimliği + yönetmen (TMDB) + OMDb puanları + eksikse İngilizce özet
async function fetchIds(it) {
  if (it.imdb !== undefined && it.director !== undefined) return;
  try {
    const d = await tmdb(`/${it.type}/${it.id}`, { append_to_response:'external_ids,credits', language:'tr-TR' });
    it.imdb = d.external_ids?.imdb_id || d.imdb_id || null;
    it.director = directorOf(d, it.type);
    if (!it.originalTitle) it.originalTitle = d.original_title || d.original_name || '';
    if (!it.overview) it.overview = d.overview || '';
  } catch {}
}
// Film: yönetmen(ler); dizi: yaratıcı(lar). En fazla iki isim.
function directorOf(d, type) {
  const names = type === 'movie'
    ? (d.credits?.crew || []).filter(c => c.job === 'Director').map(c => c.name)
    : (d.created_by || []).map(c => c.name);
  return [...new Set(names)].slice(0, 2).join(', ') || null;
}
const directorHTML = it => it.director
  ? `${it.type === 'movie' ? 'Yönetmen' : 'Yaratıcı'}: <b>${esc(it.director)}</b>` : '';
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
    $('.overview', el).textContent = it.overview || 'Özet yok.';
    $('.director', el).innerHTML = directorHTML(it);
  }
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
  toast('OMDb: ' + (/limit/i.test(msg) ? 'günlük istek sınırı doldu.' : 'anahtar geçersiz.'), null, null, 4000);
}
function scoresHTML(it) {
  if (!it.imdb) return '';
  const s = it.scores || {};
  const url = `https://www.imdb.com/title/${encodeURIComponent(it.imdb)}/`;
  let h = `<a class="score score-imdb" href="${url}" target="_blank" rel="noopener"><b>IMDb</b>${s.imdb ? ' ' + esc(s.imdb.replace('.', ',')) : ''}</a>`;
  if (s.rt) h += `<span class="score" title="Rotten Tomatoes">🍅 ${esc(s.rt)}</span>`;
  if (s.mc) h += `<span class="score" title="Metacritic">MC ${esc(s.mc.split('/')[0])}</span>`;
  return h;
}
function refreshScores(it) {
  const box = $(keySel(it.key) + ' .scores');
  if (box) box.innerHTML = scoresHTML(it);
  if (S.items[it.key] && (it.imdb || it.scores)) {
    S.items[it.key].imdb = it.imdb;
    if (it.originalTitle) S.items[it.key].originalTitle = it.originalTitle;
    if (it.director !== undefined) S.items[it.key].director = it.director;
    if (it.scores) Object.assign(S.items[it.key], { imdbRating: it.scores.imdb || null, rt: it.scores.rt || null, scoreAt: Date.now() });
    saveItems();
  }
}
