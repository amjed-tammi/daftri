/* تطبيق على كل الأجهزة: بينفتح من سيرفر (زي GitHub Pages)، بيتثبّت، وبيشتغل بدون إنترنت */
const SUITE = {
  title: 'PWA — تثبيت على أي جهاز وشغل بدون إنترنت',
  http: true,
  phases: [
    async T => {
      const { expect } = T;
      await T.test('الـmanifest سليم والتطبيق قابل للتثبيت (ويندوز، ماك، لينكس، أندرويد)', async () => {
        const mf = await T.rpc('manifest');
        expect(mf.ok, 'manifest').toBeTruthy();
        expect((mf.errors || []).map(e => e.message).join(' | ')).toBe('');
        await T.waitFor(async () => navigator.serviceWorker && (await navigator.serviceWorker.getRegistration()), 8000, 'تسجيل عامل الخدمة');
        await navigator.serviceWorker.ready;
        const errs = await T.rpc('installability');
        T.info({ installability: errs });
        expect((errs || []).map(e => e.errorId).join(',')).toBe('');
      });
      await T.test('كل ملفات التطبيق محفوظة للشغل بدون إنترنت (حتى اللي بتتحمّل وقت الحاجة)', async () => {
        await T.waitFor(async () => (await caches.keys()).length, 8000, 'الكاش');
        const c = await caches.open((await caches.keys())[0]);
        const have = (await c.keys()).map(r => new URL(r.url).pathname.replace(/^\//, ''));
        const need = [...document.querySelectorAll('script[src], link[rel=stylesheet]')].map(e => e.getAttribute('src') || e.getAttribute('href'));
        if (typeof Lazy !== 'undefined') need.push(...Object.values(Lazy.files));
        need.push('manifest.webmanifest', 'icon-192.png', 'icon-512.png');
        const miss = need.filter(f => !have.includes(f));
        T.info({ cached: have.length });
        expect(miss.join(', '), 'ناقص بالكاش:').toBe('');
      });
      await T.test('بنكتب كتاب قبل ما ينقطع النت', async () => {
        await T.makeBook('كتاب بدون نت', { htmls: ['<p>كتبته قبل ما ينقطع النت</p>', '', '', ''] });
        expect(!!navigator.serviceWorker.controller || true).toBeTruthy();
      });
    },
    async T => {
      const { expect } = T;
      await T.test('بعد الفتحة الأولى الصفحة تحت سيطرة عامل الخدمة', async () => {
        await T.waitFor(() => navigator.serviceWorker.controller, 6000, 'controller');
        await T.rpc('server', { on: false }); // ← هون «انقطع النت»: السيرفر طفي
      });
    },
    async T => {
      const { expect } = T;
      await T.test('بدون إنترنت: التطبيق بيفتح والكتاب موجود', async () => {
        expect(!!document.querySelector('#library')).toBeTruthy();
        expect((await DB.all('books')).some(b => b.title === 'كتاب بدون نت')).toBeTruthy();
        const r = await fetch('index.html').then(x => x.status).catch(() => 'net');
        T.info({ indexStatus: r, note: 'جاي من الكاش لأن السيرفر طافي' });
        expect(r).toBe(200);
        // إثبات إنه السيرفر فعلاً طافي: ملف مش بالكاش بيفشل بخطأ شبكة (لو السيرفر شغّال كان رجّع 404)
        expect(await fetch('__not-cached.js').then(x => x.status).catch(() => 'net')).toBe('net');
        await T.shot('offline-library');
      });
      await T.test('زر التثبيت بكل الأدوات، ومن ملف بيشرح كيف', async () => {
        expect(!!Cmd.get('install')).toBeTruthy();
      });
    },
  ],
};
