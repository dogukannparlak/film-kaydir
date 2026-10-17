'use strict';
/* ================= Başlat ================= */
function init() {
  fillListSelects();
  updateSummary();
  updateCounts();

  $$('.act[data-dir]').forEach(b => b.addEventListener('click', () => act(b.dataset.dir)));
  $('#btnUndo').onclick = undo;
  $('#btnFilters').onclick = openFilters;
  $('#summary').onclick = openFilters;
  $('#btnSettings').onclick = openSettings;
  $('#backdrop').onclick = closeSheet;
  $$('[data-close]').forEach(b => b.onclick = closeSheet);
  $('#filterBody').addEventListener('click', onFilterClick);
  $('#filterBody').addEventListener('input', e => {
    if (e.target.id === 'minRating') {
      draft.minRating = +e.target.value;
      $('#ratingOut').textContent = draft.minRating ? '★ ' + draft.minRating : 'yok';
    }
  });
  $('#btnApplyFilters').onclick = applyFilters;
  $('#btnResetFilters').onclick = () => { draft = JSON.parse(JSON.stringify(DEFAULT_FILTERS)); renderFilterSheet(); };
  $('#deck').addEventListener('click', e => {
    if (e.target.closest('[data-retry]')) { E.error = null; E.dry = 0; fetchMore(); }
    if (e.target.closest('[data-open-filters]')) openFilters();
  });

  $$('nav.tabs button').forEach(b => b.onclick = () => setView(b.dataset.view));
  $$('#listTabs button').forEach(b => b.onclick = () => {
    S.listTab = b.dataset.tab;
    $$('#listTabs button').forEach(x => x.setAttribute('aria-selected', x === b));
    renderList();
  });
  const lfChange = () => {
    S.listF = { type:$('#lType').value, genre:$('#lGenre').value, period:$('#lPeriod').value, q:$('#lq').value, sort:$('#lSort').value, progress:$('#lProgress').value };
    store.set(K.listF, S.listF);
    renderList();
  };
  ['#lType', '#lGenre', '#lPeriod', '#lSort', '#lProgress'].forEach(s => $(s).onchange = lfChange);
  $('#lq').oninput = lfChange;
  $('#list').addEventListener('click', onListClick);
  $('#btnExport').onclick = exportJSON;
  $('#btnImport').onclick = () => $('#fileImport').click();
  $('#fileImport').onchange = e => { const f = e.target.files[0]; if (f) importJSON(f); e.target.value = ''; };
  $('#btnSearch').onclick = openSearch;
  $('#sq').oninput = onSearchInput;
  $('#sq').onkeydown = e => { if (e.key === 'Enter') { clearTimeout(searchTimer); runSearch(); } };
  $('#sResults').addEventListener('click', onSearchClick);
  $('#btnLetterboxd').onclick = () => $('#fileLetterboxd').click();
  $('#fileLetterboxd').onchange = e => { const fs = [...e.target.files]; if (fs.length) importLetterboxd(fs); e.target.value = ''; };

  $('#btnSaveKey2').onclick = () => saveKey($('#setKey').value, $('#setKeyErr'));
  $('#btnDelKey').onclick = () => {
    store.del(K.key); S.apiKey = ''; closeSheet(); resetEngine(); toast('Anahtar silindi');
  };
  $('#btnSaveOmdb').onclick = saveOmdb;
  $('#btnDelOmdb').onclick = () => { store.del(K.omdb); S.omdbKey = ''; $('#setOmdb').value = ''; toast('OMDb anahtarı silindi'); };
  $('#btnResetSeen').onclick = () => {
    if (!resetSeenArmed) { resetSeenArmed = true; $('#btnResetSeen').textContent = 'Emin misin? Tekrar dokun'; return; }
    S.seen = new Set(Object.keys(S.items)); saveSeen();
    closeSheet(); resetEngine(); toast('Görülenler sıfırlandı');
  };

  document.addEventListener('keydown', e => {
    if (e.target.closest?.('input, textarea, select')) return;
    if (openSheetEl) { if (e.key === 'Escape') closeSheet(); return; }
    if (e.key === '/' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); openSearch(); return; }
    if (S.view !== 'discover' || !S.apiKey) return;
    const dir = { ArrowRight:'right', ArrowLeft:'left', ArrowUp:'up' }[e.key];
    if (dir) { e.preventDefault(); act(dir); }
    else if (e.key === 'Backspace' || e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
  });

  renderDeck();
  if (S.apiKey) loadProviders();
}
init();
