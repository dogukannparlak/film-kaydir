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
  $('#cSeries').textContent = new Set(Object.values(S.items).filter(i => i.collection).map(i => i.collection.id)).size;
  $('#navDot').textContent = c.want;
  $('#navDot').classList.toggle('hidden', !c.want);
  $('#btnUndo').disabled = !S.undo.length;
}
let listOrder = null, resortReady = false;
let shownKeys = new Set(); // önceki çizimde görünen satırlar: yalnız yeniler belirme animasyonu alır
function renderList() {
  const lf = S.listF, tab = S.listTab;
  $('#viewLists').classList.toggle('series-mode', tab === 'series');
  if (tab === 'series') return renderSeries();
  const g = GENRES.find(x => x.id === lf.genre);
  const p = PERIODS.find(x => x.id === lf.period) || PERIODS[0];
  const q = fold(lf.q.trim());
  const arr = Object.entries(S.items).map(([key, v]) => ({ key, ...v })).filter(i => {
    if (i.status !== tab) return false;
    if (lf.type !== 'all' && i.type !== lf.type) return false;
    if (g && !(i.genres || []).some(id => (i.type === 'movie' ? g.m : g.t).includes(id))) return false;
    const y = +yearOf(i.date);
    if (p.from && (!y || y < p.from)) return false;
    if (p.to && (!y || y > p.to)) return false;
    if (q && ![i.title, i.originalTitle].some(t => fold(t).includes(q))) return false;
    if (tab === 'watched' && lf.progress !== 'all') {
      if (lf.progress === 'done' ? i.progress : lf.progress === 'partial' ? !i.progress : i.progress !== lf.progress) return false;
    }
    return true;
  });
  const by = scoreSort(lf.sort);
  const val = i => by ? scoreVal({ imdb:i.imdbRating, rt:i.rt }, by) : lf.sort === 'tmdb' ? +i.rating || -1 : 0;
  arr.sort((a, b) => val(b) - val(a) || (b.addedAt || 0) - (a.addedAt || 0));
  // Sekme açıkken sıra sabit: düğmeye basınca satırlar yer değiştirmesin. Yeni gelenler sona eklenir.
  // Sekme, süzgeç, sıralama ya da arama değişince (ve IMDb/RT puanları gelince) yeniden sıralanır.
  const okey = JSON.stringify([tab, lf.type, lf.genre, lf.period, lf.sort, lf.progress, q]);
  if (listOrder?.key === okey) {
    const pos = new Map(listOrder.ids.map((k, n) => [k, n]));
    arr.sort((a, b) => (pos.get(a.key) ?? 1e9) - (pos.get(b.key) ?? 1e9));
  }
  if (listOrder?.key !== okey) resortReady = false;
  listOrder = { key: okey, ids: arr.map(i => i.key) };
  if (by) backfillScores(arr);
  backfillTitles(arr);
  const list = $('#list');
  $('#lProgress').hidden = tab !== 'watched';
  // Varsayılandan farklı süzgeçler vurgulanır
  [['#lType', 'all'], ['#lGenre', ''], ['#lPeriod', 'all'], ['#lProgress', 'all']].forEach(([s, d]) => $(s).classList.toggle('on', $(s).value !== d));
  const total = Object.values(S.items).filter(i => i.status === tab).length;
  const partial = tab === 'watched' ? arr.filter(i => PROGRESS[i.progress]).length : 0;
  $('#lCount').innerHTML = (total ? `<b>${arr.length}</b> yapım${arr.length < total ? ` · ${total} içinden` : ''}${partial ? ` · ${partial} yarım` : ''}` : '')
    + (resortReady ? ' · <button class="resort" data-resort>Puanlar geldi, yeniden sırala</button>' : '');
  if (!arr.length) {
    list.innerHTML = total
      ? `<li class="empty"><span class="empty-icon">🔍</span><b>Bu süzgeçlere uyan yapım yok</b>Aramayı ya da süzgeçleri gevşet.</li>`
      : `<li class="empty"><span class="empty-icon">${EMPTY_ICON[tab]}</span><b>Bu liste boş</b>Keşfet'te kaydırdıkça burası dolar.</li>`;
    return;
  }
  // Aynı seriden en az iki film bu listede ise tek kutuda: kutu, grubun en üstteki filminin yerinde durur
  const groups = new Map();
  arr.forEach(i => { if (i.collection) (groups.get(i.collection.id) || groups.set(i.collection.id, []).get(i.collection.id)).push(i); });
  const open = openColls(list), done = new Set();
  const html = arr.map(i => {
    const g = i.collection && groups.get(i.collection.id);
    if (!g || g.length < 2) return itemHTML(i, tab);
    if (done.has(i.collection.id)) return '';
    done.add(i.collection.id);
    return groupHTML(i.collection, g, tab, open.has(String(i.collection.id)));
  }).join('');
  list.innerHTML = html;
  shownKeys = new Set(arr.map(i => i.key));
}
const EMPTY_ICON = { want:'💚', watched:'🎬', passed:'🙅' };
// Taşıma düğmeleri: destedeki simgelerle aynı (♥ istek, ✓ izledim, ✕ geç)
const MOVES = { want:['♥', 'İstek listesine taşı'], watched:['✓', 'İzlediklerim\'e taşı'], passed:['✕', 'Geçtiklerim\'e taşı'] };
const TRASH = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>';
function groupHTML(ref, members, tab, open) {
  const c = collCache[ref.id];
  if (!c) collListTag(members[0]); // seri önbellekte yoksa getirir ve listeyi yeniler
  const t = c ? titles(c) : { main: ref.name, sub: '' };
  // Grubun içinde seri sırasıyla (çıkış tarihi)
  const sorted = [...members].sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
  const rel = c ? c.parts.filter(released).length : 0;
  const watched = c ? c.parts.filter(p => S.items[p.key]?.status === 'watched').length : 0;
  const poster = c?.poster || sorted[0].poster;
  return `
    <li class="coll lgroup" data-coll="${ref.id}">
      <details ${open ? 'open' : ''}>
        <summary>
          <span class="item-poster">${poster ? `<img src="${IMG}w185${esc(poster)}" alt="" loading="lazy">` : ''}<span class="type">SERİ</span></span>
          <span class="coll-main">
            <span class="item-title"><span class="t-main">${esc(t.main)}</span>${t.sub ? `<small>${esc(t.sub)}</small>` : ''}</span>
            <span class="item-sub">Bu listede <b>${members.length}</b> film${c ? ` · seride ${c.parts.length}` : ''}</span>
            ${c ? `<span class="coll-prog"><i style="width:${rel ? Math.round(100 * Math.min(watched, rel) / rel) : 0}%"></i></span>` : ''}
            <span class="lg-thumbs">${sorted.slice(0, 6).map(m => m.poster ? `<img src="${IMG}w92${esc(m.poster)}" alt="" loading="lazy">` : '').join('')}${c ? `<span class="coll-frac">${watched}/${rel} izlendi</span>` : ''}</span>
          </span>
          <span class="coll-chev" aria-hidden="true">›</span>
        </summary>
        <ul class="list coll-parts">${sorted.map(m => itemHTML(m, tab, true)).join('')}</ul>
        <button class="lg-all" data-coll-open="${ref.id}">Serinin tamamını aç ›</button>
      </details>
    </li>`;
}
function itemHTML(i, tab, inGroup = false) {
  const t = titles(i);
  const scores = [
    i.imdb ? `<a class="sc sc-imdb" href="https://www.imdb.com/title/${encodeURIComponent(i.imdb)}/" target="_blank" rel="noopener">IMDb${i.imdbRating ? ' ' + esc(String(i.imdbRating).replace('.', ',')) : ''}</a>` : '',
    i.rt ? `<span class="sc" title="Rotten Tomatoes">🍅 ${esc(i.rt)}</span>` : '',
    seasonBadges(i),
    i.lbRating ? `<span class="sc sc-lb" title="Letterboxd puanın">LB ${String(i.lbRating).replace('.', ',')}★</span>` : '',
    i.rating ? `<span class="sc sc-tmdb" title="TMDB">★ ${(+i.rating).toFixed(1).replace('.', ',')}</span>` : '',
    i.trailer === '' ? '' : `<button class="sc sc-trailer" data-trailer title="YouTube'da fragman">▶ Fragman</button>`,
  ].join('');
  const sub = [genreNames(i.type, i.genres || []).slice(0, 2).join(' · '), i.director ? '🎬 ' + i.director : ''].filter(Boolean).join(' · ');
  const progBtns = tab === 'watched' ? Object.entries(PROGRESS).filter(([, p]) => !p.tvOnly || i.type === 'tv').map(([id, p]) =>
    `<button class="pill pill-prog" data-progress="${id}" aria-pressed="${i.progress === id}">${p.icon} ${p.label}</button>`).join('') : '';
  return `
    <li class="item${shownKeys.has(i.key) ? '' : ' fresh'}" data-key="${esc(i.key)}">
      <a class="item-poster" href="https://www.themoviedb.org/${i.type}/${i.id}" target="_blank" rel="noopener" tabindex="-1">
        ${i.poster ? `<img src="${IMG}w185${esc(i.poster)}" alt="" loading="lazy">` : ''}
        <span class="type">${i.type === 'movie' ? 'FİLM' : 'DİZİ'}</span>
      </a>
      <div class="item-main">
        <div class="item-head">
          <a class="item-title" href="https://www.themoviedb.org/${i.type}/${i.id}" target="_blank" rel="noopener"><span class="t-main">${esc(t.main)}</span>${t.sub ? `<small>${esc(t.sub)}</small>` : ''}</a>
          ${yearOf(i.date) ? `<span class="item-year">${yearOf(i.date)}</span>` : ''}
        </div>
        ${sub ? `<div class="item-sub">${esc(sub)}</div>` : ''}
        ${scores ? `<div class="item-scores">${scores}</div>` : ''}
        ${watchingRow(i)}
        ${i.collection && !inGroup ? `<div>${collListTag(i)}</div>` : ''}
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
// Orijinal adı (ve eksikse yönetmeni, IMDb kimliğini) olmayan eski öğeleri TMDB'den tamamla; OMDb harcamaz
const triedTitle = new Set();
let fillingTitles = false;
async function backfillTitles(arr) {
  if (fillingTitles || !tmdbReady()) return;
  const need = arr.filter(i => (i.originalTitle === undefined || (i.type === 'movie' && i.collection === undefined)) && !triedTitle.has(i.key)).slice(0, 40);
  if (!need.length) return;
  fillingTitles = true;
  need.forEach(i => triedTitle.add(i.key));
  await pool(need, 4, async i => {
    try {
      const d = await tmdb(`/${i.type}/${i.id}`, { language:'tr-TR', append_to_response:'external_ids,credits' });
      const item = S.items[i.key];
      if (!item) return;
      item.originalTitle = d.original_title || d.original_name || '';
      if (!item.director) item.director = directorOf(d, i.type);
      if (!item.imdb) item.imdb = d.external_ids?.imdb_id || d.imdb_id || null;
      if (i.type === 'movie') item.collection = collRef(d);
    } catch {}
  });
  saveItems();
  updateCounts();
  fillingTitles = false;
  if (S.view === 'lists') renderList();
}
async function backfillScores(arr) {
  if (backfilling || !S.omdbKey) return;
  const need = arr.filter(i => !i.scoreAt && !triedScore.has(i.key)).slice(0, 40);
  if (!need.length) return;
  backfilling = true;
  need.forEach(i => triedScore.add(i.key));
  const tmp = need.map(i => ({ key:i.key, id:i.id, type:i.type, imdb:i.imdb || undefined, director:i.director ?? undefined, collection:i.collection }));
  await pool(tmp, 6, fetchIds);
  await pool(tmp, 6, loadScores);
  for (const t of tmp) {
    const item = S.items[t.key];
    if (!item) continue;
    item.imdb = t.imdb || null;
    if (t.director !== undefined) item.director = t.director;
    if (t.collection !== undefined) item.collection = t.collection;
    if (t.scores) Object.assign(item, { imdbRating: t.scores.imdb || null, rt: t.scores.rt || null, scoreAt: Date.now() });
  }
  saveItems();
  backfilling = false;
  if (scoreSort(S.listF.sort)) resortReady = true; // sıra kendiliğinden değişmesin; kullanıcı isterse yeniden sıralar
  if (S.view === 'lists') renderList();
}
function onListClick(e) {
  if (S.listTab === 'series') return onCollAction(e, seriesColls, () => null);
  if (e.target.closest('[data-resort]')) { listOrder = null; resortReady = false; return renderList(); }
  const tr = e.target.closest('[data-trailer]');
  if (tr) { const li = tr.closest('.item'), it = li && S.items[li.dataset.key]; if (it) openTrailer(it.type, it.id); return; }
  if (e.target.closest('[data-ep-open]')) return openEpisodes(e.target.closest('.item').dataset.key);
  if (e.target.closest('[data-ep-next]')) return nextEpisode(e.target.closest('.item').dataset.key);
  const ct = e.target.closest('[data-coll-open]');
  if (ct) return openCollection(+ct.dataset.collOpen);
  const li = e.target.closest('.item');
  if (!li) return;
  const k = li.dataset.key, item = S.items[k];
  if (!item) return;
  const mv = e.target.closest('[data-move]');
  const pg = e.target.closest('[data-progress]');
  if (pg) {
    // Aynı işarete yeniden basmak kaldırır (biten olur)
    const snap = { ...item }, prev = item.progress || null, next = prev === pg.dataset.progress ? null : pg.dataset.progress;
    if (next) item.progress = next; else delete item.progress;
    if (prev === 'season' && next !== 'season') ackSeason(item); // yeni sezon görüldü: bir daha işaretlenmesin
    if (prev === 'watching' && next !== 'watching') delete item.at;
    saveItems(); renderList();
    if (next === 'watching' && !item.at) return openEpisodes(k);
    toast(next ? `Yarım kaldı: ${PROGRESS[next].label}` : 'Bitti olarak işaretlendi', 'Geri al', () => {
      S.items[k] = snap; saveItems(); renderList();
    });
  } else if (mv) {
    const prev = item.status, prevProg = item.progress, prevAt = item.addedAt;
    item.status = mv.dataset.move; item.addedAt = Date.now();
    delete item.progress; // yarım işareti yalnız İzlediklerim'de anlamlı
    saveItems(); renderList(); updateCounts();
    toast(`${STATUS_TO[item.status]} taşındı`, 'Geri al', () => {
      item.status = prev; item.addedAt = prevAt; if (prevProg) item.progress = prevProg;
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
    let n = 0, kept = 0;
    for (const i of items) {
      if (!i || !(+i.id > 0) || !['movie', 'tv'].includes(i.type) || !Object.hasOwn(STATUS, i.status)) continue;
      const k = `${i.type}:${+i.id}`;
      if (S.items[k] && (S.items[k].addedAt || 0) > (+i.addedAt || 0)) { S.seen.add(k); kept++; continue; } // buradaki daha yeni
      S.items[k] = { id:+i.id, type:i.type, title:String(i.title || '—'), ...(typeof i.originalTitle === 'string' ? { originalTitle:i.originalTitle.slice(0, 300) } : {}), poster:i.poster || null, date:String(i.date || ''),
        status:i.status, genres:Array.isArray(i.genres) ? i.genres.map(Number) : [], rating:+i.rating || 0, imdb:/^tt\d+$/.test(i.imdb) ? i.imdb : null, imdbRating:i.imdbRating ? String(i.imdbRating) : null, rt:/^\d+%$/.test(i.rt) ? i.rt : null, director:typeof i.director === 'string' ? i.director.slice(0, 200) : null, ...(typeof i.trailer === 'string' && /^[\w-]{0,20}$/.test(i.trailer) ? { trailer:i.trailer } : {}), ...(+i.seasonAck > 0 ? { seasonAck:+i.seasonAck } : {}), ...(i.at && +i.at.s > 0 && +i.at.e > 0 ? { at:{ s:+i.at.s, e:+i.at.e } } : {}), ...(i.collection === null || (i.collection && +i.collection.id > 0) ? { collection:i.collection && { id:+i.collection.id, name:String(i.collection.name || '').slice(0, 200) } } : {}), ...(i.status === 'watched' && Object.hasOwn(PROGRESS, i.progress) ? { progress:i.progress } : {}), ...(+i.lbRating > 0 && +i.lbRating <= 5 ? { lbRating:+i.lbRating } : {}), scoreAt:+i.scoreAt || null, addedAt:+i.addedAt || Date.now() };
      S.seen.add(k); n++;
    }
    (Array.isArray(data.seen) ? data.seen : []).forEach(k => typeof k === 'string' && /^(movie|tv):\d+$/.test(k) && S.seen.add(k));
    saveItems(); saveSeen();
    S.queue = S.queue.filter(it => !S.seen.has(it.key));
    S.queued = new Set(S.queue.map(it => it.key));
    renderDeck(); renderList(); updateCounts();
    toast(`${n} öğe içe aktarıldı${kept ? ` · ${kept} öğede buradaki daha yeni sürüm korundu` : ''}`, null, null, 4000);
  } catch (e) {
    toast('İçe aktarılamadı: geçerli bir JSON yedeği değil.');
  }
}
