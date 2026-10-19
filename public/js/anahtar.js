'use strict';
/* ================= Anahtar kutusu ================= */
function keyBoxHTML(msg) {
  return `<div class="keybox">
    <h2>${t('TMDB anahtarını yapıştır')}</h2>
    <p>${t('Film ve dizi verisi TMDB\'den gelir. Ücretsiz anahtar 2 dakikada alınır.')}</p>
    <ol>
      <li><a href="https://www.themoviedb.org/signup" target="_blank" rel="noopener">${t('TMDB\'de hesap aç')}</a></li>
      <li>${t('{link} sayfasından anahtar iste', { link: `<a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener">${t('Ayarlar › API')}</a>` })}</li>
      <li>${t('"API Anahtarı" ya da "API Okuma Erişim Jetonu"nu aşağı yapıştır')}</li>
    </ol>
    <input class="field" id="keyInput" type="password" placeholder="${t('API anahtarı')}" autocomplete="off">
    <div class="row-btns"><button class="btn btn-primary" id="btnSaveKey" style="flex:1">${t('Kaydet ve başla')}</button></div>
    <div class="err" id="keyErr">${esc(msg || '')}</div>
    <p class="note">${t('Anahtar bu tarayıcıda saklanır; istersen hesabında şifreli de saklanır (Ayarlar).')}</p>
    ${S.user ? '' : `<button class="linkish" id="btnKeyLogin">${t('Hesabın var mı? Giriş yap, anahtarın gelsin')}</button>`}
  </div>`;
}
function bindKeyBox() {
  const save = () => saveKey($('#keyInput').value, $('#keyErr'));
  $('#btnSaveKey').onclick = save;
  $('#keyInput').onkeydown = e => { if (e.key === 'Enter') save(); };
  const login = $('#btnKeyLogin'); if (login) login.onclick = () => openAccount();
}
async function saveKey(raw, errEl) {
  const key = raw.trim();
  if (!key) { errEl.textContent = t('Anahtar boş.'); return; }
  const old = S.apiKey;
  S.apiKey = key;
  errEl.textContent = t('Kontrol ediliyor…');
  try {
    await tmdb('/configuration');
  } catch (e) {
    S.apiKey = old;
    errEl.textContent = e instanceof AuthError ? t('Anahtar geçersiz.') : t('TMDB\'ye ulaşılamadı: {m}', { m: e.message });
    return;
  }
  store.set(K.key, key); stateChanged();
  errEl.textContent = '';
  closeSheet();
  toast(t('Anahtar kaydedildi'));
  loadProviders();
  resetEngine();
}

async function saveOmdb() {
  const key = $('#setOmdb').value.trim(), err = $('#omdbErr');
  if (!key) { err.textContent = t('Anahtar boş.'); return; }
  err.textContent = t('Kontrol ediliyor…');
  try {
    const d = await (await fetch(`https://www.omdbapi.com/?apikey=${encodeURIComponent(key)}&i=tt0111161`)).json();
    if (d.Response === 'False') { err.textContent = t('OMDb: {m}', { m: d.Error || t('anahtar geçersiz') }); return; }
  } catch (e) { err.textContent = t('OMDb\'ye ulaşılamadı.'); return; }
  S.omdbKey = key; store.set(K.omdb, key); omdbWarned = false; stateChanged();
  err.textContent = '';
  toast(t('OMDb anahtarı kaydedildi'));
  S.queue.slice(0, 2).forEach(it => loadScores(it).then(() => refreshScores(it)));
}
