'use strict';
// Keşfet görünümü: özet satırı, deste, eylem düğmeleri. Betik etiketinin yerine (önüne) yazılır; file:// ile de çalışır.
document.currentScript.insertAdjacentHTML('beforebegin', `
  <!-- KEŞFET -->
  <section class="view active" id="viewDiscover">
    <button class="summary" id="summary"></button>
    <div class="deck-wrap"><div id="deck"></div></div>
    <div class="actions" id="actions">
      <button class="act act-sm act-undo" id="btnUndo" aria-label="Geri al (Backspace)" title="Geri al" disabled>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>
      </button>
      <button class="act act-lg act-pass" data-dir="left" aria-label="Geç (sol ok)" title="Geç">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
      <button class="act act-md act-watched" data-dir="up" aria-label="İzledim (yukarı ok)" title="İzledim">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>
      </button>
      <button class="act act-lg act-want" data-dir="right" aria-label="İzlemek istiyorum (sağ ok)" title="İstiyorum">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7.5-4.6-9.3-9.6C1.5 7.9 3.7 4.5 7.2 4.5c2 0 3.6 1.1 4.8 2.7 1.2-1.6 2.8-2.7 4.8-2.7 3.5 0 5.7 3.4 4.5 6.9C19.5 16.4 12 21 12 21z"/></svg>
      </button>
    </div>
  </section>
`);
