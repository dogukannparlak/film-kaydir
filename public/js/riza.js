'use strict';
/* ================= Rıza ve veri hakları (KVKK / GDPR) ================= */
// Zorunlu olmayan iki işleme, seçim yapılana kadar KAPALI (önceden rıza):
//   stats    — ziyaret sayacı (kalıcı anonim kimlik, js/istatistik.js) + Umami
//   activity — site içi etkinlik kaydı (js/kayit.js)
// Rıza olmadan yalnız kimliksiz hata raporu gider (meşru menfaat: sitenin çalışması). Kabul ve Reddet eşit ağırlıkta;
// tercih Ayarlar › Gizlilik ve verilerin'den her an değişir. Haklar: verilerimi indir (my_data), bu cihazın kayıtlarını
// sil (forget_visitor), hesabımı sil (delete_my_account). Metin: gizlilik.html / privacy.html.
const CONSENT_KEY = 'kd_consent'; // { v:1, stats, activity, at }
const consentGet = () => { const c = store.get(CONSENT_KEY, null); return c && c.v === 1 ? c : null; };
const allowed = cat => !!consentGet()?.[cat];
const privacyHref = () => LANG === 'en' ? 'privacy.html' : 'gizlilik.html';

function setConsent(stats, activity) {
  const before = consentGet();
  store.set(CONSENT_KEY, { v:1, stats:!!stats, activity:!!activity, at:new Date().toISOString() });
  if (!stats && !activity) store.del(VISITOR_KEY); // kalıcı kimlik yalnız rızayla durur
  if (stats && !before?.stats) { startVisit(); loadUmami(); }
  if (!stats && before?.stats) stopVisit();
  if (activity) logEv('consent', { stats:!!stats, activity:true });
  else LOG.buf = LOG.buf.filter(e => e.kind === 'error');
  $('#consentBar')?.remove();
  renderPrivacy();
}

/* ---- Açılış bandı ---- */
function showConsentBar() {
  if (consentGet() || !location.protocol.startsWith('http') || $('#consentBar')) return;
  if (!$('#guide')?.classList.contains('hidden')) { setTimeout(showConsentBar, 3000); return; } // rehber açıkken bekle
  document.body.insertAdjacentHTML('beforeend', `
    <div class="consent" id="consentBar" role="dialog" aria-label="${t('Gizlilik tercihleri')}">
      <p>${t('Kaydır\'ı geliştirmek için anonim ziyaret istatistiği ve site içi etkinlik kaydı tutmak istiyoruz. İzin vermezsen site aynı şekilde çalışır; tercihini Ayarlar\'dan her zaman değiştirebilirsin.')} <a href="${privacyHref()}" target="_blank">${t('Aydınlatma metni')}</a></p>
      <div class="consent-pick hidden" id="consentPick">
        <label><input type="checkbox" id="cbStats"> <span><b>${t('İstatistik')}</b> · ${t('ziyaret sayısı ve kalma süresi (Umami dahil)')}</span></label>
        <label><input type="checkbox" id="cbActivity"> <span><b>${t('Etkinlik kaydı')}</b> · ${t('sitede yaptıkların, hata ayıklama ve iyileştirme için')}</span></label>
      </div>
      <div class="row-btns">
        <button class="btn" data-consent="all">${t('Kabul et')}</button>
        <button class="btn" data-consent="none">${t('Reddet')}</button>
        <button class="btn" data-consent="pick" id="consentPickBtn">${t('Seç')}</button>
      </div>
    </div>`);
  $('#consentBar').addEventListener('click', e => {
    const b = e.target.closest('[data-consent]');
    if (!b) return;
    const c = b.dataset.consent;
    if (c === 'all') setConsent(true, true);
    else if (c === 'none') setConsent(false, false);
    else if ($('#consentPick').classList.contains('hidden')) { $('#consentPick').classList.remove('hidden'); b.textContent = t('Seçilenleri kaydet'); }
    else setConsent($('#cbStats').checked, $('#cbActivity').checked);
  });
}

/* ---- Ayarlar › Gizlilik ve verilerin ---- */
function renderPrivacy() {
  const c = consentGet();
  $('#cStats')?.setAttribute('aria-checked', !!c?.stats);
  $('#cActivity')?.setAttribute('aria-checked', !!c?.activity);
  $$('.acc-only').forEach(el => el.classList.toggle('hidden', !S.user));
  const n = $('#consentAt');
  if (n) n.textContent = c ? t('Son tercih: {d}', { d:new Date(c.at).toLocaleString(LOCALE) }) : t('Henüz tercih yapılmadı (ikisi de kapalı).');
}
let delAccArmed = false;
async function onPrivacyClick(e) {
  const id = e.target.closest('button')?.id;
  const c = consentGet() || { stats:false, activity:false };
  if (id === 'cStats') setConsent(!c.stats, c.activity);
  else if (id === 'cActivity') setConsent(c.stats, !c.activity);
  else if (id === 'btnForget') {
    const v = store.get(VISITOR_KEY, '');
    if (v && sb) { const { error } = await sb.rpc('forget_visitor', { p_visitor:v }); if (error) return toast(t('Silinemedi: {m}', { m:error.message })); }
    store.del(VISITOR_KEY); LOG.buf = [];
    toast(t('Bu cihazın ziyaret ve etkinlik kayıtları silindi'));
  } else if (id === 'btnMyData') {
    const { data, error } = await sb.rpc('my_data');
    if (error) return toast(t('Alınamadı: {m}', { m:error.message }));
    data.this_device = { lists:Object.values(S.items), seen:[...S.seen], filters:S.filters, consent:consentGet(), visitor:store.get(VISITOR_KEY, null) };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type:'application/json' }));
    a.download = `kaydir-verilerim-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  } else if (id === 'btnDelAcc') {
    const b = $('#btnDelAcc');
    if (!delAccArmed) { delAccArmed = true; b.textContent = t('Emin misin? Geri alınamaz, tekrar bas'); setTimeout(() => { delAccArmed = false; b.textContent = t('Hesabımı ve verilerimi sil'); }, 5000); return; }
    delAccArmed = false; b.disabled = true;
    const { error } = await sb.rpc('delete_my_account');
    b.disabled = false; b.textContent = t('Hesabımı ve verilerimi sil');
    if (error) return toast(t('Silinemedi: {m}', { m:error.message }));
    await sb.auth.signOut();
    store.del(VISITOR_KEY); store.del('kd_sync'); setVault(null);
    toast(t('Hesabın ve sunucudaki bütün verilerin silindi. Bu cihazdaki listeler duruyor; istersen Görülenler/Yedek bölümünden temizleyebilirsin.'), null, null, 7000);
  }
}
function initPrivacy() {
  $('#privSec').addEventListener('click', onPrivacyClick);
  $$('#privSec a[data-privacy]').forEach(a => a.href = privacyHref());
  renderPrivacy();
}
