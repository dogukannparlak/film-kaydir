'use strict';
// Alt gezinti: yüzen cam kapsül, etkin sekmenin arkasında kayan vurgu (parmakla sağa sola sürüklenebilir). Betik etiketinin yerine (önüne) yazılır; file:// ile de çalışır.
document.currentScript.insertAdjacentHTML('beforebegin', `
  <nav class="tabs" style="--i:0;--n:2">
    <span class="tab-ind" aria-hidden="true"></span>
    <button data-view="discover" aria-selected="true">
      <svg class="i" aria-hidden="true"><use href="#i-discover"/></svg>
      Keşfet
    </button>
    <button data-view="lists" aria-selected="false">
      <svg class="i" aria-hidden="true"><use href="#i-collection"/></svg>
      <span>Koleksiyonum<span class="dot hidden" id="navDot" title="İstek listesindekiler"></span></span>
    </button>
  </nav>
`);
