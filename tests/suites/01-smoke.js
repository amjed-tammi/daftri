const SUITE = {
  title: 'Smoke — التطبيق بيقوم سليم من أول تشغيل',
  phases: [async T => {
    await T.test('كل وحدات التطبيق محمّلة', () => {
      const mods = { DB: typeof DB, Media: typeof Media, Library: typeof Library, Reader: typeof Reader, Editor: typeof Editor, Stickies: typeof Stickies, Wrap: typeof Wrap, Study: typeof Study, Finder: typeof Finder, Trash: typeof Trash, IdeaWeb: typeof IdeaWeb, Exams: typeof Exams, Share: typeof Share, Music: typeof Music, Settings: typeof Settings, Reminders: typeof Reminders, Rope: typeof Rope, Tour: typeof Tour, FontKit: typeof FontKit, Exporter: typeof Exporter, Backup: typeof Backup, PaperUI: typeof PaperUI };
      const missing = Object.entries(mods).filter(([, t]) => t === 'undefined').map(([n]) => n);
      T.expect(missing.join(','), 'وحدات ناقصة:').toBe('');
    });
    await T.test('قاعدة البيانات بتفتح بالنسخة الحالية وكل المخازن موجودة', async () => {
      const d = await DB.open();
      T.expect(d.version >= 6, 'نسخة القاعدة').toBeTruthy();
      for (const s of ['books', 'pages', 'blobs', 'trash', 'cards', 'journal', 'links', 'exams', 'subjects', 'files', 'plans']) T.expect(d.objectStoreNames.contains(s), 'مخزن ' + s).toBeTruthy();
    });
    await T.test('الجولة التعريفية بتبدأ لحالها أول مرة', async () => {
      T.allowTour(); localStorage.removeItem('tour-lib');
      Tour.maybe('lib');
      await T.waitFor(() => Tour.active === 'lib', 3000, 'بدء الجولة');
      T.expect(!!document.querySelector('.tour-card')).toBeTruthy();
      await T.shot('first-run-tour');
      Tour.end(false);
    });
    await T.test('المكتبة الفاضية بتعرض زر «أنشئ أول كتاب»', async () => {
      await Library.load();
      T.expect(!!document.querySelector('#shelves .empty button')).toBeTruthy();
      await T.shot('empty-library');
    });
    await T.test('السماء انرسمت والنجوم موجودة', () => {
      const c = document.querySelector('#sky');
      T.expect(c.width).toBeGreaterThan(100);
      T.expect(document.querySelectorAll('#twinkles .tw').length).toBeGreaterThan(10);
    });
    await T.test('الخطوط العربية والإنجليزية متوفرة بالجهاز', () => {
      T.expect(FontKit.list('ar').length).toBeGreaterThan(2);
      T.expect(FontKit.list('en').length).toBeGreaterThan(2);
      T.info({ ar: FontKit.list('ar').length, en: FontKit.list('en').length });
    });
    await T.test('فتح كتاب وتقليب صفحة بدون أخطاء', async () => {
      const b = await T.makeBook('Smoke كتاب', { lastSpread: -1 });
      await Reader.open(b.id); await T.sleep(500); T.quiet();
      T.expect(!!document.querySelector('.coverpg')).toBeTruthy();
      await Reader.turn(1);
      T.expect(Reader.s).toBe(0);
      T.expect(Editor.live.size).toBe(2);
      Reader.close(); await T.sleep(200);
    });
  }],
};
