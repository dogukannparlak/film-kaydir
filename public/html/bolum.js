'use strict';
// Bölüm seçici alt sayfası: dizide kaldığın sezon ve bölümü işaretler (içeriği js/bolumler.js çizer). Betik etiketinin yerine (önüne) yazılır; file:// ile de çalışır.
document.currentScript.insertAdjacentHTML('beforebegin', `
<div class="sheet" id="sheetEpisode" role="dialog" aria-label="Kaldığın bölüm">
  <div class="grip"></div>
  <div class="sheet-head"><h2 id="epTitle">Kaldığın bölüm</h2><button class="icon-btn" data-close aria-label="Kapat"><svg class="i" aria-hidden="true"><use href="#i-close"/></svg></button></div>
  <div class="sheet-body" id="epBody"></div>
</div>
`);
