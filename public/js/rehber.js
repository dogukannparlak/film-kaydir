'use strict';
/* ================= İlk açılış rehberi ================= */
// Bu tarayıcıda bir kez gösterilir (kd_guide); Ayarlar › Kısayollar'dan yeniden açılır.
// Son adım hesap seçimidir: giriş yap / kaydol / hesapsız devam et. "Geç" doğrudan bu adıma atlar.
const GUIDE_STEPS = [
  { icon:'🎬', title:'Kaydır\'a hoş geldin', text:'Film ve dizileri kart kart keşfet, beğendiklerini listene at. Birkaç adımda nasıl çalıştığını göstereyim.' },
  { icon:'👆', title:'Kartı kaydır', html:`<ul class="guide-moves">
      <li><b style="color:var(--want)">Sağa →</b> izlemek istiyorum</li>
      <li><b style="color:var(--pass)">Sola ←</b> geç, bir daha çıkmaz</li>
      <li><b style="color:var(--watched)">Yukarı ↑</b> zaten izledim</li>
    </ul><p>Alttaki düğmeler de aynı işi yapar. Yanlış mı kaydırdın? ↶ ile geri al. Kartın üstüne dokununca özetin tamamı açılır.</p>` },
  { icon:'🎛️', title:'Filtrele ve ara', text:'Üstteki düğmelerle tür, dönem, puan ve platforma göre filtrele ya da aklındaki filmi doğrudan ara.' },
  { icon:'📚', title:'Koleksiyonun', text:'Alttaki Koleksiyonum sekmesinde İstek, İzledim ve Geç listelerin durur. Dizilerde kaldığın bölümü de işaretleyebilirsin.' },
  { icon:'👤', title:'Hesapla mı, hesapsız mı?', account:true },
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
  if (S.user) return `<p>Hesabınla giriş yaptın: listelerin ve API anahtarların bu hesapta yedekleniyor, cihazlar arasında düzenli eşitleniyor.</p>`;
  return `<p><b>Hesap açarsan</b> listelerin ve API anahtarların her cihazda aynı olur, düzenli eşitlenir. OMDb gibi anahtarlarını telefonda ya da bilgisayarda yeniden girmen gerekmez.</p>
    <p><b>Hesapsız</b> devam edersen her şey yalnız bu tarayıcıda kalır. İstediğin zaman Ayarlar › Hesap'tan giriş yapabilirsin.</p>
    <div class="guide-acc"><button class="btn btn-primary" data-acc="up">Kaydol</button><button class="btn" data-acc="in">Giriş yap</button></div>`;
}
function renderGuide() {
  const s = GUIDE_STEPS[guideStep], last = guideStep === GUIDE_STEPS.length - 1;
  const body = s.account ? accountStepHTML() : s.html || `<p>${esc(s.text)}</p>`;
  $('#guideBody').innerHTML = `<div class="guide-icon">${s.icon}</div><h2>${esc(s.title)}</h2>${body}`;
  $('#guideDots').innerHTML = GUIDE_STEPS.map((_, i) => `<i class="${i === guideStep ? 'on' : ''}"></i>`).join('');
  $('#guideBack').classList.toggle('hidden', !guideStep);
  $('#guideNext').textContent = !last ? 'İleri' : S.user ? 'Başla' : 'Hesapsız devam et';
  $('#guideNext').classList.toggle('btn-primary', !last || !!S.user); // hesap adımında öne çıkan Kaydol olsun
  $('#guideSkip').classList.toggle('hidden', last);
}
function initGuide() {
  $('#guideNext').onclick = () => { if (guideStep < GUIDE_STEPS.length - 1) { guideStep++; renderGuide(); } else closeGuide(); };
  $('#guideBack').onclick = () => { if (guideStep) { guideStep--; renderGuide(); } };
  $('#guideSkip').onclick = () => { guideStep = GUIDE_STEPS.length - 1; renderGuide(); };
  $('#guideBody').addEventListener('click', e => {
    const b = e.target.closest('[data-acc]');
    if (b) { closeGuide(); openAccount(b.dataset.acc); }
  });
  $('#btnGuide').onclick = () => { closeSheet(); openGuide(); };
  if (!store.get(K.guide, 0)) openGuide();
}
