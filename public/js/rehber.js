'use strict';
/* ================= İlk açılış rehberi ================= */
// Bu tarayıcıda bir kez gösterilir (kd_guide); Ayarlar › Kısayollar'dan yeniden açılır.
// Son adım hesap seçimidir: giriş yap / kaydol / hesapsız devam et. "Geç" doğrudan bu adıma atlar.
const GUIDE_STEPS = [
  { icon:'ticket', title:t('Kaydır\'a hoş geldin'), text:t('Film ve dizileri kart kart keşfet, beğendiklerini listene at. Birkaç adımda nasıl çalıştığını göstereyim.') },
  { icon:'discover', title:t('Kartı kaydır'), html:`<ul class="guide-moves">
      <li><b style="color:var(--want)">${t('Sağa →')}</b> ${t('izlemek istiyorum')}</li>
      <li><b style="color:var(--pass)">${t('Sola ←')}</b> ${t('geç, bir daha çıkmaz')}</li>
      <li><b style="color:var(--watched)">${t('Yukarı ↑')}</b> ${t('zaten izledim')}</li>
    </ul><p>${t('Alttaki düğmeler de aynı işi yapar. Yanlış mı kaydırdın? Geri al düğmesiyle geri al. Kartın üstüne dokununca özetin tamamı açılır.')}</p>` },
  { icon:'filter', title:t('Filtrele ve ara'), text:t('Üstteki düğmelerle tür, dönem, puan ve platforma göre filtrele ya da aklındaki filmi doğrudan ara.') },
  { icon:'collection', title:t('Koleksiyonun'), text:t('Alttaki Koleksiyonum sekmesinde İstek, İzledim ve Geç listelerin durur. Dizilerde kaldığın bölümü de işaretleyebilirsin.') },
  { icon:'key', title:t('API anahtarları'), html:`<ul class="guide-moves">
      <li><b>TMDB</b> · ${t('film ve dizi verisi.')} <b>${t('Gerekmez:')}</b> ${t('site ortak bağlantıyla çalışır. İstersen kendi anahtarını girersin.')}</li>
      <li><b>OMDb</b> · ${t('isteğe bağlı. Kartlara')} <b>${t('IMDb, Rotten Tomatoes ve Metacritic')}</b> ${t('puanlarını ve IMDb/RT sıralamasını açar.')}</li>
    </ul><p>${t('Ücretsiz OMDb anahtarı:')} <a href="https://www.omdbapi.com/apikey.aspx" target="_blank" rel="noopener">omdbapi.com/apikey.aspx</a> ${t('→ FREE, e-postadan etkinleştir, Ayarlar\'a yapıştır. İstersen Ayarlar\'dan hesabında şifreli saklarsın, her cihaza gelir.')}</p>
    <button class="btn btn-ico guide-settings" data-guide-settings>${ico('settings')} ${t('Ayarlar\'ı aç')}</button>` },
  { icon:'account', title:t('Hesapla mı, hesapsız mı?'), account:true },
];
let guideStep = 0;
function openGuide() {
  guideStep = 0; renderGuide();
  $('#guide').classList.remove('hidden');
}
function closeGuide() {
  $('#guide').classList.add('hidden');
  store.set(K.guide, 1);
}
function accountStepHTML() {
  if (S.user) return `<p>${t('Hesabınla giriş yaptın: listelerin bu hesapta yedekleniyor, cihazlar arasında düzenli eşitleniyor. API anahtarlarını da Ayarlar\'dan şifreli saklayabilirsin.')}</p>`;
  return `<p><b>${t('Hesap açarsan')}</b> ${t('listelerin her cihazda aynı olur, düzenli eşitlenir. İstersen API anahtarlarını da şifreli saklarsın; telefonda ya da bilgisayarda yeniden girmen gerekmez.')}</p>
    <p><b>${t('Hesapsız')}</b> ${t('devam edersen her şey yalnız bu sekmede kalır, sekmeyi kapatınca silinir. İstediğin zaman Ayarlar › Hesap\'tan kayıt olabilirsin.')}</p>
    <div class="guide-acc"><button class="btn btn-primary" data-acc="up">${t('Kaydol')}</button><button class="btn" data-acc="in">${t('Giriş yap')}</button></div>`;
}
function renderGuide() {
  const s = GUIDE_STEPS[guideStep], last = guideStep === GUIDE_STEPS.length - 1;
  const body = s.account ? accountStepHTML() : s.html || `<p>${esc(s.text)}</p>`;
  $('#guideBody').innerHTML = `<div class="guide-icon">${ico(s.icon)}</div><h2>${esc(s.title)}</h2>${body}`;
  $('#guideDots').innerHTML = GUIDE_STEPS.map((_, i) => `<i class="${i === guideStep ? 'on' : ''}"></i>`).join('');
  $('#guideBack').classList.toggle('hidden', !guideStep);
  $('#guideNext').textContent = !last ? t('İleri') : S.user ? t('Başla') : t('Hesapsız devam et');
  $('#guideNext').classList.toggle('btn-primary', !last || !!S.user); // hesap adımında öne çıkan Kaydol olsun
  $('#guideSkip').classList.toggle('hidden', last);
}
function initGuide() {
  $('#guideNext').onclick = () => { if (guideStep < GUIDE_STEPS.length - 1) { guideStep++; renderGuide(); } else closeGuide(); };
  $('#guideBack').onclick = () => { if (guideStep) { guideStep--; renderGuide(); } };
  if (LANG === 'en') $('#guideSkip').textContent = 'Skip'; // html'deki "Geç" sözlükte kaydırma "Pass"ı; rehberde atlama
  $('#guideSkip').onclick = () => { guideStep = GUIDE_STEPS.length - 1; renderGuide(); };
  $('#guideBody').addEventListener('click', e => {
    const b = e.target.closest('[data-acc]');
    if (b) { closeGuide(); openAccount(b.dataset.acc); }
    if (e.target.closest('[data-guide-settings]')) { closeGuide(); openSettings(); }
  });
  $('#btnGuide').onclick = () => { closeSheet(); openGuide(); };
  if (!store.get(K.guide, 0)) openGuide();
}
