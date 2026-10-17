'use strict';
/* ================= Arama (TMDB) ================= */
// Tüm TMDB'de arar. Önce film serileri (TMDB "collection": Harry Potter, Yüzüklerin Efendisi…) bütün filmleriyle,
// sonra film ve dizi sonuçları, en sonda kişi sonuçlarının bilinen işleri (known_for) gelir.
let searchGen = 0, searchTimer = null, searchResults = [], searchColls = [];
const searchIndex = new Map(); // key → öğe (seri filmleri + sonuçlar), tek tek eklemede bulmak için
function openSearch() {
  if (!S.apiKey) { toast('Önce Ayarlar\'dan TMDB anahtarını kaydet.'); return; }
  openSheet('#sheetSearch');
  setTimeout(() => $('#sq').focus(), 250);
  if ($('#sq').value.trim()) renderSearch();
}
function onSearchInput() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(runSearch, 350);
}
const COLL_MAX = 2; // en çok kaç seri gösterilsin
async function loadCollections(q) {
  const d = await tmdb('/search/collection', { query:q, language:'tr-TR' }).catch(() => ({ results: [] }));
  const hits = (d.results || []).slice(0, COLL_MAX);
  const full = await Promise.all(hits.map(c => tmdb(`/collection/${c.id}`, { language:'tr-TR' }).catch(() => null)));
  return full.filter(Boolean).map((c, i) => ({
    id: c.id, title: c.name || hits[i].name, originalTitle: hits[i].original_name || c.original_name || '',
    poster: c.poster_path || hits[i].poster_path,
    // Çıkış tarihine göre; tarihi olmayan (duyurulmuş) filmler sonda
    parts: (c.parts || []).map(p => norm(p, 'movie')).sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999')),
  })).filter(c => c.parts.length > 1);
}
async function runSearch() {
  const q = $('#sq').value.trim(), gen = ++searchGen;
  if (q.length < 2) { searchResults = []; searchColls = []; $('#sHint').hidden = false; $('#sResults').innerHTML = ''; return; }
  $('#sHint').hidden = true;
  $('#sResults').innerHTML = '<li class="empty"><span class="spinner"></span></li>';
  try {
    const [d, colls] = await Promise.all([tmdb('/search/multi', { query:q, language:'tr-TR', include_adult:false }), loadCollections(q)]);
    if (gen !== searchGen) return;
    const inColl = new Set(colls.flatMap(c => c.parts.map(p => p.key)));
    const seen = new Set(), out = [];
    const add = (r, via) => {
      const type = r.media_type;
      if (type !== 'movie' && type !== 'tv') return;
      const it = norm(r, type);
      if (seen.has(it.key) || inColl.has(it.key)) return; // seride zaten görünüyor
      seen.add(it.key); out.push(via ? { ...it, via } : it);
    };
    const res = d.results || [];
    res.forEach(r => add(r));
    res.filter(r => r.media_type === 'person').slice(0, 3).forEach(p => (p.known_for || []).forEach(r => add(r, p.name)));
    searchColls = colls; searchResults = out;
    searchIndex.clear();
    [...colls.flatMap(c => c.parts), ...out].forEach(it => searchIndex.set(it.key, it));
    renderSearch();
  } catch (e) {
    if (gen !== searchGen) return;
    $('#sResults').innerHTML = `<li class="empty"><b>Aranamadı</b>${e instanceof AuthError ? 'TMDB anahtarı geçersiz.' : esc(e.message)}</li>`;
  }
}
const SEARCH_ADD = { want:['♥', 'İstek'], watched:['✓', 'İzledim'], passed:['✕', 'Geç'] };
const released = it => it.date && it.date <= TODAY;
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
  const t = titles(c), n = c.parts.length;
  const counts = { want:0, watched:0, passed:0 };
  c.parts.forEach(p => { const s = S.items[p.key]?.status; if (s) counts[s]++; });
  const inList = Object.entries(counts).filter(([, v]) => v).map(([s, v]) => `<span class="in-list in-${s}">${v} ${STATUS[s].split(' ')[0]}</span>`).join('');
  const span = [yearOf(c.parts[0].date), yearOf(c.parts.filter(released).at(-1)?.date || '')].filter(Boolean);
  return `
    <li class="coll" data-coll="${c.id}">
      <details ${open ? 'open' : ''}>
        <summary>
          <span class="item-poster">${c.poster ? `<img src="${IMG}w185${esc(c.poster)}" alt="" loading="lazy">` : ''}<span class="type">SERİ</span></span>
          <span class="coll-main">
            <span class="item-title"><span class="t-main">${esc(t.main)}</span>${t.sub ? `<small>${esc(t.sub)}</small>` : ''}</span>
            <span class="item-sub">${n} film${span.length ? ' · ' + [...new Set(span)].join('–') : ''}</span>
            <span class="coll-in">${inList || '<span class="note" style="margin:0">Hiçbiri listende değil</span>'}</span>
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
function renderSearch() {
  const ul = $('#sResults');
  if (!searchResults.length && !searchColls.length) { ul.innerHTML = '<li class="empty"><span class="empty-icon">🔍</span><b>Sonuç yok</b>Başka bir yazım dene ya da orijinal adıyla ara.</li>'; return; }
  // Açık/kapalı seri durumunu yeniden çizimde koru
  const openIds = new Set($$('.coll details', ul).filter(d => d.open).map(d => d.parentElement.dataset.coll));
  const first = !ul.querySelector('.coll');
  ul.innerHTML = searchColls.map((c, i) => collHTML(c, first ? i === 0 : openIds.has(String(c.id)))).join('')
    + (searchColls.length && searchResults.length ? '<li class="sec-head">Diğer sonuçlar</li>' : '')
    + searchResults.map(resultHTML).join('');
}
// Bir öğeyi listeye yaz; geri almak için önceki durumu döndürür
function putItem(it, status) {
  const prev = S.items[it.key] ? { ...S.items[it.key] } : null, wasSeen = S.seen.has(it.key);
  if (prev) {
    Object.assign(S.items[it.key], { status, addedAt:Date.now(), originalTitle:S.items[it.key].originalTitle || it.originalTitle });
    if (status !== 'watched') delete S.items[it.key].progress;
  } else setItem(it, status);
  S.seen.add(it.key);
  // Destede bekliyorsa çıkar (bir daha gösterme)
  const qi = S.queue.findIndex(x => x.key === it.key);
  if (qi >= 0) { S.queue.splice(qi, 1); S.queued.delete(it.key); }
  return () => { if (prev) S.items[it.key] = prev; else delete S.items[it.key]; if (!wasSeen) S.seen.delete(it.key); };
}
function afterPut() {
  saveItems(); saveSeen(); renderDeck(); updateCounts(); renderSearch();
  if (S.view === 'lists') renderList();
}
function onSearchClick(e) {
  const b = e.target.closest('[data-add], [data-bulk]');
  if (!b) return;
  if (b.dataset.bulk) {
    const c = searchColls.find(x => String(x.id) === b.closest('.coll').dataset.coll);
    if (!c) return;
    const status = b.dataset.bulk;
    // Henüz çıkmamış filmler "izledim" olamaz; zaten o listede olanlara dokunma
    const targets = c.parts.filter(p => (status !== 'watched' || released(p)) && S.items[p.key]?.status !== status);
    if (!targets.length) { toast(`Hepsi zaten ${STATUS[status]} listesinde`); return; }
    const undos = targets.map(p => putItem(p, status));
    afterPut();
    const skipped = status === 'watched' ? c.parts.filter(p => !released(p)).length : 0;
    toast(`${targets.length} film ${STATUS_TO[status]} taşındı${skipped ? ` (${skipped} çıkmamış film atlandı)` : ''}`, 'Geri al', () => { undos.forEach(u => u()); afterPut(); }, 5000);
    return;
  }
  const it = searchIndex.get(b.closest('.item').dataset.key);
  if (!it) return;
  const u = putItem(it, b.dataset.add);
  afterPut();
  toast(`${STATUS_TO[b.dataset.add]} eklendi`, 'Geri al', () => { u(); afterPut(); });
}
