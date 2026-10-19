'use strict';
/* ================= Hesap ve eşitleme (Supabase) ================= */
// Önce yerel: site hesapsız da çalışır, veri localStorage'da. Giriş yapınca:
// - Değişen/silinen öğeler 1,5 sn sonra buluta yazılır (items: key → data, silinen deleted=true).
// - Buluttan yalnız son eşitlemeden sonra değişenler çekilir (updated_at > since); açılışta, sekmeye dönünce, bağlantı gelince ve 30 sn'de bir.
// - Sekme gizlenince bekleyen değişiklik hemen gönderilir; gönderilmemiş durum (anahtar, filtre, görülen) yenilemede kaybolmaz (kd_dirty).
// - Bu cihazda bu hesapla ilk girişte yerel ve bulut birleştirilir: aynı öğede addedAt'i yeni olan kazanır.
// - Görülenler birleşim (union); filtreler kullanıcı durumunda (user_state).
// - API anahtarları yalnız Ayarlar'daki düğme açıksa ve şifreli gider (user_state.keys_enc, js/kasa.js); düz metin sütunlar (tmdb_key, omdb_key) hep boşaltılır.
// Güvenlik: anahtar herkese açık "publishable" anahtardır; her satır RLS ile yalnız sahibine açık.
const SB_URL = 'https://zungbtgtlrltowkvjqso.supabase.co';
const SB_KEY = 'sb_publishable_Bgg9ZLBOaQe4nn904kRYTQ_mcy-SMYS';
const GOOGLE_AUTH = false; // Google ile giriş kapalı; açmak için true yap (Supabase'de Google sağlayıcısı da açık olmalı)
const sb = window.supabase?.createClient(SB_URL, SB_KEY, { auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true, flowType:'pkce' } }) || null;
const SYNC_KEY = 'kd_sync'; // { user, since, hashes: { key: imza } } — son eşitlenen hâl
let sync = store.get(SYNC_KEY, null);
let syncTimer = null, syncing = false, pullTimer = null;
let pendingPass = null; // giriş formunda yazılan şifre: kasa anahtarı türetilene kadar yalnız bellekte
const SYNC_EVERY = 30000; // düzenli eşitleme: sekme açıkken 30 sn'de bir çek + gönder
const sig = o => o ? JSON.stringify(o) : '';

function syncSoon() {
  if (!S.user) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(pushChanges, 1500);
}
// Yereldeki farkları gönder
async function pushChanges() {
  if (!S.user || syncing) { if (S.user) syncSoon(); return; }
  syncing = true;
  try {
    const h = sync.hashes, rows = [];
    for (const [k, v] of Object.entries(S.items)) if (h[k] !== sig(v)) rows.push({ key:k, data:v, deleted:false });
    for (const k of Object.keys(h)) if (!S.items[k] && h[k] !== '') rows.push({ key:k, data:{}, deleted:true });
    for (let i = 0; i < rows.length; i += 500) {
      const part = rows.slice(i, i + 500);
      const { error } = await sb.from('items').upsert(part.map(r => ({ ...r, user_id:S.user.id })), { onConflict:'user_id,key' });
      if (error) throw error;
      part.forEach(r => { h[r.key] = r.deleted ? '' : sig(r.data); });
    }
    if (S.seenDirty || S.stateDirty) await pushState();
    saveSync(); setSyncStatus();
  } catch (e) { setSyncStatus(t('Eşitlenemedi: {m}', { m: e.message || e })); }
  finally { syncing = false; }
}
async function pushState() {
  const row = { user_id:S.user.id, seen:[...S.seen], filters:S.filters, list_filters:S.listF, tmdb_key:null, omdb_key:null };
  // keys_enc yalnız bu cihazda anahtar ya da düğme değiştiyse yazılır (sync.keysSig = son eşitlenen hâl);
  // sıradan görülen/filtre gönderimi başka cihazın kopyasını ezmesin. Açık ama kasa yoksa/kilitliyse dokunulmaz.
  const want = keysSig();
  if (want !== sync.keysSig) {
    if (!S.keySync) row.keys_enc = null;
    else if (!S.keysLocked && vaultFor(S.user.id)) row.keys_enc = await sealKeys(vault, { tmdb:S.apiKey || '', omdb:S.omdbKey || '' });
  }
  const { error } = await sb.from('user_state').upsert(row, { onConflict:'user_id' });
  if (error) throw error;
  if ('keys_enc' in row) { sync.keysSig = want; saveSync(); }
  S.seenDirty = S.stateDirty = false; saveDirty();
}
// Buluttaki değişiklikleri çek ve uygula
async function pullChanges(first = false) {
  if (!S.user) return;
  let changed = 0, since = first ? null : sync.since;
  for (;;) {
    let q = sb.from('items').select('key,data,deleted,updated_at').order('updated_at', { ascending:true }).limit(1000);
    if (since) q = q.gt('updated_at', since);
    const { data, error } = await q;
    if (error) throw error;
    for (const r of data) {
      const local = S.items[r.key], pending = local && sync.hashes[r.key] !== sig(local);
      if (first && local && !r.deleted && (local.addedAt || 0) > (r.data.addedAt || 0)) continue; // ilk birleştirme: yereldeki daha yeni → gönderilecek
      if (!first && pending) continue; // gönderilmemiş yerel değişiklik kazanır
      if (r.deleted) { if (local && !first) { delete S.items[r.key]; changed++; } sync.hashes[r.key] = ''; }
      else { S.items[r.key] = r.data; sync.hashes[r.key] = sig(r.data); changed++; S.seen.add(r.key); }
    }
    if (data.length) since = data.at(-1).updated_at;
    if (data.length < 1000) break;
  }
  sync.since = since || sync.since;
  // Kullanıcı durumu: görülenler birleşir; filtreler ilk girişte buluttan gelir
  const { data: st } = await sb.from('user_state').select('*').maybeSingle();
  if (st) {
    const before = S.seen.size;
    (st.seen || []).forEach(k => S.seen.add(k));
    if (S.seen.size !== before) { store.set(K.seen, [...S.seen]); S.queue = S.queue.filter(it => !S.seen.has(it.key)); }
    if (S.seen.size > (st.seen || []).length) S.seenDirty = true;
    const keys = await applyCloudKeys(st);
    if (first) {
      if (st.filters) { S.filters = { ...DEFAULT_FILTERS, ...migrateFilters(st.filters) }; store.set(K.filters, S.filters); updateSummary(); }
      if (st.filters || keys) { resetEngine(); loadProviders(); }
    }
  } else { S.stateDirty = true; if (pendingPass) await applyCloudKeys({}); }
  if (changed || first) {
    store.set(K.items, S.items);
    updateCounts(); if (S.view === 'lists') renderList();
  }
  saveSync();
  return changed;
}
function saveSync() { store.set(SYNC_KEY, sync); }

