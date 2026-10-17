'use strict';
// Listeler görünümü: sekmeler, arama, filtreler, sıralama, yedek. Betik etiketinin yerine (önüne) yazılır; file:// ile de çalışır.
document.currentScript.insertAdjacentHTML('beforebegin', `
  <!-- LİSTELER -->
  <section class="view" id="viewLists">
    <div class="seg" role="tablist" id="listTabs">
      <button role="tab" data-tab="want" aria-selected="true">İstek <small id="cWant">0</small></button>
      <button role="tab" data-tab="watched" aria-selected="false">İzlediklerim <small id="cWatched">0</small></button>
      <button role="tab" data-tab="passed" aria-selected="false">Geçtiklerim <small id="cPassed">0</small></button>
    </div>
    <div class="lsearch-wrap"><input class="lsearch" id="lq" type="search" placeholder="Listede ara…" autocomplete="off"></div>
    <div class="lfilters">
      <select id="lType" aria-label="İçerik türü"><option value="all">Film + Dizi</option><option value="movie">Film</option><option value="tv">Dizi</option></select>
      <select id="lGenre" aria-label="Tür"></select>
      <select id="lPeriod" aria-label="Dönem"></select>
      <select id="lSort" aria-label="Sıralama"><option value="added">Son eklenen</option><option value="imdb">IMDb puanı</option><option value="rt">Rotten Tomatoes</option><option value="tmdb">TMDB puanı</option></select>
      <select id="lProgress" class="lprogress" aria-label="İzleme durumu"><option value="all">Hepsi (biten + yarım)</option><option value="done">Yalnız bitenler</option><option value="partial">Yalnız yarım kalanlar</option><option value="season">Yeni sezon bekleyenler</option><option value="dropped">Bıraktıklarım</option></select>
    </div>
    <div class="ltools">
      <button class="btn" id="btnExport">⬇︎ Dışa aktar (JSON)</button>
      <button class="btn" id="btnImport">⬆︎ İçe aktar</button>
      <input type="file" id="fileImport" accept="application/json,.json" class="hidden">
    </div>
    <ul class="list" id="list"></ul>
  </section>
`);
