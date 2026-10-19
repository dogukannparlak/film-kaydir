'use strict';
// Yönetim paneli alt sayfası: ziyaret ve hesap istatistikleri, yalnız admin hesaba görünür (içeriği js/admin.js çizer). Betik etiketinin yerine (önüne) yazılır.
document.currentScript.insertAdjacentHTML('beforebegin', `
<div class="sheet sheet-tall" id="sheetAdmin" role="dialog" aria-label="Yönetim paneli">
  <div class="grip"></div>
  <div class="sheet-head"><h2>Yönetim</h2><button class="icon-btn" data-close aria-label="Kapat"><svg class="i" aria-hidden="true"><use href="#i-close"/></svg></button></div>
  <div class="sheet-body" id="adminBody"></div>
</div>
`);
