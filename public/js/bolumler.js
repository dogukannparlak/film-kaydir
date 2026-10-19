'use strict';
/* ================= İzliyorum: kaldığın sezon / bölüm ================= */
// İzlediklerim'deki dizide "▶ İzliyorum" işareti + kaldığın yer: item.at = { s: sezon, e: bölüm } (o bölümü izledin).
// Sezon bilgisi (yayınlanmış bölüm sayıları) TMDB /tv/{id}'den gelir, öğede 12 saat saklanır: item.eps = [[sezon, yayınlanmış bölüm]].
const EP_TTL = 12 * 3600e3;
async function loadEpisodes(item) {
  if (item.eps && Date.now() - (item.epsAt || 0) < EP_TTL) return item.eps;
  const d = await tmdb(`/tv/${item.id}`, { language:LOCALE });
  const last = d.last_episode_to_air; // yayınlanmış son bölüm: o sezonda sonrası henüz yok
  item.eps = (d.seasons || []).filter(s => s.season_number > 0 && s.episode_count > 0 && s.air_date && s.air_date <= TODAY)
    .map(s => [s.season_number, last && s.season_number === last.season_number ? last.episode_number : last && s.season_number > last.season_number ? 0 : s.episode_count])
    .filter(([, n]) => n > 0);
  item.epsAt = Date.now();
  saveItems();
  return item.eps;
}
const epLabel = at => at ? t('{s}. sezon {e}. bölüm', { s:at.s, e:at.e }) : t('Kaldığın yeri seç');
// Sonraki yayınlanmış bölüm (yoksa null)
function nextEp(eps, at) {
  if (!at) return eps.length ? { s: eps[0][0], e: 1 } : null;
  const cur = eps.find(([s]) => s === at.s);
  if (cur && at.e < cur[1]) return { s: at.s, e: at.e + 1 };
  const nx = eps.find(([s]) => s > at.s);
  return nx ? { s: nx[0], e: 1 } : null;
}
let epItemKey = null, epSeason = null;
async function openEpisodes(key) {
  const item = S.items[key];
  if (!item) return;
  epItemKey = key;
  $('#epTitle').textContent = titles(item).main;
  $('#epBody').innerHTML = '<div class="empty"><span class="spinner"></span></div>';
  openSheet('#sheetEpisode');
  try {
    const eps = await loadEpisodes(item);
    epSeason = item.at?.s || eps[0]?.[0] || 1;
    renderEpisodes();
  } catch { $('#epBody').innerHTML = `<div class="empty"><b>${t('Bölümler alınamadı')}</b>${t('Bağlantını kontrol et.')}</div>`; }
}
function renderEpisodes() {
  const item = S.items[epItemKey];
  if (!item) return;
  const eps = item.eps || [], cur = eps.find(([s]) => s === epSeason) || eps[0];
  if (!cur) { $('#epBody').innerHTML = `<div class="empty"><b>${t('Yayınlanmış bölüm yok')}</b></div>`; return; }
  const at = item.at;
  $('#epBody').innerHTML = `
    <p class="note" style="margin:0 0 10px">${t('Son izlediğin bölüme dokun. Şu an:')} <b>${epLabel(at)}</b></p>
    <div class="chips ep-seasons">${eps.map(([s, n]) => `<button class="chip" data-ep-season="${s}" aria-pressed="${s === cur[0]}">${t('{s}. sezon', { s })} <small>${n}</small></button>`).join('')}</div>
    <div class="ep-grid">${Array.from({ length: cur[1] }, (_, n) => n + 1).map(e => {
      const seen = at && (cur[0] < at.s || (cur[0] === at.s && e <= at.e));
      return `<button class="ep${seen ? ' seen' : ''}${at && cur[0] === at.s && e === at.e ? ' here' : ''}" data-ep="${e}">${e}</button>`;
    }).join('')}</div>`;
}
function onEpisodeClick(e) {
  const sb = e.target.closest('[data-ep-season]');
  if (sb) { epSeason = +sb.dataset.epSeason; renderEpisodes(); return; }
  const b = e.target.closest('[data-ep]');
  if (!b) return;
  const item = S.items[epItemKey];
  if (!item) return;
  setAt(epItemKey, { s: epSeason, e: +b.dataset.ep });
  closeSheet();
}
// Kaldığın yeri yaz; İzliyorum işaretini koy, geri alınabilir
function setAt(key, at) {
  const item = S.items[key], snap = { ...item };
  item.at = at;
  item.progress = 'watching';
  saveItems(); renderList();
  const last = item.eps?.at(-1);
  const end = last && at.s === last[0] && at.e === last[1];
  toast(end ? t('{label} · yayınlanan son bölüm', { label:epLabel(at) }) : t('Kaldığın yer: {label}', { label:epLabel(at) }), t('Geri al'), () => { S.items[key] = snap; saveItems(); renderList(); }, 4000);
}
// Satırdaki "+1": sonraki yayınlanmış bölüm
async function nextEpisode(key) {
  const item = S.items[key];
  if (!item) return;
  try {
    const n = nextEp(await loadEpisodes(item), item.at);
    if (n) setAt(key, n);
    else toast(t('Yayınlanan son bölümdesin'), t('Bitti say'), () => { const it = S.items[key]; if (!it) return; delete it.progress; delete it.at; ackSeason(it); saveItems(); renderList(); }, 5000);
  } catch { toast(t('Bölümler alınamadı')); }
}
// Liste satırı: "📍 2. sezon 5. bölüm ›" + "+1"
function watchingRow(i) {
  if (i.type !== 'tv' || i.status !== 'watched' || i.progress !== 'watching') return '';
  return `<div class="ep-row"><button class="ep-where" data-ep-open>${ico('pin')} ${epLabel(i.at)} ›</button>${i.at ? `<button class="ep-next" data-ep-next title="${t('Sonraki bölümü izledim')}">${t('+1 bölüm')}</button>` : ''}</div>`;
}
