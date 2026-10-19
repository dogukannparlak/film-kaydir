'use strict';
/* ================= Sabitler ================= */
const API = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p/';
// Sitenin TMDB ara katmanı (src/worker.js; anahtar Cloudflare'de gizli). Dosyadan açıkken (file://) yok: kendi anahtarı gerekir.
const TMDB_PROXY = location.protocol.startsWith('http') ? '/api/tmdb' : null;
const K = { key:'kd_apikey', items:'kd_items', seen:'kd_seen', filters:'kd_filters', prov:'kd_providers', listF:'kd_listf', omdb:'kd_omdbkey', omdbCache:'kd_omdb', coll:'kd_coll', guide:'kd_guide', dirty:'kd_dirty', keySync:'kd_keysync' };
const NOW_Y = new Date().getFullYear();
const TODAY = new Date().toISOString().slice(0, 10);
const PREFETCH_AT = 12;         // kuyruk bunun altına inince arka planda yeni sayfa çek
const RANDOM_PAGE_CAP = 25;     // rastgele modda bir dilimde en fazla kaçıncı sayfaya kadar inilsin
const STATUS = { want:t('İstek listesi'), watched:t('İzlediklerim'), passed:t('Geçtiklerim') };
// Bildirimlerde yönelme hâli: "… İstek listesine taşındı"
const STATUS_TO = { want:t('İstek listesine'), watched:t('İzlediklerim\'e'), passed:t('Geçtiklerim\'e') };
// Hakkında bölümünde görünür; anlamlı bir sürüm çıkınca artır
const APP_VERSION = '0.1'; // beta
const APP_STAGE = 'beta';
const DIR_STATUS = { right:'want', left:'passed', up:'watched' };
// İzlediklerim içinde "yarım kaldı" işareti; öğe İzlediklerim'de kalır
const PROGRESS = {
  watching:{ label:t('İzliyorum'),  icon:'watching',  tvOnly:true }, // icon: html/simgeler.js'teki simge adı
  season:  { label:t('Yeni sezon'), icon:'newseason', tvOnly:true },
  dropped: { label:t('Bıraktım'),   icon:'dropped' },
};

