'use strict';
/* ================= Gezinti ve sheet ================= */
const TAB_VIEWS = ['discover', 'lists'];
function setView(v) {
  S.view = v;
  $('#viewDiscover').classList.toggle('active', v === 'discover');
  $('#viewLists').classList.toggle('active', v === 'lists');
  $('.app').classList.toggle('on-discover', v === 'discover'); // telefonda üst çubuk kartın üstünde yüzer
  $$('nav.tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.view === v));
  $('nav.tabs').style.setProperty('--i', TAB_VIEWS.indexOf(v)); // vurgu kapsülü etkin sekmeye kayar
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
  $('#seenCount').textContent = t('{n} içerik', { n:S.seen.size.toLocaleString(LOCALE) });
  resetSeenArmed = false;
  $('#btnResetSeen').textContent = t('Görülenleri sıfırla');
  $('#appVersion').textContent = t('Film ve dizi keşfi · sürüm {v}', { v:APP_VERSION + ' ' + APP_STAGE });
  renderPrivacy();
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

/* ---- Kaydırmalı sekme çubukları (alt çubuk + Koleksiyonum üstü): iOS gibi parmakla sağa sola ---- */
// Dokunup kaydırınca vurgu kapsülü parmağı izler; bırakınca hangi sekmenin üstündeyse ona geçer. Kısa dokunuş normal tıklamadır.
function initSlider(bar, onSelect) {
  const ind = $('.tab-ind', bar), btns = $$('button', bar);
  let st = null;
  const idxAt = (x, r) => Math.min(btns.length - 1, Math.max(0, Math.floor((x - r.left) / (r.width / btns.length))));
  bar.addEventListener('pointerdown', e => { st = { x0:e.clientX, moved:false, r:bar.getBoundingClientRect(), w:ind.offsetWidth, id:e.pointerId }; });
  bar.addEventListener('pointermove', e => {
    if (!st) return;
    if (!st.moved) {
      if (Math.abs(e.clientX - st.x0) < 8) return;
      st.moved = true;
      bar.setPointerCapture(st.id);
      ind.style.transition = 'none';
      bar.classList.add('dragging');
    }
    const pad = parseFloat(getComputedStyle(ind).left) || 0;
    const x = Math.min(Math.max(e.clientX - st.r.left - pad - st.w / 2, 0), st.r.width - pad * 2 - st.w);
    ind.style.transform = `translateX(${x}px)`;
    const over = idxAt(e.clientX, st.r);
    btns.forEach((b, k) => b.classList.toggle('hover', k === over));
  });
  const end = e => {
    if (!st) return;
    const s = st; st = null;
    if (!s.moved) return;
    ind.style.transition = ''; ind.style.transform = '';
    bar.classList.remove('dragging');
    btns.forEach(b => b.classList.remove('hover'));
    onSelect(idxAt(e.clientX, s.r));
    // Sürüklemeden sonra gelen tıklama seçimi geri çevirmesin
    const block = ev => { ev.stopPropagation(); ev.preventDefault(); };
    bar.addEventListener('click', block, true);
    setTimeout(() => bar.removeEventListener('click', block, true), 300);
  };
  bar.addEventListener('pointerup', end);
  bar.addEventListener('pointercancel', end);
}
function initTabDrag() {
  initSlider($('nav.tabs'), i => { if (TAB_VIEWS[i] !== S.view) setView(TAB_VIEWS[i]); });
  // Koleksiyonum sekmeleri: düğmenin kendi işleyicisini doğrudan çağır (tıklama olayı engelli)
  initSlider($('#listTabs'), i => { const b = $$('#listTabs button')[i]; if (b.dataset.tab !== S.listTab) b.onclick(); });
}
