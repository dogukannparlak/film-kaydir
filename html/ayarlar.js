'use strict';
// Ayarlar alt sayfası: anahtarlar, görülenler, kısayollar. Betik etiketinin yerine (önüne) yazılır; file:// ile de çalışır.
document.currentScript.insertAdjacentHTML('beforebegin', `
<div class="sheet" id="sheetSettings" role="dialog" aria-label="Ayarlar">
  <div class="grip"></div>
  <div class="sheet-head"><h2>Ayarlar</h2><button class="icon-btn" data-close aria-label="Kapat">✕</button></div>
  <div class="sheet-body">
    <section>
      <h3>TMDB API anahtarı</h3>
      <input class="field" id="setKey" type="password" placeholder="API anahtarı ya da okuma erişim jetonu" autocomplete="off">
      <div class="row-btns"><button class="btn btn-primary" id="btnSaveKey2">Kaydet</button><button class="btn btn-danger" id="btnDelKey">Anahtarı sil</button></div>
      <div class="err" id="setKeyErr"></div>
      <p class="note">Anahtar yalnız bu tarayıcıda (localStorage) saklanır.</p>
    </section>
    <section>
      <h3>OMDb anahtarı <small>isteğe bağlı · IMDb, RT, Metacritic puanı</small></h3>
      <input class="field" id="setOmdb" type="password" placeholder="OMDb API anahtarı" autocomplete="off">
      <div class="row-btns"><button class="btn btn-primary" id="btnSaveOmdb">Kaydet</button><button class="btn btn-danger" id="btnDelOmdb">Sil</button></div>
      <div class="err" id="omdbErr"></div>
      <p class="note">Ücretsiz anahtar: <a href="https://www.omdbapi.com/apikey.aspx" target="_blank" rel="noopener">omdbapi.com/apikey.aspx</a> (FREE, günde 1000 istek). Anahtarsız da IMDb bağlantısı görünür.</p>
    </section>
    <section>
      <h3>Görülenler <small id="seenCount"></small></h3>
      <p class="note" style="margin:0 0 10px">Kaydırdığın içerik bir daha çıkmaz. Listeden sildiklerin de görüldü sayılır. Sıfırlarsan listelerde olmayanlar yeniden çıkabilir.</p>
      <button class="btn btn-danger" id="btnResetSeen">Görülenleri sıfırla</button>
    </section>
    <section>
      <h3>Kısayollar</h3>
      <p class="note" style="margin:0">→ istiyorum · ← geç · ↑ izledim · Backspace / Z geri al · Kartın üstüne dokun: özetin tamamı</p>
    </section>
    <section>
      <p class="note" style="margin:0">Veriler ve afişler <a href="https://www.themoviedb.org" target="_blank" rel="noopener">TMDB</a>'den gelir. Platform bilgisi TMDB'nin JustWatch kaynaklı Türkiye verisidir.<br>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
    </section>
  </div>
</div>
`);
