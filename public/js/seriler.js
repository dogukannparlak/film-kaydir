'use strict';
/* ================= Film serileri (TMDB collection) ================= */
// Ortak parçalar: seri önbelleği, seri kutusu (aramada ve Listeler › Seriler'de), kart etiketi, toplu taşıma.
const COLL_TTL = 7 * 864e5;
let collCache = store.get(K.coll, {});
const collRef = d => d?.belongs_to_collection ? { id:d.belongs_to_collection.id, name:d.belongs_to_collection.name } : null;
// Seri ayrıntısı (Türkçe filmler + İngilizce seri adı), 7 gün önbellekli
const collInflight = new Map(), collFailed = new Set(); // aynı seriye eşzamanlı tek istek; başarısızlar oturumda yeniden denenmez
async function getCollection(id) {
  const c = collCache[id];
  if (c && Date.now() - c.at < COLL_TTL) return c;
  if (collInflight.has(id)) return collInflight.get(id);
  const p = fetchCollection(id).finally(() => collInflight.delete(id));
  collInflight.set(id, p);
  p.catch(() => collFailed.add(id));
  return p;
}
async function fetchCollection(id) {
  const [tr, en] = await Promise.all([
    tmdb(`/collection/${id}`, { language:'tr-TR' }),
    tmdb(`/collection/${id}`, { language:'en-US' }).catch(() => null),
  ]);
  const ref = { id, name:tr.name };
  const out = {
    id, at:Date.now(), title:tr.name || en?.name || '—', originalTitle:en?.name || '', poster:tr.poster_path || en?.poster_path || null,
    // Çıkış tarihine göre; tarihi olmayan (duyurulmuş) filmler sonda
    parts:(tr.parts || []).map(p => ({ ...norm(p, 'movie'), collection:ref })).sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999')),
  };
  collCache[id] = out;
  const ids = Object.keys(collCache);
  if (ids.length > 300) ids.sort((a, b) => collCache[a].at - collCache[b].at).slice(0, 50).forEach(k => delete collCache[k]);
  store.set(K.coll, collCache);
  return out;
}
const released = it => it.date && it.date <= TODAY;
const SEARCH_ADD = { want:['♥', 'İstek'], watched:['✓', 'İzledim'], passed:['✕', 'Geç'] };

