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
- Filtreler: film/dizi, dönem, tür, bölge/dil, en az puan, en az oy, platform (ülke seçilir: Türkiye, ABD, İngiltere …).
  Dönem, tür, bölge/dil ve platformda birden fazla seçim yapılır ("ya da": seçilenlerden herhangi biri).
- Sıralama: rastgele, popüler, en yüksek puan, en yeni, **IMDb yüksek**, **RT yüksek**.
- Kartta: TMDB puanı, IMDb bağlantısı, OMDb puanları, yönetmen (dizide yaratıcı), özet.
- Üç liste (İstek, İzledim, Geç): arama, tür/dönem filtresi, sıralama
  (son eklenen, IMDb, Rotten Tomatoes, TMDB).
- İzlediklerim'de "yarım kaldı" işareti: ◐ Yeni sezon (yalnız dizi) ya da ⏸ Bıraktım. Öğe İzlediklerim'de
  kalır; durum kutusuyla bitenler / yarım kalanlar / yeni sezon bekleyenler / bıraktıklarım süzülür.
- JSON dışa/içe aktarma (yedek): Ayarlar → Yedek.

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
