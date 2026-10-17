'use strict';
/* ================= Arama (TMDB) ================= */
// Tüm TMDB'de arar. Önce film serileri (TMDB "collection": Harry Potter, Yüzüklerin Efendisi…) bütün filmleriyle,
// sonra film ve dizi sonuçları, en sonda kişi sonuçlarının bilinen işleri (known_for) gelir.
// Seri kutusu, sonuç satırı ve toplu taşıma js/seriler.js'te.
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
  const full = await Promise.all((d.results || []).slice(0, COLL_MAX).map(c => getCollection(c.id).catch(() => null)));
  return full.filter(c => c && c.parts.length > 1);
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
    $('#sResults').innerHTML = '';
    renderSearch();
  } catch (e) {
    if (gen !== searchGen) return;
    $('#sResults').innerHTML = `<li class="empty"><b>Aranamadı</b>${e instanceof AuthError ? 'TMDB anahtarı geçersiz.' : esc(e.message)}</li>`;
  }
}
function renderSearch() {
  const ul = $('#sResults');
  if (!searchResults.length && !searchColls.length) { ul.innerHTML = '<li class="empty"><span class="empty-icon">🔍</span><b>Sonuç yok</b>Başka bir yazım dene ya da orijinal adıyla ara.</li>'; return; }
  const first = !ul.querySelector('.coll'), open = openColls(ul);
  ul.innerHTML = searchColls.map((c, i) => collHTML(c, first ? i === 0 : open.has(String(c.id)))).join('')
    + (searchColls.length && searchResults.length ? '<li class="sec-head">Diğer sonuçlar</li>' : '')
    + searchResults.map(resultHTML).join('');
}
function onSearchClick(e) {
  onCollAction(e, searchColls, key => searchIndex.get(key));
}
