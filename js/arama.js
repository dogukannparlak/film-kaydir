'use strict';
/* ================= Arama (TMDB) ================= */
// Tüm TMDB'de arar: film ve dizi sonuçları doğrudan, kişi sonuçlarının bilinen işleri (known_for) ardından gelir.
let searchGen = 0, searchTimer = null, searchResults = [];
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
async function runSearch() {
  const q = $('#sq').value.trim(), gen = ++searchGen;
  if (q.length < 2) { searchResults = []; $('#sHint').hidden = false; $('#sResults').innerHTML = ''; return; }
  $('#sHint').hidden = true;
  $('#sResults').innerHTML = '<li class="empty"><span class="spinner"></span></li>';
  try {
    const d = await tmdb('/search/multi', { query:q, language:'tr-TR', include_adult:false });
    if (gen !== searchGen) return;
    const seen = new Set(), out = [];
    const add = (r, via) => {
      const type = r.media_type;
      if (type !== 'movie' && type !== 'tv') return;
      const it = norm(r, type);
      if (seen.has(it.key)) return;
      seen.add(it.key); out.push(via ? { ...it, via } : it);
    };
    const res = d.results || [];
    res.forEach(r => add(r));
    res.filter(r => r.media_type === 'person').slice(0, 3).forEach(p => (p.known_for || []).forEach(r => add(r, p.name)));
    searchResults = out;
    renderSearch();
  } catch (e) {
    if (gen !== searchGen) return;
    $('#sResults').innerHTML = `<li class="empty"><b>Aranamadı</b>${e instanceof AuthError ? 'TMDB anahtarı geçersiz.' : esc(e.message)}</li>`;
  }
}
const SEARCH_ADD = { want:['♥', 'İstek'], watched:['✓', 'İzledim'], passed:['✕', 'Geç'] };
function renderSearch() {
  const ul = $('#sResults');
  if (!searchResults.length) { ul.innerHTML = '<li class="empty"><span class="empty-icon">🔍</span><b>Sonuç yok</b>Başka bir yazım dene ya da orijinal adıyla ara.</li>'; return; }
  ul.innerHTML = searchResults.map(it => {
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
          ${yearOf(it.date) ? `<span class="item-year">${yearOf(it.date)}</span>` : ''}
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
  }).join('');
}
function onSearchClick(e) {
  const b = e.target.closest('[data-add]');
  if (!b) return;
  const it = searchResults.find(x => x.key === b.closest('.item').dataset.key);
  if (!it) return;
  const prev = S.items[it.key] ? { ...S.items[it.key] } : null, wasSeen = S.seen.has(it.key);
  if (prev) Object.assign(S.items[it.key], { status:b.dataset.add, addedAt:Date.now(), originalTitle:S.items[it.key].originalTitle || it.originalTitle }), delete S.items[it.key].progress, saveItems();
  else setItem(it, b.dataset.add);
  S.seen.add(it.key); saveSeen();
  // Destede bekliyorsa çıkar (bir daha gösterme)
  const qi = S.queue.findIndex(x => x.key === it.key);
  if (qi >= 0) { S.queue.splice(qi, 1); S.queued.delete(it.key); renderDeck(); }
  updateCounts(); renderSearch(); if (S.view === 'lists') renderList();
  toast(`${STATUS[b.dataset.add]} listesine eklendi`, 'Geri al', () => {
    if (prev) S.items[it.key] = prev; else delete S.items[it.key];
    if (!wasSeen) S.seen.delete(it.key);
    saveItems(); saveSeen(); updateCounts(); renderSearch(); if (S.view === 'lists') renderList();
  });
}
