# Kaydır · Film ve Dizi

[English](../README.md) · Türkçe

**Canlı:** https://kaydir.dogukanparlak.com · **Yapan:** [Doğukan Parlak](https://dogukanparlak.com) · **Lisans:** [PolyForm Noncommercial 1.0.0](../LICENSE) (ticari kullanım yasak)

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

Kullanıcı anahtarları tarayıcının `localStorage`'ında durur; giriş yapılmışsa ve Ayarlar'da açılırsa hesapta şifreli saklanır (aşağıda).

### TMDB ortak bağlantısı (Cloudflare Worker)

- `src/worker.js`: `public/` dosyalarını sunar, `/api/tmdb/<yol>` isteklerini `api.themoviedb.org/3/<yol>`'a iletir.
- Sitenin TMDB anahtarı **Cloudflare'de gizli değişkendir** (secret `TMDB_KEY`): kodda, repoda ve tarayıcıda yoktur;
  repo public olsa da görünmez. Ekleme: Workers & Pages › kaydir › Settings › Variables and secrets › Add › Secret.
- Yalnız sitenin kendi sayfalarından gelen GET istekleri kabul edilir (`Sec-Fetch-Site` / Origin / Referer).
- Yalnız sitenin kullandığı TMDB yollarına izin var (`ALLOWED`); IP başına dakikada 600 istek sınırı (`wrangler.jsonc › ratelimits`,
  köken başlığı taklit edilebildiği için asıl koruma bu). Aşılınca 429 + `Retry-After`; istemci bekleyip en çok 3 kez yeniden dener.
  Yanıtlar 6 saat kenar önbellekte tutulur (aynı istek TMDB'ye tekrar gitmez).
- Secret yoksa ya da geçersizse site "ortak bağlantı çalışmıyor" der ve kendi anahtarını ister.
- Yerel deneme için anahtar `.dev.vars` dosyasına yazılır (`TMDB_KEY=…`); bu dosya `.gitignore`'dadır.

## Özellikler

- Kaydırma (fare, dokunma, klavye ← → ↑), geri al.
- Telefonda kart ekranı doldurur (9:16'ya yakın); üst çubuk, özet ve eylem düğmeleri kartın üstünde yüzer.
- Alt sekme çubuğu ve Koleksiyonum üstündeki İstek/İzledim/Geçtim/Seriler çubuğu yüzen cam kapsül; etkin sekmenin arkasında
  parlak vurgu. Parmakla sağa sola kaydırarak sekme değişir (iOS gibi).
- Alt sayfalar (Ayarlar, Filtreler, Arama, Bölüm) aşağı sürüklenerek kapanır: yarısından fazla çekilirse kapanır, azsa geri döner.
  İçerik en üstteyken içerikten de çekilebilir.
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

- Hesapsız (misafir) kullanım: listeler, görülenler, filtreler ve anahtarlar yalnız o sekmede durur (sessionStorage), yenilemede kalır,
  sekme kapanınca silinir; kalıcı olması için kayıt olunur (ilk kaydırmada hatırlatma). Misafir Ayarlar'ı sadedir: anahtarlar,
  yedek, Letterboxd ve görülenler yerine "Hesapla açılanlar" kartı görünür.
- Sürüm: 0.1 beta.
- Yaş sınırı (Ayarlar): Hepsi / +18 gizle / 13 yaş altı / 7 yaş altı. Keşfette TMDB'nin ABD derecelendirmesiyle süzer
  (`certification.lte`; film PG-13/PG/G, dizi TV-14/TV-PG/TV-Y7); derecelendirmesiz yapımlar da gizlenir, arama süzülmez.
  Cihaz ayarıdır (`kd_age`).
- Ayarlar › Hesap: e-posta + şifre. Google ile giriş şimdilik kapalı (`js/hesap.js` › `GOOGLE_AUTH`). Hesapsız da çalışır (veri yalnız tarayıcıda).
- Giriş yapınca listeler, görülenler ve filtreler hesaba yazılır; cihazlar aynı listeyi görür.
- API anahtarları (Ayarlar › "API anahtarlarını hesabımda sakla", varsayılan kapalı): açıksa anahtarlar hesapta **şifreli**
  saklanır (`user_state.keys_enc`). Şifreleme anahtarı hesap şifresinden tarayıcıda türetilir (PBKDF2-SHA256, 310 000 tur →
  AES-GCM, `js/kasa.js`); anahtarların açık hâli ve şifreleme anahtarı sunucuya gitmez. Yeni cihazda şifreyle giriş yapınca
  anahtarlar gelir; oturum e-posta bağlantısıyla açıldıysa Ayarlar şifreyi bir kez sorar. Şifre sıfırlanırsa eski kopya
  açılamaz, anahtarlar yeniden girilir. Kapalıysa anahtarlar yalnız cihazda kalır, hesaptaki kopya silinir.
  Eski sürümün düz metin anahtarları ilk girişte cihaza alınır ve buluttan silinir.
- Çıkış yapınca önce her şey hesaba yazılır, sonra bu cihazdaki hesap verisi silinir (listeler, görülenler, filtreler,
  anahtarlar, eşitleme izi); giriş yapınca geri gelir. Hesaba yazılamadıysa ya da anahtarlar hesapta saklanmıyorsa önce sorulur.
- İlk açılışta kısa bir rehber çıkar, sonunda giriş yap / kaydol / hesapsız devam et seçimi sorulur ("Geç" doğrudan bu seçime atlar); Ayarlar › Kısayollar › "Rehberi yeniden göster" ile tekrar açılır.
- Önce yerel: değişiklik 1,5 sn sonra (sekme gizlenince hemen) buluta gider; düzenli eşitleme: açılışta, sekmeye dönünce,
  bağlantı gelince ve sekme açıkken 30 sn'de bir çekilir ve gönderilir.
  Bir cihazda ilk girişte yerel ve bulut birleşir (aynı öğede yeni olan kazanır).
- Supabase projesi `kaydir` (eu-central-1). Tablolar `items`, `user_state`; RLS: her satır yalnız sahibine açık.

## İstatistik ve yönetim

- **KVKK / GDPR:** istatistik ve etkinlik kaydı seçim yapılana kadar kapalı (önceden rıza, `js/riza.js`). Açılış bandında
  Kabul / Reddet / Seç eşit ağırlıkta; Ayarlar › Gizlilik ve verilerin'den her an değişir. Haklar sitede: verilerimi indir,
  hesabımı ve verilerimi sil, bu cihazın kayıtlarını sil. Rıza olmadan yalnız kimliksiz hata raporu gider. Aydınlatma metni:
  `gizlilik.html` / `privacy.html`. Saklama: etkinlik 90 gün, ziyaret 13 ay. (Hukuki son kontrol yapılmadı.)
- Kendi sayaç (`js/istatistik.js`, tablo `visits`, yalnız İstatistik rızasıyla): ziyaret, ziyaretçi, kalma süresi, cihaz türü,
  dil, nereden gelindiği. Çerez ve IP yok; rızayla `localStorage`'a anonim kimlik yazılır, geri dönen ziyaretçi sayılır.
- Umami Cloud (`js/istatistik.js` › `UMAMI_ID`; yalnız kaydir.dogukanparlak.com sayılır). Cloudflare Web Analytics de açık.
- Etkinlik günlüğü (`js/kayit.js`, tablo `events`, yalnız Etkinlik kaydı rızasıyla): kullanıcının sitede yaptığı her şey (kaydırma, arama, filtre, açılan sayfalar,
  tıklamalar, tarayıcı hataları), girişsiz ziyaretçi de anonim kimlikle. Şifre, e-posta kutusu ve API anahtarı içeriği kaydedilmez; 90 gün saklanır.
- Yönetim sayfası (`/admin.html`, Ayarlar › Yönetim de açar): yalnız `admins` tablosundaki hesaba açık, siteden bağımsız panel.
  Sekmeler: Genel, Hesaplar (arama, rol, silme), Ziyaretçiler (girişsizler dahil), Etkinlik (canlı akış, tür/metin filtresi),
  Hatalar (mesaja göre gruplu); kişiye tıklayınca girişten önceki anonim olaylarıyla birlikte bütün geçmişi açılır.
  Kendi sayaç + Umami + Cloudflare (Web Analytics, Worker istek/hata) grafiklerle yan yana; en çok sayfa/nereden/ülke,
  hesap listesi (rol: Kullanıcı / Admin, silme), veritabanı boyutu, bütün panellere bağlantılar. Supabase verisi admin'e özel RPC'lerden
  (`admin_stats`, `admin_users`, `admin_delete_user`, `admin_db`); Cloudflare ve Umami gizli anahtar istediği için Worker
  `/api/admin/*` (`src/admin.js`) üzerinden, Supabase oturumu + `is_admin()` doğrulanarak gelir. Worker ayarları:
  `CF_API_TOKEN` (Account Analytics: Read), `CF_ACCOUNT_ID`, isteğe bağlı `CF_SITE_TAG`, `UMAMI_API_KEY`.
  Admin ekleme (Supabase SQL): `insert into public.admins (user_id) select id from auth.users where email = '…';`

## Dil

- Türkçe ve İngilizce (Ayarlar › Dil). İlk açılışta tarayıcı dili Türkçeyse Türkçe, değilse İngilizce.
- Kaynak metinler kodda Türkçe; `t('…')` İngilizce sözlükten çevirir (`js/dil.js`, `js/dil/en.js`), html/ parçaları
  açılışta `translateDom()` ile çevrilir. TMDB verisi de seçilen dilde istenir (listeye önceden eklenen adlar eklendiği dilde kalır).
- E-posta bağlantıları (onay, şifre sıfırlama) yalnız yayındaki adreste çalışır (`file://` değil).

## Görsel kimlik

- Logo: sinema bileti (`public/icons/logo.svg`); ana ekran simgeleri ondan üretilir (`icons/*.png`).
- Simgeler: tek set, çizgi stili (`public/html/simgeler.js`, önizleme `docs/simgeler.html`). Kullanım: `ico('ad')`.
  Emoji kullanılmaz; yalnız 🍅 (Rotten Tomatoes) ve ★ (TMDB) tanınırlık için kalır.

## Güvenlik

- Güvenlik başlıkları `public/_headers`: CSP (betik yalnız bu site + jsDelivr), kare içine gömme yasak, nosniff, referrer.
  CSP satır içi betiğe izin vermez: `onerror=` gibi satır içi olay yazma, dinleyici kullan.
- Supabase kütüphanesi SRI (`integrity`) ile yüklenir; sürüm değişirse özeti yeniden hesapla:
  `curl -s <adres> | openssl dgst -sha384 -binary | openssl base64 -A`.
- Veritabanı sınırları (kayıt herkese açık): öğe verisi ≤ 16 KB, kullanıcı başına ≤ 20.000 öğe, görülenler ≤ 100.000,
  filtreler ≤ 16 KB, anahtarlar ≤ 512 karakter (migration `kaydir_size_limits`).

## Bilinen sınırlar

- **IMDb/RT sıralaması destede yaklaşık.** TMDB bu puanlara göre arama yapamaz; site en çok oy
  almış yapımları çeker ve her partiyi (20–40 kart) kendi içinde OMDb puanına göre dizer.
  Her parti ~40 OMDb isteği harcar. Listelerdeki sıralama tamdır.
- Yönetmen bilgisi yeni kaydırılan kartlarda gelir. Eski liste öğelerinde, listeyi IMDb/RT'ye göre
  sıralayınca puanı eksik olanlarla birlikte tamamlanır.
- Hesapsız kullanımda veriler tarayıcıya bağlı: başka cihazda görmek için giriş yap ya da JSON yedeğini taşı.
- Gerçek "her ülke" platform araması yok: TMDB ülke şart koşar, 14 ülkede aranır.
- Seriler yalnız filmler için (TMDB collection); diziler kapsanmaz.

## Geliştirme

Yapı (html/ parçaları, css/, js/ modülleri): [mimari.md](mimari.md).
Testler elle ve sahte `fetch` ile yapılır (bkz. mimari belgesinde "Test").
Tarayıcı testi: headless Chromium/Brave + CDP (Node'un yerleşik `WebSocket`'i), sahte `fetch` ile.

## Yol haritası

- İleride: Resend destekli mail + geri bildirim (panelden okunur); liste paylaşma (amaç Letterboxd olmak değil); film çıkınca / yeni sezon gelince e-posta bildirimi.
- 2026-10-19'da eklendi: dil desteği (TR/EN), İngilizce ana README, ziyaretçi istatistiği, yönetim paneli, API anahtarlarını şifreli saklama.

## Lisans

[PolyForm Noncommercial License 1.0.0](../LICENSE) · © 2026 Doğukan Parlak ([dogukanparlak.com](https://dogukanparlak.com)).

- **Serbest:** kişisel kullanım, öğrenme, araştırma, değiştirme ve ticari olmayan paylaşım (lisans metni ve
  `Required Notice` satırı korunarak).
- **Yasak:** ticari kullanım (satış, ücretli hizmet, reklam geliri amaçlı yayın vb.). Ticari kullanım için izin iste.

## Atıflar

- Film ve dizi verileri, afişler: [TMDB](https://www.themoviedb.org). *This product uses the TMDB API but is not
  endorsed or certified by TMDB.*
- Platform bilgisi: [JustWatch](https://www.justwatch.com) (TMDB üzerinden).
- IMDb / Rotten Tomatoes / Metacritic puanları: [OMDb API](https://www.omdbapi.com). Adlar ve logolar sahiplerine aittir.
- Fragmanlar: YouTube. Kaydır bu hizmetlerle ya da Letterboxd ile bağlantılı değildir.

## İletişim

Hata, öneri ya da hesap silme isteği: [dogukanparlak.com](https://dogukanparlak.com) üzerinden ya da GitHub'da issue aç.

