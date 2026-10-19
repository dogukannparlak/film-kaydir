'use strict';
/* ================= Etkinlik günlüğü ================= */
// Doğukan'ın kararı (2026-10-19): kullanıcının sitede yaptığı her şey kaydedilir, girişsiz ziyaretçi de (anonim
// kd_visitor kimliğiyle, e-postasız). Olaylar bellekte toplanır, 5 sn'de bir ya da sekme gizlenince toplu gider
// (Supabase log_events; hesap kimliği sunucuda auth.uid()'den eklenir). Yönetim sayfasında Etkinlik / Hatalar sekmeleri.
// Asla kaydedilmez: şifre, e-posta kutusu, API anahtarı içerikleri (yalnız düğme metni ve olay verisi gider).
// Yükleme sırası: bütün modüllerden sonra, baslat.js'ten önce (sarılan işlevler init() olayları bağlamadan değişsin).
const LOG = { buf:[], timer:null, last:'' };
const LOG_FLUSH = 5000, LOG_MAX = 50;
const clip = (s, n = 80) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const itemInfo = k => { const it = k && (S.items[k] || S.queue.find(q => q.key === k)); return it ? { key:k, title:clip(it.title, 60) } : (k ? { key:k } : {}); };

function logEv(kind, data) {
  if (!location.protocol.startsWith('http')) return;
  LOG.buf.push({ kind, data:data || null, at:new Date().toISOString() });
  if (LOG.buf.length >= LOG_MAX) flushLog();
  else if (!LOG.timer) LOG.timer = setTimeout(flushLog, LOG_FLUSH);
}
function flushLog() {
  clearTimeout(LOG.timer); LOG.timer = null;
  if (!LOG.buf.length || !sb) return;
  const batch = LOG.buf.splice(0, LOG_MAX);
  sb.rpc('log_events', { p_visitor:visitorId().id, p_events:batch, p_path:location.pathname }).then(() => {}, () => {});
  if (LOG.buf.length) LOG.timer = setTimeout(flushLog, LOG_FLUSH);
}

// Var olan işlevi sarar: önce asıl işlev, sonra kayıt (kayıt hatası işlevi bozmaz)
function wrapLog(name, fn) {
  const orig = window[name];
  if (typeof orig !== 'function') return;
  window[name] = function (...a) {
    let before; try { before = fn.before?.(...a); } catch {}
    const r = orig.apply(this, a);
    try { fn.after?.(a, before, r); } catch {}
    return r;
  };
}
wrapLog('act', { before:(dir, from) => { const it = S.queue[0]; return it && { dir, how:from ? 'kaydırma' : 'düğme/klavye', key:it.key, title:clip(it.title, 60), type:it.type }; },
  after:(a, b) => b && logEv('swipe', b) });
wrapLog('undo', { before:() => { const u = S.undo.at(-1); return u && { key:u.it.key, title:clip(u.it.title, 60), dir:u.dir }; }, after:(a, b) => b && logEv('undo', b) });
wrapLog('setView', { after:([v]) => logEv('view', { v }) });
wrapLog('openSettings', { after:() => logEv('open', { sheet:'ayarlar' }) });
wrapLog('openFilters', { after:() => logEv('open', { sheet:'filtreler' }) });
wrapLog('openSearch', { after:() => logEv('open', { sheet:'arama' }) });
wrapLog('applyFilters', { after:() => logEv('filters', { ...S.filters }) });
wrapLog('runSearch', { before:() => clip($('#sq')?.value, 100), after:(a, q) => { if (q && q !== LOG.last) { LOG.last = q; logEv('search', { q }); } } });
wrapLog('openTrailer', { after:([type, id]) => logEv('trailer', { type, id }) });
wrapLog('openCollection', { after:([id]) => logEv('collection', { id }) });
wrapLog('openEpisodes', { after:([key]) => logEv('open', { sheet:'bölüm', ...itemInfo(key) }) });
wrapLog('setAt', { after:([key, at]) => logEv('episode', { ...itemInfo(key), at }) });
wrapLog('nextEpisode', { after:([key]) => logEv('episode', { ...itemInfo(key), next:true }) });
wrapLog('importLetterboxd', { after:([files]) => logEv('import', { from:'letterboxd', files:files?.length }) });
wrapLog('importJSON', { after:() => logEv('import', { from:'json' }) });
wrapLog('exportJSON', { after:() => logEv('export', { items:Object.keys(S.items).length }) });
wrapLog('setLang', { before:l => { if (l === LANG || !LANGS[l]) return null; logEv('lang', { from:LANG, to:l }); flushLog(); } }); // sayfa yenilenmeden gitsin
wrapLog('setKeySync', { after:([on, push]) => { if (push !== false) logEv('keysync', { on }); } });
wrapLog('onSignedIn', { before:user => !S.user || S.user.id !== user?.id, after:([user], fresh) => fresh && logEv('signin', { email:user?.email || null }) });
wrapLog('signOut', { before:() => { logEv('signout', null); flushLog(); } }); // oturum kapanmadan gitsin (hesapla eşleşsin)
wrapLog('openGuide', { after:() => logEv('guide', { open:true }) });
wrapLog('closeGuide', { after:() => logEv('guide', { open:false }) });

// Liste düğmeleri (taşı, sil, yarım işareti …) ve öteki bütün tıklamalar: düğmenin adı + varsa öğe
document.addEventListener('click', e => {
  const el = e.target.closest('button, a, [role="switch"], .chip');
  if (!el || el.closest('.act')) return; // kaydırma düğmeleri "swipe" olarak zaten kaydediliyor
  const d = {};
  for (const [k, v] of Object.entries(el.dataset)) if (k !== 'close') d[k] = clip(v, 40);
  const key = el.closest('[data-key]')?.dataset.key;
  logEv('click', { id:el.id || undefined, text:clip(el.textContent || el.getAttribute('aria-label'), 40) || undefined,
    href:el.tagName === 'A' ? clip(el.getAttribute('href'), 80) : undefined, ...d, ...itemInfo(key) });
}, true);

// Hatalar
window.addEventListener('error', e => logEv('error', { msg:clip(e.message, 200), src:clip(e.filename, 120), line:e.lineno, col:e.colno, stack:clip(e.error?.stack, 600) }));
window.addEventListener('unhandledrejection', e => logEv('error', { msg:clip('Promise: ' + (e.reason?.message || e.reason), 200), stack:clip(e.reason?.stack, 600) }));

// Açılış ve ayrılış
logEv('page', { lang:LANG, ref:clip(document.referrer, 120) || undefined, w:innerWidth, h:innerHeight,
  app:matchMedia('(display-mode: standalone)').matches || undefined, items:Object.keys(S.items).length });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushLog(); });
window.addEventListener('pagehide', flushLog);
