'use strict';
/* ================= Yeni sezon tespiti + fragman ================= */
// İzlediklerim'deki dizilerde, diziyi İzledim'e eklediğin tarihten (addedAt) SONRA ilk bölümü yayınlanan sezon "yeni" sayılır.
// Bulununca "◐ Yeni sezon" işareti kendiliğinden konur. İşareti kaldırınca o sezon görüldü sayılır (seasonAck) ve bir daha konmaz.
// "Bıraktım" işaretli dizilere dokunulmaz. Yayın tarihi açıklanmış gelecek sezon da bilgi olarak gösterilir.
const SEASON_CHECK_EVERY = 12 * 3600e3, SEASON_BATCH = 40;
let seasonChecking = false;
const dayStr = ms => new Date(ms).toISOString().slice(0, 10);
const shortDate = d => new Date(d + 'T00:00:00').toLocaleDateString(LOCALE, { day:'numeric', month:'short' });
async function checkNewSeasons() {
  if (seasonChecking || !tmdbReady()) return;
  const due = Object.entries(S.items).filter(([, i]) => i.type === 'tv' && i.status === 'watched' && !(Date.now() - (i.tvCheckedAt || 0) < SEASON_CHECK_EVERY)).slice(0, SEASON_BATCH);
  if (!due.length) return;
  seasonChecking = true;
  const found = [];
  await pool(due, 3, async ([k, i]) => {
    try {
      const d = await tmdb(`/tv/${i.id}`, { language:LOCALE });
      const item = S.items[k];
      if (!item || item.status !== 'watched') return;
      const since = dayStr(item.addedAt || Date.now());
      const aired = (d.seasons || []).filter(s => s.season_number > 0 && s.air_date && s.air_date <= TODAY);
      item.latestSeason = Math.max(0, ...aired.map(s => s.season_number));
      item.tvCheckedAt = Date.now();
      // Eklendikten sonra başlayan ve henüz "görüldü" denmemiş en son sezon
      const fresh = aired.filter(s => s.air_date > since && s.season_number > (item.seasonAck || 0)).sort((a, b) => b.season_number - a.season_number)[0];
      if (fresh && item.progress !== 'dropped') {
        if (item.newSeason?.n !== fresh.season_number) found.push(item.title);
        item.newSeason = { n: fresh.season_number, date: fresh.air_date };
        if (item.progress !== 'watching') item.progress = 'season';
      }
      // Tarihi açıklanmış gelecek sezon (bilgi)
      const nx = d.next_episode_to_air;
      item.nextSeason = nx && nx.season_number > item.latestSeason && nx.air_date ? { n: nx.season_number, date: nx.air_date } : null;
    } catch {}
  });
  saveItems();
  seasonChecking = false;
  if (S.view === 'lists') renderList();
  if (found.length) toast(`${t('Yeni sezon')} · ${found.length === 1 ? found[0] : t('{n} dizi', { n:found.length })}`, t('Göster'), showNewSeasons, 6000);
  // Kalan varsa sonraki partiyi biraz sonra kontrol et
  if (Object.values(S.items).some(i => i.type === 'tv' && i.status === 'watched' && !(Date.now() - (i.tvCheckedAt || 0) < SEASON_CHECK_EVERY))) setTimeout(checkNewSeasons, 5000);
}
function showNewSeasons() {
  setView('lists');
  S.listTab = 'watched';
  $$('#listTabs button').forEach(x => x.setAttribute('aria-selected', x.dataset.tab === 'watched'));
  S.listF.progress = 'season'; $('#lProgress').value = 'season'; store.set(K.listF, S.listF);
  listOrder = null; renderList();
}
// "Yeni sezon" işareti kaldırılınca: o ana kadar yayınlanan sezonlar görüldü
function ackSeason(item) {
  item.seasonAck = Math.max(item.seasonAck || 0, item.newSeason?.n || 0, item.latestSeason || 0);
  delete item.newSeason;
}
function seasonBadges(i) {
  if (i.type !== 'tv' || i.status !== 'watched') return '';
  return (i.newSeason && ['season', 'watching'].includes(i.progress) ? `<span class="sc sc-new" title="${t('Eklediğinden sonra yayınlandı')}">${ico('newseason')} ${t('{n}. sezon', { n:i.newSeason.n })} · ${shortDate(i.newSeason.date)}</span>` : '')
    + (i.nextSeason ? `<span class="sc" title="${t('Yayın tarihi açıklandı')}">${ico('upcoming')} ${t('{n}. sezon', { n:i.nextSeason.n })} · ${shortDate(i.nextSeason.date)}</span>` : '');
}

/* ---- Fragman ---- */
// YouTube fragmanı: önce Türkçe, sonra İngilizce; resmi "Trailer" > "Teaser"
function pickTrailer(videos) {
  const yt = (videos || []).filter(v => v.site === 'YouTube' && v.key);
  const rank = v => (v.type === 'Trailer' ? 0 : v.type === 'Teaser' ? 2 : 4) + (v.official ? 0 : 1) + (v.iso_639_1 === LANG ? 0 : 0.5);
  return yt.filter(v => ['Trailer', 'Teaser'].includes(v.type)).sort((a, b) => rank(a) - rank(b))[0]?.key || null;
}
const trailerURL = key => `https://www.youtube.com/watch?v=${encodeURIComponent(key)}`;
// Listede fragman kimliği henüz yoksa: pencereyi tıklama anında aç (açılır pencere engeline takılmasın), sonra adrese yönlendir
async function openTrailer(type, id) {
  const key = `${type}:${id}`, item = S.items[key];
  if (item?.trailer) { window.open(trailerURL(item.trailer), '_blank', 'noopener'); return; }
  const w = window.open('about:blank', '_blank');
  try {
    const d = await tmdb(`/${type}/${id}/videos`, { language:LOCALE, include_video_language:`${LANG},en,null` });
    const tk = pickTrailer(d.results);
    if (item) { item.trailer = tk || ''; saveItems(); }
    if (tk && w) w.location.href = trailerURL(tk);
    else { w?.close(); toast(t('Fragman bulunamadı')); }
  } catch { w?.close(); toast(t('Fragman alınamadı')); }
}
