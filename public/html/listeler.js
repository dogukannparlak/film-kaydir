'use strict';
// Listeler görünümü: sekmeler, arama + sıralama, kaydırılabilir süzgeç satırı, liste. Betik etiketinin yerine (önüne) yazılır; file:// ile de çalışır.
document.currentScript.insertAdjacentHTML('beforebegin', `
  <!-- LİSTELER -->
  <section class="view" id="viewLists">
    <div class="seg" role="tablist" id="listTabs" style="--i:0;--n:4">
      <span class="tab-ind" aria-hidden="true"></span>
      <button role="tab" data-tab="want" aria-selected="true"><i class="seg-dot"></i>İstek <small id="cWant">0</small></button>
      <button role="tab" data-tab="watched" aria-selected="false"><i class="seg-dot"></i>İzledim <small id="cWatched">0</small></button>
      <button role="tab" data-tab="passed" aria-selected="false"><i class="seg-dot"></i>Geçtim <small id="cPassed">0</small></button>
      <button role="tab" data-tab="series" aria-selected="false"><i class="seg-dot"></i>Seriler <small id="cSeries">0</small></button>
    </div>
    <div class="lsearch-wrap">
      <label class="lsearch-box">
        <svg class="i" aria-hidden="true"><use href="#i-search"/></svg>
        <input class="lsearch" id="lq" type="search" placeholder="Listede ara…" autocomplete="off">
      </label>
      <label class="lsort" title="Sıralama">
        <svg class="i" aria-hidden="true"><use href="#i-sort"/></svg>
        <select id="lSort" aria-label="Sıralama"><option value="added">Son eklenen</option><option value="imdb">IMDb</option><option value="rt">Rotten Tomatoes</option><option value="tmdb">TMDB</option></select>
      </label>
    </div>
    <div class="lfilters">
      <select id="lProgress" aria-label="İzleme durumu"><option value="all">Hepsi</option><option value="done">Bitenler</option><option value="watching">İzliyorum</option><option value="partial">Yarım kalanlar</option><option value="season">Yeni sezon</option><option value="dropped">Bıraktıklarım</option></select>
      <select id="lType" aria-label="İçerik türü"><option value="all">Film + Dizi</option><option value="movie">Film</option><option value="tv">Dizi</option></select>
      <select id="lGenre" aria-label="Tür"></select>
      <select id="lPeriod" aria-label="Dönem"></select>
    </div>
    <div class="lcount" id="lCount"></div>
    <ul class="list" id="list"></ul>
  </section>
`);
