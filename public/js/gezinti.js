'use strict';
/* ================= Gezinti ve sheet ================= */
function setView(v) {
  S.view = v;
  $('#viewDiscover').classList.toggle('active', v === 'discover');
  $('#viewLists').classList.toggle('active', v === 'lists');
  $$('nav.tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.view === v));
  if (v === 'lists') { seriesOrder = null; listOrder = null; renderList(); }
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
// Ayarları aç ve Hesap bölümüne odaklan (rehber ve anahtar kutusundan); mode 'up' kayıt düğmesini öne çıkarır
function openAccount(mode = 'in') {
  openSettings();
  const up = mode === 'up';
  $('#accIn')?.classList.toggle('btn-primary', !up);
  $('#accUp')?.classList.toggle('btn-primary', up);
  $('#accPass')?.setAttribute('autocomplete', up ? 'new-password' : 'current-password');
  $('#accBox').scrollIntoView({ block:'nearest' });
  setTimeout(() => $('#accEmail')?.focus(), 300);
}
let resetSeenArmed = false;
