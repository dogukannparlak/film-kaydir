'use strict';
// Eski sürümde dönem ve bölge tekliydi (period/region); şimdi dizi (periods/regions), boş = hepsi
function migrateFilters(f) {
  if (!f || typeof f !== 'object') f = {};
  if (!Array.isArray(f.periods)) f.periods = f.period && f.period !== 'all' ? [f.period] : [];
  if (!Array.isArray(f.regions)) f.regions = f.region && f.region !== 'all' ? [f.region] : [];
  delete f.period; delete f.region;
  // Bilinmeyen değerler (eski sürüm, elle düzenleme) siteyi çökertmesin
  if (!SORTS.some(s => s.id === f.sort)) delete f.sort;
  f.periods = f.periods.filter(id => PERIODS.some(p => p.id === id));
  f.regions = f.regions.filter(id => REGIONS.some(r => r.id === id));
  if (Array.isArray(f.genres)) f.genres = f.genres.filter(id => GENRES.some(g => g.id === id));
  return f;
}
/* ================= Durum ================= */
const S = {
  apiKey: store.get(K.key, ''),
  omdbKey: store.get(K.omdb, ''),
  omdbCache: store.get(K.omdbCache, {}),
  items: store.get(K.items, {}),
  seen: new Set(store.get(K.seen, [])),
  filters: { ...DEFAULT_FILTERS, ...migrateFilters(store.get(K.filters, {})) },
  providers: null,
  queue: [], queued: new Set(), undo: [],
  view: 'discover', listTab: 'want',
  listF: { type:'all', genre:'', period:'all', q:'', sort:'added', progress:'all', ...store.get(K.listF, {}) },
  dragging: false,
};
Object.keys(S.items).forEach(k => S.seen.add(k));
const saveItems = () => store.set(K.items, S.items);
const saveSeen = () => store.set(K.seen, [...S.seen]);
