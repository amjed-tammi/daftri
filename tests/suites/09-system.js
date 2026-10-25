const SUITE = {
  title: 'تصميم النظام — مصدر واحد للحقيقة، الترابط، وما في تسريب',
  phases: [async T => {
    const { expect } = T;
    // المخطط بينقرأ من كود التطبيق نفسه (DB.open)، فأي نسخة أو مخزن جديد بينفحص لحاله بدون تعديل هون
    const dbSrc = DB.open.toString();
    const VERSION = +(dbSrc.match(/indexedDB\.open\(\s*'daftari'\s*,\s*(\d+)\s*\)/) || [])[1];
    const STORES = JSON.parse(((dbSrc.match(/for \(const s of (\[[^\]]+\])\)/) || [])[1] || '[]').replace(/'/g, '"'));

    await T.test('قاعدة البيانات: النسخة والمخازن الحقيقية مطابقة للمخطط', async () => {
      expect(VERSION > 0 && STORES.length > 0, 'ما قدرت أقرأ المخطط من DB.open').toBeTruthy();
      expect(STORES.includes('books') && STORES.includes('pages'), 'المخازن الأساسية').toBeTruthy();
      const d = await DB.open();
      expect(d.name).toBe('daftari');
      expect(d.version).toBe(VERSION);
      expect([...d.objectStoreNames].sort()).toEqual(STORES.slice().sort());
      for (const s of STORES) expect(Array.isArray(await DB.all(s)), s).toBeTruthy();
      T.info({ version: d.version, stores: [...d.objectStoreNames] });
    });

    await T.test('ورق أي كتاب جديد جاي من مكان واحد: Settings', async () => {
      const p = Settings.newPaper();
      expect(p).toEqual(Settings.d.paper);
      p.tone = '__changed__';
      expect(Settings.d.paper.tone !== '__changed__', 'newPaper لازم يرجع نسخة مش نفس الكائن').toBeTruthy();
      const b = await T.makeBook('مصدر الحقيقة');
      expect((await DB.get('books', b.id)).paper).toEqual(Settings.d.paper);
      // كتاب قديم ناقصه حقول: القارئ بيكمّلها من الإعدادات
      const old = await DB.get('books', b.id); old.paper = { tone: Settings.d.paper.tone }; await DB.put('books', old);
      await Reader.open(b.id, 0); await T.sleep(400); T.quiet();
      for (const k of Object.keys(Settings.d.paper)) expect(k in Reader.book.paper, 'حقل ناقص: ' + k).toBeTruthy();
      Reader.close(); await T.sleep(300);
    });

    await T.test('كل خطوة بالجولات بتلاقي العنصر اللي بتأشر عليه', async () => {
      const missing = [];
      const check = (name, s) => {
        if (!s.el || s.center) return;
        if (s.bar) Bars.show('#topbar');
        if (s.nav) Bars.show('#navbar');
        if (!Tour.target(s) && !s.optional) missing.push(`${name}: ${s.title}`);
      };
      TOURS.lib.forEach(s => check('lib', s));
      const b = await T.makeBook('جولة', { htmls: ['<h2>عنوان</h2><p>نص</p>', '', '', ''] });
      await Reader.open(b.id, 0); await T.sleep(700); T.quiet();
      for (const s of TOURS.book) { check('book', s); await T.sleep(60); }
      T.info({ lib: TOURS.lib.length, book: TOURS.book.length });
      Reader.close(); await T.sleep(300);
      expect(missing.join(' | '), 'خطوات ضايعة:').toBe('');
    });

    await T.test('الصفحة المرسومة بنفس المقاس المنطقي (PW×PH)', async () => {
      const b = (await DB.all('books'))[0];
      await Reader.open(b.id, 0); await T.sleep(600); T.quiet();
      const pg = document.querySelector('.page[data-i="0"]');
      expect(pg.offsetWidth).toBe(PW);
      expect(pg.offsetHeight).toBe(PH);
      Reader.close(); await T.sleep(300);
    });

    await T.test('فتح وسكّر كتاب 10 مرات: ما في تسريب (محررات، عناصر، مستمعين)', async () => {
      const b = await T.makeBook('تسريب', { htmls: ['<p>' + 'نص '.repeat(200) + '</p>', '<p>صفحة ٢</p>', '', ''] });
      const count = () => document.getElementsByTagName('*').length;
      const listeners = async () => { await T.gc(); await T.sleep(100); await T.gc(); return listenersRaw(); };
      const listenersRaw = async () => ((await T.metrics()) || []).find(m => m.name === 'JSEventListeners')?.value || 0;
      const cycle = async () => { await Reader.open(b.id, 0); await T.sleep(250); T.quiet(); Reader.close(); await T.sleep(250); };
      await cycle(); await cycle(); // تسخين
      const n0 = count(), l0 = await listeners();
      for (let i = 0; i < 10; i++) {
        await cycle();
        expect(Editor.live.size, 'محررات عالقة بعد السكّر').toBe(0);
      }
      const n1 = count(), l1 = await listeners();
      T.info({ domBefore: n0, domAfter: n1, listenersBefore: l0, listenersAfter: l1 });
      expect(n1 - n0, 'زيادة بعدد العناصر').toBeLessThan(40);
      expect(l1 - l0, 'زيادة بعدد المستمعين').toBeLessThan(40);
      expect(document.querySelectorAll('.pop, .modal-back, #tour').length).toBe(0);
    });

    await T.test('الوحدات بتحكي مع بعض عبر واجهات معروفة (مش متغيرات عشوائية)', () => {
      const api = {
        DB: ['open', 'get', 'put', 'all', 'getMany', 'putMany', 'delMany'],
        Settings: ['newPaper', 'panel'], Reader: ['open', 'close', 'turn'], Editor: ['flushAll', 'unbindAll'],
        Sheet: ['open', 'collect', 'print'], Share: ['pack', 'importData', 'exportBook'],
        Music: ['panel', 'onBookOpen', 'onBookClose'], Tour: ['maybe', 'start', 'end'], Library: ['load', 'titleTaken'],
      };
      const mods = { DB, Settings, Reader, Editor, Sheet, Share, Music, Tour, Library };
      const bad = [];
      for (const [mod, fns] of Object.entries(api)) {
        const m = mods[mod]; if (!m) { bad.push(mod); continue; }
        for (const f of fns) if (typeof m[f] !== 'function') bad.push(`${mod}.${f}`);
      }
      expect(bad.join(', '), 'واجهات ناقصة:').toBe('');
    });
  }],
};
