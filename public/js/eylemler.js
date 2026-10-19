'use strict';
/* ---- Eylemler ---- */
function setItem(it, status) {
  S.items[it.key] = { id:it.id, type:it.type, title:it.title, originalTitle:it.originalTitle || '', poster:it.poster, date:it.date, status,
    genres:it.genres, rating:it.rating, imdb:it.imdb || null, imdbRating:it.scores?.imdb || null, rt:it.scores?.rt || null,
    director:it.director || null, ...(it.trailer !== undefined ? { trailer:it.trailer } : {}), ...(it.collection !== undefined ? { collection:it.collection } : {}),
    scoreAt:it.scores ? Date.now() : null, addedAt:Date.now() };
  saveItems();
}
function act(dir, from) {
  const it = S.queue[0];
  if (!it) return;
  if (!from && S.dragging) return;
  S.queue.shift(); S.queued.delete(it.key);
  const prev = S.items[it.key] ? { ...S.items[it.key] } : null;
  const wasSeen = S.seen.has(it.key);
  setItem(it, DIR_STATUS[dir]);
  S.seen.add(it.key); saveSeen();
  S.undo.push({ it, prev, wasSeen, dir });
  if (S.undo.length > 50) S.undo.shift();
  const el = $(keySel(it.key) + ':not(.leaving)');
  if (el) flyOut(el, dir, from);
  const btn = $(`.act[data-dir="${dir}"]`);
  btn.classList.add('pop'); setTimeout(() => btn.classList.remove('pop'), 160);
  vibrate();
  renderDeck(); updateCounts();
  if (!S.user) guestNudge();
}
function undo() {
  const u = S.undo.pop();
  if (!u) return;
  const { it } = u;
  if (u.prev) S.items[it.key] = u.prev; else delete S.items[it.key];
  saveItems();
  if (!u.wasSeen) { S.seen.delete(it.key); saveSeen(); }
  $$(keySel(it.key)).forEach(e => e.remove());
  S.queue.unshift(it); S.queued.add(it.key);
  // Kart çıktığı yönden geri gelsin
  const el = createCard(it);
  el.dataset.depth = 0; el.style.zIndex = 10;
  el.style.transition = 'none';
  const off = { right:`translate(${innerWidth}px,0) rotate(28deg)`, left:`translate(${-innerWidth}px,0) rotate(-28deg)`, up:`translate(0,${-innerHeight}px)` }[u.dir];
  el.style.transform = off;
  $('#deck').appendChild(el);
  el.getBoundingClientRect();
  el.style.transition = '';
  el.style.transform = '';
  renderDeck(); updateCounts();
  if (S.view === 'lists') renderList();
}
