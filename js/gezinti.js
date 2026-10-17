'use strict';
/* ================= Gezinti ve sheet ================= */
function setView(v) {
  S.view = v;
  $('#viewDiscover').classList.toggle('active', v === 'discover');
  $('#viewLists').classList.toggle('active', v === 'lists');
  $$('nav.tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.view === v));
  if (v === 'lists') { seriesOrder = null; renderList(); }
}
let openSheetEl = null;
function openSheet(sel) {
  openSheetEl = $(sel);
  openSheetEl.classList.add('open');
  $('#backdrop').classList.add('open');
}
function closeSheet() {
  openSheetEl?.classList.remove('open');
  openSheetEl = null;
  $('#backdrop').classList.remove('open');
}
function openSettings() {
  $('#setKey').value = S.apiKey;
  $('#setOmdb').value = S.omdbKey;
  $('#omdbErr').textContent = '';
  $('#setKeyErr').textContent = '';
  $('#seenCount').textContent = S.seen.size.toLocaleString('tr-TR') + ' içerik';
  resetSeenArmed = false;
  $('#btnResetSeen').textContent = 'Görülenleri sıfırla';
  openSheet('#sheetSettings');
}
let resetSeenArmed = false;
