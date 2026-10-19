'use strict';
/* ================= Yönetim sayfası (admin.html) ================= */
// Siteden bağımsız tek dosya. Oturum sitenin Supabase oturumudur (aynı alan adı, aynı localStorage).
// Veri kaynakları:
// - Supabase RPC (yalnız admin): admin_stats (kendi sayaç), admin_users, admin_delete_user, admin_db
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
  umami: `<b>Umami bağlı değil.</b> cloud.umami.is › Settings › API keys › Create key; anahtarı Cloudflare'de <code>UMAMI_API_KEY</code> (Secret) olarak ekle.`,
};
const st = { days:30, token:null, charts:{}, armed:null };

/* ---- Oturum ---- */
async function boot() {
  const { data:{ session } } = await sb.auth.getSession();
  if (!session) return showLogin();
  st.token = session.access_token;
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
  const [own, users, db, cf, um] = await Promise.allSettled([
    rpc('admin_stats', { p_days:st.days }), rpc('admin_users'), rpc('admin_db'), api('cloudflare'), api('umami'),
  ]);
  const v = r => r.status === 'fulfilled' ? r.value : null;
  const D = { own:v(own), users:v(users), db:v(db), cf:v(cf), um:v(um) };
  renderSources(own, cf, um);
  renderKpis(D); renderCharts(D); renderTops(D); renderUsers(D.users, users); renderDb(D.db);
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
  const parts = [chip('Kendi sayaç (Supabase)', own, ''), chip('Cloudflare', cf, SETUP.cloudflare), chip('Umami', um, SETUP.umami)];
  $('#sources').innerHTML = parts.map(p => p[0]).join('') + parts.map(p => p[1]).join('');
}

/* ---- Özet kutuları ---- */
function renderKpis({ own, users, cf, um }) {
  const k = (label, value, sub = '', color = '') => `<div class="kpi"><small>${color ? `<i style="background:${color}"></i>` : ''}${label}</small><b>${value}</b>${sub ? `<span class="sub">${sub}</span>` : ''}</div>`;
  const sum = (a, f) => (a || []).reduce((s, x) => s + (x[f] || 0), 0);
  const out = [];
  if (own) out.push(
    k('Şu an sitede', fmt(own.online), 'son 90 sn · kendi sayaç', COLORS.own),
    k('Ziyaretçi', fmt(own.visitors), `${fmt(own.returning)} geri dönen`, COLORS.own),
    k('Ziyaret', fmt(own.visits), `girişli %${fmt(own.logged_in_share)}`, COLORS.own),
    k('Ort. kalma', secs(own.avg_secs), 'ortanca ' + secs(own.median_secs), COLORS.own));
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
function draw(id, type, labels, datasets, extraScales = {}) {
  st.charts[id]?.destroy();
  const ticks = { color:'#8b93a7', maxRotation:0, autoSkipPadding:14 }, grid = { color:'#252b38' };
  st.charts[id] = new Chart(document.getElementById(id), {
    type, data:{ labels:labels.map(d => d.slice(5).replace('-', '.')), datasets },
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
function renderUsers(users, r) {
  const tb = $('#users tbody');
  if (!users) { tb.innerHTML = `<tr><td colspan="7" class="err">${esc(r.reason?.message || 'alınamadı')}</td></tr>`; return; }
  $('#usersMeta').textContent = `${users.length} hesap`;
  tb.innerHTML = users.map(u => `<tr>
    <td>${esc(u.email)}${u.is_admin ? '<span class="tag adm">admin</span>' : ''}${u.confirmed ? '' : '<span class="tag">onaysız</span>'}</td>
    <td>${date(u.created_at)}</td><td>${ago(u.last_sign_in_at)}</td><td class="num">${fmt(u.items)}</td><td>${ago(u.last_change)}</td>
    <td>${u.keys_saved ? 'şifreli' : '—'}</td>
    <td>${u.is_admin ? '' : `<button class="btn sm danger" data-del="${esc(u.id)}" data-email="${esc(u.email)}">Sil</button>`}</td></tr>`).join('');
}
$('#users').addEventListener('click', async e => {
  const b = e.target.closest('[data-del]');
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
function alertBox(msg) { $('#sources').insertAdjacentHTML('afterbegin', `<div class="setup">${esc(msg)}</div>`); }

/* ---- Veritabanı ---- */
function renderDb(db) {
  if (!db) { $('#db').innerHTML = '<p class="empty">Alınamadı</p>'; return; }
  $('#db').innerHTML = `<p class="dbsize">${bytes(db.db_bytes)} <small class="muted" style="font-size:13px;font-weight:500">/ 500 MB ücretsiz</small></p>
    <table><thead><tr><th>Tablo</th><th>Satır (yaklaşık)</th><th>Boyut</th></tr></thead><tbody>
    ${(db.tables || []).map(t => `<tr><td>${esc(t.name)}</td><td class="num">${fmt(Math.max(0, t.rows))}</td><td class="num">${bytes(t.bytes)}</td></tr>`).join('')}</tbody></table>`;
}

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
