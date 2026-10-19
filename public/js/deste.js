'use strict';
const preloaded = new Set();
function preload(it) {
  if (preloaded.has(it.key)) return;
  preloaded.add(it.key);
  new Image().src = IMG + 'w780' + it.poster;
}

function renderDeck(keyMsg) {
  const deck = $('#deck');
  $('#actions').classList.toggle('hidden', !tmdbReady());
  if (!tmdbReady()) { deck.innerHTML = keyBoxHTML(keyMsg ?? S.keyMsg); bindKeyBox(); return; }
  $('.keybox', deck)?.remove();
  const top = S.queue.slice(0, 3);
  setAmbient(top[0]?.poster);
  const live = $$('.card:not(.leaving)', deck);
  live.forEach(el => { if (!top.some(t => t.key === el.dataset.key)) el.remove(); });
  top.forEach((it, i) => {
    let el = $(keySel(it.key) + ':not(.leaving)', deck);
    if (!el) { el = createCard(it); el.classList.add('enter'); deck.appendChild(el); }
    if (el.dataset.depth !== String(i)) { el.dataset.depth = i; if (i === 0) el.classList.remove('enter'); }
    el.style.zIndex = 10 - i;
    if (i < 2) ensureExtra(it);
  });
  S.queue.slice(0, 6).forEach(preload);
  updateDeckStatus();
  $$('.act[data-dir]').forEach(b => b.disabled = !S.queue.length);
  if (S.queue.length < PREFETCH_AT) fetchMore();
}
function updateDeckStatus() {
  const deck = $('#deck');
  let st = $('.deck-status', deck);
  if (!tmdbReady() || S.queue.length) { st?.remove(); return; }
  if (!st) { st = document.createElement('div'); st.className = 'deck-status'; deck.prepend(st); }
  if (E.loading) st.innerHTML = '<div class="spinner"></div><div>' + t('Yükleniyor…') + '</div>';
  else if (E.error) st.innerHTML = `<div>${t('Bağlantı hatası:')} ${esc(E.error.message)}</div><button class="btn btn-primary" data-retry>${t('Tekrar dene')}</button>`;
  else if (E.exhausted) st.innerHTML = `<div class="empty-icon">${ico('popcorn')}</div><div>${t('Bu filtrelerle gösterilecek yeni içerik kalmadı.')}</div><button class="btn btn-primary" data-open-filters>${t('Filtreleri değiştir')}</button>`;
  else st.innerHTML = '<div class="spinner"></div>';
}
// Cam görünümü: üstteki kartın afişi sayfanın arkasında bulanık yansır (değişince yumuşak geçiş)
let ambientPoster = null;
function setAmbient(poster) {
  if (poster === ambientPoster) return;
  ambientPoster = poster;
  const el = $('#ambient');
  if (!el) return;
  el.style.opacity = '0';
  setTimeout(() => {
    el.style.backgroundImage = poster ? `url("${IMG}w300${encodeURI(poster)}")` : '';
    el.style.opacity = '';
  }, poster ? 200 : 0);
}
