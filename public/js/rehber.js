'use strict';
/* ================= İlk açılış rehberi ================= */
// Bu tarayıcıda bir kez gösterilir (kd_guide); Ayarlar › Rehber'den yeniden açılır.
const GUIDE_STEPS = [
  { icon:'🎬', title:'Kaydır\'a hoş geldin', text:'Film ve dizileri kart kart keşfet, beğendiklerini listene at. Birkaç adımda nasıl çalıştığını göstereyim.' },
  { icon:'👆', title:'Kartı kaydır', html:`<ul class="guide-moves">
      <li><b style="color:var(--want)">Sağa →</b> izlemek istiyorum</li>
      <li><b style="color:var(--pass)">Sola ←</b> geç, bir daha çıkmaz</li>
      <li><b style="color:var(--watched)">Yukarı ↑</b> zaten izledim</li>
    </ul><p>Alttaki düğmeler de aynı işi yapar. Yanlış mı kaydırdın? ↶ ile geri al. Kartın üstüne dokununca özetin tamamı açılır.</p>` },
  { icon:'🎛️', title:'Filtrele ve ara', text:'Üstteki düğmelerle tür, dönem, puan ve platforma göre filtrele ya da aklındaki filmi doğrudan ara.' },
  { icon:'📚', title:'Koleksiyonun', text:'Alttaki Koleksiyonum sekmesinde İstek, İzledim ve Geç listelerin durur. Dizilerde kaldığın bölümü de işaretleyebilirsin.' },
  { icon:'🔑', title:'Başlamak için', html:`<p>Film verisi TMDB'den gelir: ücretsiz bir TMDB anahtarı gerekir, sonraki ekranda nasıl alınacağı yazıyor.</p>
    <p><b>Hesap açarsan</b> listelerin ve API anahtarların hesabında yedeklenir; telefonda ya da bilgisayarda giriş yapınca anahtarı yeniden girmen gerekmez.</p>`,
    extra:'<button class="linkish" id="guideLogin">Hesabım var, giriş yap</button>' },
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
function renderGuide() {
  const s = GUIDE_STEPS[guideStep], last = guideStep === GUIDE_STEPS.length - 1;
  $('#guideBody').innerHTML = `<div class="guide-icon">${s.icon}</div><h2>${esc(s.title)}</h2>${s.html || `<p>${esc(s.text)}</p>`}${s.extra || ''}`;
  $('#guideDots').innerHTML = GUIDE_STEPS.map((_, i) => `<i class="${i === guideStep ? 'on' : ''}"></i>`).join('');
  $('#guideBack').classList.toggle('hidden', !guideStep);
  $('#guideNext').textContent = last ? 'Başla' : 'İleri';
  $('#guideSkip').classList.toggle('hidden', last);
}
function initGuide() {
  $('#guideNext').onclick = () => { if (guideStep < GUIDE_STEPS.length - 1) { guideStep++; renderGuide(); } else closeGuide(); };
  $('#guideBack').onclick = () => { if (guideStep) { guideStep--; renderGuide(); } };
  $('#guideSkip').onclick = closeGuide;
  $('#guideBody').addEventListener('click', e => { if (e.target.id === 'guideLogin') { closeGuide(); openAccount(); } });
  $('#btnGuide').onclick = () => { closeSheet(); openGuide(); };
  if (!store.get(K.guide, 0)) openGuide();
}