// Aramada ve serilerde ortak sonuç satırı
function resultHTML(it) {
  const t = titles(it), cur = S.items[it.key]?.status;
  const sub = [genreNames(it.type, it.genres).slice(0, 2).join(' · '), it.via ? '👤 ' + it.via : ''].filter(Boolean).join(' · ');
  return `
    <li class="item" data-key="${esc(it.key)}">
      <a class="item-poster" href="https://www.themoviedb.org/${it.type}/${it.id}" target="_blank" rel="noopener" tabindex="-1">
        ${it.poster ? `<img src="${IMG}w185${esc(it.poster)}" alt="" loading="lazy">` : ''}
        <span class="type">${it.type === 'movie' ? 'FİLM' : 'DİZİ'}</span>
      </a>
      <div class="item-main">
        <div class="item-head">
          <a class="item-title" href="https://www.themoviedb.org/${it.type}/${it.id}" target="_blank" rel="noopener"><span class="t-main">${esc(t.main)}</span>${t.sub ? `<small>${esc(t.sub)}</small>` : ''}</a>
          <span class="item-year">${yearOf(it.date) || 'yakında'}</span>
        </div>
        ${sub ? `<div class="item-sub">${esc(sub)}</div>` : ''}
        ${it.rating ? `<div class="item-scores"><span class="sc sc-tmdb" title="TMDB">★ ${it.rating.toFixed(1).replace('.', ',')}</span>${it.votes ? `<span class="sc">${it.votes.toLocaleString('tr-TR')} oy</span>` : ''}</div>` : ''}
      </div>
      <div class="item-acts">
        ${cur ? `<span class="in-list in-${cur}">${STATUS[cur]}</span>` : '<span class="note" style="margin:0">Listene ekle</span>'}
        <span class="acts-right">
          ${Object.entries(SEARCH_ADD).map(([s, [ic, l]]) => `<button class="pill pill-ico pill-${s}" data-add="${s}" aria-label="${l}" title="${l}" aria-pressed="${cur === s}" ${cur === s ? 'disabled' : ''}>${ic}</button>`).join('')}
        </span>
      </div>
    </li>`;
}
function collHTML(c, open) {
  const t = titles(c), n = c.parts.length, rel = c.parts.filter(released).length;
  const counts = { want:0, watched:0, passed:0 };
  c.parts.forEach(p => { const s = S.items[p.key]?.status; if (s) counts[s]++; });
  const inList = Object.entries(counts).filter(([, v]) => v).map(([s, v]) => `<span class="in-list in-${s}">${v} ${STATUS[s].split(' ')[0]}</span>`).join('');
  const span = [...new Set([yearOf(c.parts[0]?.date || ''), yearOf(c.parts.filter(released).at(-1)?.date || '')].filter(Boolean))];
  const pct = rel ? Math.round(100 * Math.min(counts.watched, rel) / rel) : 0;
  return `
    <li class="coll" data-coll="${c.id}">
      <details ${open ? 'open' : ''}>
        <summary>
          <span class="item-poster">${c.poster ? `<img src="${IMG}w185${esc(c.poster)}" alt="" loading="lazy">` : ''}<span class="type">SERİ</span></span>
          <span class="coll-main">
            <span class="item-title"><span class="t-main">${esc(t.main)}</span>${t.sub ? `<small>${esc(t.sub)}</small>` : ''}</span>
            <span class="item-sub">${n} film${span.length ? ' · ' + span.join('–') : ''}${n > rel ? ` · ${n - rel} yakında` : ''}</span>
            <span class="coll-prog" title="İzlenen / çıkmış film"><i style="width:${pct}%"></i></span>
            <span class="coll-in">${inList || '<span class="note" style="margin:0">Hiçbiri listende değil</span>'}<span class="coll-frac">${counts.watched}/${rel} izlendi</span></span>
          </span>
          <span class="coll-chev" aria-hidden="true">›</span>
        </summary>
        <div class="coll-bulk">
          <span class="note" style="margin:0">Hepsini taşı</span>
          <span class="acts-right">
            ${Object.entries(SEARCH_ADD).map(([s, [ic, l]]) => `<button class="pill pill-bulk pill-${s}" data-bulk="${s}" title="Serinin bütün filmleri: ${l}">${ic} ${l}</button>`).join('')}
          </span>
        </div>
        <ul class="list coll-parts">${c.parts.map(resultHTML).join('')}</ul>
      </details>
    </li>`;
}
// Yeniden çizimde açık serileri koru
const openColls = root => new Set($$('.coll details', root).filter(d => d.open).map(d => d.parentElement.dataset.coll));

// Bir öğeyi listeye yaz; geri almak için bir fonksiyon döndürür
function putItem(it, status) {
  const prev = S.items[it.key] ? { ...S.items[it.key] } : null, wasSeen = S.seen.has(it.key);
  if (prev) {
    const cur = S.items[it.key];
    Object.assign(cur, { status, addedAt:Date.now(), originalTitle:cur.originalTitle || it.originalTitle });
    if (cur.collection === undefined && it.collection !== undefined) cur.collection = it.collection;
    if (status !== 'watched') delete cur.progress;
  } else setItem(it, status);
  S.seen.add(it.key);
  // Destede bekliyorsa çıkar (bir daha gösterme)
  const qi = S.queue.findIndex(x => x.key === it.key), queued = qi >= 0 ? S.queue[qi] : null;
  if (queued) { S.queue.splice(qi, 1); S.queued.delete(it.key); }
  return () => {
    if (prev) S.items[it.key] = prev; else delete S.items[it.key];
    if (!wasSeen) S.seen.delete(it.key);
    if (queued && !S.queued.has(it.key)) { S.queue.splice(Math.min(qi, S.queue.length), 0, queued); S.queued.add(it.key); }
  };
}
function afterPut() {
  saveItems(); saveSeen(); renderDeck(); updateCounts();
  if (openSheetEl?.id === 'sheetSearch') renderSearch();
  if (S.view === 'lists') renderList();
}
// Seri kutusu ve sonuç satırlarındaki düğmeler (arama sayfası ve Listeler › Seriler ortak)
function onCollAction(e, colls, lookup) {
  const b = e.target.closest('[data-add], [data-bulk]');
  if (!b) return false;
  if (b.dataset.bulk) {
    const c = colls.find(x => String(x.id) === b.closest('.coll').dataset.coll);
    if (!c) return true;
    const status = b.dataset.bulk;
    // Henüz çıkmamış filmler "izledim" olamaz; zaten o listede olanlara dokunma
    const targets = c.parts.filter(p => (status !== 'watched' || released(p)) && S.items[p.key]?.status !== status);
    if (!targets.length) { toast(`Hepsi zaten ${STATUS[status]} içinde`); return true; }
    const undos = targets.map(p => putItem(p, status));
    afterPut();
    const skipped = status === 'watched' ? c.parts.filter(p => !released(p)).length : 0;
    toast(`${targets.length} film ${STATUS_TO[status]} taşındı${skipped ? ` (${skipped} çıkmamış film atlandı)` : ''}`, 'Geri al', () => { undos.forEach(u => u()); afterPut(); }, 5000);
    return true;
  }
  const key = b.closest('.item').dataset.key;
  const it = lookup(key) || colls.flatMap(c => c.parts).find(p => p.key === key);
  if (!it) return true;
  const u = putItem(it, b.dataset.add);
  afterPut();
  toast(`${STATUS_TO[b.dataset.add]} eklendi`, 'Geri al', () => { u(); afterPut(); });
  return true;
}

