'use strict';
/* ================= Yönetim sayfası (admin.html) ================= */
// Siteden bağımsız tek dosya. Oturum sitenin Supabase oturumudur (aynı alan adı, aynı localStorage).
// Veri kaynakları:
// - Supabase RPC (yalnız admin): admin_stats (kendi sayaç), admin_users, admin_delete_user, admin_set_role, admin_db,
//   admin_visitors, admin_events, admin_event_kinds, admin_errors (etkinlik günlüğü: js/kayit.js),
//   admin_anon_stats (rıza bandı görüldü/seçim + rızasız yükleme toplamları; kimliksiz, js/riza.js)
// - Worker /api/admin/cloudflare ve /api/admin/umami (src/admin.js; gizli anahtarlar orada)
const SB_URL = 'https://zungbtgtlrltowkvjqso.supabase.co';
const SB_KEY = 'sb_publishable_Bgg9ZLBOaQe4nn904kRYTQ_mcy-SMYS';
const sb = window.supabase.createClient(SB_URL, SB_KEY, { auth:{ persistSession:true, autoRefreshToken:true } });
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const fmt = n => (+n || 0).toLocaleString('tr-TR');
const secs = s => { s = Math.round(s || 0); return s < 60 ? `${s} sn` : s < 3600 ? `${Math.floor(s / 60)} dk ${s % 60} sn` : `${Math.floor(s / 3600)} sa ${Math.floor(s % 3600 / 60)} dk`; };
const bytes = b => b > 1e9 ? (b / 1e9).toFixed(2) + ' GB' : b > 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.round(b / 1e3) + ' KB';
const date = d => d ? new Date(d).toLocaleDateString('tr-TR', { day:'numeric', month:'short', year:'2-digit' }) : '—';
const ago = d => { if (!d) return '—'; const m = (Date.now() - new Date(d)) / 60000; return m < 60 ? Math.round(m) + ' dk önce' : m < 1440 ? Math.round(m / 60) + ' sa önce' : Math.round(m / 1440) + ' gün önce'; };
// Umami ücretsiz planda API yok (Pro gerekir, 2026-10-19): paylaşım bağlantısı panelin içine gömülür.
// cloud.umami.is › Websites › Kaydır › Edit › Share URL › Enable share URL › bağlantıyı buraya yapıştır.
const UMAMI_SHARE = '';
const COLORS = { own:'#8b5cf6', umami:'#22d3ee', cf:'#f59e0b', err:'#ef4444' };
const PANELS = [
  ['Canlı site', 'https://kaydir.dogukanparlak.com'],
  ['Supabase', 'https://supabase.com/dashboard/project/zungbtgtlrltowkvjqso'],
  ['Supabase · Kullanıcılar', 'https://supabase.com/dashboard/project/zungbtgtlrltowkvjqso/auth/users'],
  ['Supabase · SQL', 'https://supabase.com/dashboard/project/zungbtgtlrltowkvjqso/sql/new'],
  ['Cloudflare · Worker', 'https://dash.cloudflare.com/?to=/:account/workers/services/view/kaydir/production'],
  ['Cloudflare · Web Analytics', 'https://dash.cloudflare.com/?to=/:account/web-analytics'],
  ['Umami', 'https://cloud.umami.is/websites/08f74919-6681-4aa7-a12c-4a37ecfa130c'],
  ['GitHub', 'https://github.com/dogukannparlak/film-kaydir'],
  ['TMDB API', 'https://www.themoviedb.org/settings/api'],
];
const SETUP = {
  cloudflare: `<b>Cloudflare bağlı değil.</b> Workers &amp; Pages › kaydir › Settings › Variables and secrets'e ekle:
    <ol><li><code>CF_API_TOKEN</code> (Secret): My Profile › API Tokens › Create Token › Custom › izin <i>Account · Account Analytics · Read</i></li>
    <li><code>CF_ACCOUNT_ID</code> (Text): Workers &amp; Pages sayfasının sağındaki Account ID</li></ol>`,
  umami: `<b>Umami paylaşım bağlantısı yok.</b> cloud.umami.is › Websites › Kaydır › Edit › <i>Share URL</i> › Enable; bağlantıyı <code>js/yonetim.js</code> › <code>UMAMI_SHARE</code>'e yaz. (Umami API'si ücretli planda; gerekmiyor.)`,
};
const st = { days:30, token:null, me:null, charts:{}, armed:null, tab:'genel', users:[], loaded:{} };
const ROLES = { user:'Kullanıcı', admin:'Admin' }; // public.admin_set_role ile aynı

