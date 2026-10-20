'use strict';
/* ---- Eylemler ---- */
function setItem(it, status) {
  S.items[it.key] = { id:it.id, type:it.type, title:it.title, originalTitle:it.originalTitle || '', poster:it.poster, date:it.date, status,
    genres:it.genres, rating:it.rating, imdb:it.imdb || null, imdbRating:it.scores?.imdb || null, rt:it.scores?.rt || null,
    director:it.director || null, ...(it.age !== undefined ? { age:it.age } : {}), ...(it.trailer !== undefined ? { trailer:it.trailer } : {}), ...(it.collection !== undefined ? { collection:it.collection } : {}),
    scoreAt:it.scores ? Date.now() : null, addedAt:Date.now() };
  saveItems();
}
function act(dir, from) {
  const it = S.queue[0];
  if (!it) return;
  if (!from && S.dragging) return;
  S.queue.shift(); S.queued.delete(it.key);
  const prev = S.items[it.key] ? { ...S.items[it.key] } : null;
  const wasSeen = S.seen.has(it.key);
  setItem(it, DIR_STATUS[dir]);
  S.seen.add(it.key); saveSeen();
  S.undo.push({ it, prev, wasSeen, dir });
  if (S.undo.length > 50) S.undo.shift();
  const el = $(keySel(it.key) + ':not(.leaving)');
  if (el) flyOut(el, dir, from);
  const btn = $(`.act[data-dir="${dir}"]`);
  btn.classList.add('pop'); setTimeout(() => btn.classList.remove('pop'), 160);
  vibrate();
  renderDeck(); updateCounts();
  if (!S.user) guestNudge();
}
function undo() {
  const u = S.undo.pop();
  if (!u) return;
  const { it } = u;
  if (u.prev) S.items[it.key] = u.prev; else delete S.items[it.key];
  saveItems();
  if (!u.wasSeen) { S.seen.delete(it.key); saveSeen(); }
  $$(keySel(it.key)).forEach(e => e.remove());
  S.queue.unshift(it); S.queued.add(it.key);
  // Kart çıktığı yönden geri gelsin
  const el = createCard(it);
  el.dataset.depth = 0; el.style.zIndex = 10;
  el.style.transition = 'none';
  const off = { right:`translate(${innerWidth}px,0) rotate(28deg)`, left:`translate(${-innerWidth}px,0) rotate(-28deg)`, up:`translate(0,${-innerHeight}px)` }[u.dir];
  el.style.transform = off;
  $('#deck').appendChild(el);
  el.getBoundingClientRect();
  el.style.transition = '';
  el.style.transform = '';
  renderDeck(); updateCounts();
  if (S.view === 'lists') renderList();
}

