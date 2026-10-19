'use strict';
/* ================= Ziyaret istatistiği ================= */
// İki yol birden:
// 1) Kendi sayaç (Supabase visits): açılışta visit_start, sekme görünürken 30 sn'de bir visit_ping → ziyaret + kalma süresi.
//    Çerez yok. Ziyaretçi kimliği rastgele: rıza verildiyse cihazda kalıcı (kd_visitor → geri dönen ziyaretçi sayılır),
//    verilmediyse yalnız bu sekmede (sessionStorage) — o zaman her açılış yeni ziyaretçidir.
// 2) Umami Cloud: UMAMI_ID doluysa betiği yüklenir (Umami çerezsizdir). Boşsa hiç yüklenmez.
// Dosyadan açıkken (file://) ikisi de çalışmaz.
const UMAMI_ID = ''; // cloud.umami.is › Websites › Add website → "Website ID"
const CONSENT_KEY = 'kd_consent'; // 'yes' | 'no'
const VISITOR_KEY = 'kd_visitor';
const PING_EVERY = 30000;
const NEW_VISIT_AFTER = 30 * 60000; // sekme 30 dk'dan uzun gizli kaldıysa dönüş yeni ziyaret sayılır
const V = { id:null, token:null, timer:null, hiddenAt:0 };
const uuid = () => crypto.randomUUID ? crypto.randomUUID() : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));

function visitorId() {
  if (store.get(CONSENT_KEY, '') === 'yes') {
    let id = store.get(VISITOR_KEY, '');
    if (!id) { id = uuid(); store.set(VISITOR_KEY, id); }
    return { id, kept:true };
  }
  let id = '';
  try { id = sessionStorage.getItem(VISITOR_KEY) || ''; if (!id) { id = uuid(); sessionStorage.setItem(VISITOR_KEY, id); } } catch { id = id || uuid(); }
  return { id, kept:false };
}
async function startVisit() {
  if (!sb || !location.protocol.startsWith('http')) return;
  const who = visitorId();
  let ref = '';
  try { const r = document.referrer && new URL(document.referrer); if (r && r.host !== location.host) ref = r.host; } catch {}
  const { data, error } = await sb.rpc('visit_start', {
    p_visitor:who.id, p_path:location.pathname, p_referrer:ref,
    p_device:matchMedia('(pointer:coarse)').matches ? 'mobile' : 'desktop',
    p_lang:(navigator.language || '').slice(0, 12), p_logged_in:!!S.user, p_kept:who.kept,
  });
  if (error || !data?.[0]) return;
  V.id = data[0].id; V.token = data[0].token;
  clearInterval(V.timer);
  V.timer = setInterval(pingVisit, PING_EVERY);
}
function pingVisit(force = false) {
  if (!V.id || (!force && document.visibilityState !== 'visible')) return;
  sb.rpc('visit_ping', { p_id:V.id, p_token:V.token }).then(() => {}, () => {});
}
function loadUmami() {
  if (!UMAMI_ID || !location.protocol.startsWith('http')) return;
  const s = document.createElement('script');
  s.src = 'https://cloud.umami.is/script.js'; s.defer = true; s.dataset.websiteId = UMAMI_ID;
  document.head.appendChild(s);
}

/* ---- Rıza bandı ve Ayarlar › Gizlilik ---- */
function setConsent(yes) {
  store.set(CONSENT_KEY, yes ? 'yes' : 'no');
  if (!yes) store.del(VISITOR_KEY);
  $('#consentBar')?.remove();
  renderConsent();
}
function showConsentBar() {
  if (store.get(CONSENT_KEY, '') || !location.protocol.startsWith('http') || $('#consentBar')) return;
  if (!$('#guide')?.classList.contains('hidden')) { setTimeout(showConsentBar, 4000); return; } // rehber açıkken bekle
  document.body.insertAdjacentHTML('beforeend', `
    <div class="consent" id="consentBar" role="dialog" aria-label="${t('Ziyaret istatistiği')}">
      <p>${t('Kaydır anonim ziyaret istatistiği tutar (kaç kişi, ne kadar kaldı). Tekrar gelişini de sayabilmemiz için cihazına rastgele bir kimlik yazalım mı? Kişisel bilgi içermez.')} <a href="${LANG === 'en' ? 'privacy.html' : 'gizlilik.html'}" target="_blank">${t('Gizlilik')}</a></p>
      <div class="row-btns"><button class="btn btn-primary" data-consent="yes">${t('Kabul')}</button><button class="btn" data-consent="no">${t('Reddet')}</button></div>
    </div>`);
  $('#consentBar').addEventListener('click', e => { const b = e.target.closest('[data-consent]'); if (b) setConsent(b.dataset.consent === 'yes'); });
}
function renderConsent() {
  const sw = $('#consentSwitch');
  if (sw) sw.setAttribute('aria-checked', store.get(CONSENT_KEY, '') === 'yes');
}

function initStats() {
  renderConsent();
  $('#consentSwitch')?.addEventListener('click', () => setConsent(store.get(CONSENT_KEY, '') !== 'yes'));
  // Hesap oturumu açılışta birkaç yüz ms içinde gelir; logged_in doğru gitsin diye kısa bekle
  setTimeout(startVisit, 1500);
  loadUmami();
  setTimeout(showConsentBar, 2500);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { V.hiddenAt = Date.now(); pingVisit(true); return; }
    if (V.hiddenAt && Date.now() - V.hiddenAt > NEW_VISIT_AFTER) startVisit(); else pingVisit();
  });
}