/* ---- API anahtarları: hesapta şifreli kopya ---- */
// sync.keysSig: bu cihazla bulut arasında son eşitlenen [düğme, tmdb, omdb]. Yereldeki hâl ondan farklıysa bekleyen yerel
// değişiklik var demektir: buluttaki düğme/anahtar uygulanmaz, gönderilir. null: bu hesapla bu cihazda ilk kez (ya da çıkış sonrası).
const keysSig = (on = S.keySync, t = S.apiKey || '', o = S.omdbKey || '') => JSON.stringify([!!on, t, o]);
// Buluttaki durumu uygular; kaç anahtar geldiğini döner. Yeni yazılmış şifre varsa önce kasa anahtarı türetilir.
async function applyCloudKeys(st) {
  const box = st.keys_enc || null, uid = S.user.id;
  const first = sync.keysSig == null, adopt = first || sync.keysSig === keysSig();
  let keys = 0, fresh = false;
  if (pendingPass) {
    const pass = pendingPass; pendingPass = null;
    let v = await deriveVault(uid, pass, box?.salt);
    if (box && !(await openKeys(v, box))) {
      // Şifre başka yerde değişmiş: eski kopya bu şifreyle açılmaz. Yeni kasa kurulur, kopya bu cihazdakilerle yeniden yazılır.
      v = await deriveVault(uid, pass); fresh = true;
      toast(S.apiKey || S.omdbKey ? t('Hesaptaki eski anahtar kopyası açılamadı (şifre değişmiş); bu cihazdakiler yeniden şifrelendi')
        : t('Hesaptaki anahtarlar açılamadı (şifre değişmiş): anahtarları Ayarlar\'dan yeniden gir'), null, null, 5000);
    }
    setVault(v);
  }
  if (st.tmdb_key || st.omdb_key) {
    // Eski sürüm anahtarları düz metin saklıyordu: bu cihaza al (pushState düz metni hep boşaltır); kasa varsa şifreli saklamayı aç
    if (st.tmdb_key && !S.apiKey) { S.apiKey = st.tmdb_key; store.set(K.key, st.tmdb_key); keys++; }
    if (st.omdb_key && !S.omdbKey) { S.omdbKey = st.omdb_key; store.set(K.omdb, st.omdb_key); keys++; }
    if (vaultFor(uid)) setKeySync(true, false);
    sync.keysSig = '';
  } else if (fresh) {
    setKeySync(true, false); S.keysLocked = false; sync.keysSig = '';
  } else {
    const v = box && vaultFor(uid, box.salt), got = v ? await openKeys(v, box) : null;
    if (adopt) setKeySync(!!box, false);
    S.keysLocked = !!(S.keySync && box && !got);
    if (got) {
      // Bekleyen yerel değişiklik yoksa buluttaki kazanır; ilk girişte ya da bekleyen değişiklik varsa yalnız boş olanı doldurur
      const take = (cloud, local) => cloud && cloud !== local && (!local || (adopt && !first));
      if (take(got.tmdb, S.apiKey)) { S.apiKey = got.tmdb; S.keyMsg = ''; store.set(K.key, got.tmdb); keys++; if (!first) { resetEngine(); loadProviders(); } }
      if (take(got.omdb, S.omdbKey)) { S.omdbKey = got.omdb; store.set(K.omdb, got.omdb); keys++; }
    }
    if (adopt) sync.keysSig = got ? keysSig(true, got.tmdb || '', got.omdb || '') : keysSig(); // yereldeki fazlası sonra gönderilir
  }
  saveSync();
  if (sync.keysSig !== keysSig()) { S.stateDirty = true; saveDirty(); }
  if (keys) toast(t('API anahtarların hesabından geldi'));
  renderKeySync();
  return keys;
}
function setKeySync(on, push = true) {
  S.keySync = on; store.set(K.keySync, on);
  if (push) { S.stateDirty = true; saveDirty(); syncSoon(); }
}
// Ayarlar › API anahtarlarını hesabımda sakla
function renderKeySync() {
  const sec = $('#keySyncSec'), box = $('#keySyncBox');
  if (!sec) return;
  sec.classList.toggle('hidden', !S.user);
  if (!S.user) return;
  $('#keySync').setAttribute('aria-checked', S.keySync);
  const needPass = S.keySync && (S.keysLocked || !vaultFor(S.user.id));
  box.innerHTML = `
    <p class="note">${S.keySync
      ? t('Açık: TMDB ve OMDb anahtarların hesabında şifreli saklanır, giriş yaptığın her cihaza gelir. Şifreleme anahtarı hesap şifrenden bu tarayıcıda türetilir; şifre ve anahtarların açık hâli sunucuya gitmez. Şifreni sıfırlarsan anahtarları yeniden girmen gerekir.')
      : t('Kapalı: anahtarlar yalnız bu cihazda kalır, hesabına hiç gönderilmez. Her cihazda ayrı girersin.')}</p>
    ${needPass ? `<p class="note" style="color:var(--text)">${S.keysLocked ? t('Hesabındaki anahtarları bu cihazda açmak için hesap şifreni gir:') : t('Şifrelemeyi başlatmak için hesap şifreni gir:')}</p>
    <input class="field" id="kvPass" type="password" autocomplete="current-password" placeholder="${t('Hesap şifren')}" style="margin-top:8px">
    <div class="row-btns"><button class="btn btn-primary" id="kvUnlock">${t('Aç')}</button></div>` : ''}
    <div class="err" id="kvErr"></div>`;
}
async function onKeySyncClick(e) {
  const id = e.target.closest('button')?.id;
  const err = m => { const el = $('#kvErr'); if (el) el.textContent = m; };
  if (id === 'keySync') {
    const on = !S.keySync;
    setKeySync(on);
    if (!on) { S.keysLocked = false; toast(t('API anahtarların artık yalnız bu cihazda; hesaptaki şifreli kopya silinecek')); }
    else if (vaultFor(S.user.id)) toast(t('API anahtarların hesabında şifreli saklanacak'));
    renderKeySync();
    if (on && !vaultFor(S.user.id)) setTimeout(() => $('#kvPass')?.focus(), 50);
  } else if (id === 'kvUnlock') {
    const pass = $('#kvPass').value;
    if (!pass) return err(t('Şifreni yaz.'));
    err(t('Kontrol ediliyor…'));
    // Şifre doğru mu: yanlış şifreyle şifrelenen kopya başka cihazda açılmazdı
    const { error } = await sb.auth.signInWithPassword({ email:S.user.email, password:pass });
    if (error) return err(authMsg(error));
    pendingPass = pass;
    const { data: st, error: e2 } = await sb.from('user_state').select('keys_enc,tmdb_key,omdb_key').maybeSingle();
    if (e2) { pendingPass = null; return err(t('Hesaba ulaşılamadı: {m}', { m: e2.message })); }
    await applyCloudKeys(st || {});
    S.stateDirty = true; saveDirty(); await pushChanges();
    toast(S.keysLocked ? t('Anahtarlar açılamadı') : t('Tamam: anahtarların hesabında şifreli'));
  }
}
async function syncNow(first = false) {
  if (!S.user) return;
  setSyncStatus(t('Eşitleniyor…'));
  try {
    const n = await pullChanges(first);
    await pushChanges();
    if (first && n) toast(t('Hesaptan {n} öğe geldi', { n }));
  } catch (e) { setSyncStatus(t('Eşitlenemedi: {m}', { m: e.message || e })); }
}
function setSyncStatus(msg) {
  S.syncMsg = msg || t('Son eşitleme {time}', { time: new Date().toLocaleTimeString(LOCALE, { hour:'2-digit', minute:'2-digit' }) });
  const el = $('#accSync'); if (el) el.textContent = S.syncMsg;
}
async function onSignedIn(user) {
  const fresh = !S.user || S.user.id !== user.id;
  S.user = user;
  // Kod ekranındayken bağlantıyla onaylandı (başka sekmede de olabilir): bellekteki şifre kasa için kullanılır
  if (acc.mode === 'code') {
    clearInterval(resendTimer);
    // Yalnız kod beklenen hesapsa: başka sekmede başka hesaba girildiyse şifre o hesabın kasasına verilmez
    const same = (user.email || '').toLowerCase() === acc.email.toLowerCase();
    if (same && acc.pass && !pendingPass) pendingPass = acc.pass;
    acc.done = same; acc.mode = 'in'; acc.pass = '';
  }
  // Misafir verisi (sekmelik) artık kalıcı depoya: ilk girişte hesaba da birleştirilir
  if (!accountMode) setAccountMode(true, Object.fromEntries([[K.items, S.items], [K.seen, [...S.seen]], [K.filters, S.filters], [K.listF, S.listF],
    [K.key, S.apiKey], [K.omdb, S.omdbKey], [K.omdbCache, S.omdbCache], [K.dirty, { state:S.stateDirty, seen:S.seenDirty }]].filter(([, v]) => v !== '' && v != null)));
  renderAccount(); renderKeySync(); renderPrivacy();
  if (!fresh) return;
  checkAdmin();
  // Bu cihazda bu hesapla ilk kez mi? (başka hesabın eşitleme izi varsa sıfırla)
  const first = !sync || sync.user !== user.id;
  if (first) sync = { user:user.id, since:null, hashes:{} };
  await syncNow(first);
  clearInterval(pullTimer);
  pullTimer = setInterval(() => document.visibilityState === 'visible' && syncNow(), SYNC_EVERY);
}
// Çıkış (Doğukan, 2026-10-19: "çıkış yapınca cihazdaki veriler silinsin"): önce her şey hesaba yazılır, sonra bu
// cihazdaki hesap verisi silinir: listeler, görülenler, filtreler, eşitleme izi, API anahtarları, kasa, OMDb önbelleği.
// Kalanlar cihazın kendi ayarları: dil, rıza, rehber işareti, anonim kimlik (rızaya bağlı), seri/platform önbelleği.
// Hesaba yazılamadıysa (çevrimdışı) ya da anahtarlar hesapta saklanmıyorsa silmeden önce sorulur: yoksa kaybolurdu.
async function signOut() {
  accErr(t('Çıkış yapılıyor…'));
  await pushChanges();
  let pushed = true;
  try { await pushState(); } catch (e) { pushed = false; }
  pushed = pushed && Object.entries(S.items).every(([k, v]) => sync.hashes[k] === sig(v)); // listelerin hepsi hesapta mı
  const keysInCloud = S.keySync && !S.keysLocked && !!vaultFor(S.user.id) && sync.keysSig === keysSig();
  if (!pushed && !confirm(t('Hesaba yedeklenemedi (çevrimdışı olabilirsin). Çıkarsan hesaba gitmemiş değişiklikler bu cihazdan silinir. Yine de çıkılsın mı?'))) { accErr(''); return; }
  if ((S.apiKey || S.omdbKey) && !keysInCloud && !confirm(t('API anahtarların hesabında saklanmıyor; çıkınca bu cihazdan silinecek. Saklamak için önce Ayarlar\'da "API anahtarlarını hesabımda sakla"yı aç. Yine de çıkılsın mı?'))) { accErr(''); return; }
  await sb.auth.signOut();
  wipeLocalAccountData();
  toast(t('Çıkış yapıldı: bu cihazdaki listelerin ve anahtarların silindi; giriş yapınca geri gelir'), null, null, 4500);
}
function wipeLocalAccountData() {
  setVault(null); setKeySync(false, false); S.keysLocked = false;
  sync = null; store.del(SYNC_KEY);
  S.items = {}; S.seen = new Set(); S.filters = { ...DEFAULT_FILTERS }; S.listF = { type:'all', genre:'', period:'all', q:'', sort:'added', progress:'all' };
  S.apiKey = ''; S.omdbKey = ''; S.omdbCache = {}; S.proxyDown = false; S.stateDirty = S.seenDirty = false; S.undo = [];
  [K.items, K.seen, K.filters, K.listF, K.dirty, K.key, K.omdb, K.omdbCache].forEach(k => store.del(k));
  store.del(VISITOR_KEY); // aynı tarayıcıyı paylaşan hesaplar aynı ziyaretçi kimliğini taşımasın (rıza varsa yenisi üretilir)
  if ($('#setKey')) { $('#setKey').value = ''; $('#setOmdb').value = ''; }
  updateSummary(); updateCounts(); if (S.view === 'lists') renderList();
  resetEngine(); loadProviders();
  setAccountMode(false); // silme kalıcı depoda yapıldı; bundan sonrası misafir (sekmelik)
}
function onSignedOut() {
  if (accountMode) setAccountMode(false);
  S.user = null; clearInterval(pullTimer); clearInterval(resendTimer);
  Object.assign(acc, { mode:'in', pass:'', done:false }); renderAccount(); renderKeySync(); renderPrivacy(); checkAdmin();
}

