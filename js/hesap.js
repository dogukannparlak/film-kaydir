'use strict';
/* ================= Hesap ve eşitleme (Supabase) ================= */
// Önce yerel: site hesapsız da çalışır, veri localStorage'da. Giriş yapınca:
// - Değişen/silinen öğeler 1,5 sn sonra buluta yazılır (items: key → data, silinen deleted=true).
// - Buluttan yalnız son eşitlemeden sonra değişenler çekilir (updated_at > since); açılışta, sekmeye dönünce ve 60 sn'de bir.
// - Bu cihazda bu hesapla ilk girişte yerel ve bulut birleştirilir: aynı öğede addedAt'i yeni olan kazanır.
// - Görülenler birleşim (union); API anahtarları ve filtreler kullanıcı durumunda (user_state).
// Güvenlik: anahtar herkese açık "publishable" anahtardır; her satır RLS ile yalnız sahibine açık.
const SB_URL = 'https://zungbtgtlrltowkvjqso.supabase.co';
const SB_KEY = 'sb_publishable_Bgg9ZLBOaQe4nn904kRYTQ_mcy-SMYS';
const sb = window.supabase?.createClient(SB_URL, SB_KEY, { auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true, flowType:'pkce' } }) || null;
const SYNC_KEY = 'kd_sync'; // { user, since, hashes: { key: imza } } — son eşitlenen hâl
let sync = store.get(SYNC_KEY, null);
let syncTimer = null, syncing = false, pullTimer = null;
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
  } catch (e) { setSyncStatus('Eşitlenemedi: ' + (e.message || e)); }
  finally { syncing = false; }
}
async function pushState() {
  const row = { user_id:S.user.id, seen:[...S.seen], filters:S.filters, list_filters:S.listF, tmdb_key:S.apiKey || null, omdb_key:S.omdbKey || null };
  const { error } = await sb.from('user_state').upsert(row, { onConflict:'user_id' });
  if (error) throw error;
  S.seenDirty = S.stateDirty = false;
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
  // Kullanıcı durumu: görülenler birleşir; anahtar/filtre ilk girişte buluttan (yerelde yoksa)
  const { data: st } = await sb.from('user_state').select('*').maybeSingle();
  if (st) {
    const before = S.seen.size;
    (st.seen || []).forEach(k => S.seen.add(k));
    if (S.seen.size !== before) { store.set(K.seen, [...S.seen]); S.queue = S.queue.filter(it => !S.seen.has(it.key)); }
    if (S.seen.size > (st.seen || []).length) S.seenDirty = true;
    if (first) {
      if (st.tmdb_key && !S.apiKey) { S.apiKey = st.tmdb_key; store.set(K.key, st.tmdb_key); resetEngine(); loadProviders(); }
      if (st.omdb_key && !S.omdbKey) { S.omdbKey = st.omdb_key; store.set(K.omdb, st.omdb_key); }
      if (st.filters) { S.filters = { ...DEFAULT_FILTERS, ...migrateFilters(st.filters) }; store.set(K.filters, S.filters); updateSummary(); resetEngine(); }
      if (S.apiKey && !st.tmdb_key) S.stateDirty = true;
    }
  } else S.stateDirty = true;
  if (changed || first) {
    store.set(K.items, S.items);
    updateCounts(); if (S.view === 'lists') renderList();
  }
  saveSync();
  return changed;
}
function saveSync() { store.set(SYNC_KEY, sync); }
async function syncNow(first = false) {
  if (!S.user) return;
  setSyncStatus('Eşitleniyor…');
  try {
    const n = await pullChanges(first);
    await pushChanges();
    if (first && n) toast(`☁️ Hesaptan ${n} öğe geldi`);
  } catch (e) { setSyncStatus('Eşitlenemedi: ' + (e.message || e)); }
}
function setSyncStatus(msg) {
  S.syncMsg = msg || `Son eşitleme ${new Date().toLocaleTimeString('tr-TR', { hour:'2-digit', minute:'2-digit' })}`;
  const el = $('#accSync'); if (el) el.textContent = S.syncMsg;
}
async function onSignedIn(user) {
  const fresh = !S.user || S.user.id !== user.id;
  S.user = user;
  renderAccount();
  if (!fresh) return;
  // Bu cihazda bu hesapla ilk kez mi? (başka hesabın eşitleme izi varsa sıfırla)
  const first = !sync || sync.user !== user.id;
  if (first) sync = { user:user.id, since:null, hashes:{} };
  await syncNow(first);
  clearInterval(pullTimer);
  pullTimer = setInterval(() => document.visibilityState === 'visible' && syncNow(), 60000);
}
function onSignedOut() {
  S.user = null; clearInterval(pullTimer); renderAccount();
}

