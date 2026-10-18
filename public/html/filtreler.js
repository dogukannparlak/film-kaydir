'use strict';
// Filtreler alt sayfası (içeriği js/filtreler.js çizer). Betik etiketinin yerine (önüne) yazılır; file:// ile de çalışır.
document.currentScript.insertAdjacentHTML('beforebegin', `
<div class="sheet" id="sheetFilters" role="dialog" aria-label="Filtreler">
  <div class="grip"></div>
  <div class="sheet-head"><h2>Filtreler</h2><button class="icon-btn" data-close aria-label="Kapat"><svg class="i" aria-hidden="true"><use href="#i-close"/></svg></button></div>
  <div class="sheet-body" id="filterBody"></div>
  <div class="sheet-foot"><button class="btn" id="btnResetFilters">Sıfırla</button><button class="btn btn-primary" id="btnApplyFilters">Uygula</button></div>
</div>
`);
