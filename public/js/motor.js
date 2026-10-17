'use strict';
/* ================= Sonsuz akış motoru ================= */
const E = { gen:0, keys:{}, cursors:{}, done:{}, loading:false, exhausted:false, error:null, dry:0 };

const MAX_PARALLEL = 4;          // bir turda en fazla kaç kaynaktan sayfa çekilsin
function randomBlocks(src) {
  const [a, b] = src.range;
  const lo = a ?? (src.pid === 'old' ? 1930 : 1960), hi = b ?? NOW_Y;
  const blocks = [];
  for (let y = lo; y <= hi; y += 5) blocks.push([y, Math.min(y + 4, hi)]);
  return blocks;
}
// Rastgele mod: dönemi 5 yıllık dilimlere böl, rastgele dilim + rastgele sıralama + rastgele sayfa seç.
// Böylece eski ve yeni içerik eşit şansla karışır.
async function fetchRandom(src) {
  const { type, base } = src;
  const blocks = randomBlocks(src);
  const sorts = ['popularity.desc', 'vote_count.desc', 'vote_average.desc'];
  for (let attempt = 0; attempt < 6; attempt++) {
    const [ys, ye] = pick(blocks), sort = pick(sorts);
    const k = `${src.key}|${ys}|${sort}`;
    const info = E.keys[k] || (E.keys[k] = { total:null, pages:new Set(), dead:false });
    if (info.dead) continue;
    let page = 1;
    if (info.total != null) {
      const max = Math.min(info.total, RANDOM_PAGE_CAP), free = [];
      for (let i = 1; i <= max; i++) if (!info.pages.has(i)) free.push(i);
      if (!free.length) { info.dead = true; continue; }
      page = pick(free);
    }
    info.pages.add(page);
    let d;
    try { d = await tmdb(`/discover/${type}`, { ...base, ...dateParams(type, ys, ye), sort_by:sort, page }); }
    catch (e) { info.pages.delete(page); throw e; } // hata alan sayfa sonra yeniden denensin
    info.total = d.total_pages || 0;
    if (!info.total) info.dead = true;
    return { items: (d.results || []).map(r => norm(r, type)) };
  }
  const deadCount = Object.entries(E.keys).filter(([k, v]) => k.startsWith(src.key + '|') && v.dead).length;
  return { items: [], done: deadCount >= blocks.length * sorts.length };
}
async function fetchSeq(src) {
  const f = S.filters, { type, base } = src;
  const c = E.cursors[src.key] || (E.cursors[src.key] = { page:0, total:1 });
  if (c.page >= Math.min(c.total, 500)) return { items: [], done: true };
  c.page++;
  const [y0, y1] = src.range;
  // IMDb/RT sıralamasını TMDB yapamaz: en çok oy alanları çek, parti içinde OMDb puanına göre diz (fetchMore)
  const sort = f.sort === 'popular' ? 'popularity.desc' : f.sort === 'top' ? 'vote_average.desc'
    : scoreSort(f.sort) ? 'vote_count.desc'
    : type === 'movie' ? 'primary_release_date.desc' : 'first_air_date.desc';
  let d;
  try { d = await tmdb(`/discover/${type}`, { ...base, ...dateParams(type, y0, y1), sort_by:sort, page:c.page }); }
  catch (e) { c.page--; throw e; } // hata alan sayfa atlanmasın
  c.total = d.total_pages || 0;
  return { items: (d.results || []).map(r => norm(r, type)), done: c.page >= Math.min(c.total, 500) };
}
async function fetchOne(src) {
  const r = await (S.filters.sort === 'random' ? fetchRandom(src) : fetchSeq(src));
  if (src.reg.anime) r.items = r.items.filter(it => it.genres.includes(16));
  return r;
}
function interleave(lists) {
  const out = [], n = Math.max(0, ...lists.map(l => l.length));
  for (let i = 0; i < n; i++) lists.forEach(l => l[i] && out.push(l[i]));
  return out;
}
async function fetchMore() {
  if (!S.apiKey || E.loading || E.exhausted || E.error) return;
  E.loading = true;
  const gen = E.gen;
  let added = 0;
  updateDeckStatus();
  try {
    for (let round = 0; round < 5 && added < 12; round++) {
      const live = sources().filter(s => !E.done[s.key]);
      if (!live.length) { E.exhausted = true; break; }
      const srcs = shuffle(live).slice(0, MAX_PARALLEL);
      const res = await Promise.all(srcs.map(s => fetchOne(s).catch(err => {
        if (err instanceof AuthError) throw err;
        console.warn(err);
        return { items: [], err };
      })));
      if (gen !== E.gen) return;
      res.forEach((r, i) => { if (r.done) E.done[srcs[i].key] = true; });
      if (res.every(r => r.err)) throw res[0].err;
      const merged = interleave(res.map(r => r.items));
      if (S.filters.sort === 'random') shuffle(merged);
      const fresh = [];
      for (const it of merged) if (accept(it)) { S.queued.add(it.key); fresh.push(it); }
      const by = scoreSort(S.filters.sort);
      if (by && S.omdbKey) {
        await pool(fresh, 6, fetchIds);
        await pool(fresh, 6, loadScores);
        if (gen !== E.gen) return;
        fresh.sort((a, b) => scoreVal(b.scores, by) - scoreVal(a.scores, by));
      }
      S.queue.push(...fresh); added += fresh.length;
    }
    E.dry = added ? 0 : E.dry + 1;
    if (E.dry >= 3) E.exhausted = true;
  } catch (err) {
    if (gen !== E.gen) return;
    if (err instanceof AuthError) { S.apiKey = ''; store.del(K.key); S.keyMsg = 'Anahtar geçersiz. Yeniden yapıştır.'; return; }
    E.error = err;
  } finally {
    if (gen === E.gen) { E.loading = false; renderDeck(); }
  }
}
function resetEngine() {
  E.gen++;
  Object.assign(E, { keys:{}, cursors:{}, done:{}, loading:false, exhausted:false, error:null, dry:0 });
  S.queue = []; S.queued.clear();
  $$('#deck .card').forEach(c => c.remove());
  renderDeck();
}