/* ---- Giriş arayüzü (Ayarlar › Hesap) ---- */
// Misafir formu üç hâlde: 'in' giriş, 'up' kayıt (şifre kuralları + tekrar), 'code' e-posta kodu (kayıttan sonra ya da
// onaylanmamış hesapla girişte). Kayıt bitince oturumlu görünümde "Hesabın hazır" kartı (acc.done) çıkar.
// 'reset': şifre sıfırlama bağlantısıyla gelen oturumda yeni şifre formu (oturumlu görünüm yerine).
// acc.pass: kod ekranındayken kasa anahtarı için şifre yalnız bellekte durur (kod doğrulanınca pendingPass olur).
const acc = { mode:'in', email:'', pass:'', busy:false, resendAt:0, done:false };
let resendTimer = null;
const EMAIL_RE = /^\S+@\S+\.\S+$/;
// Şifre kuralları: Supabase Auth'ta da aynısı açık olmalı (en az 8, "Letters and digits"); sunucu harfi a–z sayar.
// 72: bcrypt sınırı, bayt cinsinden (Türkçe harf 2 bayt).
const PASS_RULES = [
  ['En az 8 karakter', p => p.length >= 8],
  ['Bir harf (a–z)', p => /[A-Za-z]/.test(p)],
  ['Bir rakam', p => /\d/.test(p)],
];
function passProblem(p) {
  if (new TextEncoder().encode(p).length > 72) return t('Şifre çok uzun (en çok 72 bayt).');
  return PASS_RULES.every(([, ok]) => ok(p)) ? '' : t('Şifre kuralları karşılanmadı: en az 8 karakter, bir harf (a–z) ve bir rakam.');
}
const rulesHtml = p => PASS_RULES.map(([s, ok]) => `<li class="${ok(p) ? 'ok' : ''}">${ico(ok(p) ? 'check' : 'close')}${t(s)}</li>`).join('');
const passField = (id, ph, ac) => `<div class="acc-f"><div class="pw-wrap"><input class="field" id="${id}" type="password" placeholder="${ph}" autocomplete="${ac}"><button type="button" class="pw-eye" data-eye="${id}" aria-label="${t('Şifreyi göster')}" aria-pressed="false">${ico('eye')}</button></div><span class="f-err" id="${id}Err"></span></div>`;

