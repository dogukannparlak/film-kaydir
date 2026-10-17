'use strict';
/* ================= Letterboxd içe aktarma ================= */
// Letterboxd "Export Your Data" zip'i (ya da içindeki CSV'ler): watched.csv → İzlediklerim,
// watchlist.csv → İstek, ratings.csv → Letterboxd puanı. CSV'de TMDB kimliği yok; ad + yılla TMDB'de aranır.
const LB_FILES = ['watched.csv', 'watchlist.csv', 'ratings.csv'];

// Yalnız kök dizindeki dosyaları okur (deleted/, orphaned/ altındakiler aynı adla çakışmasın)
async function unzipFiles(buf, names) {
  const v = new DataView(buf), u8 = new Uint8Array(buf), out = {};
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('zip değil');
  let p = v.getUint32(eocd + 16, true);
  const count = v.getUint16(eocd + 10, true);
  for (let n = 0; n < count; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const method = v.getUint16(p + 10, true), size = v.getUint32(p + 20, true);
    const nameLen = v.getUint16(p + 28, true), extraLen = v.getUint16(p + 30, true), cmtLen = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + cmtLen;
    if (!names.includes(name)) continue;
    const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    const raw = u8.subarray(start, start + size);
    if (method === 0) out[name] = new TextDecoder().decode(raw);
    else if (method === 8) out[name] = await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
  }
  return out;
}
// Tırnaklı alanları ve alan içi satır sonlarını destekleyen CSV okuyucu → başlık adlı nesneler
function parseCSV(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter(r => r.some(c => c.trim()));
  return head ? body.map(r => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? '').trim()]))) : [];
}
async function readLetterboxd(files) {
  const texts = {};
  for (const f of files) {
    if (/\.zip$/i.test(f.name)) Object.assign(texts, await unzipFiles(await f.arrayBuffer(), LB_FILES));
    else if (LB_FILES.includes(f.name.toLowerCase())) texts[f.name.toLowerCase()] = await f.text();
  }
  if (!texts['watched.csv'] && !texts['watchlist.csv']) throw new Error('watched.csv ya da watchlist.csv bulunamadı');
  const rows = n => texts[n] ? parseCSV(texts[n]) : [];
  return { watched: rows('watched.csv'), watchlist: rows('watchlist.csv'), ratings: rows('ratings.csv') };
}
// Ad + yıl → TMDB filmi. Önce aynı yıl, yoksa yılsız arama ve en yakın yıl (±1).
const lbNorm = s => s.toLocaleLowerCase('en').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
async function matchTMDB(name, year) {
  const y = +year || null;
  const pickBest = (results, strictYear) => {
    const cands = results.filter(r => {
      const ry = +yearOf(r.release_date || '');
      return !y || !ry || (strictYear ? ry === y : Math.abs(ry - y) <= 1);
    });
    const n = lbNorm(name);
    return cands.find(r => lbNorm(r.original_title || '') === n || lbNorm(r.title || '') === n) || cands[0] || null;
  };
  // Letterboxd adları İngilizce olduğu için arama İngilizce yapılır; Türkçe ad ayrıntı isteğinden gelir
  let d = await tmdb('/search/movie', { query:name, primary_release_year:y || undefined, include_adult:false, language:'en-US' });
  let r = pickBest(d.results || [], true);
  if (!r && y) { d = await tmdb('/search/movie', { query:name, include_adult:false, language:'en-US' }); r = pickBest(d.results || [], false); }
  return r;
}
async function importLetterboxd(files) {
  const out = $('#lbStatus'), btn = $('#btnLetterboxd');
  if (!S.apiKey) { out.textContent = 'Önce TMDB anahtarını kaydet.'; return; }
  let data;
  try { data = await readLetterboxd(files); }
  catch (e) { out.textContent = 'Okunamadı: ' + e.message; return; }
  const rating = {};
  data.ratings.forEach(r => { rating[r['Letterboxd URI']] = +r.Rating || null; });
  // İzlenen kazanır: aynı film iki dosyada varsa İzlediklerim'e gider
  const jobs = new Map();
  data.watchlist.forEach(r => jobs.set(r['Letterboxd URI'] || r.Name + r.Year, { row:r, status:'want' }));
  data.watched.forEach(r => jobs.set(r['Letterboxd URI'] || r.Name + r.Year, { row:r, status:'watched' }));
  const list = [...jobs.values()];
  btn.disabled = true;
  let done = 0, added = 0, upgraded = 0, kept = 0;
  const missing = [];
  out.textContent = `Eşleştiriliyor… 0 / ${list.length}`;
  await pool(list, 4, async job => {
    const { row, status } = job;
    try {
      const r = await matchTMDB(row.Name, row.Year);
      if (!r) missing.push(`${row.Name} (${row.Year || '?'})`);
      else {
        // Türkçe ad + özet, IMDb kimliği ve yönetmen tek istekte
        const det = await tmdb(`/movie/${r.id}`, { language:'tr-TR', append_to_response:'external_ids,credits' }).catch(() => null);
        const it = norm(det ? { ...r, title:det.title || r.title } : r, 'movie'), cur = S.items[it.key];
        const lb = rating[row['Letterboxd URI']] || null;
        if (!cur) {
          S.items[it.key] = { id:it.id, type:'movie', title:it.title, poster:it.poster, date:it.date, status, genres:it.genres,
            rating:it.rating, imdb:det?.external_ids?.imdb_id || det?.imdb_id || null, imdbRating:null, rt:null,
            director:det ? directorOf(det, 'movie') : null, scoreAt:null,
            addedAt: Date.parse(row.Date) || Date.now(), ...(lb ? { lbRating:lb } : {}) };
          added++;
        } else if (cur.status !== 'watched' && status === 'watched') {
          // İstek/Geç'teyken Letterboxd'da izlenmiş: İzlediklerim'e taşı
          Object.assign(cur, { status:'watched', ...(lb ? { lbRating:lb } : {}) }); upgraded++;
        } else { if (lb && !cur.lbRating) cur.lbRating = lb; kept++; }
        // IMDb/RT puanları listeyi IMDb ya da RT'ye göre sıralayınca tamamlanır (scoreAt boş)
        S.seen.add(it.key);
      }
    } catch (e) {
      if (e instanceof AuthError) throw e;
      missing.push(`${row.Name} (${row.Year || '?'}) — hata`);
    }
    done++;
    if (done % 5 === 0 || done === list.length) out.textContent = `Eşleştiriliyor… ${done} / ${list.length}`;
  }).catch(e => { out.textContent = e instanceof AuthError ? 'TMDB anahtarı geçersiz.' : 'Hata: ' + e.message; });
  saveItems(); saveSeen();
  S.queue = S.queue.filter(it => !S.seen.has(it.key));
  renderDeck(); renderList(); updateCounts();
  btn.disabled = false;
  out.innerHTML = `<b>${added}</b> eklendi · <b>${upgraded}</b> İzlediklerim'e taşındı · ${kept} zaten vardı · <b>${missing.length}</b> eşleşmedi`
    + (missing.length ? `<details><summary>Eşleşmeyenler</summary><ul>${missing.map(m => `<li>${esc(m)}</li>`).join('')}</ul></details>` : '');
  toast(`Letterboxd: ${added + upgraded} film aktarıldı`);
}
