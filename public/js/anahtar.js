'use strict';
/* ================= Anahtar kutusu ================= */
function keyBoxHTML(msg) {
  return `<div class="keybox">
    <h2>TMDB anahtarını yapıştır</h2>
    <p>Film ve dizi verisi TMDB'den gelir. Ücretsiz anahtar 2 dakikada alınır.</p>
    <ol>
      <li><a href="https://www.themoviedb.org/signup" target="_blank" rel="noopener">TMDB'de hesap aç</a></li>
      <li><a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener">Ayarlar › API</a> sayfasından anahtar iste</li>
      <li>"API Anahtarı" ya da "API Okuma Erişim Jetonu"nu aşağı yapıştır</li>
    </ol>
    <input class="field" id="keyInput" type="password" placeholder="API anahtarı" autocomplete="off">
    <div class="row-btns"><button class="btn btn-primary" id="btnSaveKey" style="flex:1">Kaydet ve başla</button></div>
    <div class="err" id="keyErr">${esc(msg || '')}</div>
    <p class="note">Anahtar yalnız bu tarayıcıda saklanır.</p>
  </div>`;
}
function bindKeyBox() {
  const save = () => saveKey($('#keyInput').value, $('#keyErr'));
  $('#btnSaveKey').onclick = save;
  $('#keyInput').onkeydown = e => { if (e.key === 'Enter') save(); };
}
async function saveKey(raw, errEl) {
  const key = raw.trim();
  if (!key) { errEl.textContent = 'Anahtar boş.'; return; }
  const old = S.apiKey;
  S.apiKey = key;
  errEl.textContent = 'Kontrol ediliyor…';
  try {
    await tmdb('/configuration');
  } catch (e) {
    S.apiKey = old;
    errEl.textContent = e instanceof AuthError ? 'Anahtar geçersiz.' : 'TMDB\'ye ulaşılamadı: ' + e.message;
    return;
  }
  store.set(K.key, key); stateChanged();
  errEl.textContent = '';
  closeSheet();
  toast('Anahtar kaydedildi');
  loadProviders();
  resetEngine();
}

async function saveOmdb() {
  const key = $('#setOmdb').value.trim(), err = $('#omdbErr');
  if (!key) { err.textContent = 'Anahtar boş.'; return; }
  err.textContent = 'Kontrol ediliyor…';
  try {
    const d = await (await fetch(`https://www.omdbapi.com/?apikey=${encodeURIComponent(key)}&i=tt0111161`)).json();
    if (d.Response === 'False') { err.textContent = 'OMDb: ' + (d.Error || 'anahtar geçersiz'); return; }
  } catch (e) { err.textContent = 'OMDb\'ye ulaşılamadı.'; return; }
  S.omdbKey = key; store.set(K.omdb, key); omdbWarned = false; stateChanged();
  err.textContent = '';
  toast('OMDb anahtarı kaydedildi');
  S.queue.slice(0, 2).forEach(it => loadScores(it).then(() => refreshScores(it)));
}
