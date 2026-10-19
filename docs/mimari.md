# Mimari

Tek sayfalık, derlemesiz bir site; bütün site dosyaları `public/` altında (Cloudflare Pages yalnız bu klasörü yayınlar). `public/index.html` yalnız iskelettir: arayüz parçaları `html/`,
stil `css/style.css`, davranış `js/` altındadır.

## HTML parçaları (`html/`)

`file://` ile açılan sayfa başka bir `.html` dosyasını `fetch` ile yükleyemez (CORS). Bu yüzden her
parça bir `.js` dosyasıdır: işaretlemeyi şablon metni olarak tutar ve
`document.currentScript.insertAdjacentHTML('beforebegin', …)` ile kendi `<script>` etiketinin yerine yazar.
Parçalar sayfa ayrıştırılırken sırayla çalışır, böylece `js/` dosyaları yüklendiğinde bütün öğeler hazırdır.
Parçalarda ters tırnak (`` ` ``) ve `${` kullanma; şablon metnini bozar.

| Dosya | İçerik |
|---|---|
| `html/simgeler.js` | Simge seti (SVG `<symbol>`), en başta bir kez gömülür; JS'te `ico('ad')` |
| `html/ust.js` | Üst çubuk: logo + marka, arama, filtre ve ayar düğmeleri |
| `html/kesfet.js` | Keşfet görünümü: özet satırı, deste kabı, eylem düğmeleri |
| `html/listeler.js` | Listeler görünümü: sekmeler, arama, filtreler, sıralama, yedek düğmeleri |
| `html/alt-gezinti.js` | Alt sekme çubuğu: yüzen cam kapsül + kayan vurgu (`.tab-ind`) |
| `html/filtreler.js` | Filtreler alt sayfasının kabı (içeriği `js/filtreler.js` çizer) |
| `html/arama.js` | Arama alt sayfası: arama kutusu ve sonuç listesi |
| `html/bolum.js` | Bölüm seçici alt sayfası |
| `html/ayarlar.js` | Ayarlar alt sayfası: hesap, anahtarlar, anahtarları hesapta saklama düğmesi, tekrar gelişi sayma düğmesi, yönetim, görülenler, yedek, Letterboxd, kısayollar, Hakkında (lisans, bağlantılar, atıflar) |
| `html/rehber.js` | İlk açılış rehberinin kabı (adımları `js/rehber.js` çizer) |

`index.html` içinde yalnız `.app` kabı, `#backdrop`, `#toasts` ve betik etiketleri kalır.

## Neden ES modülü değil

Dosyalar klasik `<script src>` olarak, sırayla yüklenir (en başta `js/dil.js` + sözlükler, sonra html/ parçaları). `type="module"` kullanılsaydı tarayıcı
`file://` adresinden modül yüklemeyi CORS yüzünden reddederdi ve site çift tıklamayla açılmazdı.
Klasik betiklerde üst düzey `const`/`let`/`function` adları bütün dosyalarda ortaktır, bu yüzden:

- **Yükleme sırası önemlidir** (aşağıdaki tablo sırası = `index.html` sırası). Bir dosya, yüklenirken
  hemen çalışan kodda yalnız kendisinden önceki dosyaların adlarını kullanabilir. Fonksiyon
  gövdelerinin içinde her ad kullanılabilir, çünkü onlar `init()` sonrasında çalışır.
- **Adlar tekil olmalıdır.** İki dosyada aynı üst düzey `const` adı "already declared" hatası verir.
- Her dosya `'use strict';` ile başlar.

## Modüller (yükleme sırasıyla)

| Dosya | İş | Başlıca adlar |
|---|---|---|
| `js/dil.js` | Dil: `LANG` (`kd_lang` ya da tarayıcı dili), `LOCALE`, `t('Türkçe metin', {yer tutucu})` (sözlükte "tekil\|çoğul" desteği), html/ parçalarını çeviren `translateDom()`, `setLang` (sayfayı yeniler) | `LANG`, `LOCALE`, `t`, `translateDom`, `setLang` |
| `js/dil/en*.js` | İngilizce sözlük (`EN`), anahtar Türkçe kaynak metin; gruplara bölünmüş (`en-a` hesap/ayarlar/yönetim, `en-b` liste/filtre/kart, `en-c` rehber/bölüm/Letterboxd) | `EN` |
| `js/sabitler.js` | API adresleri, localStorage anahtarları (`K`), türler, dönemler, sıralamalar, bölgeler, varsayılan filtreler | `API`, `IMG`, `K`, `GENRES`, `PERIODS`, `SORTS`, `REGIONS`, `DEFAULT_FILTERS` |
| `js/yardimci.js` | DOM kısayolları, kaçış, güvenli `store` (localStorage), bildirim | `$`, `$$`, `esc`, `store`, `toast`, `shuffle` |
| `js/durum.js` | Uygulama durumu `S` (anahtarlar, öğeler, görülenler, filtreler, kuyruk) | `S`, `saveItems`, `saveSeen` |
| `js/tmdb.js` | TMDB isteği (Bearer ya da `api_key`), sonuç biçimleme, filtre → sorgu parametreleri | `tmdb`, `norm`, `baseParams`, `dateParams`, `accept` |
| `js/motor.js` | Sonsuz akış: sayfa çekme (rastgele/sıralı), parti içi IMDb/RT sıralaması, kuyruğu doldurma | `E`, `fetchRandom`, `fetchSeq`, `fetchMore`, `resetEngine` |
| `js/kartlar.js` | Kart HTML'i | `createCard`, `genreNames` |
| `js/puanlar.js` | Ek ayrıntı: IMDb kimliği + yönetmen (TMDB `external_ids,credits`), OMDb puanları ve önbelleği | `fetchIds`, `directorOf`, `loadScores`, `scoresHTML`, `refreshScores`, `pool` |
| `js/deste.js` | Destenin ilk üç kartını çizme, afiş önyükleme | `renderDeck`, `updateDeckStatus` |
| `js/surukleme.js` | Pointer Events ile sürükleme, damgalar, kartı fırlatma | `attachDrag`, `flyOut` |
| `js/eylemler.js` | Kaydırma kararı → listeye yazma, geri al | `setItem`, `act`, `undo` |
| `js/anahtar.js` | TMDB/OMDb anahtar kutusu ve doğrulaması | `saveKey`, `saveOmdb` |
| `js/filtreler.js` | Filtre sayfası, özet satırı, platform listesi | `openFilters`, `applyFilters`, `loadProviders` |
| `js/listeler.js` | Listeler: filtre, sıralama, eksik puanları tamamlama, taşıma/silme, JSON yedek | `renderList`, `backfillScores`, `exportJSON`, `importJSON` |
| `js/gezinti.js` | Sekme geçişi, alt sayfalar (sheet), ayarlar | `setView`, `openSheet`, `closeSheet` |
| `js/seriler.js` | Film serileri: `/collection/{id}` önbelleği (`kd_coll`, 7 gün), seri kutusu ve sonuç satırı (arama + Listeler › Seriler ortak), toplu taşıma, kart etiketi, listedeki filmlerin `belongs_to_collection` taraması | `getCollection`, `collHTML`, `onCollAction`, `renderSeries`, `scanCollections` |
| `js/arama.js` | Arama sayfası: `/search/collection` + `/collection/{id}` (seriler, en üstte), `/search/multi`, kişilerin `known_for` işleri, toplu taşıma, sonuçtan listeye ekleme + geri al | `openSearch`, `runSearch`, `renderSearch`, `onSearchClick` |
| `js/sezonlar.js` | Yeni sezon tespiti (`/tv/{id}` sezon tarihleri ↔ `addedAt`, `seasonAck`), fragman (`videos`) | `checkNewSeasons`, `ackSeason`, `pickTrailer`, `openTrailer` |
| `js/bolumler.js` | İzliyorum: kaldığın sezon/bölüm (`at`), yayınlanmış bölüm sayıları (`eps`, 12 saat), seçici ve +1 | `openEpisodes`, `setAt`, `nextEpisode`, `nextEp`, `watchingRow` |
| `js/letterboxd.js` | Letterboxd zip/CSV okuma (tarayıcıda `DecompressionStream` ile açar), TMDB eşleştirme, listelere yazma | `importLetterboxd`, `unzipFiles`, `parseCSV`, `matchTMDB` |
| `js/kasa.js` | API anahtarlarını hesapta şifreli saklama: hesap şifresinden PBKDF2-SHA256 (310 000 tur) ile AES-GCM anahtarı türetme, şifreleme/çözme; türetilen anahtar cihazda `kd_vault` | `deriveVault`, `setVault`, `vaultFor`, `sealKeys`, `openKeys` |
| `js/hesap.js` | Supabase hesap + eşitleme: giriş/kayıt sekmeleri (şifre kuralları ≥8 + a–z harf + rakam, ≤72 bayt; kayıtta tekrar; alan altı hatalar `error.code`'dan; kayıttan sonra e-posta kodu `verifyOtp` (uzunluk panelde: 8), 60 sn'lik tekrar gönder), sıfırlama; Google `GOOGLE_AUTH` ile kapalı, değişen öğeleri gönderme, `updated_at > since` ile çekme, ilk girişte birleştirme; API anahtarı düğmesi (`keys_enc`, kilitli cihazda şifre sorma, eski düz metin anahtarları taşıma) | `syncSoon`, `pushChanges`, `pullChanges`, `syncNow`, `initAccount`, `applyCloudKeys`, `renderKeySync` |
| `js/riza.js` | KVKK/GDPR rızası: `stats` (sayaç + Umami) ve `activity` (etkinlik kaydı) seçim yapılana kadar kapalı; açılış bandı (Kabul / Reddet / Seç), Ayarlar › Gizlilik ve verilerin (düğmeler, verilerimi indir, bu cihazın kayıtlarını sil, hesabımı sil) | `allowed`, `setConsent`, `showConsentBar`, `renderPrivacy`, `initPrivacy` |
| `js/istatistik.js` | Ziyaret sayacı (`visit_start` + 30 sn'de `visit_ping`), kalıcı anonim kimlik (`kd_visitor`), Umami (`UMAMI_ID` doluysa) | `initStats`, `setConsent`, `startVisit` |
| `js/admin.js` | Ayarlar › Yönetim düğmesi: `is_admin()` ise görünür, `admin.html`'i açar | `checkAdmin`, `initAdmin` |
| `js/kayit.js` | Etkinlik günlüğü: işlevleri sarar (`act`, `undo`, `runSearch`, `applyFilters`, `setView`, …) + bütün tıklamalar + tarayıcı hataları; 5 sn'de bir `log_events`'e toplu gider. Şifre/e-posta/anahtar içeriği gitmez. `baslat.js`'ten hemen önce yüklenir | `logEv`, `flushLog`, `wrapLog` |
| `js/rehber.js` | İlk açılış rehberi: adımlar, sonda hesap seçimi (giriş / kayıt / hesapsız), bir kez gösterme (`kd_guide`), Ayarlar › Kısayollar'dan yeniden açma | `openGuide`, `closeGuide`, `initGuide` |
| `js/baslat.js` | Olay bağlama ve `init()` çağrısı; en sonda yüklenir | `init` |

## Supabase Auth panel ayarları (repoda yok)

Kod bunlara dayanır; panelde elle tutulur:
- **SMTP:** Resend (`smtp.resend.com:465`, kullanıcı `resend`, gönderen `kaydir@dogukanparlak.com`). Varsayılan Supabase göndericisi saatte birkaç mail atar.
- **Confirm signup şablonu:** yalnız `{{ .Token }}` (Doğukan, 2026-10-20: "sadece kod olsun"; `{{ .ConfirmationURL }}` bağlantısı yok).
- **Şifre:** en az 8, "Letters and digits" (istemcideki kuralla aynı; sunucu harfi a–z sayar).

## Veri akışı

1. `sources()` (tmdb) filtreleri kaynaklara açar: içerik tipi × bölge × dönem (platform seçiliyse × `WATCH_REGIONS` içindeki 14 ülke, `watch_region`; platform herhangi bir ülkede varsa gelir). TMDB tek sorguda dönemleri ya da
   dilleri "ya da" ile birleştiremediği için her kaynak ayrı akıştır; `fetchMore` her turda en çok
   `MAX_PARALLEL` (4) kaynağı rastgele seçip çeker. Boş seçim = hepsi. Eski tekli kayıtları
   (`period`, `region`) `migrateFilters` (durum) diziye çevirir.
2. `fetchMore` (motor) → `tmdb('/discover/...')` → `norm` → `accept` (görülmemiş, afişli, oy eşiği).
3. Sıralama IMDb/RT ise parti önce `fetchIds` + `loadScores` ile zenginleşir ve puana göre dizilir.
4. `renderDeck` ilk üç kartı çizer; ilk ikisi için `ensureExtra` yönetmeni, IMDb kimliğini,
   özeti ve puanları tamamlar.
5. Kaydırma → `act` → `setItem`: öğe `S.items`'a yazılır (localStorage `kd_items`).

## Saklanan veri (localStorage / sessionStorage)

Misafir (girişsiz) modda `GUEST_KEYS` (öğeler, görülenler, filtreler, liste filtresi, kirli işaret, API anahtarları, OMDb önbelleği)
`sessionStorage`'dadır: sekme kapanınca silinir. Girişte bellekteki durum `localStorage`'a yazılır (`setAccountMode`), çıkışta
silinir ve misafir moduna dönülür. Mod açılışta Supabase oturum anahtarının varlığından anlaşılır; `body.guest` sınıfı Ayarlar'da
`.acc-only` / `.guest-only` bölümlerini gösterir/gizler. Öteki anahtarlar hep `localStorage`.

| Anahtar | İçerik |
|---|---|
| `kd_apikey`, `kd_omdbkey` | API anahtarları |
| `kd_keysync` | API anahtarları hesapta (şifreli) saklansın mı |
| `kd_vault` | Hesap şifresinden türetilen AES anahtarı + tuz (`{user, salt, k}`); çıkışta silinir |
| `kd_lang` | Arayüz dili (`tr` / `en`) |
| `kd_consent` | Rıza: `{v:1, stats, activity, at}`; yoksa bant çıkar, ikisi de kapalı |
| `kd_visitor` | Kalıcı anonim ziyaretçi kimliği; yalnız rıza varsa yazılır |
| `kd_items` | Liste öğeleri: `id, type, title, originalTitle, trailer, latestSeason/seasonAck/newSeason/nextSeason/tvCheckedAt (dizi), collection ({id, name} | null), poster, date, status, genres, rating, imdb, imdbRating, rt, director, scoreAt, addedAt`, İzlediklerim'de isteğe bağlı `progress` (`watching` \| `season` \| `dropped`; İzliyorum'da kaldığın yer `at: {s, e}` ve yayınlanmış bölümler `eps`, bkz. `PROGRESS`; başka listeye taşınınca silinir) |
| `kd_seen` | Daha önce gösterilenler (tekrar gelmesin) |
| `kd_filters`, `kd_listf` | Deste ve liste filtreleri |
| `kd_providers` | Ülke başına platform listesi önbelleği: `{ TR: {at, list}, US: … }` (3 gün); çiplerde birleşimi gösterilir |
| `kd_coll` | Seri önbelleği: `{ id: {at, title, originalTitle, poster, parts[]} }` (7 gün, en çok 300) |
| `kd_guide` | Rehber görüldü işareti (`1`) |
| `kd_dirty` | Buluta gönderilmemiş durum: `{ state, seen }` (anahtar/filtre, görülenler) |
| `kd_omdb` | OMDb puan önbelleği (14 gün, en çok 3000 kayıt) |

## Supabase tabloları ve fonksiyonları

Göçler: `supabase/migrations/` (önceki dördü panelden/MCP ile uygulandı, adları dosyanın başında).

- `items`, `user_state`: kullanıcı verisi, RLS ile yalnız sahibine açık. API anahtarları `user_state.keys_enc`'te
  şifreli (`{v, salt, iv, ct}`); eski düz metin sütunlar `tmdb_key`, `omdb_key` istemci tarafından hep boşaltılır.
- `visits` + `visit_start` / `visit_ping`: anonim ziyaret sayacı. Tabloya doğrudan erişim yok, yalnız bu iki
  `security definer` fonksiyon; ziyaretçi başına günde en çok 200 ziyaret.
- KVKK/GDPR hakları: `my_data()` (giriş yapanın bütün verisi), `delete_my_account()`, `forget_visitor(id)` (cihaz kayıtları).
  Saklama: `events` 90 gün, `visits` 13 ay (ara sıra silinir).
- `events` + `log_events(visitor, olaylar, yol)`: etkinlik günlüğü (girişsiz ziyaretçi dahil, hesap `auth.uid()`'den), 90 gün; ziyaretçi
  başına saatte en çok 1000 olay. Okuma yalnız admin: `admin_events`, `admin_visitors`, `admin_errors`, `admin_event_kinds`.
- `admins` + `is_admin()`, `admin_stats(p_days)`, `admin_users()`, `admin_delete_user(id)`, `admin_set_role(id, rol)`, `admin_db()`: yönetim sayfası
  (`admin.html` + `js/yonetim.js` + `css/yonetim.css`, siteden bağımsız). Cloudflare/Umami verisi Worker'dan: `src/admin.js`
  (`/api/admin/cloudflare`, `/api/admin/umami`; çağıranın oturumu ve admin olduğu Supabase'e sorulur). Admin satırı elle eklenir.

## Dış API'ler

- TMDB isteği (`js/tmdb.js` › `tmdb`): kullanıcının anahtarı varsa doğrudan TMDB'ye, yoksa sitenin ara katmanına
  (`/api/tmdb/*`, `src/worker.js`; anahtar Cloudflare secret `TMDB_KEY`). Ara katman 401/403/404/503 dönerse
  `S.proxyDown` olur ve anahtar kutusu çıkar. `tmdbReady()` ikisinden biri kullanılabilir mi söyler.

- TMDB v3: `/configuration` (anahtar sınaması), `/discover/{movie,tv}`, `/{movie,tv}/{id}`
  (`append_to_response=external_ids,credits,videos`), `/{movie,tv}/{id}/videos`, `/search/{movie,multi,collection}`,
  `/collection/{id}`, `/watch/providers/movie`. Dizi sezonları `/tv/{id}` (`seasons`, `last_episode_to_air`,
  `next_episode_to_air`). Afişler `image.tmdb.org/t/p/`.
- OMDb: `?apikey=…&i=tt…` → `imdbRating`, `Ratings[]` (Rotten Tomatoes, Metacritic).
- Yönetmen: filmde `credits.crew` içinde `job === 'Director'`; dizide `created_by` (yaratıcı).

## Statik dosyalar ve yayın

| Dosya | İş |
|---|---|
| `public/icons/logo.svg` | Logo (sinema bileti); `favicon.svg` aynısı |
| `public/icons/*.png` | Ana ekran simgeleri (180/192/512), `logo-square.svg`'den headless tarayıcıyla üretilir |
| `public/manifest.webmanifest` | Web uygulaması: ad, tam ekran açılış, simgeler |
| `public/_headers` | Güvenlik başlıkları (CSP, X-Frame-Options, nosniff, Referrer-Policy) |
| `public/gizlilik.html` | Gizlilik ve lisans metni |
| `src/worker.js`, `wrangler.jsonc` | TMDB ara katmanı (yol izin listesi, IP başına hız sınırı) + statik site; GitHub'a push → Cloudflare yayınlar |
| `LICENSE` | PolyForm Noncommercial 1.0.0 |

## Test

Otomatik test yok. Yöntem: `fetch`'i (ve hesap için Supabase istemcisini) sahte yanıtlarla değiştiren bir betiği
`js/sabitler.js`'den önce yükleyip headless Brave/Chromium'u `--remote-debugging-port` ile açmak; Node'un yerleşik
`WebSocket`'iyle CDP üzerinden `Runtime.evaluate` (durum, hatalar), `Input.dispatchTouchEvent` (sürükleme, kaydırma)
ve `Page.captureScreenshot` (390×664 telefon görünümü) kullanmak. Gerçek veriyle son kontrol tarayıcıda elle yapılır.
