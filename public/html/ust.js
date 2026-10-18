'use strict';
// Üst çubuk: marka, filtre ve ayar düğmeleri. Betik etiketinin yerine (önüne) yazılır; file:// ile de çalışır.
document.currentScript.insertAdjacentHTML('beforebegin', `
  <header>
    <div class="brand"><img class="brand-logo" src="icons/logo.svg" alt="" width="28" height="28"><span>Kaydır</span></div>
    <button class="icon-btn" id="btnSearch" aria-label="Ara (/)" title="Ara (/)">
      <svg class="i" aria-hidden="true"><use href="#i-search"/></svg>
    </button>
    <button class="icon-btn" id="btnFilters" aria-label="Filtreler">
      <svg class="i" aria-hidden="true"><use href="#i-filter"/></svg>
      <span class="dot hidden" id="filterDot"></span>
    </button>
    <button class="icon-btn" id="btnSettings" aria-label="Ayarlar">
      <svg class="i" aria-hidden="true"><use href="#i-settings"/></svg>
    </button>
  </header>
`);
