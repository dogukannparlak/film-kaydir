'use strict';
// Alt gezinti: yüzen cam kapsül, etkin sekmenin arkasında kayan vurgu (parmakla sağa sola sürüklenebilir). Betik etiketinin yerine (önüne) yazılır; file:// ile de çalışır.
document.currentScript.insertAdjacentHTML('beforebegin', `
  <nav class="tabs" style="--i:0">
    <span class="tab-ind" aria-hidden="true"></span>
    <button data-view="discover" aria-selected="true">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="3"/><path d="M2 7v10M22 7v10" stroke-linecap="round"/></svg>
      Keşfet
    </button>
    <button data-view="lists" aria-selected="false">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/></svg>
      <span>Koleksiyonum<span class="dot hidden" id="navDot" title="İstek listesindekiler"></span></span>
    </button>
  </nav>
`);
