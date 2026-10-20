'use strict';
// Ayarlar alt sayfası: anahtarlar, görülenler, kısayollar. Betik etiketinin yerine (önüne) yazılır; file:// ile de çalışır.
document.currentScript.insertAdjacentHTML('beforebegin', `
<div class="sheet" id="sheetSettings" role="dialog" aria-label="Ayarlar">
  <div class="grip"></div>
  <div class="sheet-head"><h2>Ayarlar</h2><button class="icon-btn" data-close aria-label="Kapat"><svg class="i" aria-hidden="true"><use href="#i-close"/></svg></button></div>
  <div class="sheet-body">
    <section>
      <h3>Hesap</h3>
      <div id="accBox"></div>
    </section>
    <section class="guest-only guest-card">
      <h3>Hesapla açılanlar</h3>
      <ul class="note guest-list"><li>Listelerin kalıcı olur, telefon ve bilgisayarda aynı görünür</li><li>Kendi TMDB ve OMDb anahtarın (IMDb, Rotten Tomatoes puanları)</li><li>Letterboxd'dan içe aktarma, yedek, görülenleri yönetme</li></ul>
      <div class="row-btns"><button class="btn btn-primary" data-acc="up">Ücretsiz kayıt ol</button><button class="btn" data-acc="in">Giriş yap</button></div>
    </section>
    <section class="acc-only">
      <h3>TMDB API anahtarı <small>isteğe bağlı</small></h3>
      <input class="field" id="setKey" type="password" placeholder="API anahtarı ya da okuma erişim jetonu" autocomplete="off">
      <div class="row-btns"><button class="btn btn-primary" id="btnSaveKey2">Kaydet</button><button class="btn btn-danger" id="btnDelKey">Anahtarı sil</button></div>
      <div class="err" id="setKeyErr"></div>
      <p class="note">Gerekmez: site TMDB'ye kendi ortak bağlantısıyla bağlanır. Kendi anahtarını girersen istekler doğrudan onunla gider; bu tarayıcıda saklanır; giriş yaptıysan ve aşağıdaki düğme açıksa hesabında şifreli yedeklenir.</p>
    </section>
    <section class="acc-only">
      <h3>OMDb anahtarı <small>isteğe bağlı · IMDb, RT, Metacritic puanı</small></h3>
      <input class="field" id="setOmdb" type="password" placeholder="OMDb API anahtarı" autocomplete="off">
      <div class="row-btns"><button class="btn btn-primary" id="btnSaveOmdb">Kaydet</button><button class="btn btn-danger" id="btnDelOmdb">Sil</button></div>
      <div class="err" id="omdbErr"></div>
      <p class="note">Ücretsiz anahtar: <a href="https://www.omdbapi.com/apikey.aspx" target="_blank" rel="noopener">omdbapi.com/apikey.aspx</a> (FREE, günde 1000 istek). Anahtarsız da IMDb bağlantısı görünür.</p>
    </section>
    <section id="keySyncSec" class="hidden">
      <div class="switch-row"><h3>API anahtarlarını hesabımda sakla <small>şifreli</small></h3><button class="switch" id="keySync" role="switch" aria-checked="false" aria-label="API anahtarlarını hesabımda sakla"></button></div>
      <div id="keySyncBox"></div>
    </section>
    <section class="acc-only">
      <h3>Görülenler <small id="seenCount"></small></h3>
      <p class="note" style="margin:0 0 10px">Kaydırdığın içerik bir daha çıkmaz. Listeden sildiklerin de görüldü sayılır. Sıfırlarsan listelerde olmayanlar yeniden çıkabilir.</p>
      <button class="btn btn-danger" id="btnResetSeen">Görülenleri sıfırla</button>
    </section>
    <section class="acc-only">
      <h3>Yedek <small>listeler + görülenler · JSON</small></h3>
      <div class="row-btns"><button class="btn btn-ico" id="btnExport"><svg class="i" aria-hidden="true"><use href="#i-export"/></svg> Dışa aktar</button><button class="btn btn-ico" id="btnImport"><svg class="i" aria-hidden="true"><use href="#i-import"/></svg> İçe aktar</button></div>
      <input type="file" id="fileImport" accept="application/json,.json" class="hidden">
    </section>
    <section class="acc-only">
      <h3>Letterboxd'dan içe aktar <small>yalnız filmler</small></h3>
      <button class="btn btn-ico" id="btnLetterboxd"><svg class="i" aria-hidden="true"><use href="#i-import"/></svg> Letterboxd zip'ini seç</button>
      <input type="file" id="fileLetterboxd" accept=".zip,.csv,application/zip,text/csv" multiple class="hidden">
      <div class="note lb-status" id="lbStatus" aria-live="polite"></div>
      <p class="note">letterboxd.com → Settings → Data → Export Your Data. İzlenenler İzlediklerim'e, izleme listesi İstek'e gider; Letterboxd puanın saklanır. Zip yerine <code>watched.csv</code> ve <code>watchlist.csv</code> da seçilebilir.</p>
    </section>
    <section id="privSec">
      <h3>Gizlilik ve verilerin</h3>
      <div class="switch-row"><span><b>İstatistik</b><br><small class="note">Anonim ziyaret sayısı ve kalma süresi (Umami dahil)</small></span><button class="switch" id="cStats" role="switch" aria-checked="false" aria-label="İstatistik"></button></div>
      <div class="switch-row" style="margin-top:10px"><span><b>Etkinlik kaydı</b><br><small class="note">Sitede yaptıkların; hata ayıklama ve iyileştirme için</small></span><button class="switch" id="cActivity" role="switch" aria-checked="false" aria-label="Etkinlik kaydı"></button></div>
      <p class="note" id="consentAt"></p>
      <p class="note">İkisi de isteğe bağlı; kapalıyken site aynı çalışır. Hata raporları kimliksiz gönderilir.</p>
      <div class="row-btns"><button class="btn acc-only hidden" id="btnMyData">Verilerimi indir</button><button class="btn" id="btnForget">Bu cihazın kayıtlarını sil</button></div>
      <div class="row-btns acc-only hidden"><button class="btn btn-danger" id="btnDelAcc">Hesabımı ve verilerimi sil</button></div>
      <p class="note"><a href="gizlilik.html" data-privacy target="_blank">Aydınlatma metni ve hakların</a></p>
    </section>
    <section id="adminSec" class="hidden">
      <h3>Yönetim</h3>
      <button class="btn btn-ico" id="btnAdmin"><svg class="i" aria-hidden="true"><use href="#i-shield"/></svg> Yönetim panelini aç</button>
    </section>
    <section>
      <h3>Yaş sınırı</h3>
      <div class="chips" id="ageChips"></div>
      <p class="note"><b>+18 gizle:</b> en çok 13+ (dizide 14+) gösterilir · <b>13 yaş altı:</b> en çok 7+ · <b>7 yaş altı:</b> yalnız Genel izleyici. Kartlarda her yapımın yaş sınırı yazar (önce Türkiye, yoksa ABD derecelendirmesi). Derecelendirmesi olmayanlar da gizlenir; aramaya uygulanmaz.</p>
    </section>
    <section>
      <h3>Dil · Language</h3>
      <div class="chips" id="langChips"></div>
    </section>
    <section>
      <h3>Kısayollar</h3>
      <p class="note" style="margin:0">→ istiyorum · ← geç · ↑ izledim · Backspace / Z geri al · Kartın üstüne dokun: özetin tamamı</p>
      <button class="linkish" id="btnGuide">Rehberi yeniden göster</button>
    </section>
    <section class="about">
      <div class="about-head"><img src="icons/logo.svg" alt="" width="44" height="44"><div><b>Kaydır <span class="beta">beta</span></b><small id="appVersion">Film ve dizi keşfi</small></div></div>
      <p class="note">Yapan: <b>Doğukan Parlak</b> · <a href="https://dogukanparlak.com" target="_blank" rel="noopener">dogukanparlak.com</a></p>
      <div class="about-links">
        <a class="btn btn-ico" href="https://github.com/dogukannparlak/film-kaydir" target="_blank" rel="noopener"><svg class="i" aria-hidden="true"><use href="#i-github"/></svg> GitHub</a>
        <a class="btn btn-ico" href="https://dogukanparlak.com" target="_blank" rel="noopener"><svg class="i" aria-hidden="true"><use href="#i-globe"/></svg> Web sitesi</a>
        <a class="btn btn-ico" href="gizlilik.html" target="_blank" rel="noopener"><svg class="i" aria-hidden="true"><use href="#i-shield"/></svg> Gizlilik</a>
      </div>
      <p class="note" style="margin-bottom:6px">Bana ulaş: hata, öneri ya da hesap silme isteği</p>
      <div class="about-links">
        <a class="btn btn-ico" href="mailto:dogukannparlak@gmail.com"><svg class="i" aria-hidden="true"><use href="#i-mail"/></svg> E-posta</a>
        <a class="btn btn-ico" href="https://instagram.com/dogukanparlak_" target="_blank" rel="noopener"><svg class="i" aria-hidden="true"><use href="#i-instagram"/></svg> Instagram</a>
        <a class="btn btn-ico" href="https://x.com/dogukannparlak" target="_blank" rel="noopener"><svg class="i" aria-hidden="true"><use href="#i-x"/></svg> X</a>
      </div>
      <p class="note"><b>Lisans:</b> <a href="https://polyformproject.org/licenses/noncommercial/1.0.0" target="_blank" rel="noopener">PolyForm Noncommercial 1.0.0</a>. Kişisel, eğitim ve ticari olmayan kullanım serbest; <b>ticari kullanım yasaktır</b>. © 2026 Doğukan Parlak.</p>
      <p class="note about-credits">Film ve dizi verileri ile afişler <a href="https://www.themoviedb.org" target="_blank" rel="noopener">TMDB</a>'den, platform bilgisi <a href="https://www.justwatch.com" target="_blank" rel="noopener">JustWatch</a>'tan (TMDB üzerinden), IMDb / Rotten Tomatoes / Metacritic puanları <a href="https://www.omdbapi.com" target="_blank" rel="noopener">OMDb</a>'den, fragmanlar YouTube'dan gelir. Bu adlar ve logolar sahiplerine aittir; Kaydır bu hizmetlerle ya da Letterboxd ile bağlantılı değildir.<br>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
    </section>
  </div>
</div>
`);
