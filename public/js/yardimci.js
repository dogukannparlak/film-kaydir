'use strict';
/* ================= Yardımcılar ================= */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const yearOf = d => (d || '').slice(0, 4);
const keySel = k => `.card[data-key="${CSS.escape(k)}"]`;
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
// Misafir modu (Doğukan, 2026-10-19): giriş yapmamış kullanıcının listeleri, görülenleri, filtreleri ve anahtarları
// sessionStorage'da durur: sekme kapanınca silinir (yenilemede kalır), kalıcı olsun isteyen kayıt olur. Girişliyken
// localStorage. Cihazın kendi ayarları (dil, rıza, rehber, anonim kimlik, önbellekler) her zaman localStorage.
// Mod açılışta Supabase oturum anahtarının varlığından anlaşılır; giriş/çıkışta setAccountMode ile değişir.
const GUEST_KEYS = new Set([K.items, K.seen, K.filters, K.listF, K.dirty, K.key, K.omdb, K.omdbCache]);
let accountMode = (() => { try { return Object.keys(localStorage).some(k => /^sb-.+-(auth-token|session)$/.test(k)); } catch { return false; } })();
const area = k => !accountMode && GUEST_KEYS.has(k) ? sessionStorage : localStorage;
const store = {
  get(k, d) { try { const v = area(k).getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { area(k).setItem(k, JSON.stringify(v)); } catch { toast(t('Kaydedilemedi: tarayıcı depolaması dolu ya da kapalı.')); } },
  del(k) { try { area(k).removeItem(k); } catch {} },
};
// Eski sürümde misafir verisi localStorage'daydı: bu sekmeye (sessionStorage) taşı. guestMoved: bilgilendirme için.
let guestMoved = false;
function moveToSession() {
  try {
    for (const k of GUEST_KEYS) { const v = localStorage.getItem(k); if (v != null) { if (sessionStorage.getItem(k) == null) sessionStorage.setItem(k, v); localStorage.removeItem(k); guestMoved ||= k === K.items && v !== '{}'; } }
  } catch {}
}
if (!accountMode) moveToSession();
document.body.classList.toggle('guest', !accountMode);
// Giriş: bellekteki durum kalıcı depoya yazılır, sekmelik kopya silinir. Çıkış: yalnız mod değişir (veri zaten silinir).
function setAccountMode(on, values) {
  if (on === accountMode) return;
  accountMode = on;
  document.body.classList.toggle('guest', !on);
  if (!on) { moveToSession(); return; } // oturum kendiliğinden düştüyse (süresi bitti) cihazdaki kopya bu sekmeye geçer
  if (!values) return;
  for (const [k, v] of Object.entries(values)) store.set(k, v);
  try { GUEST_KEYS.forEach(k => sessionStorage.removeItem(k)); } catch {}
}
function toast(msg, action, fn, ms = 2800) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `<span>${esc(msg)}</span>`;
  if (action) {
    const b = document.createElement('button');
    b.textContent = action;
    b.onclick = () => { fn(); t.remove(); };
    t.appendChild(b);
  }
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), ms);
}
const vibrate = () => { try { navigator.vibrate && navigator.vibrate(8); } catch {} };
// Ana başlık orijinal ad, altında Türkçe ad. Orijinal ad Latin alfabesinde değilse (기생충, 千と千尋…)
// okunabilir olsun diye Türkçe ad üstte, orijinal altta kalır. İkisi aynıysa alt satır yok.
const LATIN = /^[\p{Script=Latin}\p{N}\p{P}\p{S}\p{Zs}]+$/u;
const sameTitle = (a, b) => a.toLocaleLowerCase('tr').replace(/[^\p{L}\p{N}]+/gu, '') === b.toLocaleLowerCase('tr').replace(/[^\p{L}\p{N}]+/gu, '');
function titles(it) {
  const t = it.title || '—', o = it.originalTitle || '';
  if (!o || sameTitle(o, t)) return { main: t, sub: '' };
  return LATIN.test(o) ? { main: o, sub: t } : { main: t, sub: o };
}
// Arama karşılaştırması: Türkçe küçük harf + aksan/nokta temizliği + ı→i (Inception ↔ inception, Işık ↔ isik)
const fold = s => String(s || '').toLocaleLowerCase('tr').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i');
// Simge: html/simgeler.js'teki setten (ör. ico('want'))
const ico = (n, cls = '') => `<svg class="i ${cls}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