function renderAccount() {
  const box = $('#accBox');
  if (!box) return;
  if (!sb) { box.innerHTML = `<p class="note" style="margin:0">${t('Hesap servisine ulaşılamadı (çevrimdışı olabilirsin). Site yerelde çalışmaya devam ediyor.')}</p>`; return; }
  if (S.user && acc.mode === 'reset') return renderNewPass();
  if (S.user && acc.done) {
    box.innerHTML = `<div class="acc-done"><span class="acc-done-ico">${ico('check')}</span><b class="acc-title">${t('Hesabın hazır')}</b>
      <p class="note">${t('E-postan onaylandı. Listelerin bu hesaba yedeklenir; giriş yaptığın her cihazda aynı listeyi görürsün.')}</p>
      <div class="row-btns"><button class="btn btn-primary" id="accDoneOk">${t('Tamam')}</button></div></div>`;
    return;
  }
  if (S.user) {
    box.innerHTML = `
      <p class="acc-who">${ico('cloud')} <b>${esc(S.user.email || t('Hesap'))}</b></p>
      <p class="note" id="accSync" style="margin:4px 0 10px">${esc(S.syncMsg || '')}</p>
      <div class="row-btns"><button class="btn" id="accSyncNow">${t('Şimdi eşitle')}</button><button class="btn btn-danger" id="accOut">${t('Çıkış yap')}</button></div>
      <p class="note">${t('Listelerin, görülenler ve filtreler bu hesapta saklanır; telefon ve bilgisayar aynı listeyi görür. API anahtarları yalnız aşağıdaki düğme açıksa, şifreli saklanır. Çıkış yapınca bu cihazdaki listelerin ve anahtarların silinir, giriş yapınca geri gelir.')} <a href="${LANG === 'en' ? 'privacy.html' : 'gizlilik.html'}" target="_blank">${t('Gizlilik')}</a></p>`;
    return;
  }
  if (acc.mode === 'code') {
    box.innerHTML = `<div class="acc-code">
      <b class="acc-title">${t('E-postana kod gönderdik')}</b>
      <p class="note">${t('{email} adresine gelen 6 haneli kodu yaz. E-postadaki bağlantıya tıklaman da yeter. Gelmediyse istenmeyen klasörüne bak.', { email:`<b>${esc(acc.email)}</b>` })}</p>
      <div class="acc-f"><input class="field acc-code-in" id="accCode" inputmode="numeric" autocomplete="one-time-code" maxlength="10" placeholder="••••••" aria-label="${t('Doğrulama kodu')}"><span class="f-err" id="accCodeErr"></span></div>
      <div class="row-btns"><button class="btn btn-primary" id="accVerify">${t('Doğrula')}</button><button class="btn" id="accResend">${t('Tekrar gönder')}</button></div>
      <button class="linkish" id="accBack">${t('E-postayı değiştir')}</button>
      <div class="err" id="accErr" role="alert" aria-live="polite"></div></div>`;
    resendTick();
    return;
  }
  const up = acc.mode === 'up', local = location.protocol === 'file:';
  box.innerHTML = `
    <p class="note" style="margin:0 0 10px">${t('Hesapsız kullanıyorsun: listelerin yalnız bu sekmede durur, sekmeyi kapatınca silinir. Kayıt olursan kalıcı olur ve cihazlar arasında eşitlenir.')}</p>
    ${local ? `<p class="note" style="margin:0 0 10px">${GOOGLE_AUTH ? t('⚠️ Site dosyadan açık: Google ile giriş ve e-posta bağlantıları yalnız yayındaki adreste çalışır.') : t('⚠️ Site dosyadan açık: e-posta bağlantıları yalnız yayındaki adreste çalışır.')}</p>` : ''}
    ${GOOGLE_AUTH ? `<button class="btn btn-google" id="accGoogle" ${local ? 'disabled' : ''}><span>G</span> ${t('Google ile devam et')}</button>
    <div class="acc-or">${t('ya da e-posta')}</div>` : ''}
    <div class="seg acc-seg" role="tablist"><button role="tab" data-accmode="in" aria-selected="${!up}">${t('Giriş yap')}</button><button role="tab" data-accmode="up" aria-selected="${up}">${t('Kayıt ol')}</button></div>
    <div class="acc-f"><input class="field" id="accEmail" type="email" placeholder="${t('E-posta')}" autocomplete="email" value="${esc(acc.email)}"><span class="f-err" id="accEmailErr"></span></div>
    ${passField('accPass', t('Şifre'), up ? 'new-password' : 'current-password')}
    ${up ? `<ul class="pw-rules" id="accRules" aria-live="polite">${rulesHtml('')}</ul>${passField('accPass2', t('Şifre (tekrar)'), 'new-password')}` : ''}
    <div class="row-btns"><button class="btn btn-primary" id="accGo">${up ? t('Kayıt ol') : t('Giriş yap')}</button></div>
    ${up ? '' : `<button class="linkish" id="accForgot">${t('Şifremi unuttum')}</button>`}
    <p class="note">${t('Hesap verilerinin nasıl işlendiği {link} yazıyor.', { link: `<a href="${LANG === 'en' ? 'privacy.html' : 'gizlilik.html'}" target="_blank">${t('aydınlatma metninde')}</a>` })}</p>
    <div class="err" id="accErr" role="alert" aria-live="polite"></div>`;
}
// Şifre sıfırlama bağlantısıyla gelince: yeni şifre + tekrar, aynı kurallar
function renderNewPass() {
  $('#accBox').innerHTML = `<p class="note" style="margin:0 0 8px">${t('Yeni şifreni yaz:')}</p>
    ${passField('accNew', t('Yeni şifre'), 'new-password')}<ul class="pw-rules" id="accRules" aria-live="polite">${rulesHtml('')}</ul>
    ${passField('accNew2', t('Yeni şifre (tekrar)'), 'new-password')}
    <div class="row-btns"><button class="btn btn-primary" id="accNewPass">${t('Şifreyi kaydet')}</button></div><div class="err" id="accErr" role="alert" aria-live="polite"></div>`;
}
// Genel kutu (hata kırmızı, bilgi gri) ve alan altı hata
const accErr = (m, info = false) => { const e = $('#accErr'); if (e) { e.textContent = m; e.classList.toggle('ok', info); } };
function fieldErr(id, msg) {
  const f = $('#' + id); if (!f) return;
  f.classList.toggle('bad', !!msg); f.setAttribute('aria-invalid', String(!!msg));
  const e = $('#' + id + 'Err'); if (e) e.textContent = msg || '';
}
function clearErrs() { $$('#accBox .field.bad').forEach(f => fieldErr(f.id, '')); accErr(''); }
// Supabase hatası → [alan, mesaj] (alan null: genel kutu). Eşleştirme koda göre; kodsuz eski yanıtlar mesajdan.
const authCode = e => e?.code || { 'Invalid login credentials':'invalid_credentials', 'Email not confirmed':'email_not_confirmed', 'User already registered':'user_already_exists' }[e?.message];
function authErr(e) {
  if (e?.name === 'AuthRetryableFetchError' || /failed to fetch|network/i.test(e?.message || '')) return [null, t('Sunucuya ulaşılamadı: bağlantını kontrol edip tekrar dene.')];
  switch (authCode(e)) {
    case 'invalid_credentials': return ['accPass', t('E-posta ya da şifre yanlış.')];
    case 'email_not_confirmed': return [null, t('E-postan henüz onaylanmadı.')];
    case 'user_already_exists': case 'email_exists': return ['accEmail', t('Bu e-postayla hesap var; giriş yap.')];
    case 'email_address_invalid': return ['accEmail', t('Bu e-posta adresi kabul edilmedi.')];
    case 'weak_password': return ['accPass', t('Şifre yeterince güçlü değil: en az 8 karakter, bir harf (a–z) ve bir rakam kullan.')];
    case 'same_password': return ['accNew', t('Yeni şifre eskisiyle aynı olamaz.')];
    case 'otp_expired': return ['accCode', t('Kod yanlış ya da süresi dolmuş; yeni kod iste.')];
    case 'over_email_send_rate_limit': return [null, t('Kısa sürede çok fazla e-posta istendi; birkaç dakika sonra tekrar dene.')];
    case 'over_request_rate_limit': return [null, t('Çok fazla deneme yapıldı; birkaç dakika bekleyip tekrar dene.')];
    case 'signup_disabled': case 'email_provider_disabled': return [null, t('Şu an yeni kayıt alınmıyor.')];
  }
  return [null, e?.message || t('Bir şeyler ters gitti.')];
}
const authMsg = e => authErr(e)[1];
function showErr(e, field) {
  const [f, m] = authErr(e), id = field && f ? field : f;
  if (id && $('#' + id)) { fieldErr(id, m); $('#' + id).focus(); } else accErr(m);
}
// İstek sürerken düğme kilitli ve "…" yazar; çift tıklama ikinci isteği göndermez
async function busy(btn, label, fn) {
  if (acc.busy) return;
  acc.busy = true;
  const old = btn?.innerHTML;
  if (btn) { btn.disabled = true; btn.classList.add('loading'); btn.textContent = label; }
  try { return await fn(); }
  finally { acc.busy = false; if (btn?.isConnected) { btn.disabled = false; btn.classList.remove('loading'); btn.innerHTML = old; } }
}
function showCode(msg, sent) {
  acc.mode = 'code';
  if (sent) acc.resendAt = Date.now() + 60000;
  renderAccount();
  if (msg) accErr(msg, true);
  setTimeout(() => $('#accCode')?.focus(), 50);
}
// "Tekrar gönder" 60 sn kilitli, geri sayım düğmede
function resendTick() {
  clearInterval(resendTimer);
  const upd = () => {
    const b = $('#accResend');
    if (!b) return clearInterval(resendTimer);
    const s = Math.ceil((acc.resendAt - Date.now()) / 1000);
    if (!b.classList.contains('loading')) { b.disabled = s > 0; b.textContent = s > 0 ? t('Tekrar gönder ({s} sn)', { s }) : t('Tekrar gönder'); }
    if (s <= 0) clearInterval(resendTimer);
  };
  upd(); resendTimer = setInterval(upd, 1000);
}
const redirectTo = () => location.origin + location.pathname;
async function accSubmit(btn) {
  clearErrs();
  const up = acc.mode === 'up', email = $('#accEmail').value.trim(), pass = $('#accPass').value;
  acc.email = email;
  if (!EMAIL_RE.test(email)) fieldErr('accEmail', t('Geçerli bir e-posta yaz.'));
  if (!pass) fieldErr('accPass', t('Şifreni yaz.'));
  else if (up && passProblem(pass)) fieldErr('accPass', passProblem(pass));
  else if (up && $('#accPass2').value !== pass) fieldErr('accPass2', t('Şifreler aynı değil.'));
  const bad = $('#accBox .field.bad');
  if (bad) return bad.focus();
  await busy(btn, up ? t('Kayıt olunuyor…') : t('Giriş yapılıyor…'), async () => {
    pendingPass = pass; // kasa anahtarı ilk eşitlemede türetilir (js/kasa.js)
    const { data, error } = up
      ? await sb.auth.signUp({ email, password:pass, options:{ emailRedirectTo:redirectTo() } })
      : await sb.auth.signInWithPassword({ email, password:pass });
    if (error) {
      pendingPass = null;
      if (authCode(error) === 'email_not_confirmed') { acc.pass = pass; return showCode(t('E-postan henüz onaylanmadı: gelen kutundaki kodu yaz ya da yeni kod iste.'), false); }
      return showErr(error);
    }
    if (up) {
      // Onaylı bir hesabın e-postasıyla kayıtta Supabase hata vermez, kimliksiz kullanıcı döner
      if (data.user && !data.user.identities?.length) { pendingPass = null; return fieldErr('accEmail', t('Bu e-postayla hesap var; giriş yap.')); }
      if (data.session) { acc.done = true; if (S.user) renderAccount(); return; } // e-posta onayı kapalıysa doğrudan oturum
      pendingPass = null; acc.pass = pass;
      return showCode(null, true);
    }
    acc.pass = '';
    toast(t('Hoş geldin! Listelerin eşitleniyor'));
    closeSheet();
  });
}
async function onAccountClick(e) {
  const eye = e.target.closest('[data-eye]');
  if (eye) {
    const f = $('#' + eye.dataset.eye), show = f.type === 'password';
    f.type = show ? 'text' : 'password';
    eye.setAttribute('aria-pressed', String(show));
    eye.setAttribute('aria-label', show ? t('Şifreyi gizle') : t('Şifreyi göster'));
    eye.innerHTML = ico(show ? 'eye-off' : 'eye');
    return;
  }
  const tab = e.target.closest('[data-accmode]');
  if (tab) return setAccMode(tab.dataset.accmode, true);
  const btn = e.target.closest('button'), id = btn?.id;
  if (!id) return;
  if (id === 'accGoogle' && GOOGLE_AUTH) {
    const { error } = await sb.auth.signInWithOAuth({ provider:'google', options:{ redirectTo:redirectTo() } });
    if (error) accErr(authMsg(error));
  } else if (id === 'accGo') accSubmit(btn);
  else if (id === 'accForgot') {
    clearErrs();
    const email = $('#accEmail').value.trim();
    acc.email = email;
    if (!EMAIL_RE.test(email)) { fieldErr('accEmail', t('Önce e-postanı yaz.')); return $('#accEmail').focus(); }
    await busy(btn, t('Gönderiliyor…'), async () => {
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo:redirectTo() });
      if (error) showErr(error, 'accEmail'); else accErr(t('Şifre sıfırlama bağlantısı gönderildi: e-postana bak.'), true);
    });
  } else if (id === 'accVerify') {
    clearErrs();
    const code = $('#accCode').value.replace(/\s/g, '');
    if (!/^\d{6,10}$/.test(code)) { fieldErr('accCode', t('E-postadaki 6 haneli kodu yaz.')); return $('#accCode').focus(); }
    await busy(btn, t('Doğrulanıyor…'), async () => {
      pendingPass = acc.pass || null;
      const { error } = await sb.auth.verifyOtp({ email:acc.email, token:code, type:'email' });
      if (error) { pendingPass = null; return showErr(error, 'accCode'); }
      clearInterval(resendTimer);
      acc.pass = ''; acc.mode = 'in'; acc.done = true;
      if (S.user) renderAccount();
    });
  } else if (id === 'accResend') {
    clearErrs();
    await busy(btn, t('Gönderiliyor…'), async () => {
      const { error } = await sb.auth.resend({ type:'signup', email:acc.email, options:{ emailRedirectTo:redirectTo() } });
      if (error) return showErr(error);
      acc.resendAt = Date.now() + 60000;
      accErr(t('Yeni kod gönderildi.'), true);
    });
    resendTick();
  } else if (id === 'accBack') { clearInterval(resendTimer); acc.pass = ''; setAccMode('up', false); }
  else if (id === 'accDoneOk') { acc.done = false; renderAccount(); }
  else if (id === 'accSyncNow') syncNow();
  else if (id === 'accOut') signOut();
  else if (id === 'accNewPass') {
    clearErrs();
    const np = $('#accNew').value, p = passProblem(np);
    if (p) { fieldErr('accNew', p); return $('#accNew').focus(); }
    if ($('#accNew2').value !== np) { fieldErr('accNew2', t('Şifreler aynı değil.')); return $('#accNew2').focus(); }
    await busy(btn, t('Kaydediliyor…'), async () => {
      const { error } = await sb.auth.updateUser({ password:np });
      if (error) return showErr(error, 'accNew');
      // Kasa yeni şifreyle yeniden kurulur; bu cihazdaki anahtarlar yeniden şifrelenip gönderilir
      // (eski kopya eski şifreyle şifreli: yeni şifreyle zaten açılmaz; bu cihazdakilerle yeniden yazılır, öbür cihazlar
      // Ayarlar'da yeni şifreyi bir kez girince kendi anahtarlarını da ekler)
      setVault(await deriveVault(S.user.id, np)); S.keysLocked = false;
      if (S.keySync) { sync.keysSig = ''; S.stateDirty = true; saveDirty(); syncSoon(); }
      acc.mode = 'in';
      toast(t('Şifren değiştirildi')); renderAccount(); renderKeySync(); renderPrivacy();
    });
  }
}
// Giriş/kayıt sekmesi (yazılan e-posta korunur)
function setAccMode(mode, focus) {
  const em = $('#accEmail');
  if (em) acc.email = em.value.trim();
  acc.mode = mode === 'up' ? 'up' : 'in';
  renderAccount();
  if (focus) setTimeout(() => $(acc.email ? '#accPass' : '#accEmail')?.focus(), 50);
}
// Yazarken: kural listesi canlı, düzeltilen alanın hatası kalkar; Enter formu gönderir
function onAccountInput(e) {
  const id = e.target.id;
  if (id === 'accPass' || id === 'accNew') { const r = $('#accRules'); if (r) r.innerHTML = rulesHtml(e.target.value); }
  if (e.target.classList.contains('bad')) fieldErr(id, '');
}
function onAccountKey(e) {
  if (e.key !== 'Enter' || e.target.tagName !== 'INPUT') return;
  e.preventDefault();
  $('#accGo, #accVerify, #accNewPass')?.click();
}
// Misafire hatırlatma: oturumda ilk kaydırmada bir kez (ve eski sürümden taşınan veri varsa açılışta)
function guestNudge() {
  if (S.user) return;
  try { if (sessionStorage.getItem('kd_nudged')) return; sessionStorage.setItem('kd_nudged', '1'); } catch { return; }
  toast(t('Hesapsızsın: sekmeyi kapatınca listelerin silinir'), t('Kayıt ol'), () => openAccount('up'), 6000);
}
function initAccount() {
  if (guestMoved) setTimeout(() => toast(t('Hesapsız listelerin artık yalnız bu sekmede tutuluyor; kalıcı olması için kayıt ol'), t('Kayıt ol'), () => openAccount('up'), 8000), 1500);
  $('#sheetSettings').addEventListener('click', e => { const b = e.target.closest('.guest-card [data-acc]'); if (b) openAccount(b.dataset.acc); });
  if (LANG === 'en') $$('#sheetSettings a[href="gizlilik.html"]').forEach(a => a.href = 'privacy.html');
  renderAccount();
  if (!sb) return;
  $('#accBox').addEventListener('click', onAccountClick);
  $('#accBox').addEventListener('input', onAccountInput);
  $('#accBox').addEventListener('keydown', onAccountKey);
  $('#keySyncSec').addEventListener('click', onKeySyncClick);
  $('#keySyncSec').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'kvPass') $('#kvUnlock').click(); });
  sb.auth.onAuthStateChange((event, session) => {
    // Supabase olay içinde başka Supabase çağrısı beklenmemeli: işi sonraya bırak
    setTimeout(() => {
      if (event === 'PASSWORD_RECOVERY') {
        openSettings();
        acc.mode = 'reset'; renderAccount();
      }
      if (session?.user) onSignedIn(session.user);
      else if (event === 'SIGNED_OUT') onSignedOut();
      else if (event === 'INITIAL_SESSION' && accountMode) setAccountMode(false); // oturumun süresi dolmuş
    }, 0);
  });
  // Sekmeye dönünce çek; sekme gizlenince / sayfa kapanırken bekleyen değişiklikleri hemen gönder
  document.addEventListener('visibilitychange', () => {
    if (!S.user) return;
    if (document.visibilityState === 'visible') syncNow();
    else { clearTimeout(syncTimer); pushChanges(); }
  });
  window.addEventListener('online', () => { if (S.user) syncNow(); });
}
