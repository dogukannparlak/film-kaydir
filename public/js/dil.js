'use strict';
/* ================= Dil (i18n) ================= */
// Kaynak dil Türkçe: metinler kodda Türkçe yazılır, t('…') İngilizce seçiliyse sözlükten (EN, js/dil/en-*.js) çevirir.
// Sözlük anahtarı Türkçe metnin kendisidir (değerde "tekil|çoğul" olabilir, bkz. t); karşılığı yoksa Türkçe kalır. {ad} yer tutucuları t('…', { ad }) ile dolar.
// html/ parçalarındaki sabit metinler init() başında translateDom() ile çevrilir: metin düğümleri (boşlukları tek
// boşluğa indirip kırpılmış hâliyle aranır) ve placeholder / aria-label / title öznitelikleri.
// En başta yüklenir (sabitler.js'teki etiketler yüklenirken t() çağırır). Dil değişince sayfa yeniden yüklenir.
const LANGS = { tr:'Türkçe', en:'English' };
const LANG = (() => {
  try { const v = JSON.parse(localStorage.getItem('kd_lang')); if (LANGS[v]) return v; } catch {}
  return /^tr\b/i.test(navigator.language || '') ? 'tr' : 'en';
})();
const LOCALE = LANG === 'tr' ? 'tr-TR' : 'en-US'; // sayı/saat biçimi ve TMDB "language" parametresi
const EN = {};
const normText = s => s.replace(/\s+/g, ' ').trim();
function t(s, vars) {
  let r = LANG === 'en' && EN[s] != null ? EN[s] : s;
  // Tekil/çoğul: sözlük değeri "tekil|çoğul" ise {n}'e göre seçilir ("{n} film|{n} films")
  if (r.includes('|') && vars && 'n' in vars) { const [one, many] = r.split('|'); r = +vars.n === 1 ? one : many; }
  if (vars) r = r.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m);
  return r;
}
function translateDom(root = document.body) {
  if (LANG === 'tr') return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) {
    const s = normText(n.nodeValue);
    if (s && EN[s] != null) n.nodeValue = n.nodeValue.match(/^\s*/)[0] + EN[s] + n.nodeValue.match(/\s*$/)[0];
  }
  root.querySelectorAll('[placeholder],[aria-label],[title]').forEach(el => {
    for (const a of ['placeholder', 'aria-label', 'title']) { const v = el.getAttribute(a); if (v && EN[normText(v)] != null) el.setAttribute(a, EN[normText(v)]); }
  });
}
document.documentElement.lang = LANG;
function setLang(l) {
  if (!LANGS[l] || l === LANG) return;
  try { localStorage.setItem('kd_lang', JSON.stringify(l)); } catch {}
  location.reload();
}