/* ---- Kart etiketi: "🎞️ Harry Potter Serisi · 3/8" ---- */
function collTagHTML(it) {
  if (!it.collection) return '';
  const c = collCache[it.collection.id];
  const i = c ? c.parts.findIndex(p => p.key === it.key) : -1;
  return `<button class="coll-tag" data-coll-open="${it.collection.id}">🎞️ ${esc(c ? titles(c).main : it.collection.name)}${i >= 0 ? ` · ${i + 1}/${c.parts.length}` : ''} ›</button>`;
}
// Liste satırı etiketi: "🎞️ Harry Potter · 3. film · 5/7 izlendi"; seri önbellekte yoksa getirilir ve liste yenilenir
const collWant = new Set();
function collListTag(i) {
  if (!i.collection) return '';
  const c = collCache[i.collection.id];
  if (!c && !collWant.has(i.collection.id) && !collFailed.has(i.collection.id)) {
    collWant.add(i.collection.id);
    getCollection(i.collection.id).then(() => { if (S.view === 'lists') renderList(); }).catch(() => {});
  }
  if (!c) return `<button class="coll-tag coll-tag-sm" data-coll-open="${i.collection.id}">🎞️ ${esc(i.collection.name)} ›</button>`;
  const idx = c.parts.findIndex(p => p.key === i.key), rel = c.parts.filter(released).length;
  const watched = c.parts.filter(p => S.items[p.key]?.status === 'watched').length;
  const done = rel && watched >= rel;
  return `<button class="coll-tag coll-tag-sm${done ? ' coll-done' : ''}" data-coll-open="${c.id}" title="Seriyi aç">🎞️ ${esc(titles(c).main)}${idx >= 0 ? ` · ${idx + 1}. film` : ''} · ${done ? '✓ hepsi izlendi' : `${watched}/${rel} izlendi`} ›</button>`;
}
async function refreshCollTag(it) {
  if (!it.collection) return;
  const paint = () => { const box = $(keySel(it.key) + ' .coll-tag-wrap'); if (box) box.innerHTML = collTagHTML(it); };
  paint();
  try { await getCollection(it.collection.id); paint(); } catch {}
}
// Karttaki etikete dokununca: seriyi arama sayfasında aç (toplu taşıma orada)
async function openCollection(id) {
  try {
    const c = await getCollection(id);
    openSheet('#sheetSearch');
    $('#sq').value = titles(c).main; $('#sHint').hidden = true;
    clearTimeout(searchTimer); searchGen++; searchColls = [c]; searchResults = [];
    searchIndex.clear(); c.parts.forEach(p => searchIndex.set(p.key, p));
    $('#sResults').innerHTML = '';
    renderSearch();
  } catch (e) { toast('Seri açılamadı'); }
}

