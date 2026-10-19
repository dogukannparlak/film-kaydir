'use strict';
/* ================= Yönetim bağlantısı ================= */
// Yönetim paneli ayrı sayfadır (admin.html, js/yonetim.js). Burada yalnız Ayarlar › Yönetim düğmesi:
// is_admin() true dönerse görünür (yetki sunucuda denetlenir; düğmeyi gizlemek yalnız arayüz kolaylığıdır).
async function checkAdmin() {
  let on = false;
  if (S.user && sb) { const { data, error } = await sb.rpc('is_admin'); on = !error && data === true; }
  $('#adminSec')?.classList.toggle('hidden', !on);
}
function initAdmin() {
  $('#btnAdmin').onclick = () => window.open('admin.html', '_blank', 'noopener');
}
