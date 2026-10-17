# Mimari

Tek sayfalık, derlemesiz bir site. `index.html` yalnız iskelettir: arayüz parçaları `html/`,
stil `css/style.css`, davranış `js/` altındadır.

## HTML parçaları (`html/`)

`file://` ile açılan sayfa başka bir `.html` dosyasını `fetch` ile yükleyemez (CORS). Bu yüzden her
parça bir `.js` dosyasıdır: işaretlemeyi şablon metni olarak tutar ve
`document.currentScript.insertAdjacentHTML('beforebegin', …)` ile kendi `<script>` etiketinin yerine yazar.
Parçalar sayfa ayrıştırılırken sırayla çalışır, böylece `js/` dosyaları yüklendiğinde bütün öğeler hazırdır.
Parçalarda ters tırnak (`` ` ``) ve `${` kullanma; şablon metnini bozar.

| Dosya | İçerik |
|---|---|
| `html/ust.js` | Üst çubuk: marka, filtre ve ayar düğmeleri |
| `html/kesfet.js` | Keşfet görünümü: özet satırı, deste kabı, eylem düğmeleri |
| `html/listeler.js` | Listeler görünümü: sekmeler, arama, filtreler, sıralama, yedek düğmeleri |
| `html/alt-gezinti.js` | Alt sekmeler ve TMDB atıf satırı |
| `html/filtreler.js` | Filtreler alt sayfasının kabı (içeriği `js/filtreler.js` çizer) |
| `html/arama.js` | Arama alt sayfası: arama kutusu ve sonuç listesi |
| `html/ayarlar.js` | Ayarlar alt sayfası: anahtarlar, görülenler, kısayollar |

`index.html` içinde yalnız `.app` kabı, `#backdrop`, `#toasts` ve betik etiketleri kalır.

## Neden ES modülü değil

Dosyalar klasik `<script src>` olarak, sırayla yüklenir. `type="module"` kullanılsaydı tarayıcı
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
| `js/letterboxd.js` | Letterboxd zip/CSV okuma (tarayıcıda `DecompressionStream` ile açar), TMDB eşleştirme, listelere yazma | `importLetterboxd`, `unzipFiles`, `parseCSV`, `matchTMDB` |
| `js/baslat.js` | Olay bağlama ve `init()` çağrısı; en sonda yüklenir | `init` |

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

## Saklanan veri (localStorage)

| Anahtar | İçerik |
|---|---|
| `kd_apikey`, `kd_omdbkey` | API anahtarları |
| `kd_items` | Liste öğeleri: `id, type, title, originalTitle, collection ({id, name} | null), poster, date, status, genres, rating, imdb, imdbRating, rt, director, scoreAt, addedAt`, İzlediklerim'de isteğe bağlı `progress` (`season` \| `dropped`, bkz. `PROGRESS`; başka listeye taşınınca silinir) |
| `kd_seen` | Daha önce gösterilenler (tekrar gelmesin) |
| `kd_filters`, `kd_listf` | Deste ve liste filtreleri |
| `kd_providers` | Ülke başına platform listesi önbelleği: `{ TR: {at, list}, US: … }` (3 gün); çiplerde birleşimi gösterilir |
| `kd_coll` | Seri önbelleği: `{ id: {at, title, originalTitle, poster, parts[]} }` (7 gün, en çok 300) |
| `kd_omdb` | OMDb puan önbelleği (14 gün, en çok 3000 kayıt) |

## Dış API'ler

- TMDB v3: `/configuration` (anahtar sınaması), `/discover/{movie,tv}`, `/{movie,tv}/{id}`
  (`append_to_response=external_ids,credits`), `/watch/providers/movie`. Afişler `image.tmdb.org/t/p/`.
- OMDb: `?apikey=…&i=tt…` → `imdbRating`, `Ratings[]` (Rotten Tomatoes, Metacritic).
- Yönetmen: filmde `credits.crew` içinde `job === 'Director'`; dizide `created_by` (yaratıcı).

## Test

Otomatik test yok. Yöntem: `fetch`'i sahte TMDB/OMDb yanıtlarıyla değiştiren bir betiği
`js/sabitler.js`'den önce yükleyip headless Chromium'da (`--dump-dom`) kart başlığı, yönetmen,
puan sırası ve konsol hatalarını okumak. Gerçek anahtarla son kontrol tarayıcıda elle yapılır.
