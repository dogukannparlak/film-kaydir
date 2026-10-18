'use strict';
// Keşfet görünümü: özet satırı, deste, eylem düğmeleri. Betik etiketinin yerine (önüne) yazılır; file:// ile de çalışır.
document.currentScript.insertAdjacentHTML('beforebegin', `
  <!-- KEŞFET -->
  <section class="view active" id="viewDiscover">
    <button class="summary" id="summary"></button>
    <div class="deck-wrap"><div id="deck"></div></div>
    <div class="actions" id="actions">
      <button class="act act-sm act-undo" id="btnUndo" aria-label="Geri al (Backspace)" title="Geri al" disabled>
        <svg class="i" aria-hidden="true"><use href="#i-undo"/></svg>
      </button>
      <button class="act act-lg act-pass" data-dir="left" aria-label="Geç (sol ok)" title="Geç">
        <svg class="i" aria-hidden="true"><use href="#i-pass"/></svg>
      </button>
      <button class="act act-md act-watched" data-dir="up" aria-label="İzledim (yukarı ok)" title="İzledim">
        <svg class="i" aria-hidden="true"><use href="#i-watched"/></svg>
      </button>
      <button class="act act-lg act-want" data-dir="right" aria-label="İzlemek istiyorum (sağ ok)" title="İstiyorum">
        <svg class="i" aria-hidden="true"><use href="#i-want"/></svg>
      </button>
    </div>
  </section>
`);
