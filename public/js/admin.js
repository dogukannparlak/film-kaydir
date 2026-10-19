'use strict';
/* ================= Yönetim paneli ================= */
// Yalnız public.admins tablosundaki hesaba açık: düğme is_admin() true dönerse görünür, veriyi admin_stats() verir
// (ikisi de sunucuda yetki denetler; düğmeyi gizlemek yalnız arayüz kolaylığıdır).
// Umami ve Cloudflare Web Analytics kendi panellerinde; buradan bağlantı verilir.
const ADMIN = { on:false, days:30, data:null, busy:false };
const ADMIN_DAYS = [7, 30, 90];
const fmtSecs = s => { s = Math.round(s || 0); return s < 60 ? t('{s} sn', { s }) : s < 3600 ? t('{m} dk {s} sn', { m: Math.floor(s / 60), s: s % 60 }) : t('{h} sa {m} dk', { h: Math.floor(s / 3600), m: Math.floor(s % 3600 / 60) }); };
const fmtN = n => (+n || 0).toLocaleString(LOCALE);

async function checkAdmin() {
  ADMIN.on = false;
  if (S.user && sb) {
    const { data, error } = await sb.rpc('is_admin');
    ADMIN.on = !error && data === true;
  }
  $('#adminSec')?.classList.toggle('hidden', !ADMIN.on);
}
async function openAdmin() {
  if (!ADMIN.on) return;
  closeSheet(); openSheet('#sheetAdmin');
  await loadAdmin();
}
async function loadAdmin() {
  if (ADMIN.busy) return;
  ADMIN.busy = true;
  const body = $('#adminBody');
  if (!ADMIN.data) body.innerHTML = `<p class="note">${t('Yükleniyor…')}</p>`;
  const { data, error } = await sb.rpc('admin_stats', { p_days:ADMIN.days });
  ADMIN.busy = false;
  if (error) { body.innerHTML = `<p class="err">${t('İstatistik alınamadı: {m}', { m: esc(error.message) })}</p>`; return; }
  ADMIN.data = data; renderAdmin();
}
function renderAdmin() {
  const d = ADMIN.data, body = $('#adminBody');
  const tile = (label, value, sub = '') => `<div class="stat"><small>${label}</small><b>${value}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
  const max = Math.max(1, ...d.daily.map(x => x.visits));
  const bars = d.daily.map(x => `<div class="bar" title="${esc(t('{day}: {visits} ziyaret, {visitors} ziyaretçi, ort. {avg}', { day: x.day, visits: x.visits, visitors: x.visitors, avg: fmtSecs(x.avg_secs) }))}"><i style="height:${Math.round(100 * x.visits / max)}%"></i></div>`).join('');
  const rows = (list, empty) => list.length ? list.map(r => `<li><span>${esc(t(r.k))}</span><b>${fmtN(r.n)}</b></li>`).join('') : `<li class="note">${t(empty)}</li>`;
  const dev = d.devices || {};
  body.innerHTML = `
    <div class="seg admin-days">${ADMIN_DAYS.map(n => `<button data-days="${n}" aria-selected="${n === ADMIN.days}">${t('{n} gün', { n })}</button>`).join('')}<button data-days="0">${t('Yenile')}</button></div>
    <section>
      <h3>${t('Ziyaret')} <small>${t('kendi sayaç · {d} sonrası', { d: esc(String(d.since).slice(0, 10)) })}</small></h3>
      <div class="stats">
        ${tile(t('Şu an'), fmtN(d.online), t('son 90 sn'))}
        ${tile(t('Ziyaretçi'), fmtN(d.visitors))}
        ${tile(t('Ziyaret'), fmtN(d.visits))}
        ${tile(t('Ort. kalma'), fmtSecs(d.avg_secs), t('ortanca {s}', { s: fmtSecs(d.median_secs) }))}
        ${tile(t('Geri dönen'), fmtN(d.returning), t('{n} ziyaretçiden', { n: fmtN(d.kept_visitors) }))}
        ${tile(t('Girişli ziyaret'), '%' + fmtN(d.logged_in_share))}
      </div>
      <div class="bars" aria-label="${t('Günlük ziyaret')}">${bars}</div>
      <p class="note">${t('Telefon {m} · bilgisayar {d}. Tarayıcı verisini silen yeni ziyaretçi sayılır.', { m: fmtN(dev.mobile), d: fmtN(dev.desktop) })}</p>
    </section>
    <section>
      <h3>${t('Hesaplar')}</h3>
      <div class="stats">
        ${tile(t('Hesap'), fmtN(d.users), t('{n} yeni', { n: fmtN(d.users_new) }))}
        ${tile(t('Aktif hesap'), fmtN(d.users_active), t('listesi değişen'))}
        ${tile(t('Liste öğesi'), fmtN(d.items))}
      </div>
    </section>
    <section class="admin-lists">
      <div><h3>${t('Nereden')}</h3><ul>${rows(d.referrers, 'Veri yok')}</ul></div>
      <div><h3>${t('Dil')}</h3><ul>${rows(d.langs, 'Veri yok')}</ul></div>
    </section>
    <section>
      <h3>${t('Diğer paneller')}</h3>
      <div class="row-btns">
        <a class="btn" href="https://cloud.umami.is" target="_blank" rel="noopener">Umami</a>
        <a class="btn" href="https://dash.cloudflare.com/?to=/:account/web-analytics" target="_blank" rel="noopener">Cloudflare Analytics</a>
      </div>
      ${UMAMI_ID ? '' : `<p class="note">${t('Umami henüz bağlı değil: js/istatistik.js içindeki UMAMI_ID boş.')}</p>`}
    </section>`;
}
function initAdmin() {
  $('#btnAdmin').onclick = openAdmin;
  $('#adminBody').addEventListener('click', e => {
    const b = e.target.closest('[data-days]');
    if (!b) return;
    if (+b.dataset.days) ADMIN.days = +b.dataset.days;
    loadAdmin();
  });
}
