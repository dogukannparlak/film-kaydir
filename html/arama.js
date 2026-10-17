'use strict';
// Arama alt sayfası: TMDB'de film/dizi/kişi arar, sonuçlar listelere eklenir (içeriği js/arama.js çizer). Betik etiketinin yerine (önüne) yazılır; file:// ile de çalışır.
document.currentScript.insertAdjacentHTML('beforebegin', `
<div class="sheet sheet-tall" id="sheetSearch" role="dialog" aria-label="Ara">
  <div class="grip"></div>
  <div class="sheet-head"><h2>Ara</h2><button class="icon-btn" data-close aria-label="Kapat">✕</button></div>
  <div class="search-top">
    <label class="lsearch-box">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
      <input class="lsearch" id="sq" type="search" placeholder="Film, dizi ya da yönetmen/oyuncu adı…" autocomplete="off" enterkeyhint="search">
    </label>
    <div class="note search-hint" id="sHint">Kaydırmadan bulmak istediğin yapımı yaz, listene ekle. Kişi adı yazarsan bilinen işleri gelir.</div>
  </div>
  <ul class="list sheet-list" id="sResults"></ul>
</div>
`);
