'use strict';
// İlk açılış rehberi: adım adım tanıtım. Betik etiketinin yerine (önüne) yazılır; file:// ile de çalışır.
document.currentScript.insertAdjacentHTML('beforebegin', `
<div class="guide hidden" id="guide" role="dialog" aria-modal="true" aria-label="Rehber">
  <div class="guide-card">
    <button class="guide-skip" id="guideSkip">Geç</button>
    <div class="guide-body" id="guideBody"></div>
    <div class="guide-dots" id="guideDots"></div>
    <div class="row-btns"><button class="btn" id="guideBack">Geri</button><button class="btn btn-primary" id="guideNext" style="flex:1">İleri</button></div>
  </div>
</div>
`);
