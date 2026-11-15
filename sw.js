// =============================================
// FINCONTROL PRO - SERVICE WORKER
// Atualize VERSION a cada publicação para renovar o cache.
// =============================================
const VERSION = 'fincontrol-v6.3.0';
const SHELL_CACHE = `${VERSION}-shell`;
const CDN_CACHE = `${VERSION}-cdn`;

// Arquivos do próprio app, guardados na instalação para abrir offline.
const SHELL_FILES = [
  './',
  './index.html',
  './styles-modern.css',
  './app.js',
  './app-charts.js',
  './app-notifications.js',
  './app-export.js',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './favicon-48.png',
  './apple-touch-icon.png',
  './logo-fincontrol-pro.svg',
  './logo-fincontrol-pro-dark.svg',
  './fonts/instrument-sans.woff2'
];

// Bibliotecas externas com versão fixa na URL: podem vir direto do cache.
const CDN_HOSTS = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'cdn.sheetjs.com'];
const isFirebaseSdk = (url) => url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/');

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Arquivos do app: rede primeiro (sempre a versão mais nova), cache se offline.
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Bibliotecas (Chart.js, jsPDF, SheetJS, Font Awesome, SDK do Firebase): cache primeiro.
  if (CDN_HOSTS.includes(url.hostname) || isFirebaseSdk(url)) {
    event.respondWith(cacheFirst(request));
  }

  // Demais requisições (Firestore, Auth, APIs do Google) não passam pelo cache.
});

async function networkFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: request.mode === 'navigate' });
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const shell = await cache.match('./index.html');
      if (shell) return shell;
    }
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CDN_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  // Respostas "opaque" (status 0) de CDNs sem CORS também podem ser guardadas.
  if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
  return response;
}