/* ---- Geçtiklerimi sıfırlama ---- */
// Sola kaydırılanlar (passed) listeden ve görülenlerden çıkar, destede yeniden çıkabilir. Elle (son 24 saat, son 7 gün,
// 1 aydan eski, tümü) ya da otomatik: bu cihazda seçilen süreden eski olanlar (kd_passreset = gün, 0 = hiç).
// Hesapta silme satırı data:{reset:true} ile gider; öbür cihazlar onu görünce anahtarı görülenlerden de çıkarır (sıradan
// liste silme görülen sayılmaya devam eder). Hesaba gidene kadar anahtarlar kd_resetp'de bekler ve buluttaki görülenler
// birleştirilirken atlanır; yoksa henüz gönderilmemiş sıfırlama ilk çekmede geri gelirdi.
const PASS_AUTO = [[0, 'Hiç'], [7, '1 hafta'], [30, '1 ay'], [90, '3 ay'], [180, '6 ay'], [365, '1 yıl']];
const DAY = 864e5;
const PASS_NOW = [
  ['day', 'Son 24 saat', a => a >= Date.now() - DAY],
  ['week', 'Son 7 gün', a => a >= Date.now() - 7 * DAY],
  ['old', '1 aydan eski', a => a < Date.now() - 30 * DAY],
  ['all', 'Tümü', () => true],
];
let resetPending = new Set(accountMode ? store.get(K.resetPending, []) : []);
const passAuto = () => +store.get(K.passReset, 0) || 0;
// keepAt: "Geri al" ile dönen öğe otomatik sıfırlamada o andan itibaren sayılır (yoksa bir sonraki açılışta yine giderdi)
const passedKeys = (test, auto) => Object.entries(S.items).filter(([, v]) => v.status === 'passed' && test(auto ? Math.max(v.addedAt || 0, v.keepAt || 0) : v.addedAt || 0)).map(([k]) => k);
function passChanged() {
  store.set(K.resetPending, [...resetPending]);
  saveItems(); saveSeen(); updateCounts(); if (S.view === 'lists') renderList();
  resetEngine(); renderPassReset();
}
function resetPassed(keys, msg) {
  if (!keys.length) return 0;
  const back = keys.map(k => [k, S.items[k], S.seen.has(k)]);
  keys.forEach(k => { delete S.items[k]; S.seen.delete(k); if (S.user) resetPending.add(k); }); // misafirde eşitleme yok
  S.undo = S.undo.filter(u => !keys.includes(u.it.key));
  passChanged();
  toast(msg || t('{n} içerik sıfırlandı; destede yeniden çıkabilir', { n:keys.length }), t('Geri al'), () => {
    back.forEach(([k, v, seen]) => { S.items[k] = { ...v, keepAt:Date.now() }; if (seen) S.seen.add(k); resetPending.delete(k); });
    passChanged();
  }, 6000);
  return keys.length;
}
function applyPassAuto() {
  const d = passAuto();
  if (!d) return;
  const keys = passedKeys(a => a < Date.now() - d * DAY, true);
  if (keys.length) resetPassed(keys, t('{d} günden eski {n} geçtiğin içerik sıfırlandı', { d, n:keys.length }));
}
function renderPassReset() {
  const box = $('#passAutoChips');
  if (!box) return;
  const d = passAuto(), preset = PASS_AUTO.some(([v]) => v === d);
  box.innerHTML = PASS_AUTO.map(([v, l]) => `<button class="chip" data-pauto="${v}" aria-pressed="${v === d}">${t(l)}</button>`).join('')
    + `<button class="chip" data-pauto="custom" aria-pressed="${!preset}">${preset ? t('Özel') : t('Özel: {n} gün', { n:d })}</button>`;
  $('#passCount').textContent = t('{n} içerik', { n:passedKeys(() => true).length.toLocaleString(LOCALE) });
  $('#passNowChips').innerHTML = PASS_NOW.map(([id, l, f]) => {
    const n = passedKeys(f).length;
    return `<button class="chip" data-pnow="${id}" ${n ? '' : 'disabled'}>${t(l)} <small>${n.toLocaleString(LOCALE)}</small></button>`;
  }).join('');
}
function setPassAuto(d) {
  store.set(K.passReset, d);
  $('#passCustom').classList.add('hidden');
  renderPassReset();
  toast(d ? t('Geçtiklerin {n} gün sonra kendiliğinden sıfırlanır', { n:d }) : t('Geçtiklerin kendiliğinden sıfırlanmaz'));
  applyPassAuto();
}
function onPassClick(e) {
  const a = e.target.closest('[data-pauto]'), now = e.target.closest('[data-pnow]');
  if (a) {
    if (a.dataset.pauto !== 'custom') return setPassAuto(+a.dataset.pauto);
    $('#passCustom').classList.remove('hidden');
    setTimeout(() => $('#passCustomN').focus(), 50);
  } else if (now) resetPassed(passedKeys(PASS_NOW.find(p => p[0] === now.dataset.pnow)[2]));
  else if (e.target.closest('#passCustomSave')) {
    const d = Math.round(+$('#passCustomN').value * +$('#passCustomU').value);
    if (!(d >= 1 && d <= 3650)) return toast(t('1 gün ile 10 yıl arasında bir süre yaz'));
    setPassAuto(d);
  }
}
function initPassReset() {
  $('#passSec').addEventListener('click', onPassClick);
  $('#passCustomN').addEventListener('keydown', e => { if (e.key === 'Enter') $('#passCustomSave').click(); });
  renderPassReset();
  if (!accountMode) applyPassAuto(); // hesapta ilk eşitlemeden sonra (syncNow)
}