/* ---- Oturum ---- */
async function boot() {
  const { data:{ session } } = await sb.auth.getSession();
  if (!session) return showLogin();
  st.token = session.access_token; st.me = session.user.id;
  const { data:admin } = await sb.rpc('is_admin');
  if (admin !== true) return showLogin('Bu hesap admin değil.', session.user.email);
  $('#who').innerHTML = `${esc(session.user.email)} · <a href="#" id="out">çıkış</a>`;
  $('#out').onclick = async e => { e.preventDefault(); await sb.auth.signOut(); location.reload(); };
  $('#login').classList.add('hidden'); $('#dash').classList.remove('hidden');
  $('#links').innerHTML = PANELS.map(([n, u]) => `<a class="btn" href="${u}" target="_blank" rel="noopener">${esc(n)} ↗</a>`).join('');
  load();
}
function showLogin(msg = '', email = '') {
  $('#dash').classList.add('hidden'); $('#login').classList.remove('hidden');
  $('#loginErr').textContent = msg; if (email) $('#email').value = email;
}
$('#signin').onclick = async () => {
  $('#loginErr').textContent = 'Giriş yapılıyor…';
  const { error } = await sb.auth.signInWithPassword({ email:$('#email').value.trim(), password:$('#pass').value });
  if (error) { $('#loginErr').textContent = error.message; return; }
  boot();
};
$('#pass').onkeydown = e => { if (e.key === 'Enter') $('#signin').click(); };
sb.auth.onAuthStateChange((_, s) => { if (s) st.token = s.access_token; });

/* ---- Veri ---- */
const rpc = (fn, args) => sb.rpc(fn, args).then(({ data, error }) => { if (error) throw error; return data; });
const api = path => fetch(`/api/admin/${path}?days=${st.days}`, { headers:{ authorization:'Bearer ' + st.token } })
  .then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.message || d.error || ('HTTP ' + r.status)); return d; });
async function load() {
  $('#refresh').textContent = 'Yükleniyor…';
  const [own, users, db, cf, um, anon] = await Promise.allSettled([
    rpc('admin_stats', { p_days:st.days }), rpc('admin_users'), rpc('admin_db'), api('cloudflare'), api('umami'),
    rpc('admin_anon_stats'),
  ]);
  const v = r => r.status === 'fulfilled' ? r.value : null;
  const D = { own:v(own), users:v(users), db:v(db), cf:v(cf), um:v(um), anon:v(anon) };
  renderSources(own, cf, um);
  st.users = D.users || []; st.usersErr = users;
  if (UMAMI_SHARE && !$('#umamiFrame').src) { $('#umamiFrame').src = UMAMI_SHARE; $('#umamiCard').classList.remove('hidden'); }
  renderKpis(D); renderCharts(D); renderTops(D); renderUsers(); renderDb(D.db);
  st.loaded = {}; showTab(st.tab); loadErrorBadge();
  $('#refresh').textContent = 'Yenile';
}

/* ---- Kaynak durumu ---- */
function renderSources(own, cf, um) {
  const chip = (name, r, setup) => {
    if (r.status === 'rejected') return [`<span class="src bad" title="${esc(r.reason?.message)}"><i></i>${name}: hata</span>`, `<div class="setup"><b>${name}:</b> ${esc(r.reason?.message || 'hata')}</div>`];
    const d = r.value;
    if (d && d.connected === false) return [`<span class="src off"><i></i>${name}: bağlı değil</span>`, `<div class="setup">${setup}</div>`];
    const warn = d?.graphqlErrors?.length ? `<div class="setup"><b>${name} sorgu uyarısı:</b> ${esc(d.graphqlErrors.join(' · '))}</div>` : '';
    return [`<span class="src ok"><i></i>${name}</span>`, warn];
  };
  const umR = um.status === 'fulfilled' && um.value?.connected === false && UMAMI_SHARE ? { status:'fulfilled', value:{ connected:true } } : um;
  const parts = [chip('Kendi sayaç (Supabase)', own, ''), chip('Cloudflare', cf, SETUP.cloudflare), chip(UMAMI_SHARE ? 'Umami (paylaşım)' : 'Umami', umR, SETUP.umami)];
  $('#sources').innerHTML = parts.map(p => p[0]).join('') + parts.map(p => p[1]).join('');
}

