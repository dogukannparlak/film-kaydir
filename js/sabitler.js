'use strict';
/* ================= Sabitler ================= */
const API = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p/';
const K = { key:'kd_apikey', items:'kd_items', seen:'kd_seen', filters:'kd_filters', prov:'kd_providers', listF:'kd_listf', omdb:'kd_omdbkey', omdbCache:'kd_omdb' };
const NOW_Y = new Date().getFullYear();
const TODAY = new Date().toISOString().slice(0, 10);
const PREFETCH_AT = 12;         // kuyruk bunun altına inince arka planda yeni sayfa çek
const RANDOM_PAGE_CAP = 25;     // rastgele modda bir dilimde en fazla kaçıncı sayfaya kadar inilsin
const STATUS = { want:'İstek listesi', watched:'İzlediklerim', passed:'Geçtiklerim' };
const DIR_STATUS = { right:'want', left:'passed', up:'watched' };

const MOVIE_G = {28:'Aksiyon',12:'Macera',16:'Animasyon',35:'Komedi',80:'Suç',99:'Belgesel',18:'Dram',10751:'Aile',14:'Fantastik',36:'Tarih',27:'Korku',10402:'Müzik',9648:'Gizem',10749:'Romantik',878:'Bilim Kurgu',10770:'TV Filmi',53:'Gerilim',10752:'Savaş',37:'Vahşi Batı'};
const TV_G = {10759:'Aksiyon & Macera',16:'Animasyon',35:'Komedi',80:'Suç',99:'Belgesel',18:'Dram',10751:'Aile',10762:'Çocuk',9648:'Gizem',10763:'Haber',10764:'Reality',10765:'Bilim Kurgu & Fantastik',10766:'Pembe Dizi',10767:'Talk Show',10768:'Savaş & Politika',37:'Vahşi Batı'};
// Film ve dizi türleri TMDB'de farklı kimliklere sahip; filtre için ortak liste
const GENRES = [
  {id:'action', label:'Aksiyon', m:[28], t:[10759]},
  {id:'adventure', label:'Macera', m:[12], t:[10759]},
  {id:'comedy', label:'Komedi', m:[35], t:[35]},
  {id:'drama', label:'Dram', m:[18], t:[18]},
  {id:'crime', label:'Suç', m:[80], t:[80]},
  {id:'thriller', label:'Gerilim', m:[53], t:[]},
  {id:'mystery', label:'Gizem', m:[9648], t:[9648]},
  {id:'horror', label:'Korku', m:[27], t:[]},
  {id:'scifi', label:'Bilim Kurgu', m:[878], t:[10765]},
  {id:'fantasy', label:'Fantastik', m:[14], t:[10765]},
  {id:'romance', label:'Romantik', m:[10749], t:[]},
  {id:'animation', label:'Animasyon', m:[16], t:[16]},
  {id:'family', label:'Aile', m:[10751], t:[10751]},
  {id:'docu', label:'Belgesel', m:[99], t:[99]},
  {id:'history', label:'Tarih', m:[36], t:[]},
  {id:'war', label:'Savaş', m:[10752], t:[10768]},
  {id:'music', label:'Müzik', m:[10402], t:[]},
  {id:'western', label:'Vahşi Batı', m:[37], t:[37]},
  {id:'kids', label:'Çocuk', m:[], t:[10762]},
  {id:'reality', label:'Reality', m:[], t:[10764]},
];
const PERIODS = [
  {id:'all', label:'Hepsi', from:null, to:null},
  {id:'2020', label:"2020'ler", from:2020, to:null},
  {id:'2010', label:"2010'lar", from:2010, to:2019},
  {id:'2000', label:"2000'ler", from:2000, to:2009},
  {id:'1990', label:"90'lar", from:1990, to:1999},
  {id:'old', label:"80'ler ve öncesi", from:null, to:1989},
  {id:'custom', label:'Özel aralık'},
];
const SORTS = [
  {id:'random', label:'Rastgele'}, {id:'popular', label:'Popüler'},
  {id:'top', label:'En yüksek puan'}, {id:'new', label:'En yeni'},
  {id:'imdb', label:'IMDb yüksek'}, {id:'rt', label:'RT yüksek'},
];
const REGIONS = [
  {id:'all', label:'Hepsi', p:{}},
  {id:'tr', label:'Türk yapımları', p:{with_original_language:'tr'}},
  {id:'kr', label:'Kore', p:{with_original_language:'ko'}},
  {id:'anime', label:'Anime', p:{with_original_language:'ja'}, anime:true},
  {id:'jp', label:'Japon', p:{with_original_language:'ja'}},
  {id:'en', label:'İngilizce', p:{with_original_language:'en'}},
  {id:'es', label:'İspanyolca', p:{with_original_language:'es'}},
  {id:'fr', label:'Fransız', p:{with_original_language:'fr'}},
  {id:'in', label:'Hint', p:{with_original_language:'hi'}},
  {id:'cn', label:'Çin', p:{with_original_language:'zh'}},
  {id:'de', label:'Alman', p:{with_original_language:'de'}},
];
const VOTE_OPTS = [20, 50, 100, 300, 1000, 5000];
const FALLBACK_PROVIDERS = [
  {id:8, name:'Netflix', logo:''}, {id:337, name:'Disney Plus', logo:''},
  {id:119, name:'Amazon Prime Video', logo:''}, {id:350, name:'Apple TV+', logo:''}, {id:11, name:'MUBI', logo:''},
];
const DEFAULT_FILTERS = { type:'both', sort:'random', periods:[], from:1990, to:NOW_Y, genres:[], regions:[], minRating:0, minVotes:100, providers:[] };
