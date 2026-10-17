'use strict';
/* ================= Durum ================= */
const S = {
  apiKey: store.get(K.key, ''),
  omdbKey: store.get(K.omdb, ''),
  omdbCache: store.get(K.omdbCache, {}),
  items: store.get(K.items, {}),
  seen: new Set(store.get(K.seen, [])),
  filters: { ...DEFAULT_FILTERS, ...store.get(K.filters, {}) },
  providers: null,
  queue: [], queued: new Set(), undo: [],
  view: 'discover', listTab: 'want',
  listF: { type:'all', genre:'', period:'all', q:'', sort:'added', ...store.get(K.listF, {}) },
  dragging: false,
};
Object.keys(S.items).forEach(k => S.seen.add(k));
const saveItems = () => store.set(K.items, S.items);
const saveSeen = () => store.set(K.seen, [...S.seen]);