/* ---- Giriş arayüzü (Ayarlar › Hesap) ---- */
function renderAccount() {
  const box = $('#accBox');
  if (!box) return;
  if (!sb) { box.innerHTML = '<p class="note" style="margin:0">Hesap servisine ulaşılamadı (çevrimdışı olabilirsin). Site yerelde çalışmaya devam ediyor.</p>'; return; }
  if (S.user) {
    box.innerHTML = `
      <p class="acc-who">☁️ <b>${esc(S.user.email || 'Hesap')}</b></p>
      <p class="note" id="accSync" style="margin:4px 0 10px">${esc(S.syncMsg || '')}</p>
      <div class="row-btns"><button class="btn" id="accSyncNow">Şimdi eşitle</button><button class="btn btn-danger" id="accOut">Çıkış yap</button></div>
      <p class="note">Listelerin, görülenler, filtreler ve API anahtarların bu hesapta saklanır; telefon ve bilgisayar aynı listeyi görür. Çıkış yapınca bu cihazdaki veri kalır.</p>`;
    return;
  }
  const local = location.protocol === 'file:';
  box.innerHTML = `
    <p class="note" style="margin:0 0 10px">Giriş yaparsan listelerin cihazlar arasında eşitlenir. Hesapsız da kullanabilirsin.</p>
    ${local ? '<p class="note" style="margin:0 0 10px">⚠️ Site dosyadan açık: Google ile giriş ve e-posta bağlantıları yalnız yayındaki adreste çalışır.</p>' : ''}
    <button class="btn btn-google" id="accGoogle" ${local ? 'disabled' : ''}><span>G</span> Google ile devam et</button>
    <div class="acc-or">ya da e-posta</div>
    <input class="field" id="accEmail" type="email" placeholder="E-posta" autocomplete="email">
    <input class="field" id="accPass" type="password" placeholder="Şifre (en az 8 karakter)" autocomplete="current-password" style="margin-top:8px">
    <div class="row-btns"><button class="btn btn-primary" id="accIn">Giriş yap</button><button class="btn" id="accUp">Kayıt ol</button></div>
    <button class="linkish" id="accForgot">Şifremi unuttum</button>
    <div class="err" id="accErr"></div>`;
}
const accErr = m => { const e = $('#accErr'); if (e) e.textContent = m; };
const authMsg = e => ({
  'Invalid login credentials': 'E-posta ya da şifre yanlış.',
  'Email not confirmed': 'E-postanı onaylamadın: gelen kutundaki bağlantıya tıkla.',
  'User already registered': 'Bu e-postayla hesap var; giriş yap.',
}[e?.message] || e?.message || 'Bir şeyler ters gitti.');
const redirectTo = () => location.origin + location.pathname;
async function onAccountClick(e) {
  const id = e.target.closest('button')?.id;
  if (!id) return;
  const email = $('#accEmail')?.value.trim(), pass = $('#accPass')?.value || '';
  if (id === 'accGoogle') {
    const { error } = await sb.auth.signInWithOAuth({ provider:'google', options:{ redirectTo:redirectTo() } });
    if (error) accErr(authMsg(error));
  } else if (id === 'accIn' || id === 'accUp') {
    if (!/^\S+@\S+\.\S+$/.test(email || '')) return accErr('Geçerli bir e-posta yaz.');
    if (pass.length < 8) return accErr('Şifre en az 8 karakter olmalı.');
    accErr(id === 'accIn' ? 'Giriş yapılıyor…' : 'Kayıt olunuyor…');
    const { data, error } = id === 'accIn'
      ? await sb.auth.signInWithPassword({ email, password:pass })
      : await sb.auth.signUp({ email, password:pass, options:{ emailRedirectTo:redirectTo() } });
    if (error) return accErr(authMsg(error));
    if (id === 'accUp' && !data.session) accErr('Onay e-postası gönderildi: bağlantıya tıklayınca giriş yapılır.');
  } else if (id === 'accForgot') {
    if (!/^\S+@\S+\.\S+$/.test(email || '')) return accErr('Önce e-postanı yaz.');
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo:redirectTo() });
    accErr(error ? authMsg(error) : 'Şifre sıfırlama bağlantısı gönderildi.');
  } else if (id === 'accSyncNow') syncNow();
  else if (id === 'accOut') { await pushChanges(); await sb.auth.signOut(); toast('Çıkış yapıldı'); }
  else if (id === 'accNewPass') {
    const np = $('#accNew').value;
    if (np.length < 8) return accErr('Şifre en az 8 karakter olmalı.');
    const { error } = await sb.auth.updateUser({ password:np });
    if (error) return accErr(authMsg(error));
    toast('Şifren değiştirildi'); renderAccount();
  }
}
function initAccount() {
  renderAccount();
  if (!sb) return;
  $('#accBox').addEventListener('click', onAccountClick);
  sb.auth.onAuthStateChange((event, session) => {
    // Supabase olay içinde başka Supabase çağrısı beklenmemeli: işi sonraya bırak
    setTimeout(() => {
      if (event === 'PASSWORD_RECOVERY') {
        openSettings();
        $('#accBox').innerHTML = `<p class="note" style="margin:0 0 8px">Yeni şifreni yaz:</p><input class="field" id="accNew" type="password" autocomplete="new-password" placeholder="Yeni şifre (en az 8 karakter)"><div class="row-btns"><button class="btn btn-primary" id="accNewPass">Şifreyi kaydet</button></div><div class="err" id="accErr"></div>`;
      }
      if (session?.user) onSignedIn(session.user);
      else if (event === 'SIGNED_OUT') onSignedOut();
    }, 0);
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.user) syncNow(); });
}
