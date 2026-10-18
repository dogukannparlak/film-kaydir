'use strict';
/* ================= Gezinti ve sheet ================= */
function setView(v) {
  S.view = v;
  $('#viewDiscover').classList.toggle('active', v === 'discover');
  $('#viewLists').classList.toggle('active', v === 'lists');
  $('.app').classList.toggle('on-discover', v === 'discover'); // telefonda üst çubuk kartın üstünde yüzer
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

/* ---- Alt sayfayı aşağı sürükleyip kapatma ---- */
// Tutamaktan (çizgi + başlık) her zaman; içerikten yalnız en üstteyken aşağı çekince.
// Bırakınca: sayfa yüksekliğinin yarısından fazla çekildiyse kapanır, yoksa yukarı geri döner.
let sheetDrag = null;
function sheetDragStart(sheet, y, target) {
  if (!sheet.classList.contains('open') || target.closest('input, select, textarea')) return;
  const handle = target.closest('.grip, .sheet-head');
  const scroller = target.closest('.sheet-body, .sheet-list');
  if (!handle && scroller && scroller.scrollTop > 0) return;
  sheetDrag = { sheet, y0:y, dy:0, active:false, h:sheet.offsetHeight };
}
function sheetDragMove(y, e) {
  const d = sheetDrag;
  if (!d) return;
  const dy = y - d.y0;
  if (!d.active) {
    if (dy < -6) { sheetDrag = null; return; } // yukarı: içerik kaydırılıyor
    if (dy < 8) return;
    d.active = true;
    d.sheet.style.transition = 'none';
    $('#backdrop').style.transition = 'none';
  }
  if (e.cancelable) e.preventDefault();
  d.dy = Math.max(0, dy);
  d.sheet.style.transform = `translateY(${d.dy}px)`;
  $('#backdrop').style.opacity = String(Math.max(0, 1 - d.dy / d.h));
}
function sheetDragEnd() {
  const d = sheetDrag;
  sheetDrag = null;
  if (!d || !d.active) return;
  d.sheet.style.transition = ''; $('#backdrop').style.transition = '';
  d.sheet.style.transform = ''; $('#backdrop').style.opacity = '';
  if (d.dy > d.h / 2) closeSheet();
  // Sürüklemeden sonra gelen tıklama (ör. ✕ düğmesi) yanlışlıkla çalışmasın
  const block = ev => { ev.stopPropagation(); ev.preventDefault(); };
  d.sheet.addEventListener('click', block, true);
  setTimeout(() => d.sheet.removeEventListener('click', block, true), 350);
}
function initSheetDrag() {
  $$('.sheet').forEach(sheet => {
    // Dokunma: içerik en üstteyken aşağı çekmeyi tarayıcı kaydırmasından önce yakala (passive:false)
    sheet.addEventListener('touchstart', e => sheetDragStart(sheet, e.touches[0].clientY, e.target), { passive:true });
    sheet.addEventListener('touchmove', e => sheetDragMove(e.touches[0].clientY, e), { passive:false });
    sheet.addEventListener('touchend', sheetDragEnd);
    sheet.addEventListener('touchcancel', sheetDragEnd);
    // Fare
    sheet.addEventListener('mousedown', e => sheetDragStart(sheet, e.clientY, e.target));
  });
  document.addEventListener('mousemove', e => sheetDrag && sheetDragMove(e.clientY, e));
  document.addEventListener('mouseup', sheetDragEnd);
}
