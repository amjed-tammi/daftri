const SUITE = {
  title: 'نقاط البيانات (Endpoints) — كل عملية حفظ وقراءة',
  phases: [async T => {
    const { expect } = T;
    const wav = () => { const sr = 8000, n = sr, b = new ArrayBuffer(44 + n * 2), v = new DataView(b); const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0))); w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true); return new File([b], 'track.wav', { type: 'audio/wav' }); };
    const realPick = pickFile, realDl = downloadBlob;
    let downloaded = null;

    await T.test('DB: put / get / getMany / putMany / del / delMany', async () => {
      await DB.put('journal', { id: 'x1', text: 'a' });
      expect((await DB.get('journal', 'x1')).text).toBe('a');
      await DB.putMany('journal', [{ id: 'x2' }, { id: 'x3' }]);
      expect((await DB.getMany('journal', ['x1', 'x2', 'nope'])).map(x => x && x.id)).toEqual(['x1', 'x2', undefined]);
      await DB.del('journal', 'x1'); await DB.delMany('journal', ['x2', 'x3']);
      expect((await DB.all('journal')).length).toBe(0);
    });
    await T.test('Media: حفظ ملف ورابطه وحذفه', async () => {
      const id = await Media.save(new Blob(['hello'], { type: 'text/plain' }));
      const u = await Media.url(id);
      expect(await (await fetch(u)).text()).toBe('hello');
      await Media.del(id);
      expect(await DB.get('blobs', id)).toBe(undefined);
    });
    await T.test('Media: تصغير الصور الكبيرة', async () => {
      const c = document.createElement('canvas'); c.width = 3000; c.height = 2000; c.getContext('2d').fillRect(0, 0, 3000, 2000);
      const big = await new Promise(r => c.toBlob(r, 'image/png'));
      const small = await Media.downscale(big, 900);
      const bmp = await createImageBitmap(small);
      expect(Math.max(bmp.width, bmp.height)).toBe(900);
    });
    await T.test('أسماء الكتب: ما بيتكرر الاسم حتى مع اختلاف الهمزة/التشكيل/الحالة', async () => {
      expect(normTitle('  أَحْمَد   Book ')).toBe(normTitle('احمد book'));
      expect(normTitle('مكتبة')).toBe(normTitle('مكتبه'));
      await T.makeBook('دفتر JavaScript');
      expect(Library.titleTaken('دفتر  javascript')).toBeTruthy();
      expect(Library.titleTaken('دفتر Python')).toBeFalsy();
    });
    await T.test('الكود: التعرّف على الكود الملصوق وتلوينه', () => {
      expect(looksLikeCode('function f() {\n  return 1;\n}')).toBeTruthy();
      expect(looksLikeCode('هاد نص عادي\nوسطر ثاني')).toBeFalsy();
      const h = highlightCode("const x = 'hi'; // تعليق");
      expect(h).toContain('t-k'); expect(h).toContain('t-s'); expect(h).toContain('t-c');
    });
    await T.test('البحث: التطبيع بيحفظ مكان كل حرف بالأصل', () => {
      const m = normMap('أَهلاً Hello');
      expect(m.n.startsWith('اهلا')).toBeTruthy();
      expect(m.map.length).toBe(m.n.length);
      expect(htmlText('<p>سطر</p><p>two</p>').replace(/\s+/g, ' ').trim()).toBe('سطر two');
    });
    await T.test('الأجوبة المغطّاة من ميزة المراجعة القديمة بترجع نص عادي (والتنسيق جوّاها بيضل)', () => {
      expect(stripAns('<p>س؟ <span class="ans" data-card="cA">ج <b>مهم</b></span> وبعد</p>')).toBe('<p>س؟ ج <b>مهم</b> وبعد</p>');
      expect(stripAns('<p>عادي</p>')).toBe('<p>عادي</p>');
      expect(stripAns('')).toBe('');
      expect(typeof Exams === 'undefined' && typeof Study.mark === 'undefined', 'الميزة انشالت').toBeTruthy();
    });
    await T.test('شبكة الأفكار: ربط وفك ومنع التكرار', async () => {
      await IdeaWeb.load();
      const x = await IdeaWeb.add('pA', 'k1', 'pB', 'k1');
      expect(!!x).toBeTruthy();
      expect(await IdeaWeb.add('pB', 'k1', 'pA', 'k1')).toBe(null);
      expect(!!IdeaWeb.linked('pA', 'pB')).toBeTruthy();
      await IdeaWeb.removeForPages(['pA']);
      expect(IdeaWeb.linked('pA', 'pB')).toBe(null);
    });
    await T.test('سلة المحذوفات: نقل كتاب واسترجاعه بدون ما يتكرر الاسم', async () => {
      const b = await T.makeBook('للسلة');
      const item = await Trash.addBook(b);
      expect(await DB.get('books', b.id)).toBe(undefined);
      await T.makeBook('للسلة');
      await Trash.restore(item);
      expect((await DB.all('books')).filter(x => x.title.startsWith('للسلة')).map(x => x.title).sort()).toEqual(['للسلة', 'للسلة (2)']);
    });
    await T.test('سلة المحذوفات: الحذف النهائي بيمسح الصفحات والوسائط والروابط', async () => {
      const mid = await Media.save(new Blob(['x']));
      const b = await T.makeBook('نهائي', { htmls: [`<p>a</p>`, '', '', ''] });
      const p = await DB.get('pages', b.pageIds[0]); p.stickies = [{ id: 's', kind: 'photo', blob: mid, x: 0, y: 0, w: 100 }]; await DB.put('pages', p);
      await IdeaWeb.add(b.pageIds[0], b.id, b.pageIds[1], b.id);
      const item = await Trash.addBook(b);
      await Trash.purge(item);
      expect(await DB.get('pages', b.pageIds[0])).toBe(undefined);
      expect(await DB.get('blobs', mid)).toBe(undefined);
      expect(IdeaWeb.of(b.pageIds[0]).length).toBe(0);
    });
    await T.test('الإعدادات: مصدر واحد، ونسخة الورق مستقلة', () => {
      Settings.d.paper.lh = 36; Settings.save(); Settings.load();
      expect(Settings.d.paper.lh).toBe(36);
      const p = Settings.newPaper(); p.lh = 24;
      expect(Settings.d.paper.lh).toBe(36);
    });
    await T.test('الموسيقى: رفع، اسم، افتراضي الكتاب، حذف', async () => {
      pickFile = async () => [wav()];
      const id = await Music.add();
      pickFile = realPick;
      expect(Music.has(id)).toBeTruthy(); expect(Music.name(id)).toBe('track');
      Music.stop(false);
      Settings.d.music.track = id; Settings.d.music.auto = false;
      expect(Settings.bookMusic({ music: { track: 'default' } }).track).toBe(id);
      expect(Settings.bookMusic({ music: { track: 'none' } }).track).toBe(null);
      expect(Settings.bookMusic({ music: { auto: true } }).auto).toBe(true);
      await Music.remove(id);
      expect(Music.has(id)).toBeFalsy();
      expect(Settings.d.music.track).toBe(null);
    });
    await T.test('التذكيرات: بتبدأ فاضية، بتنضاف، بتشتغل بوقتها، بتنحذف', async () => {
      expect(Reminders.list.length).toBe(0);
      const r = Reminders.add({ icon: '💧', title: 'اشرب مي', every: 1 });
      r.last = Date.now() - 2 * 60e3;
      Reminders.tick(); await T.sleep(400);
      expect([...document.querySelectorAll('.toast b')].some(b => b.textContent === 'اشرب مي')).toBeTruthy();
      Reminders.list = Reminders.list.filter(x => x !== r); Reminders.save();
      expect(JSON.parse(localStorage.getItem('reminders')).length).toBe(0);
    });
    await T.test('المشاركة: تغليف وضغط وفك واستيراد كنسخة جديدة (مع الصور والروابط)، وملف قديم فيه أسئلة مراجعة بيفتح نص عادي', async () => {
      const mid = await Media.save(new Blob(['img'], { type: 'image/png' }));
      const b = await T.makeBook('مشاركة', { htmls: ['<p>س <b>ج</b></p>', '<p>ب</p>', '', ''] });
      const p0 = await DB.get('pages', b.pageIds[0]); p0.stickies = [{ id: 's1', kind: 'photo', blob: mid, x: 10, y: 10, w: 120 }]; await DB.put('pages', p0);
      await IdeaWeb.add(b.pageIds[0], b.id, b.pageIds[1], b.id);
      const data = await Share.pack(b.id);
      expect('exams' in data || 'cards' in data, 'ما في امتحانات ولا بطاقات بالملف').toBeFalsy();
      const z = await Share.gzip(JSON.stringify(data));
      expect(new Uint8Array(await z.slice(0, 2).arrayBuffer())[0]).toBe(0x1f);
      const [nb] = await Share.importData(await Share.readFile(z));
      expect(nb.id === b.id).toBeFalsy(); expect(nb.title).toBe('مشاركة (2)');
      const np = await DB.getMany('pages', nb.pageIds);
      expect(np[0].html).toBe('<p>س <b>ج</b></p>');
      expect(np[0].stickies[0].blob).toBe(mid);
      expect(IdeaWeb.of(nb.pageIds[0]).length).toBe(1);
      // ملف .daftar من نسخة قديمة فيه سؤال مراجعة
      const old = JSON.parse(JSON.stringify(data)); old.books[0].title = 'قديم'; old.pages[0].html = '<p>س؟ <span class="ans" data-card="cX">الجواب</span></p>'; old.cards = [{ id: 'cX', bookId: old.books[0].id }];
      const [ob] = await Share.importData(old);
      const op = await DB.get('pages', ob.pageIds[0]);
      expect(op.html).toBe('<p>س؟ الجواب</p>');
      T.info({ size: z.size + ' bytes' });
    });
    await T.test('النسخ الاحتياطي: تصدير واستيراد بدون تكرار', async () => {
      downloadBlob = (blob, name) => { downloaded = { blob, name }; };
      await Backup.exportBooks();
      downloadBlob = realDl;
      const before = (await DB.all('books')).length;
      pickFile = async () => new File([downloaded.blob], 'b.json');
      await Backup.importFile(); await T.sleep(300);
      pickFile = realPick;
      expect((await DB.all('books')).length, 'الكتب الموجودة ما بتتكرر').toBe(before);
    });
    await T.test('الخطوط: توليد خط العربي مع حجمه', () => {
      FontKit.apply({ font: 'hand', fontAr: 'Traditional Arabic', arScale: 120 });
      const css = document.querySelector('#bookFonts').textContent;
      expect(css).toContain('Traditional Arabic'); expect(css).toContain('size-adjust:146%');
    });
  }],
};