/* ---- Özet kutuları ---- */
function renderKpis({ own, users, cf, um, anon }) {
  const k = (label, value, sub = '', color = '') => `<div class="kpi"><small>${color ? `<i style="background:${color}"></i>` : ''}${label}</small><b>${value}</b>${sub ? `<span class="sub">${sub}</span>` : ''}</div>`;
  const sum = (a, f) => (a || []).reduce((s, x) => s + (x[f] || 0), 0);
  const out = [];
  if (own) out.push(
    k('Şu an sitede', fmt(own.online), 'son 90 sn · kendi sayaç', COLORS.own),
    k('Ziyaretçi', fmt(own.visitors), `${fmt(own.returning)} geri dönen`, COLORS.own),
    k('Ziyaret', fmt(own.visits), `girişli %${fmt(own.logged_in_share)}`, COLORS.own),
    k('Ort. kalma', secs(own.avg_secs), 'ortanca ' + secs(own.median_secs), COLORS.own));
  if (anon) out.push(
    k('Rıza bandı görüldü', fmt(anon.shown), `kabul ${fmt(anon.accept)} · kısmi ${fmt(anon.pick)} · red ${fmt(anon.reject)} · ilk seçim`, COLORS.own),
    k('Rızasız yükleme', fmt(anon.visit), 'kimliksiz toplam · sayı dışında hiçbir kayıt yok', COLORS.own));
  if (um?.connected) out.push(
    k('Umami ziyaretçi', fmt(um.stats.visitors), `şu an ${fmt(um.active)}`, COLORS.umami),
    k('Umami sayfa görüntüleme', fmt(um.stats.pageviews), `${fmt(um.stats.visits)} ziyaret`, COLORS.umami),
    k('Umami ort. süre', secs(um.stats.visits ? um.stats.totaltime / um.stats.visits : 0), `hemen çıkma %${um.stats.visits ? Math.round(100 * um.stats.bounces / um.stats.visits) : 0}`, COLORS.umami));
  if (cf?.connected) out.push(
    k('Cloudflare ziyaret', fmt(sum(cf.daily, 'visits')), `${fmt(sum(cf.daily, 'pageviews'))} sayfa yükleme`, COLORS.cf),
    k('Worker isteği', fmt(sum(cf.worker, 'requests')), `${fmt(sum(cf.worker, 'errors'))} hata`, COLORS.cf));
  if (users) out.push(
    k('Hesap', fmt(users.length), `${fmt(own?.users_new)} yeni · ${fmt(own?.users_active)} aktif`),
    k('Liste öğesi', fmt(own?.items ?? users.reduce((s, u) => s + +u.items, 0))));
  $('#kpis').innerHTML = out.join('');
}

/* ---- Grafikler ---- */
function renderCharts({ own, cf, um }) {
  const days = [];
  for (let i = st.days - 1; i >= 0; i--) days.push(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10));
  const byDay = (arr, f) => { const m = Object.fromEntries((arr || []).map(x => [x.day, x[f]])); return days.map(d => m[d] ?? 0); };
  const sets = [];
  if (own) sets.push({ label:'Kendi sayaç', data:byDay(own.daily, 'visitors'), borderColor:COLORS.own, backgroundColor:COLORS.own + '22', fill:true });
  if (um?.connected) sets.push({ label:'Umami', data:byDay(um.daily, 'sessions'), borderColor:COLORS.umami });
  if (cf?.connected && cf.daily?.length) sets.push({ label:'Cloudflare', data:byDay(cf.daily, 'visits'), borderColor:COLORS.cf });
  draw('cVisits', 'line', days, sets.map(s => ({ tension:.3, pointRadius:0, borderWidth:2, ...s })));
  const w = cf?.connected ? cf.worker : [];
  draw('cWorker', 'bar', days, [
    { label:'İstek', data:byDay(w, 'requests'), backgroundColor:COLORS.cf + 'aa', yAxisID:'y' },
    { label:'Hata', data:byDay(w, 'errors'), backgroundColor:COLORS.err, yAxisID:'y1' },
  ], { y1:{ position:'right', grid:{ display:false }, ticks:{ color:'#8b93a7' }, beginAtZero:true } });
}
function draw(id, type, labels, datasets, extraScales = {}, horizontal = false) {
  st.charts[id]?.destroy();
  const ticks = { color:'#8b93a7', maxRotation:0, autoSkipPadding:14 }, grid = { color:'#252b38' };
  st.charts[id] = new Chart(document.getElementById(id), {
    type, data:{ labels:horizontal ? labels : labels.map(d => d.slice(5).replace('-', '.')), datasets },
    options:{ responsive:true, maintainAspectRatio:false, interaction:{ mode:'index', intersect:false },
      plugins:{ legend:{ labels:{ color:'#e8eaf0', boxWidth:10 } } },
      scales:{ x:{ ticks, grid:{ display:false } }, y:{ ticks, grid, beginAtZero:true }, ...extraScales } },
  });
}

