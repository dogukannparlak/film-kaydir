'use strict';
/* ---- Sürükleme (Pointer Events) ---- */
function thresholds() { return { x: Math.min(120, innerWidth * 0.26), y: Math.min(130, innerHeight * 0.16) }; }
function stampLevels(dx, dy) {
  const th = thresholds();
  const up = -dy > Math.abs(dx) ? clamp(-dy / th.y, 0, 1) : 0;
  return { want: up ? 0 : clamp(dx / th.x, 0, 1), pass: up ? 0 : clamp(-dx / th.x, 0, 1), watched: up };
}
function setStamps(el, lv) {
  $('.stamp-want', el).style.opacity = lv.want;
  $('.stamp-pass', el).style.opacity = lv.pass;
  $('.stamp-watched', el).style.opacity = lv.watched;
}
function attachDrag(el) {
  let id = null, sx = 0, sy = 0, dx = 0, dy = 0, moved = false, samples = [];
  el.addEventListener('pointerdown', e => {
    if (el.dataset.depth !== '0' || el.classList.contains('leaving')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.target.closest('a, .coll-tag')) return; // IMDb bağlantısı ve seri etiketi kartı sürüklemesin
    if (el.classList.contains('expanded') && e.target.closest('.overview')) return; // özeti kaydırmaya izin ver
    id = e.pointerId; el.setPointerCapture(id);
    sx = e.clientX; sy = e.clientY; dx = dy = 0; moved = false;
    samples = [{ x:sx, y:sy, t:e.timeStamp }];
    el.style.transition = 'none';
    S.dragging = true;
  });
  el.addEventListener('pointermove', e => {
    if (e.pointerId !== id) return;
    dx = e.clientX - sx; dy = e.clientY - sy;
    if (!moved && Math.hypot(dx, dy) > 6) moved = true;
    samples.push({ x:e.clientX, y:e.clientY, t:e.timeStamp });
    if (samples.length > 6) samples.shift();
    el.style.transform = `translate(${dx}px,${dy}px) rotate(${dx / 18}deg)`;
    setStamps(el, stampLevels(dx, dy));
    $('#deck').style.setProperty('--p', clamp(Math.hypot(dx, dy) / 160, 0, 1));
  });
  const end = e => {
    if (e.pointerId !== id) return;
    id = null; S.dragging = false;
    $('#deck').style.setProperty('--p', 0);
    const a = samples[0], b = samples[samples.length - 1], dt = Math.max(1, b.t - a.t);
    const vx = (b.x - a.x) / dt, vy = (b.y - a.y) / dt; // px/ms
    const th = thresholds();
    let dir = null;
    if (e.type !== 'pointercancel') {
      if (-dy > Math.abs(dx) && (-dy > th.y || (vy < -0.6 && -dy > 40))) dir = 'up';
      else if (dx > th.x || (vx > 0.6 && dx > 40)) dir = 'right';
      else if (dx < -th.x || (vx < -0.6 && dx < -40)) dir = 'left';
    }
    if (dir) return act(dir, { dx, dy });
    el.style.transition = '';
    el.style.transform = '';
    setStamps(el, { want:0, pass:0, watched:0 });
    if (!moved && e.type === 'pointerup') el.classList.toggle('expanded');
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}
function flyOut(el, dir, from = { dx:0, dy:0 }) {
  el.classList.add('leaving');
  el.style.zIndex = 20;
  const W = innerWidth + el.offsetWidth, H = innerHeight + el.offsetHeight;
  let x = 0, y = 0, r = 0;
  if (dir === 'right') { x = W; y = from.dy * 2; r = 28; }
  if (dir === 'left') { x = -W; y = from.dy * 2; r = -28; }
  if (dir === 'up') { x = from.dx * 2; y = -H; r = from.dx / 15; }
  setStamps(el, { want: +(dir === 'right'), pass: +(dir === 'left'), watched: +(dir === 'up') });
  el.style.transition = 'transform .5s cubic-bezier(.3,.7,.3,1), opacity .5s';
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.style.transform = `translate(${x}px,${y}px) rotate(${r}deg)`;
    el.style.opacity = '.4';
  }));
  setTimeout(() => el.remove(), 520);
}
