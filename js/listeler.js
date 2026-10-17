'use strict';
/* ================= Listeler ================= */
function fillListSelects() {
  $('#lGenre').innerHTML = '<option value="">Tüm türler</option>' + GENRES.map(g => `<option value="${g.id}">${g.label}</option>`).join('');
  $('#lPeriod').innerHTML = PERIODS.filter(p => p.id !== 'custom').map(p => `<option value="${p.id}">${p.id === 'all' ? 'Tüm dönemler' : p.label}</option>`).join('');
  $('#lType').value = S.listF.type; $('#lGenre').value = S.listF.genre; $('#lPeriod').value = S.listF.period; $('#lq').value = S.listF.q;
  $('#lSort').value = S.listF.sort; $('#lProgress').value = S.listF.progress;
}
function updateCounts() {
  const c = { want:0, watched:0, passed:0 };
  Object.values(S.items).forEach(i => { if (c[i.status] != null) c[i.status]++; });
  $('#cWant').textContent = c.want; $('#cWatched').textContent = c.watched; $('#cPassed').textContent = c.passed;
  $('#navDot').textContent = c.want;
  $('#navDot').classList.toggle('hidden', !c.want);
  $('#btnUndo').disabled = !S.undo.length;
}
function renderList() {
  const lf = S.listF, tab = S.listTab;
  const g = GENRES.find(x => x.id === lf.genre);
  const p = PERIODS.find(x => x.id === lf.period) || PERIODS[0];
  const q = lf.q.trim().toLocaleLowerCase('tr');
  const arr = Object.entries(S.items).map(([key, v]) => ({ key, ...v })).filter(i => {
    if (i.status !== tab) return false;
    if (lf.type !== 'all' && i.type !== lf.type) return false;
    if (g && !(i.genres || []).some(id => (i.type === 'movie' ? g.m : g.t).includes(id))) return false;
    const y = +yearOf(i.date);
    if (p.from && (!y || y < p.from)) return false;
    if (p.to && (!y || y > p.to)) return false;
    if (q && !String(i.title).toLocaleLowerCase('tr').includes(q)) return false;
    if (tab === 'watched' && lf.progress !== 'all') {
      if (lf.progress === 'done' ? i.progress : lf.progress === 'partial' ? !i.progress : i.progress !== lf.progress) return false;
    }
    return true;
  });
  const by = scoreSort(lf.sort);
  const val = i => by ? scoreVal({ imdb:i.imdbRating, rt:i.rt }, by) : lf.sort === 'tmdb' ? +i.rating || -1 : 0;
  arr.sort((a, b) => val(b) - val(a) || (b.addedAt || 0) - (a.addedAt || 0));
  if (by) backfillScores(arr);
  const list = $('#list');
  $('#lProgress').hidden = tab !== 'watched';
  // Varsayılandan farklı süzgeçler vurgulanır
  [['#lType', 'all'], ['#lGenre', ''], ['#lPeriod', 'all'], ['#lProgress', 'all']].forEach(([s, d]) => $(s).classList.toggle('on', $(s).value !== d));
  const total = Object.values(S.items).filter(i => i.status === tab).length;
  const partial = tab === 'watched' ? arr.filter(i => PROGRESS[i.progress]).length : 0;
  $('#lCount').innerHTML = total ? `<b>${arr.length}</b> yapım${arr.length < total ? ` · ${total} içinden` : ''}${partial ? ` · ${partial} yarım` : ''}` : '';
  if (!arr.length) {
    list.innerHTML = total
      ? `<li class="empty"><span class="empty-icon">🔍</span><b>Bu süzgeçlere uyan yapım yok</b>Aramayı ya da süzgeçleri gevşet.</li>`
      : `<li class="empty"><span class="empty-icon">${EMPTY_ICON[tab]}</span><b>Bu liste boş</b>Keşfet'te kaydırdıkça burası dolar.</li>`;
    return;
  }
  list.innerHTML = arr.map(i => itemHTML(i, tab)).join('');
}
const EMPTY_ICON = { want:'💚', watched:'🎬', passed:'🙅' };
// Taşıma düğmeleri: destedeki simgelerle aynı (♥ istek, ✓ izledim, ✕ geç)
const MOVES = { want:['♥', 'İstek listesine taşı'], watched:['✓', 'İzlediklerim\'e taşı'], passed:['✕', 'Geçtiklerim\'e taşı'] };
const TRASH = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>';
function itemHTML(i, tab) {
  const scores = [
    i.imdb ? `<a class="sc sc-imdb" href="https://www.imdb.com/title/${encodeURIComponent(i.imdb)}/" target="_blank" rel="noopener">IMDb${i.imdbRating ? ' ' + esc(String(i.imdbRating).replace('.', ',')) : ''}</a>` : '',
    i.rt ? `<span class="sc" title="Rotten Tomatoes">🍅 ${esc(i.rt)}</span>` : '',
    i.lbRating ? `<span class="sc sc-lb" title="Letterboxd puanın">LB ${String(i.lbRating).replace('.', ',')}★</span>` : '',
    i.rating ? `<span class="sc sc-tmdb" title="TMDB">★ ${(+i.rating).toFixed(1).replace('.', ',')}</span>` : '',
  ].join('');
  const sub = [genreNames(i.type, i.genres || []).slice(0, 2).join(' · '), i.director ? '🎬 ' + i.director : ''].filter(Boolean).join(' · ');
  const progBtns = tab === 'watched' ? Object.entries(PROGRESS).filter(([, p]) => !p.tvOnly || i.type === 'tv').map(([id, p]) =>
    `<button class="pill pill-prog" data-progress="${id}" aria-pressed="${i.progress === id}">${p.icon} ${p.label}</button>`).join('') : '';
  return `
    <li class="item" data-key="${esc(i.key)}">
      <a class="item-poster" href="https://www.themoviedb.org/${i.type}/${i.id}" target="_blank" rel="noopener" tabindex="-1">
        ${i.poster ? `<img src="${IMG}w185${esc(i.poster)}" alt="" loading="lazy">` : ''}
        <span class="type">${i.type === 'movie' ? 'FİLM' : 'DİZİ'}</span>
      </a>
      <div class="item-main">
        <div class="item-head">
          <a class="item-title" href="https://www.themoviedb.org/${i.type}/${i.id}" target="_blank" rel="noopener">${esc(i.title)}</a>
          ${yearOf(i.date) ? `<span class="item-year">${yearOf(i.date)}</span>` : ''}
        </div>
        ${sub ? `<div class="item-sub">${esc(sub)}</div>` : ''}
        ${scores ? `<div class="item-scores">${scores}</div>` : ''}
      </div>
      <div class="item-acts">
        ${progBtns}
        <span class="acts-right">
          ${Object.keys(MOVES).filter(s => s !== tab).map(s => `<button class="pill pill-ico pill-${s}" data-move="${s}" aria-label="${MOVES[s][1]}" title="${MOVES[s][1]}">${MOVES[s][0]}</button>`).join('')}
          <button class="pill pill-ico pill-del" data-del aria-label="Sil" title="Sil">${TRASH}</button>
        </span>
      </div>
    </li>`;
}
// Listede IMDb/RT ile sıralarken puanı hiç alınmamış öğeleri arka planda tamamla (oturumda bir kez dene)
const triedScore = new Set();
let backfilling = false;
async function backfillScores(arr) {
  if (backfilling || !S.omdbKey) return;
  const need = arr.filter(i => !i.scoreAt && !triedScore.has(i.key)).slice(0, 40);
  if (!need.length) return;
  backfilling = true;
  need.forEach(i => triedScore.add(i.key));
  const tmp = need.map(i => ({ key:i.key, id:i.id, type:i.type, imdb:i.imdb || undefined, director:i.director ?? undefined }));
  await pool(tmp, 6, fetchIds);
  await pool(tmp, 6, loadScores);
  for (const t of tmp) {
    const item = S.items[t.key];
    if (!item) continue;
    item.imdb = t.imdb || null;
    if (t.director !== undefined) item.director = t.director;
    if (t.scores) Object.assign(item, { imdbRating: t.scores.imdb || null, rt: t.scores.rt || null, scoreAt: Date.now() });
  }
  saveItems();
  backfilling = false;
  if (S.view === 'lists') renderList();
}
function onListClick(e) {
  const li = e.target.closest('.item');
  if (!li) return;
  const k = li.dataset.key, item = S.items[k];
  if (!item) return;
  const mv = e.target.closest('[data-move]');
  const pg = e.target.closest('[data-progress]');
  if (pg) {
    // Aynı işarete yeniden basmak kaldırır (biten olur)
    const prev = item.progress || null, next = prev === pg.dataset.progress ? null : pg.dataset.progress;
    if (next) item.progress = next; else delete item.progress;
    saveItems(); renderList();
    toast(next ? `Yarım kaldı: ${PROGRESS[next].label}` : 'Bitti olarak işaretlendi', 'Geri al', () => {
      if (prev) item.progress = prev; else delete item.progress;
      saveItems(); renderList();
    });
  } else if (mv) {
    const prev = item.status, prevProg = item.progress;
    item.status = mv.dataset.move; item.addedAt = Date.now();
    delete item.progress; // yarım işareti yalnız İzlediklerim'de anlamlı
    saveItems(); renderList(); updateCounts();
    toast(`${STATUS[item.status]} listesine taşındı`, 'Geri al', () => {
      item.status = prev; if (prevProg) item.progress = prevProg;
      saveItems(); renderList(); updateCounts();
    });
  } else if (e.target.closest('[data-del]')) {
    const copy = { ...item };
    delete S.items[k];
    saveItems(); renderList(); updateCounts();
    toast('Silindi', 'Geri al', () => { S.items[k] = copy; saveItems(); renderList(); updateCounts(); }, 4000);
  }
}
function exportJSON() {
  const data = { app:'kaydir', version:1, exportedAt:new Date().toISOString(), filters:S.filters,
    items:Object.values(S.items), seen:[...S.seen] };
  const blob = new Blob([JSON.stringify(data, null, 1)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `kaydir-yedek-${TODAY}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast(`${data.items.length} öğe dışa aktarıldı`);
}
async function importJSON(file) {
  try {
    const data = JSON.parse(await file.text());
    const items = Array.isArray(data) ? data : Array.isArray(data.items) ? data.items : Object.values(data.items || {});
    let n = 0;
    for (const i of items) {
      if (!i || !Number.isFinite(+i.id) || !['movie', 'tv'].includes(i.type) || !STATUS[i.status]) continue;
      const k = `${i.type}:${+i.id}`;
      S.items[k] = { id:+i.id, type:i.type, title:String(i.title || '—'), poster:i.poster || null, date:String(i.date || ''),
        status:i.status, genres:Array.isArray(i.genres) ? i.genres.map(Number) : [], rating:+i.rating || 0, imdb:/^tt\d+$/.test(i.imdb) ? i.imdb : null, imdbRating:i.imdbRating ? String(i.imdbRating) : null, rt:/^\d+%$/.test(i.rt) ? i.rt : null, director:typeof i.director === 'string' ? i.director.slice(0, 200) : null, ...(i.status === 'watched' && PROGRESS[i.progress] ? { progress:i.progress } : {}), ...(+i.lbRating > 0 && +i.lbRating <= 5 ? { lbRating:+i.lbRating } : {}), scoreAt:+i.scoreAt || null, addedAt:+i.addedAt || Date.now() };
      S.seen.add(k); n++;
    }
    (Array.isArray(data.seen) ? data.seen : []).forEach(k => typeof k === 'string' && /^(movie|tv):\d+$/.test(k) && S.seen.add(k));
    saveItems(); saveSeen();
    S.queue = S.queue.filter(it => !S.seen.has(it.key));
    S.queued = new Set(S.queue.map(it => it.key));
    renderDeck(); renderList(); updateCounts();
    toast(`${n} öğe içe aktarıldı`);
  } catch (e) {
    toast('İçe aktarılamadı: geçerli bir JSON yedeği değil.');
  }
}