/* ---- En çoklar ---- */
function renderTops({ own, cf, um }) {
  const list = (title, rows, sub) => {
    const max = Math.max(1, ...(rows || []).map(r => r.n));
    const body = rows?.length ? `<ul class="top-list">${rows.map(r => `<li style="--w:${Math.round(100 * r.n / max)}%"><span title="${esc(r.k)}">${esc(r.k || '—')}</span><b>${fmt(r.n)}</b></li>`).join('')}</ul>` : '<p class="empty">Veri yok</p>';
    return `<div class="card"><h3>${title} <small>${sub}</small></h3>${body}</div>`;
  };
  const devs = o => Object.entries(o || {}).map(([k, n]) => ({ k:{ mobile:'Telefon', desktop:'Bilgisayar' }[k] || k, n })).sort((a, b) => b.n - a.n);
  const cards = [];
  if (um?.connected) cards.push(list('Sayfalar', um.pages, 'Umami'), list('Nereden', um.referrers, 'Umami'), list('Ülke', um.countries, 'Umami'), list('Tarayıcı', um.browsers, 'Umami'));
  if (cf?.connected) cards.push(list('Ülke', cf.countries, 'Cloudflare'), list('Nereden', cf.referers, 'Cloudflare'));
  if (own) cards.push(list('Nereden', own.referrers, 'kendi sayaç'), list('Dil', own.langs, 'kendi sayaç'), list('Cihaz', devs(own.devices), 'kendi sayaç'));
  $('#tops').innerHTML = cards.join('');
}

