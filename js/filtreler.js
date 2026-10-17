'use strict';
/* ================= Filtreler ================= */
let draft = null;
const chip = (val, label, on, extra = '') => `<button class="chip" data-val="${esc(val)}" aria-pressed="${on}" ${extra}>${label}</button>`;
function genreHiddenFor(g, type) { return (type === 'movie' && !g.m.length) || (type === 'tv' && !g.t.length); }
function openFilters() {
  draft = JSON.parse(JSON.stringify(S.filters));
  renderFilterSheet();
  openSheet('#sheetFilters');
  loadProviders().then(() => { if (draft && $('#provChips')) $('#provChips').innerHTML = providerChips(draft); });
}
function renderFilterSheet() {
  const f = draft;
  $('#filterBody').innerHTML = `
    <section><h3>İçerik</h3><div class="chips" data-single="type">
      ${[['both','İkisi'],['movie','Film'],['tv','Dizi']].map(([v, l]) => chip(v, l, f.type === v)).join('')}</div></section>
    <section><h3>Sıralama</h3><div class="chips" data-single="sort">
      ${SORTS.map(s => chip(s.id, s.label, f.sort === s.id)).join('')}</div>
      <p class="note">Rastgele: dönemi dilimlere bölüp eski ve yeni yapımları karıştırır.<br>
      IMDb/RT: en çok oy alanlar gelir, her parti kendi içinde puana göre dizilir (yaklaşık). OMDb anahtarı gerekir; yoksa çok oy alanlar sırasıyla gelir.</p></section>
    <section><h3>Dönem <small>birden fazla seçilebilir</small></h3><div class="chips" data-multi="periods">
      ${PERIODS.map(p => chip(p.id, p.label, p.id === 'all' ? !f.periods.length : f.periods.includes(p.id))).join('')}</div>
      <div class="years ${f.periods.includes('custom') ? '' : 'hidden'}" id="yearsRow">
        <input type="number" inputmode="numeric" id="yFrom" min="1900" max="${NOW_Y}" value="${f.from}" aria-label="Başlangıç yılı">
        <span>–</span>
        <input type="number" inputmode="numeric" id="yTo" min="1900" max="${NOW_Y}" value="${f.to}" aria-label="Bitiş yılı"></div></section>
    <section><h3>Tür <small>birden fazla seçilebilir · herhangi biri</small></h3><div class="chips" data-multi="genres">
      ${GENRES.map(g => chip(g.id, g.label, f.genres.includes(g.id), genreHiddenFor(g, f.type) ? 'hidden' : '')).join('')}</div></section>
    <section><h3>Dil / bölge <small>birden fazla seçilebilir</small></h3><div class="chips" data-multi="regions">
      ${REGIONS.map(r => chip(r.id, r.label, r.id === 'all' ? !f.regions.length : f.regions.includes(r.id))).join('')}</div></section>
    <section><h3>Minimum puan <small id="ratingOut">${f.minRating ? '★ ' + f.minRating : 'yok'}</small></h3>
      <input type="range" id="minRating" min="0" max="9" step="0.5" value="${f.minRating}"></section>
    <section><h3>Minimum oy sayısı</h3><div class="chips" data-single="minVotes">
      ${VOTE_OPTS.map(v => chip(v, v.toLocaleString('tr-TR'), f.minVotes === v)).join('')}</div>
      <p class="note">Az bilinen yapımlar (ör. Türk dizileri) için düşük tut.</p></section>
    <section><h3>Platform <small>abonelikle · birden fazla seçilebilir</small></h3>
      <div class="chips" data-multi="providers" id="provChips">${providerChips(f)}</div>
      <p class="note">Seçilirse bu platformlardan en az birinde (herhangi bir ülkede) olanlar gelir.</p></section>`;
}
function providerChips(f) {
  return chip('all', 'Hepsi', !f.providers.length) + providersFor().map(p => chip(p.id, `${p.logo ? `<img src="${IMG}w45${esc(p.logo)}" alt="">` : ''}${esc(p.name)}`, f.providers.includes(p.id))).join('');
}
function onFilterClick(e) {
  const c = e.target.closest('.chip');
  if (!c) return;
  const box = c.parentElement;
  const raw = c.dataset.val;
  if (box.dataset.single) {
    const k = box.dataset.single;
    draft[k] = k === 'minVotes' ? +raw : raw;
    $$('.chip', box).forEach(x => x.setAttribute('aria-pressed', x === c));
    if (k === 'type') {
      $$('[data-multi="genres"] .chip').forEach(x => {
        const g = GENRES.find(g => g.id === x.dataset.val);
        const hide = genreHiddenFor(g, raw);
        x.hidden = hide;
        if (hide) { x.setAttribute('aria-pressed', 'false'); draft.genres = draft.genres.filter(id => id !== g.id); }
      });
    }
  } else if (box.dataset.multi) {
    const k = box.dataset.multi;
    const num = s => k === 'providers' && s !== 'all' ? +s : s; // platform kimlikleri sayı
    const val = num(raw);
    const on = draft[k].includes(val);
    // "Hepsi" çipi seçimi boşaltır; boş seçim = hepsi
    draft[k] = val === 'all' ? [] : on ? draft[k].filter(v => v !== val) : [...draft[k], val];
    $$('.chip', box).forEach(x => {
      const v = num(x.dataset.val);
      x.setAttribute('aria-pressed', v === 'all' ? !draft[k].length : draft[k].includes(v));
    });
    if (k === 'periods') $('#yearsRow').classList.toggle('hidden', !draft.periods.includes('custom'));
  }
}
function applyFilters() {
  if (draft.periods.includes('custom')) {
    draft.from = clamp(parseInt($('#yFrom').value) || 1900, 1900, NOW_Y);
    draft.to = clamp(parseInt($('#yTo').value) || NOW_Y, 1900, NOW_Y);
  }
  S.filters = draft;
  store.set(K.filters, S.filters);
  closeSheet();
  updateSummary();
  resetEngine();
}
function updateSummary() {
  const f = S.filters;
  const parts = [
    SORTS.find(s => s.id === f.sort).label,
    { both:'Film + dizi', movie:'Film', tv:'Dizi' }[f.type],
    f.periods.length ? f.periods.map(id => id === 'custom' ? `${Math.min(f.from, f.to)}–${Math.max(f.from, f.to)}` : PERIODS.find(p => p.id === id)?.label).join(', ') : 'Tüm dönemler',
  ];
  if (f.genres.length) parts.push(f.genres.map(id => GENRES.find(g => g.id === id)?.label).join(', '));
  if (f.regions.length) parts.push(selRegions(f).map(r => r.label).join(', '));
  if (f.minRating) parts.push('★ ' + f.minRating + '+');
  if (f.providers.length) parts.push(f.providers.length === 1 ? (providersFor().find(p => p.id === f.providers[0])?.name || '1 platform') : f.providers.length + ' platform');
  $('#summary').textContent = parts.join(' · ');
  let n = 0;
  if (f.type !== 'both') n++; if (f.sort !== 'random') n++; if (f.periods.length) n++;
  if (f.regions.length) n++; if (f.minRating) n++; if (f.minVotes !== DEFAULT_FILTERS.minVotes) n++;
  n += f.genres.length ? 1 : 0; n += f.providers.length ? 1 : 0;
  $('#filterDot').textContent = n;
  $('#filterDot').classList.toggle('hidden', !n);
}
// Ülke başına platform listesi önbelleği (3 gün): { TR: {at, list}, US: … }
function providerCache() {
  const c = store.get(K.prov, {});
  return c && !Array.isArray(c.list) ? c : {}; // eski biçim ({at, list}, yalnız TR) atılır
}
// Bütün ülkelerin platformları tek listede: kaç ülkede öne çıktığına, sonra sırasına göre; listesi yoksa yedek liste
function providersFor() {
  const cache = providerCache(), by = new Map();
  WATCH_REGIONS.forEach(c => (cache[c]?.list || []).forEach((p, rank) => {
    const e = by.get(p.id) || { ...p, n:0, rank:0 };
    e.n++; e.rank += rank; by.set(p.id, e);
  }));
  const out = [...by.values()].sort((a, b) => b.n - a.n || a.rank / a.n - b.rank / b.n).slice(0, PROVIDER_LIMIT);
  return out.length ? out : FALLBACK_PROVIDERS;
}
async function loadProviders(countries = WATCH_REGIONS) {
  if (!S.apiKey) return;
  const cache = providerCache();
  const need = countries.filter(c => !(cache[c] && Date.now() - cache[c].at < 3 * 864e5));
  await Promise.all(need.map(async c => {
    try {
      const d = await tmdb('/watch/providers/movie', { watch_region:c, language:'tr-TR' });
      const list = (d.results || [])
        .filter(p => p.display_priorities && p.display_priorities[c] != null)
        .sort((a, b) => a.display_priorities[c] - b.display_priorities[c])
        .slice(0, 14)
        .map(p => ({ id:p.provider_id, name:p.provider_name, logo:p.logo_path }));
      if (list.length) cache[c] = { at:Date.now(), list };
    } catch {}
  }));
  if (need.length) store.set(K.prov, cache);
}
