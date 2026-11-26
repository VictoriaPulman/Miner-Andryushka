/* ================================================================
   Service Worker: офлайн-кэш + автогенерация PNG-иконок PWA
   ================================================================ */

const CACHE_NAME = 'andryushka-v2';

const ASSETS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png'
];

const ICON_SIZES = {
  'icon-192.png': 192,
  'icon-512.png': 512
};

/* ---------- Рисование иконки средствами OffscreenCanvas ---------- */

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Та же иконка, что и в icon.svg: Андрюшка, лопатка и монетка. */
function drawIcon(size) {
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const k = size / 512;
  ctx.setTransform(k, 0, 0, k, 0, 0);

  // Тёмный фон приложения (виден в углах maskable-иконки)
  ctx.fillStyle = '#2b1d14';
  ctx.fillRect(0, 0, 512, 512);

  ctx.save();
  roundRectPath(ctx, 16, 16, 480, 480, 88);
  ctx.clip();

  const bg = ctx.createLinearGradient(0, 0, 512, 512);
  bg.addColorStop(0, '#f0d9a6');
  bg.addColorStop(0.55, '#d8bb86');
  bg.addColorStop(1, '#a97843');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 512);

  // Песчинки
  ctx.fillStyle = 'rgba(141, 106, 61, 0.18)';
  [[62, 118, 3], [104, 78, 2], [430, 140, 3], [466, 212, 2],
   [52, 330, 2], [118, 436, 3], [392, 460, 2], [452, 386, 3]]
    .forEach(([x, y, r]) => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    });

  ctx.strokeStyle = 'rgba(255, 240, 207, 0.45)';
  ctx.lineWidth = 6;
  roundRectPath(ctx, 24, 24, 464, 464, 82);
  ctx.stroke();

  // Портрет в координатах SVG-символа 0..120
  ctx.translate(20, 18);
  ctx.scale(3.93, 3.93);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Лопатка
  ctx.strokeStyle = '#f2c8a0';
  ctx.lineWidth = 9;
  ctx.beginPath(); ctx.moveTo(80, 92); ctx.lineTo(95, 70); ctx.stroke();

  ctx.strokeStyle = '#8a5a2b';
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(95, 70); ctx.lineTo(104, 30); ctx.stroke();

  ctx.strokeStyle = '#c99a4c';
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(100, 46); ctx.lineTo(111, 46); ctx.stroke();

  ctx.fillStyle = '#dfe6ea';
  ctx.strokeStyle = '#71808a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(100, 34);
  ctx.quadraticCurveTo(107, 28, 111, 35);
  ctx.lineTo(108, 47);
  ctx.quadraticCurveTo(102, 50, 100, 45);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  // Плечи
  ctx.fillStyle = '#708a4c';
  ctx.strokeStyle = '#3f5530';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(34, 112);
  ctx.quadraticCurveTo(34, 82, 60, 82);
  ctx.quadraticCurveTo(86, 82, 86, 112);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  // Шея
  roundRectPath(ctx, 53, 69, 14, 15, 5);
  ctx.fillStyle = '#e6b386';
  ctx.fill();

  // Уши
  [32, 88].forEach((x) => {
    ctx.beginPath();
    ctx.arc(x, 48, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#edbd93';
    ctx.fill();
    ctx.strokeStyle = '#b98255';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });

  // Лицо
  ctx.beginPath();
  ctx.ellipse(60, 46, 28, 29, 0, 0, Math.PI * 2);
  const skin = ctx.createLinearGradient(0, 20, 0, 75);
  skin.addColorStop(0, '#f6d3ad');
  skin.addColorStop(1, '#e8b98d');
  ctx.fillStyle = skin;
  ctx.fill();
  ctx.strokeStyle = '#b98255';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Лысая макушка с бликом
  ctx.beginPath();
  ctx.ellipse(50, 28, 10, 4.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fill();

  // Брови
  ctx.strokeStyle = '#5a3a22';
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(43, 38); ctx.quadraticCurveTo(48, 35, 53, 38); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(67, 38); ctx.quadraticCurveTo(72, 35, 77, 38); ctx.stroke();

  // Глаза
  [48, 72].forEach((x) => {
    ctx.beginPath(); ctx.arc(x, 45, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#3b2b20'; ctx.fill();
    ctx.beginPath(); ctx.arc(x + 1, 44, 1, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill();
  });

  // Нос
  ctx.strokeStyle = '#c58f5f';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(60, 46); ctx.lineTo(60, 52);
  ctx.quadraticCurveTo(60, 54, 63, 54);
  ctx.stroke();

  // Короткая борода
  ctx.beginPath();
  ctx.moveTo(32, 50);
  ctx.bezierCurveTo(30, 64, 34, 78, 44, 86);
  ctx.bezierCurveTo(50, 91, 70, 91, 76, 86);
  ctx.bezierCurveTo(86, 78, 90, 64, 88, 50);
  ctx.bezierCurveTo(82, 58, 72, 62, 60, 62);
  ctx.bezierCurveTo(48, 62, 38, 58, 32, 50);
  ctx.closePath();
  const beard = ctx.createLinearGradient(0, 50, 0, 91);
  beard.addColorStop(0, '#7a5230');
  beard.addColorStop(1, '#5a3a22');
  ctx.fillStyle = beard;
  ctx.fill();
  ctx.strokeStyle = '#4a301c';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Пряди бороды
  ctx.strokeStyle = 'rgba(154, 112, 80, 0.75)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(39, 62); ctx.quadraticCurveTo(42, 73, 47, 80);
  ctx.moveTo(49, 66); ctx.quadraticCurveTo(51, 76, 54, 81);
  ctx.moveTo(60, 68); ctx.lineTo(60, 84);
  ctx.moveTo(71, 66); ctx.quadraticCurveTo(69, 76, 66, 81);
  ctx.moveTo(81, 62); ctx.quadraticCurveTo(78, 73, 73, 80);
  ctx.stroke();

  // Просвет у рта и улыбка
  ctx.beginPath();
  ctx.ellipse(60, 71, 13, 8.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#edbd93';
  ctx.fill();
  ctx.strokeStyle = '#b98255';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.strokeStyle = '#7a4626';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(51, 69); ctx.quadraticCurveTo(60, 80, 69, 69);
  ctx.stroke();

  // Усы
  ctx.fillStyle = '#5a3a22';
  ctx.strokeStyle = '#4a301c';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(60, 61);
  ctx.quadraticCurveTo(50, 54, 42, 61);
  ctx.quadraticCurveTo(50, 69, 60, 63);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(60, 61);
  ctx.quadraticCurveTo(70, 54, 78, 61);
  ctx.quadraticCurveTo(70, 69, 60, 63);
  ctx.closePath(); ctx.fill(); ctx.stroke();

  ctx.restore();

  // Золотая монетка
  ctx.save();
  ctx.translate(86, 398);
  const gold = ctx.createLinearGradient(-34, -34, 34, 34);
  gold.addColorStop(0, '#ffe089');
  gold.addColorStop(1, '#d3a02f');
  ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2);
  ctx.fillStyle = gold; ctx.fill();
  ctx.strokeStyle = '#9a7420'; ctx.lineWidth = 6; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 24, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,240,174,0.8)'; ctx.lineWidth = 3; ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -15); ctx.lineTo(4, -6); ctx.lineTo(14, -5);
  ctx.lineTo(7, 2); ctx.lineTo(9, 12); ctx.lineTo(0, 7);
  ctx.lineTo(-9, 12); ctx.lineTo(-7, 2); ctx.lineTo(-14, -5);
  ctx.lineTo(-4, -6); ctx.closePath();
  ctx.fillStyle = '#fff5cf'; ctx.fill();
  ctx.restore();

  return canvas.convertToBlob({ type: 'image/png' });
}

/** Сгенерировать PNG-ответ и положить его в кэш. */
async function generateIconResponse(size) {
  const blob = await drawIcon(size);
  const response = new Response(blob, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000'
    }
  });

  const cache = await caches.open(CACHE_NAME);
  await cache.put(new Request(`./icon-${size}.png`), response.clone());
  return response;
}

function getRequestedIconSize(request) {
  try {
    const url = new URL(request.url);
    const fileName = url.pathname.split('/').pop();
    return ICON_SIZES[fileName] || 0;
  } catch (error) {
    return 0;
  }
}

/* ---------- Жизненный цикл ---------- */

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS).catch(() => cache.addAll(ASSETS.filter((path) => !path.endsWith('.png')))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

/* ---------- Запросы ---------- */

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // PNG-иконки: если файла нет на сервере — рисуем его программно
  const iconSize = getRequestedIconSize(event.request);
  if (iconSize) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;

        return fetch(event.request)
          .then((response) => {
            if (response && response.ok) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
              return response;
            }
            return generateIconResponse(iconSize);
          })
          .catch(() => generateIconResponse(iconSize));
      })
    );
    return;
  }

  // Остальные ресурсы: сначала кэш, потом сеть
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});