/* ---- Hesaplar ---- */
function renderUsers() {
  const tb = $('#users tbody');
  if (st.usersErr?.status === 'rejected') { tb.innerHTML = `<tr><td colspan="10" class="err">${esc(st.usersErr.reason?.message || 'alınamadı')}</td></tr>`; return; }
  const q = $('#userQ').value.trim().toLowerCase();
  const users = st.users.filter(u => !q || (u.email || '').toLowerCase().includes(q));
  $('#usersMeta').textContent = q ? `${users.length} / ${st.users.length} hesap` : `${st.users.length} hesap · satıra tıkla: geçmişi`;
  tb.innerHTML = users.map(u => `<tr class="click" data-user="${esc(u.id)}">
    <td>${esc(u.email)}${u.is_admin ? '<span class="tag adm">admin</span>' : ''}${u.confirmed ? '' : '<span class="tag">onaysız</span>'}</td>
    <td>${date(u.created_at)}</td><td>${ago(u.last_sign_in_at)}</td><td class="num">${fmt(u.want)}</td><td class="num">${fmt(u.watched)}</td><td class="num">${fmt(u.passed)}</td><td>${ago(u.last_change)}</td>
    <td>${u.keys_saved ? 'şifreli' : '—'}</td>
    <td><select class="role" data-role="${esc(u.id)}" data-email="${esc(u.email)}" ${u.id === st.me ? 'disabled title="Kendi rolünü değiştiremezsin"' : ''}>
      ${Object.entries(ROLES).map(([k, v]) => `<option value="${k}" ${(u.is_admin ? 'admin' : 'user') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></td>
    <td>${u.is_admin ? '' : `<button class="btn sm danger" data-del="${esc(u.id)}" data-email="${esc(u.email)}">Sil</button>`}</td></tr>`).join('');
}
$('#userQ').oninput = () => renderUsers();
$('#users').addEventListener('click', async e => {
  const b = e.target.closest('[data-del]');
  const row = e.target.closest('[data-user]');
  if (!b && row && !e.target.closest('select')) return openPerson({ user:row.dataset.user });
  if (!b) return;
  // İki aşamalı onay: ilk dokunuş kurar, 4 sn içinde ikincisi siler
  if (st.armed !== b) {
    if (st.armed) { st.armed.classList.remove('armed'); st.armed.textContent = 'Sil'; }
    st.armed = b; b.classList.add('armed'); b.textContent = 'Emin misin? Tekrar bas';
    setTimeout(() => { if (st.armed === b) { b.classList.remove('armed'); b.textContent = 'Sil'; st.armed = null; } }, 4000);
    return;
  }
  st.armed = null; b.disabled = true; b.textContent = 'Siliniyor…';
  try { await rpc('admin_delete_user', { p_id:b.dataset.del }); load(); }
  catch (err) { b.disabled = false; b.textContent = 'Sil'; alertBox(`${b.dataset.email} silinemedi: ${err.message}`); }
});
// Rol değişikliği: seçince hemen kaydedilir; hata olursa eski değere döner
$('#users').addEventListener('change', async e => {
  const s = e.target.closest('[data-role]');
  if (!s) return;
  const prev = s.value === 'admin' ? 'user' : 'admin';
  s.disabled = true;
  try { await rpc('admin_set_role', { p_id:s.dataset.role, p_role:s.value }); load(); }
  catch (err) { s.value = prev; s.disabled = false; alertBox(`${s.dataset.email} rolü değiştirilemedi: ${err.message}`); }
});
function alertBox(msg) { $('#sources').insertAdjacentHTML('afterbegin', `<div class="setup">${esc(msg)}</div>`); }

/* ---- Veritabanı ---- */
function renderDb(db) {
  if (!db) { $('#db').innerHTML = '<p class="empty">Alınamadı</p>'; return; }
  $('#db').innerHTML = `<p class="dbsize">${bytes(db.db_bytes)} <small class="muted" style="font-size:13px;font-weight:500">/ 500 MB ücretsiz</small></p>
    <table><thead><tr><th>Tablo</th><th>Satır (yaklaşık)</th><th>Boyut</th></tr></thead><tbody>
    ${(db.tables || []).map(t => `<tr><td>${esc(t.name)}</td><td class="num">${fmt(Math.max(0, t.rows))}</td><td class="num">${bytes(t.bytes)}</td></tr>`).join('')}</tbody></table>`;
}

/* ---- Sekmeler ---- */
function showTab(name) {
  st.tab = name;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
  document.querySelectorAll('.tab').forEach(p => p.classList.toggle('hidden', p.dataset.pane !== name));
  if (st.loaded[name]) return;
  st.loaded[name] = true;
  if (name === 'ziyaretciler') loadVisitors();
  if (name === 'etkinlik') loadEvents(true);
  if (name === 'hatalar') loadErrors();
  if (name === 'genel') Object.values(st.charts).forEach(c => c.resize());
}
$('#tabs').onclick = e => { const b = e.target.closest('[data-tab]'); if (b) showTab(b.dataset.tab); };

/* ---- Olay biçimi ---- */
const KIND = { swipe:'Kaydırdı', undo:'Geri aldı', view:'Sekme', open:'Açtı', filters:'Filtre', search:'Arama', trailer:'Fragman', collection:'Seri',
  episode:'Bölüm', import:'İçe aktardı', export:'Dışa aktardı', lang:'Dil', keysync:'Anahtar düğmesi', signin:'Giriş', signout:'Çıkış',
  guide:'Rehber', click:'Tıkladı', error:'Hata', page:'Sayfa açtı' };
const DIR = { right:'→ İstek', left:'← Geç', up:'↑ İzledim' };
// Olay verisi kullanıcı tarafından yazılır (log_events herkese açık): her alan esc() ya da sayıya çevrilir,
// beklenmeyen tür (dizi yerine metin vb.) satırı bozmasın diye evRows çağrıyı try ile sarar.
const num = v => Number.isFinite(+v) ? +v : 0;
const arr = v => Array.isArray(v) ? v.map(String) : [];
function evText(e) {
  const d = e.data && typeof e.data === 'object' ? e.data : {};
  switch (e.kind) {
    case 'swipe': return `${esc(DIR[d.dir] || d.dir)} · <b>${esc(d.title || d.key)}</b> <small>${esc(d.how || '')}</small>`;
    case 'undo': return `<b>${esc(d.title || d.key)}</b>`;
    case 'search': return `“${esc(d.q)}”`;
    case 'view': return esc(d.v);
    case 'open': return esc(d.sheet) + (d.title ? ` · <b>${esc(d.title)}</b>` : '');
    case 'episode': return `<b>${esc(d.title || d.key)}</b> ${d.next ? '+1 bölüm' : d.at ? `S${num(d.at.s)} B${num(d.at.e)}` : ''}`;
    case 'error': return `<b>${esc(d.msg)}</b> <small>${esc(d.src || '')}${d.line ? ':' + num(d.line) : ''}</small>`;
    case 'click': return `${esc(d.text || d.id || '')}${d.title ? ` · <b>${esc(d.title)}</b>` : ''} <small>${esc(Object.entries(d).filter(([k]) => !['text', 'title', 'key', 'id'].includes(k)).map(([k, v]) => k + '=' + (typeof v === 'object' ? JSON.stringify(v) : v)).join(' ').slice(0, 200))}</small>`;
    case 'page': return `<small>${esc(d.lang)} · ${num(d.w)}×${num(d.h)} · ${fmt(d.items)} öğe${d.ref ? ' · ' + esc(d.ref) : ''}</small>`;
    case 'signin': return esc(d.email || '');
    case 'filters': return esc([d.type, d.sort, arr(d.genres).join('/'), arr(d.periods).join('/'), arr(d.regions).join('/'),
      d.minRating ? '★' + num(d.minRating) + '+' : '', arr(d.providers).length ? arr(d.providers).length + ' platform' : ''].filter(Boolean).join(' · '));
    default: return `<small>${esc(JSON.stringify(d).slice(0, 220))}</small>`;
  }
}
function evRows(list, withWho = true) {
  if (!list.length) return '<p class="empty">Kayıt yok.</p>';
  return list.map(e => `<div class="ev"><time title="${esc(new Date(e.at).toLocaleString('tr-TR'))}">${esc(new Date(e.at).toLocaleString('tr-TR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }))}</time>
    <span class="k k-${esc(e.kind)}">${esc(KIND[e.kind] || e.kind)}</span>
    ${withWho ? `<span class="who" data-v="${esc(e.visitor)}" data-u="${esc(e.user_id || '')}" title="${esc(e.visitor)}">${e.email ? esc(e.email) : 'anonim · ' + esc(String(e.visitor).slice(0, 8))}</span>` : '<span></span>'}
    <span class="d">${(() => { try { return evText(e); } catch { return `<small>${esc(JSON.stringify(e.data).slice(0, 220))}</small>`; } })()}</span></div>`).join('');
}
document.addEventListener('click', e => {
  const w = e.target.closest('.who[data-v]');
  if (w) openPerson(w.dataset.u ? { user:w.dataset.u } : { visitor:w.dataset.v });
});

/* ---- Etkinlik akışı ---- */
let evTimer = null, evOldest = null;
async function loadEvents(reset) {
  const q = $('#evQ').value.trim() || null, kind = $('#evKind').value || null;
  if (reset) {
    evOldest = null;
    rpc('admin_event_kinds', { p_days:st.days }).then(ks => {
      const cur = $('#evKind').value;
      $('#evKind').innerHTML = '<option value="">Bütün türler</option>' + ks.map(k => `<option value="${esc(k.kind)}">${esc(KIND[k.kind] || k.kind)} (${fmt(k.count)})</option>`).join('');
      $('#evKind').value = cur;
      draw('cKinds', 'bar', ks.slice(0, 12).map(k => KIND[k.kind] || k.kind), [{ label:'Olay', data:ks.slice(0, 12).map(k => k.count), backgroundColor:COLORS.own }], {}, true);
    }).catch(() => {});
  }
  try {
    const rows = await rpc('admin_events', { p_kind:kind, p_q:q, p_limit:200, p_before:evOldest });
    if (rows.length) evOldest = rows.at(-1).at;
    $('#events').innerHTML = (reset ? '' : $('#events').innerHTML) + evRows(rows);
    $('#evMore').classList.toggle('hidden', rows.length < 200);
    $('#evMeta').textContent = 'en yeni üstte · kişiye tıkla: geçmişi';
  } catch (err) { $('#events').innerHTML = `<p class="err">${esc(err.message)}</p>`; }
}
$('#evQ').oninput = () => { clearTimeout(evTimer); evTimer = setTimeout(() => loadEvents(true), 350); };
$('#evKind').onchange = () => loadEvents(true);
$('#evMore').onclick = () => loadEvents(false);

/* ---- Ziyaretçiler ---- */
let visTimer = null;
async function loadVisitors() {
  const tb = $('#visitors tbody');
  try {
    const rows = await rpc('admin_visitors', { p_days:st.days, p_q:$('#visQ').value.trim() || null });
    tb.innerHTML = rows.map(v => `<tr class="click" data-vis="${esc(v.visitor)}" data-u="${esc(v.user_id || '')}">
      <td class="mono">${esc(String(v.visitor).slice(0, 8))}</td><td>${v.email ? esc(v.email) : '<span class="muted">anonim</span>'}</td>
      <td>${ago(v.first_at)}</td><td>${ago(v.last_at)}</td><td class="num">${fmt(v.visits)}</td><td>${secs(v.seconds)}</td>
      <td class="num">${fmt(v.events)}</td><td>${esc({ mobile:'Telefon', desktop:'Bilgisayar' }[v.device] || v.device || '—')}</td><td>${esc(v.lang || '—')}</td></tr>`).join('')
      || '<tr><td colspan="9" class="empty">Kayıt yok.</td></tr>';
    $('#visMeta').textContent = `${rows.length} ziyaretçi · girişsizler dahil · satıra tıkla: geçmişi`;
  } catch (err) { tb.innerHTML = `<tr><td colspan="9" class="err">${esc(err.message)}</td></tr>`; }
}
$('#visQ').oninput = () => { clearTimeout(visTimer); visTimer = setTimeout(loadVisitors, 350); };
$('#visitors').addEventListener('click', e => { const r = e.target.closest('[data-vis]'); if (r) openPerson(r.dataset.u && st.users.some(x => x.id === r.dataset.u) ? { user:r.dataset.u } : { visitor:r.dataset.vis }); });

/* ---- Hatalar ---- */
async function loadErrors() {
  try {
    const rows = await rpc('admin_errors', { p_days:7 });
    $('#errors').innerHTML = rows.length ? rows.map(r => `<div class="err-row"><b>${esc(r.message)}</b>
      <div class="muted">${fmt(r.count)} kez · ${fmt(r.visitors)} ziyaretçi · ${fmt(r.users)} hesap · ilk ${ago(r.first_at)}, son ${ago(r.last_at)}
      · ${esc(r.sample?.src || '')}${r.sample?.line ? ':' + num(r.sample.line) : ''} ${esc(r.sample?.path || '')}</div>
      ${r.sample?.stack ? `<pre>${esc(r.sample.stack)}</pre>` : ''}</div>`).join('') : '<p class="empty">Son 7 günde hata yok.</p>';
  } catch (err) { $('#errors').innerHTML = `<p class="err">${esc(err.message)}</p>`; }
}
async function loadErrorBadge() {
  const rows = await rpc('admin_errors', { p_days:1 }).catch(() => []);
  const n = rows.reduce((s, r) => s + +r.count, 0);
  $('#errBadge').textContent = n; $('#errBadge').classList.toggle('hidden', !n);
}

/* ---- Kişi çekmecesi: bir hesabın ya da anonim ziyaretçinin bütün geçmişi ---- */
async function openPerson({ user, visitor }) {
  const u = user && st.users.find(x => x.id === user);
  $('#drTitle').textContent = u ? u.email : 'Anonim ziyaretçi · ' + String(visitor).slice(0, 8);
  $('#drMeta').innerHTML = u ? `<div class="stats-line"><span>Kayıt ${date(u.created_at)}</span><span>Son giriş ${ago(u.last_sign_in_at)}</span><span>İstek ${fmt(u.want)} · İzledim ${fmt(u.watched)} · Geçtim ${fmt(u.passed)}</span><span>${u.is_admin ? 'Admin' : 'Kullanıcı'}</span><span>Anahtar: ${u.keys_saved ? 'şifreli' : '—'}</span></div>`
    : `<div class="stats-line"><span class="mono">${esc(visitor)}</span></div>`;
  $('#drEvents').innerHTML = '<p class="empty">Yükleniyor…</p>';
  ['#drTabs', '#drQ', '#drItems'].forEach(s => $(s).classList.add('hidden')); $('#drEvents').classList.remove('hidden');
  $('#drawer').classList.remove('hidden');
  try {
    let rows = await rpc('admin_events', user ? { p_user:user, p_limit:1000 } : { p_visitor:visitor, p_limit:1000 });
    // Hesabın kullandığı cihaz kimlikleri: girişten önceki (anonim) olayları da aynı listeye kat
    const vis = [...new Set(rows.map(r => r.visitor))];
    if (user && vis.length) {
      const more = await Promise.all(vis.slice(0, 5).map(v => rpc('admin_events', { p_visitor:v, p_limit:500 }).catch(() => [])));
      const seen = new Set(rows.map(r => r.id));
      more.flat().forEach(r => { if (!seen.has(r.id)) { seen.add(r.id); rows.push(r); } });
      rows.sort((x, y) => x.at < y.at ? 1 : -1);
    }
    const by = {}; rows.forEach(r => by[r.kind] = (by[r.kind] || 0) + 1);
    $('#drMeta').insertAdjacentHTML('beforeend', `<div class="stats-line">${Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<span><b>${fmt(n)}</b> ${esc(KIND[k] || k)}</span>`).join('')}</div>`
      + (user && vis.length ? `<div class="stats-line muted">Cihaz kimlikleri (girişsiz olaylar dahil): ${vis.map(v => `<span class="mono">${esc(String(v).slice(0, 8))}</span>`).join(' ')}</div>` : ''));
    $('#drEvents').innerHTML = evRows(rows, false);
  } catch (err) { $('#drEvents').innerHTML = `<p class="err">${esc(err.message)}</p>`; }
  if (user) loadPersonItems(user);
}
/* ---- Kişinin listeleri: İstek / İzledim / Geçtim ---- */
const LIST_TABS = [['events', 'Etkinlik'], ['want', 'İstek'], ['watched', 'İzledim'], ['passed', 'Geçtim']];
const PROG = { watching:'İzliyor', season:'Yeni sezon', dropped:'Bıraktı' };
let drItems = [], drTab = 'events';
async function loadPersonItems(user) {
  try { drItems = await rpc('admin_user_items', { p_user:user }); } catch (err) { drItems = []; }
  drTab = 'events'; $('#drQ').value = '';
  renderDrTabs();
}
function renderDrTabs() {
  const n = s => drItems.filter(i => i.status === s).length;
  $('#drTabs').innerHTML = LIST_TABS.map(([k, l]) => `<button data-dt="${k}" class="${k === drTab ? 'on' : ''}">${l}${k === 'events' ? '' : ` <small>${fmt(n(k))}</small>`}</button>`).join('');
  $('#drTabs').classList.remove('hidden');
  const list = drTab !== 'events';
  $('#drEvents').classList.toggle('hidden', list); $('#drItems').classList.toggle('hidden', !list); $('#drQ').classList.toggle('hidden', !list);
  if (!list) return;
  const q = $('#drQ').value.trim().toLocaleLowerCase('tr');
  const rows = drItems.filter(i => i.status === drTab && (!q || `${i.title} ${i.original_title}`.toLocaleLowerCase('tr').includes(q)));
  $('#drItems').innerHTML = rows.length ? rows.map(i => `<a class="it" href="https://www.themoviedb.org/${esc(i.type)}/${esc(String(i.key).split(':')[1])}" target="_blank" rel="noopener">
      ${i.poster ? `<img src="https://image.tmdb.org/t/p/w154${esc(i.poster)}" alt="" loading="lazy">` : '<span class="noimg"></span>'}
      <b>${esc(i.title || i.key)}</b><small>${esc((i.date || '').slice(0, 4))} · ${i.type === 'tv' ? 'Dizi' : 'Film'}${i.progress ? ' · ' + esc(PROG[i.progress] || i.progress) : ''}</small>
      <small>${i.added_at ? date(i.added_at) : ''}</small></a>`).join('') : '<p class="empty">Bu listede yapım yok.</p>';
}
$('#drTabs').onclick = e => { const b = e.target.closest('[data-dt]'); if (b) { drTab = b.dataset.dt; renderDrTabs(); } };
$('#drQ').oninput = () => renderDrTabs();
$('#drClose').onclick = () => $('#drawer').classList.add('hidden');
$('#drawer').onclick = e => { if (e.target.id === 'drawer') $('#drawer').classList.add('hidden'); };
document.addEventListener('keydown', e => { if (e.key === 'Escape') $('#drawer').classList.add('hidden'); });

/* ---- Olaylar ---- */
$('#days').addEventListener('click', e => {
  const b = e.target.closest('[data-d]');
  if (!b) return;
  st.days = +b.dataset.d;
  document.querySelectorAll('#days button').forEach(x => x.classList.toggle('on', x === b));
  load();
});
$('#refresh').onclick = () => load();
boot();
