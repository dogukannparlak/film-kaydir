'use strict';
/* ================= Filtreler ================= */
let draft = null;
const chip = (val, label, on, extra = '') => `<button class="chip" data-val="${esc(val)}" aria-pressed="${on}" ${extra}>${label}</button>`;
function genreHiddenFor(g, type) { return (type === 'movie' && !g.m.length) || (type === 'tv' && !g.t.length); }
function openFilters() {
  draft = JSON.parse(JSON.stringify(S.filters));
  renderFilterSheet();
  openSheet('#sheetFilters');
}
function renderFilterSheet() {
  const f = draft;
  const provs = S.providers || FALLBACK_PROVIDERS;
  $('#filterBody').innerHTML = `
    <section><h3>İçerik</h3><div class="chips" data-single="type">
      ${[['both','İkisi'],['movie','Film'],['tv','Dizi']].map(([v, l]) => chip(v, l, f.type === v)).join('')}</div></section>
    <section><h3>Sıralama</h3><div class="chips" data-single="sort">
      ${SORTS.map(s => chip(s.id, s.label, f.sort === s.id)).join('')}</div>
      <p class="note">Rastgele: dönemi dilimlere bölüp eski ve yeni yapımları karıştırır.<br>
      IMDb/RT: en çok oy alanlar gelir, her parti kendi içinde puana göre dizilir (yaklaşık). OMDb anahtarı gerekir; yoksa çok oy alanlar sırasıyla gelir.</p></section>
    <section><h3>Dönem</h3><div class="chips" data-single="period">
      ${PERIODS.map(p => chip(p.id, p.label, f.period === p.id)).join('')}</div>
      <div class="years ${f.period === 'custom' ? '' : 'hidden'}" id="yearsRow">
        <input type="number" inputmode="numeric" id="yFrom" min="1900" max="${NOW_Y}" value="${f.from}" aria-label="Başlangıç yılı">
        <span>–</span>
        <input type="number" inputmode="numeric" id="yTo" min="1900" max="${NOW_Y}" value="${f.to}" aria-label="Bitiş yılı"></div></section>
    <section><h3>Tür <small>birden fazla seçilebilir · herhangi biri</small></h3><div class="chips" data-multi="genres">
      ${GENRES.map(g => chip(g.id, g.label, f.genres.includes(g.id), genreHiddenFor(g, f.type) ? 'hidden' : '')).join('')}</div></section>
    <section><h3>Dil / bölge</h3><div class="chips" data-single="region">
      ${REGIONS.map(r => chip(r.id, r.label, f.region === r.id)).join('')}</div></section>
    <section><h3>Minimum puan <small id="ratingOut">${f.minRating ? '★ ' + f.minRating : 'yok'}</small></h3>
      <input type="range" id="minRating" min="0" max="9" step="0.5" value="${f.minRating}"></section>
    <section><h3>Minimum oy sayısı</h3><div class="chips" data-single="minVotes">
      ${VOTE_OPTS.map(v => chip(v, v.toLocaleString('tr-TR'), f.minVotes === v)).join('')}</div>
      <p class="note">Az bilinen yapımlar (ör. Türk dizileri) için düşük tut.</p></section>
    <section><h3>Platform <small>Türkiye · abonelikle</small></h3><div class="chips" data-multi="providers">
      ${provs.map(p => chip(p.id, `${p.logo ? `<img src="${IMG}w45${esc(p.logo)}" alt="">` : ''}${esc(p.name)}`, f.providers.includes(p.id))).join('')}</div>
      <p class="note">Seçilirse yalnız bu platformlardan en az birinde olanlar gelir.</p></section>`;
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
    if (k === 'period') $('#yearsRow').classList.toggle('hidden', raw !== 'custom');
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
    const val = k === 'providers' ? +raw : raw;
    const on = draft[k].includes(val);
    draft[k] = on ? draft[k].filter(v => v !== val) : [...draft[k], val];
    c.setAttribute('aria-pressed', !on);
  }
}
function applyFilters() {
  if (draft.period === 'custom') {
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
    f.period === 'custom' ? `${Math.min(f.from, f.to)}–${Math.max(f.from, f.to)}` : f.period === 'all' ? 'Tüm dönemler' : PERIODS.find(p => p.id === f.period).label,
  ];
  if (f.genres.length) parts.push(f.genres.map(id => GENRES.find(g => g.id === id)?.label).join(', '));
  if (f.region !== 'all') parts.push(region().label);
  if (f.minRating) parts.push('★ ' + f.minRating + '+');
  if (f.providers.length) parts.push(f.providers.length + ' platform');
  $('#summary').textContent = parts.join(' · ');
  let n = 0;
  if (f.type !== 'both') n++; if (f.sort !== 'random') n++; if (f.period !== 'all') n++;
  if (f.region !== 'all') n++; if (f.minRating) n++; if (f.minVotes !== DEFAULT_FILTERS.minVotes) n++;
  n += f.genres.length ? 1 : 0; n += f.providers.length ? 1 : 0;
  $('#filterDot').textContent = n;
  $('#filterDot').classList.toggle('hidden', !n);
}
async function loadProviders() {
  const cached = store.get(K.prov, null);
  if (cached && Date.now() - cached.at < 3 * 864e5) { S.providers = cached.list; return; }
  if (!S.apiKey) return;
  try {
    const d = await tmdb('/watch/providers/movie', { watch_region:'TR', language:'tr-TR' });
    const list = (d.results || [])
      .filter(p => p.display_priorities && p.display_priorities.TR != null)
      .sort((a, b) => a.display_priorities.TR - b.display_priorities.TR)
      .slice(0, 14)
      .map(p => ({ id:p.provider_id, name:p.provider_name, logo:p.logo_path }));
    if (list.length) { S.providers = list; store.set(K.prov, { at:Date.now(), list }); }
  } catch {}
}