const MOVIE_G = {28:t('Aksiyon'),12:t('Macera'),16:t('Animasyon'),35:t('Komedi'),80:t('Suç'),99:t('Belgesel'),18:t('Dram'),10751:t('Aile'),14:t('Fantastik'),36:t('Tarih'),27:t('Korku'),10402:t('Müzik'),9648:t('Gizem'),10749:t('Romantik'),878:t('Bilim Kurgu'),10770:t('TV Filmi'),53:t('Gerilim'),10752:t('Savaş'),37:t('Vahşi Batı')};
const TV_G = {10759:t('Aksiyon & Macera'),16:t('Animasyon'),35:t('Komedi'),80:t('Suç'),99:t('Belgesel'),18:t('Dram'),10751:t('Aile'),10762:t('Çocuk'),9648:t('Gizem'),10763:t('Haber'),10764:t('Reality'),10765:t('Bilim Kurgu & Fantastik'),10766:t('Pembe Dizi'),10767:t('Talk Show'),10768:t('Savaş & Politika'),37:t('Vahşi Batı')};
// Film ve dizi türleri TMDB'de farklı kimliklere sahip; filtre için ortak liste
const GENRES = [
  {id:'action', label:t('Aksiyon'), m:[28], t:[10759]},
  {id:'adventure', label:t('Macera'), m:[12], t:[10759]},
  {id:'comedy', label:t('Komedi'), m:[35], t:[35]},
  {id:'drama', label:t('Dram'), m:[18], t:[18]},
  {id:'crime', label:t('Suç'), m:[80], t:[80]},
  {id:'thriller', label:t('Gerilim'), m:[53], t:[]},
  {id:'mystery', label:t('Gizem'), m:[9648], t:[9648]},
  {id:'horror', label:t('Korku'), m:[27], t:[]},
  {id:'scifi', label:t('Bilim Kurgu'), m:[878], t:[10765]},
  {id:'fantasy', label:t('Fantastik'), m:[14], t:[10765]},
  {id:'romance', label:t('Romantik'), m:[10749], t:[]},
  {id:'animation', label:t('Animasyon'), m:[16], t:[16]},
  {id:'family', label:t('Aile'), m:[10751], t:[10751]},
  {id:'docu', label:t('Belgesel'), m:[99], t:[99]},
  {id:'history', label:t('Tarih'), m:[36], t:[]},
  {id:'war', label:t('Savaş'), m:[10752], t:[10768]},
  {id:'music', label:t('Müzik'), m:[10402], t:[]},
  {id:'western', label:t('Vahşi Batı'), m:[37], t:[37]},
  {id:'kids', label:t('Çocuk'), m:[], t:[10762]},
  {id:'reality', label:t('Reality'), m:[], t:[10764]},
];
const PERIODS = [
  {id:'all', label:t('Hepsi'), from:null, to:null},
  {id:'2020', label:t("2020'ler"), from:2020, to:null},
  {id:'2010', label:t("2010'lar"), from:2010, to:2019},
  {id:'2000', label:t("2000'ler"), from:2000, to:2009},
  {id:'1990', label:t("90'lar"), from:1990, to:1999},
  {id:'old', label:t("80'ler ve öncesi"), from:null, to:1989},
  {id:'custom', label:t('Özel aralık')},
];
const SORTS = [
  {id:'random', label:t('Rastgele')}, {id:'popular', label:t('Popüler')},
  {id:'top', label:t('En yüksek puan')}, {id:'new', label:t('En yeni')},
  {id:'imdb', label:t('IMDb yüksek')}, {id:'rt', label:t('RT yüksek')},
];
const REGIONS = [
  {id:'all', label:t('Hepsi'), p:{}},
  {id:'tr', label:t('Türk yapımları'), p:{with_original_language:'tr'}},
  {id:'kr', label:t('Kore'), p:{with_original_language:'ko'}},
  {id:'anime', label:t('Anime'), p:{with_original_language:'ja'}, anime:true},
  {id:'jp', label:t('Japon'), p:{with_original_language:'ja'}},
  {id:'en', label:t('İngilizce'), p:{with_original_language:'en'}},
  {id:'es', label:t('İspanyolca'), p:{with_original_language:'es'}},
  {id:'fr', label:t('Fransız'), p:{with_original_language:'fr'}},
  {id:'in', label:t('Hint'), p:{with_original_language:'hi'}},
  {id:'cn', label:t('Çin'), p:{with_original_language:'zh'}},
  {id:'de', label:t('Alman'), p:{with_original_language:'de'}},
];
const VOTE_OPTS = [20, 50, 100, 300, 1000, 5000];
const FALLBACK_PROVIDERS = [
  {id:8, name:'Netflix', logo:''}, {id:337, name:'Disney Plus', logo:''},
  {id:119, name:'Amazon Prime Video', logo:''}, {id:350, name:'Apple TV+', logo:''}, {id:11, name:'MUBI', logo:''},
];
// TMDB platform aramasında ülke şart. Kullanıcı ülke seçmez: platform seçilince bu ülkelerin hepsinde aranır
// (platform herhangi birinde varsa gelir), platform listesi de bu ülkelerin birleşimidir.
const WATCH_REGIONS = ['TR', 'US', 'GB', 'DE', 'FR', 'ES', 'IT', 'NL', 'CA', 'JP', 'KR', 'IN', 'BR', 'AU'];
const PROVIDER_LIMIT = 30;       // platform çiplerinde en çok kaç platform gösterilsin
const DEFAULT_FILTERS = { type:'both', sort:'random', periods:[], from:1990, to:NOW_Y, genres:[], regions:[], minRating:0, minVotes:100, providers:[] };
