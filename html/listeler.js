'use strict';
// Listeler görünümü: sekmeler, arama + sıralama, kaydırılabilir süzgeç satırı, liste. Betik etiketinin yerine (önüne) yazılır; file:// ile de çalışır.
document.currentScript.insertAdjacentHTML('beforebegin', `
  <!-- LİSTELER -->
  <section class="view" id="viewLists">
    <div class="seg" role="tablist" id="listTabs">
      <button role="tab" data-tab="want" aria-selected="true"><i class="seg-dot"></i>İstek <small id="cWant">0</small></button>
      <button role="tab" data-tab="watched" aria-selected="false"><i class="seg-dot"></i>İzledim <small id="cWatched">0</small></button>
      <button role="tab" data-tab="passed" aria-selected="false"><i class="seg-dot"></i>Geçtim <small id="cPassed">0</small></button>
    </div>
    <div class="lsearch-wrap">
      <label class="lsearch-box">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
        <input class="lsearch" id="lq" type="search" placeholder="Listede ara…" autocomplete="off">
      </label>
      <label class="lsort" title="Sıralama">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4"/></svg>
        <select id="lSort" aria-label="Sıralama"><option value="added">Son eklenen</option><option value="imdb">IMDb</option><option value="rt">Rotten Tomatoes</option><option value="tmdb">TMDB</option></select>
      </label>
    </div>
    <div class="lfilters">
      <select id="lProgress" aria-label="İzleme durumu"><option value="all">Biten + yarım</option><option value="done">Bitenler</option><option value="partial">Yarım kalanlar</option><option value="season">Yeni sezon</option><option value="dropped">Bıraktıklarım</option></select>
      <select id="lType" aria-label="İçerik türü"><option value="all">Film + Dizi</option><option value="movie">Film</option><option value="tv">Dizi</option></select>
      <select id="lGenre" aria-label="Tür"></select>
      <select id="lPeriod" aria-label="Dönem"></select>
    </div>
    <div class="lcount" id="lCount"></div>
    <ul class="list" id="list"></ul>
  </section>
`);
