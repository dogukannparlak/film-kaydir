'use strict';
// Arama alt sayfası: TMDB'de film/dizi/kişi arar, sonuçlar listelere eklenir (içeriği js/arama.js çizer). Betik etiketinin yerine (önüne) yazılır; file:// ile de çalışır.
document.currentScript.insertAdjacentHTML('beforebegin', `
<div class="sheet sheet-tall" id="sheetSearch" role="dialog" aria-label="Ara">
  <div class="grip"></div>
  <div class="sheet-head"><h2>Ara</h2><button class="icon-btn" data-close aria-label="Kapat"><svg class="i" aria-hidden="true"><use href="#i-close"/></svg></button></div>
  <div class="search-top">
    <label class="lsearch-box">
      <svg class="i" aria-hidden="true"><use href="#i-search"/></svg>
      <input class="lsearch" id="sq" type="search" placeholder="Film, dizi ya da yönetmen/oyuncu adı…" autocomplete="off" enterkeyhint="search">
    </label>
    <div class="note search-hint" id="sHint">Kaydırmadan bulmak istediğin yapımı yaz, listene ekle. Kişi adı yazarsan bilinen işleri gelir.</div>
  </div>
  <ul class="list sheet-list" id="sResults"></ul>
</div>
`);
