'use strict';
/* ================= Kartlar ================= */
function genreNames(type, ids) {
  const map = type === 'movie' ? MOVIE_G : TV_G;
  return ids.map(i => map[i]).filter(Boolean);
}
function createCard(it) {
  const el = document.createElement('article');
  el.className = 'card';
  el.dataset.key = it.key;
  const votes = it.votes >= 1000 ? (it.votes / 1000).toLocaleString('tr-TR', { maximumFractionDigits:1 }) + 'B' : it.votes;
  el.innerHTML = `
    <img class="poster" src="${IMG}w780${esc(it.poster)}" alt="" draggable="false" onerror="this.style.visibility='hidden'">
    <div class="shade"></div>
    <div class="stamp stamp-want">İSTİYORUM</div>
    <div class="stamp stamp-pass">GEÇ</div>
    <div class="stamp stamp-watched">İZLEDİM</div>
    <div class="info">
      <div class="meta">
        <span class="badge">${it.type === 'movie' ? 'FİLM' : 'DİZİ'}</span>
        ${yearOf(it.date) ? `<span>${yearOf(it.date)}</span>` : ''}
        <span class="rating">★ ${it.rating.toFixed(1)}</span><span class="votes">${votes} oy</span>
      </div>
      <h2 class="title">${esc(it.title)}</h2>
      <div class="genres">${esc(genreNames(it.type, it.genres).join(' · '))}</div>
      <div class="director">${directorHTML(it)}</div>
      <div class="scores">${scoresHTML(it)}</div>
      <p class="overview">${esc(it.overview || 'Özet yükleniyor…')}</p>
      <div class="more">Dokun: özetin tamamı</div>
    </div>`;
  attachDrag(el);
  return el;
}