/* ---- Listeler › Seriler ---- */
let seriesColls = [], scanning = false;
// Sekme açıkken sıra sabit kalır: düğmeye basınca kutular yer değiştirmesin. Sekmeye girince ya da arama değişince sıfırlanır.
let seriesOrder = null;
const scanTried = new Set();
// Listedeki filmlerin hangi seriye ait olduğunu (belongs_to_collection) TMDB'den tamamla
async function scanCollections() {
  if (scanning || !tmdbReady()) return;
  const need = Object.entries(S.items).filter(([k, i]) => i.type === 'movie' && i.collection === undefined && !scanTried.has(k));
  if (!need.length) return;
  scanning = true;
  for (let n = 0; n < need.length; n += 40) {
    const batch = need.slice(n, n + 40);
    batch.forEach(([k]) => scanTried.add(k));
    await pool(batch, 4, async ([k, i]) => {
      try {
        const d = await tmdb(`/movie/${i.id}`, { language:'tr-TR', append_to_response:'external_ids,credits' });
        const item = S.items[k];
        if (!item) return;
        item.collection = collRef(d);
        if (item.originalTitle === undefined) item.originalTitle = d.original_title || '';
        if (!item.director) item.director = directorOf(d, 'movie');
        if (!item.imdb) item.imdb = d.external_ids?.imdb_id || d.imdb_id || null;
      } catch {}
    });
    saveItems();
    if (S.view === 'lists' && S.listTab === 'series') renderList();
  }
  scanning = false;
  updateCounts();
}
function renderSeries() {
  const ul = $('#list'), q = fold(S.listF.q.trim());
  const groups = new Map();
  Object.values(S.items).forEach(i => { if (i.collection) groups.set(i.collection.id, i.collection); });
  const pending = Object.entries(S.items).filter(([k, i]) => i.type === 'movie' && i.collection === undefined && !scanTried.has(k)).length;
  scanCollections();
  const missing = [...groups.keys()].filter(id => !collFailed.has(id) && !collInflight.has(id) && (!collCache[id] || Date.now() - collCache[id].at > COLL_TTL));
  if (missing.length) pool(missing, 3, id => getCollection(id).catch(() => {})).then(() => { if (S.view === 'lists' && S.listTab === 'series') renderList(); });
  seriesColls = [...groups.keys()].map(id => collCache[id]).filter(Boolean)
    .filter(c => c.parts.length && (!q || [c.title, c.originalTitle].some(t => fold(t).includes(q))))
    .map(c => ({ c, inList: c.parts.filter(p => S.items[p.key]).length, watched: c.parts.filter(p => S.items[p.key]?.status === 'watched').length }))
    // Önce yarım kalan seriler (izlenmeye başlanmış ama bitmemiş), sonra listede çok filmi olanlar
    .sort((a, b) => ((b.watched && b.watched < b.c.parts.filter(released).length) - (a.watched && a.watched < a.c.parts.filter(released).length)) || b.inList - a.inList || titles(a.c).main.localeCompare(titles(b.c).main, 'tr'))
    .map(x => x.c);
  if (seriesOrder?.q === q) {
    const pos = new Map(seriesOrder.ids.map((id, n) => [id, n]));
    seriesColls.sort((a, b) => (pos.get(a.id) ?? 1e9) - (pos.get(b.id) ?? 1e9));
  }
  seriesOrder = { q, ids: seriesColls.map(c => c.id) };
  $('#lCount').innerHTML = (seriesColls.length ? `<b>${seriesColls.length}</b> seri` : '') + (pending ? `${seriesColls.length ? ' · ' : ''}<span class="scan">seriler taranıyor: ${pending} film kaldı</span>` : '');
  if (!seriesColls.length) {
    ul.innerHTML = `<li class="empty"><span class="empty-icon">🎞️</span><b>${pending ? 'Seriler taranıyor…' : q ? 'Bu aramaya uyan seri yok' : 'Listende seriye ait film yok'}</b>${pending ? 'Listendeki filmlerin serileri TMDB\'den bulunuyor.' : 'Bir seri filmini listene ekleyince serisi burada görünür.'}</li>`;
    return;
  }
  const open = openColls(ul);
  ul.innerHTML = seriesColls.map(c => collHTML(c, open.has(String(c.id)))).join('');
}
