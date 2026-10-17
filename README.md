# Kaydır · Film ve Dizi

Tinder tarzı film/dizi keşfi: kartı sağa kaydır "istiyorum", sola "geç", yukarı "izledim".
Veri TMDB'den, IMDb / Rotten Tomatoes / Metacritic puanları isteğe bağlı OMDb'den gelir.
Sunucu, derleme ya da paket yok. Site dosyaları `public/` altında: `public/index.html` dosyasını tarayıcıda aç.
Yayın: https://kaydir.dogukanparlak.com (Cloudflare Workers, GitHub'a bağlı; `wrangler.jsonc` ile `public/` yayınlanır,
`src/worker.js` TMDB ara katmanıdır).

## Kurulum

1. https://kaydir.dogukanparlak.com adresini aç: TMDB anahtarı gerekmez, site sitenin ortak bağlantısını
   (`/api/tmdb/*`, aşağıda) kullanır. `public/index.html` dosyadan açılırsa ortak bağlantı yoktur, 2. adım gerekir.
2. İsteğe bağlı: Ayarlar → kendi TMDB anahtarını yapıştır (istekler doğrudan TMDB'ye gider). İkisi de olur:
   - "API Read Access Token" (`eyJ...`): `Authorization: Bearer` başlığıyla gider.
   - v3 "API Key" (32 karakter): `api_key=` parametresiyle gider.
   Anahtar: themoviedb.org → Ayarlar → API.
3. İsteğe bağlı: Ayarlar → OMDb anahtarı. Ücretsiz anahtar: omdbapi.com/apikey.aspx
   (günde 1000 istek; e-postadaki bağlantıyla etkinleştirilir).

Kullanıcı anahtarları tarayıcının `localStorage`'ında durur; giriş yapılmışsa hesapta da yedeklenir (aşağıda).

### TMDB ortak bağlantısı (Cloudflare Worker)

- `src/worker.js`: `public/` dosyalarını sunar, `/api/tmdb/<yol>` isteklerini `api.themoviedb.org/3/<yol>`'a iletir.
- Sitenin TMDB anahtarı **Cloudflare'de gizli değişkendir** (secret `TMDB_KEY`): kodda, repoda ve tarayıcıda yoktur;
  repo public olsa da görünmez. Ekleme: Workers & Pages › kaydir › Settings › Variables and secrets › Add › Secret.
- Yalnız sitenin kendi sayfalarından gelen GET istekleri kabul edilir (`Sec-Fetch-Site` / Origin / Referer).
  Yanıtlar 6 saat kenar önbellekte tutulur (aynı istek TMDB'ye tekrar gitmez).
- Secret yoksa ya da geçersizse site "ortak bağlantı çalışmıyor" der ve kendi anahtarını ister.
- Yerel deneme için anahtar `.dev.vars` dosyasına yazılır (`TMDB_KEY=…`); bu dosya `.gitignore`'dadır.

## Özellikler

- Kaydırma (fare, dokunma, klavye ← → ↑), geri al.
- Arama (🔍 ya da `/`): bütün TMDB'de film/dizi; kişi adı (yönetmen, oyuncu) yazınca bilinen işleri de gelir.
  Sonuçtan doğrudan İstek / İzledim / Geç listesine eklenir; listede olanın durumu görünür.
  Film serisi (Harry Potter, Yüzüklerin Efendisi …) en üstte bütün filmleriyle çıkar; "Hepsini taşı" ile tek seferde
  listeye eklenir (çıkmamış filmler İzledim'e eklenmez), tek "Geri al" ile geri alınır.
- Filtreler: film/dizi, dönem, tür, bölge/dil, en az puan, en az oy, platform ("Hepsi" ya da platformlar; ülke seçilmez, 14 ülkede birden aranır).
  Dönem, tür, bölge/dil ve platformda birden fazla seçim yapılır ("ya da": seçilenlerden herhangi biri).
- Sıralama: rastgele, popüler, en yüksek puan, en yeni, **IMDb yüksek**, **RT yüksek**.
- Başlık: orijinal ad büyük, altında Türkçe ad (aynıysa tek satır). Orijinal ad Latin alfabesinde değilse
  (Korece, Japonca …) Türkçe ad üstte kalır. Listede arama iki adda da çalışır.
- Kartta: TMDB puanı, IMDb bağlantısı, OMDb puanları, yönetmen (dizide yaratıcı), özet.
- Seriler: kartta "🎞️ Harry Potter Serisi · 2/8" etiketi (dokununca seri açılır, toplu taşınır);
  İstek ve İzledim'de aynı seriden 2+ film tek kutuda toplanır (seri sırasıyla, ilerleme çubuğu, açılır kapanır);
  tek filmse satırında "🎞️ Harry Potter Serisi · 3. film · 5/7 izlendi" etiketi (dokununca seri açılır);
  Koleksiyonum › Seriler sekmesinde listendeki filmlerin serileri, izleme ilerlemesi ve eksik filmleriyle.
- Üç liste (İstek, İzledim, Geç): arama, tür/dönem filtresi, sıralama
  (son eklenen, IMDb, Rotten Tomatoes, TMDB).
- İzlediklerim'de "yarım kaldı" işareti: ◐ Yeni sezon (yalnız dizi) ya da ⏸ Bıraktım. Öğe İzlediklerim'de
  kalır; durum kutusuyla bitenler / yarım kalanlar / yeni sezon bekleyenler / bıraktıklarım süzülür.
- Yeni sezon: İzlediklerim'deki dizilerde, diziyi eklediğin tarihten sonra yayınlanan sezon 12 saatte bir kontrol edilir;
  bulununca "◐ Yeni sezon" kendiliğinden konur (🆕 rozet + bildirim). İşareti kaldırınca o sezon görüldü sayılır.
  "Bıraktım" işaretli dizilere dokunulmaz. Tarihi açıklanmış gelecek sezon 📅 rozetiyle görünür.
- İzliyorum (diziler): İzlediklerim'de "▶ İzliyorum" + kaldığın yer ("📍 2. sezon 5. bölüm"); sezon/bölüm seçici,
  "+1 bölüm" ile sonraki yayınlanmış bölüm. Süzgeçte "İzliyorum". Yeni sezon gelirse rozet çıkar, işaret değişmez.
- Fragman: kartta ve listede ▶ Fragman (YouTube, önce Türkçe).
- JSON dışa/içe aktarma (yedek): Ayarlar → Yedek. İçe aktarmada buradaki daha yeni kayıt korunur.
- Letterboxd'dan içe aktarma: Ayarlar → Letterboxd. Export zip'i (ya da `watched.csv`, `watchlist.csv`) seçilir;
  filmler ad + yılla TMDB'de eşleştirilir, Letterboxd puanı `LB` rozeti olarak görünür. Eşleşmeyenler listelenir.

## Hesap ve eşitleme (Supabase)

- Ayarlar › Hesap: e-posta + şifre. Google ile giriş şimdilik kapalı (`js/hesap.js` › `GOOGLE_AUTH`). Hesapsız da çalışır (veri yalnız tarayıcıda).
- Giriş yapınca listeler, görülenler, filtreler ve API anahtarları hesaba yazılır; cihazlar aynı listeyi görür.
- API anahtarları: yeni cihazda giriş yapınca hesaptan gelir (yeniden girmek gerekmez); bir cihazda değişen anahtar
  diğerlerine de geçer. Yerelde anahtar varsa ilk girişte o kalır, hesapta yoksa hesaba yedeklenir.
- İlk açılışta kısa bir rehber çıkar, sonunda giriş yap / kaydol / hesapsız devam et seçimi sorulur ("Geç" doğrudan bu seçime atlar); Ayarlar › Kısayollar › "Rehberi yeniden göster" ile tekrar açılır.
- Önce yerel: değişiklik 1,5 sn sonra (sekme gizlenince hemen) buluta gider; düzenli eşitleme: açılışta, sekmeye dönünce,
  bağlantı gelince ve sekme açıkken 30 sn'de bir çekilir ve gönderilir.
  Bir cihazda ilk girişte yerel ve bulut birleşir (aynı öğede yeni olan kazanır).
- Supabase projesi `kaydir` (eu-central-1). Tablolar `items`, `user_state`; RLS: her satır yalnız sahibine açık.
- E-posta bağlantıları (onay, şifre sıfırlama) yalnız yayındaki adreste çalışır (`file://` değil).

## Bilinen sınırlar

- **IMDb/RT sıralaması destede yaklaşık.** TMDB bu puanlara göre arama yapamaz; site en çok oy
  almış yapımları çeker ve her partiyi (20–40 kart) kendi içinde OMDb puanına göre dizer.
  Her parti ~40 OMDb isteği harcar. Listelerdeki sıralama tamdır.
- Yönetmen bilgisi yeni kaydırılan kartlarda gelir. Eski liste öğelerinde, listeyi IMDb/RT'ye göre
  sıralayınca puanı eksik olanlarla birlikte tamamlanır.
- Veriler tarayıcıya bağlı: başka tarayıcı ya da cihazda görmek için JSON yedeğini taşı.

## Geliştirme

Yapı (html/ parçaları, css/, js/ modülleri): [docs/mimari.md](docs/mimari.md).
Testler elle ve sahte `fetch` ile yapılır (bkz. mimari belgesinde "Test").
