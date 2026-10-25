'use strict';
/* عامل الخدمة: دفتري بيشتغل بدون إنترنت بعد أول فتحة (لما ينفتح من موقع، مش من ملف على الجهاز).
   قائمة الملفات ما بنكتبها بإيدنا: بنقرأها من index.html (السكربتات والستايل) ومن core.js (الملفات اللي بتتحمّل وقت الحاجة)،
   فأي ملف بينضاف للتطبيق بيصير أوفلاين لحاله. */
const CACHE = 'daftari-v1';

async function appFiles() {
  const files = new Set(['./', 'index.html', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png']);
  const html = await (await fetch('index.html', { cache: 'no-cache' })).text();
  for (const m of html.matchAll(/(?:src|href)="((?:js|css)\/[^"?#]+)"/g)) files.add(m[1]);
  try {
    const core = await (await fetch('js/core.js', { cache: 'no-cache' })).text();
    for (const m of core.matchAll(/'((?:js|lib)\/[a-z0-9.-]+\.js)'/g)) files.add(m[1]);
  } catch { }
  return [...files];
}

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(await appFiles());
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

let told = false;
const tell = async () => { if (told) return; told = true; for (const cl of await self.clients.matchAll()) cl.postMessage({ type: 'updated' }); };

// من النسخة المحفوظة فوراً (سريع وبدون إنترنت)، وبالخلفية بنجيب الأحدث للمرة الجاية
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const key = req.mode === 'navigate' ? 'index.html' : req;
    const hit = await c.match(key, { ignoreSearch: true });
    const old = hit && hit.clone();
    const fresh = fetch(req).then(async r => {
      if (r && r.ok && r.type === 'basic') {
        // تغيّر الكود فعلاً؟ بنقول للصفحة إنه في تحديث (بيطبّق بالفتحة الجاية)
        if (old && /\.(js|css|html)$/.test(new URL(r.url).pathname)) { const [a, b] = await Promise.all([old.text(), r.clone().text()]); if (a !== b) tell(); }
        await c.put(key, r.clone());
      }
      return r;
    }).catch(() => null);
    if (hit) { e.waitUntil(fresh); return hit; }
    return (await fresh) || (req.mode === 'navigate' ? (await c.match('index.html')) : Response.error());
  })());
});
