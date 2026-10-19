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
  const votes = it.votes >= 1000 ? (it.votes / 1000).toLocaleString(LOCALE, { maximumFractionDigits:1 }) + t('B') : it.votes;
  el.innerHTML = `
    <img class="poster" src="${IMG}w780${esc(it.poster)}" alt="" draggable="false">
    <div class="shade"></div>
    <div class="stamp stamp-want">${t('İSTİYORUM')}</div>
    <div class="stamp stamp-pass">${t('GEÇ')}</div>
    <div class="stamp stamp-watched">${t('İZLEDİM')}</div>
    <div class="coll-tag-wrap">${collTagHTML(it)}</div>
    <div class="info">
      <div class="meta">
        <span class="badge">${it.type === 'movie' ? t('FİLM') : t('DİZİ')}</span>
        ${yearOf(it.date) ? `<span>${yearOf(it.date)}</span>` : ''}
        <span class="rating">★ ${it.rating.toFixed(1)}</span><span class="votes">${t('{n} oy', { n:votes })}</span>
      </div>
      <h2 class="title">${esc(titles(it).main)}</h2>
      ${titles(it).sub ? `<div class="title-sub">${esc(titles(it).sub)}</div>` : ''}
      <div class="genres">${esc(genreNames(it.type, it.genres).join(' · '))}</div>
      <div class="director">${directorHTML(it)}</div>
      <div class="scores">${scoresHTML(it)}</div>
      <p class="overview">${esc(it.overview || t('Özet yükleniyor…'))}</p>
      <div class="more">${t('Dokun: özetin tamamı')}</div>
    </div>`;
  // Satır içi onerror yerine dinleyici: güvenlik başlığı (CSP) satır içi betiğe izin vermez
  $('.poster', el).addEventListener('error', e => { e.target.style.visibility = 'hidden'; });
  attachDrag(el);
  return el;
}
