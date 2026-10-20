'use strict';
/* ================= Ziyaret istatistiği ================= */
// İki yol birden:
// 1) Kendi sayaç (Supabase visits): açılışta visit_start, sekme görünürken 30 sn'de bir visit_ping → ziyaret + kalma süresi.
//    Çerez yok. İkisi de yalnız "İstatistik" rızasıyla çalışır (js/riza.js; KVKK/GDPR, Doğukan 2026-10-19).
//    Ziyaretçi kimliği rastgele; rıza (istatistik ya da etkinlik) varsa cihazda kalıcı (kd_visitor → geri dönen ziyaretçi),
//    yoksa yalnız bu sayfa açıkken bellekte (yalnız kimliksiz hata raporunda kullanılır).
// 2) Umami Cloud: rızayla ve UMAMI_ID doluysa yüklenir (Umami çerezsizdir).
// 3) Rızasız sayfa yüklemeleri: yalnız kimliksiz tek satırlık toplam sayaça bir kez artar (riza.js › anonBump);
//    başka hiçbir veri gönderilmez, cihaza hiçbir şey yazılmaz (kişisel veri yok → rıza gerektirmez).
// Dosyadan açıkken (file://) hiçbiri çalışmaz.
const UMAMI_ID = '08f74919-6681-4aa7-a12c-4a37ecfa130c'; // cloud.umami.is › Websites › Kaydır → "Website ID" (gizli değil)
const VISITOR_KEY = 'kd_visitor';
const PING_EVERY = 30000;
const NEW_VISIT_AFTER = 30 * 60000; // sekme 30 dk'dan uzun gizli kaldıysa dönüş yeni ziyaret sayılır
const V = { id:null, token:null, timer:null, hiddenAt:0 };
const uuid = () => crypto.randomUUID ? crypto.randomUUID() : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));

let pageVisitor = null; // rızasız: cihaza yazılmayan, sayfa kapanınca kaybolan kimlik
function visitorId() {
  if (!allowed('stats') && !allowed('activity')) return { id:pageVisitor ||= uuid(), kept:false };
  let id = store.get(VISITOR_KEY, '');
  if (!id) { id = uuid(); store.set(VISITOR_KEY, id); }
  return { id, kept:!!store.get(VISITOR_KEY, '') };
}
function stopVisit() { clearInterval(V.timer); V.id = V.token = null; }
async function startVisit() {
  if (!sb || !location.protocol.startsWith('http') || !allowed('stats')) return;
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
  if (!UMAMI_ID || !location.protocol.startsWith('http') || !allowed('stats') || $('script[data-website-id]')) return;
  const s = document.createElement('script');
  s.src = 'https://cloud.umami.is/script.js'; s.defer = true; s.dataset.websiteId = UMAMI_ID;
  s.dataset.domains = 'kaydir.dogukanparlak.com'; // yerel deneme (localhost) Umami'ye sayılmasın
  document.head.appendChild(s);
}

function initStats() {
  // Rızasızsa yalnız kimliksiz toplam sayca artar (başka hiçbir veri gitmez); rızalı ziyaret startVisit'te sayılır
  if (!allowed('stats') && !allowed('activity')) anonBump('visit');
  // Hesap oturumu açılışta birkaç yüz ms içinde gelir; logged_in doğru gitsin diye kısa bekle
  setTimeout(startVisit, 1500);
  loadUmami();
  setTimeout(showConsentBar, 2000); // seçim yapılana kadar sayaç, Umami ve etkinlik kaydı kapalı (js/riza.js)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { V.hiddenAt = Date.now(); pingVisit(true); return; }
    if (V.hiddenAt && Date.now() - V.hiddenAt > NEW_VISIT_AFTER) startVisit(); else pingVisit();
  });
}
