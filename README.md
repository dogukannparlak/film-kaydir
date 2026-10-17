# Kaydır · Film ve Dizi

Tinder tarzı film/dizi keşfi: kartı sağa kaydır "istiyorum", sola "geç", yukarı "izledim".
Veri TMDB'den, IMDb / Rotten Tomatoes / Metacritic puanları isteğe bağlı OMDb'den gelir.
Sunucu, derleme ya da paket yok: `index.html` dosyasını tarayıcıda aç.

## Kurulum

1. `index.html` dosyasını çift tıkla (ya da `open index.html`).
2. Ayarlar → TMDB anahtarını yapıştır. İkisi de olur:
   - "API Read Access Token" (`eyJ...`): `Authorization: Bearer` başlığıyla gider.
   - v3 "API Key" (32 karakter): `api_key=` parametresiyle gider.
   Anahtar: themoviedb.org → Ayarlar → API.
3. İsteğe bağlı: Ayarlar → OMDb anahtarı. Ücretsiz anahtar: omdbapi.com/apikey.aspx
   (günde 1000 istek; e-postadaki bağlantıyla etkinleştirilir).

Anahtarlar yalnız bu tarayıcının `localStorage`'ında durur; depoya ya da başka yere yazılmaz.

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

- Ayarlar › Hesap: e-posta + şifre ya da Google. Hesapsız da çalışır (veri yalnız tarayıcıda).
- Giriş yapınca listeler, görülenler, filtreler ve API anahtarları hesaba yazılır; cihazlar aynı listeyi görür.
- Önce yerel: değişiklik 1,5 sn sonra buluta gider, buluttan açılışta / sekmeye dönünce / 60 sn'de bir çekilir.
  Bir cihazda ilk girişte yerel ve bulut birleşir (aynı öğede yeni olan kazanır).
- Supabase projesi `kaydir` (eu-central-1). Tablolar `items`, `user_state`; RLS: her satır yalnız sahibine açık.
- Google ile giriş ve e-posta bağlantıları yalnız yayındaki adreste çalışır (`file://` değil).

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
