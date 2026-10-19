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
    await T.test('أسئلة المراجعة: مزامنة البطاقات مع الصفحات (إضافة الناقص وحذف اليتيم)', async () => {
      const b = await T.makeBook('بطاقات', { htmls: ['<p>س؟ <span class="ans" data-card="cA">ج</span></p>', '', '', ''] });
      await DB.put('cards', { id: 'cORPHAN', bookId: b.id, level: 0, due: 0 });
      const pages = await DB.getMany('pages', b.pageIds);
      const due = await Study.dueCards(b, pages);
      expect(due.map(c => c.id)).toEqual(['cA']);
      expect(await DB.get('cards', 'cORPHAN')).toBe(undefined);
      expect(REVIEW_STEPS).toEqual([1, 3, 7, 16, 35, 80]);
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
    await T.test('الامتحانات: استيراد JSON (صيغة الذكاء الاصطناعي) وتصديرها', async () => {
      const b = await T.makeBook('امتحانات JSON', { htmls: ['<h2>الصفحة 1</h2>', '<h2>الصفحة 2</h2>', '', ''] });
      await Reader.open(b.id, 0); await T.sleep(400); T.quiet();
      const json = { title: 'AI Quiz', questions: [{ q: 'كم؟', choices: ['1', '2'], correct: 1, page: 2, explain: 'شرح' }, { q: 'ناقص', choices: ['x'] }] };
      pickFile = async () => new File([JSON.stringify(json)], 'q.json', { type: 'application/json' });
      await Exams.importFile(); await T.sleep(300);
      pickFile = realPick;
      const ex = (await Exams.all(b.id))[0];
      expect(ex.questions.length, 'السؤال الناقص لازم ينرفض').toBe(1);
      expect(ex.questions[0].pageId).toBe(b.pageIds[1]);
      downloadBlob = (blob, name) => { downloaded = { blob, name }; };
      Exams.exportFile(ex);
      downloadBlob = realDl;
      const back = JSON.parse(await downloaded.blob.text());
      expect(back.questions[0].page).toBe(2); expect(back.questions[0].correct).toBe(1);
      T.clean(); Reader.close(); await T.sleep(200);
    });
    await T.test('المشاركة: تغليف وضغط وفك واستيراد كنسخة جديدة (مع البطاقات والروابط والامتحانات)', async () => {
      const mid = await Media.save(new Blob(['img'], { type: 'image/png' }));
      const b = await T.makeBook('مشاركة', { htmls: ['<p>س <span class="ans" data-card="cS1">ج</span></p>', '<p>ب</p>', '', ''] });
      const p0 = await DB.get('pages', b.pageIds[0]); p0.stickies = [{ id: 's1', kind: 'photo', blob: mid, x: 10, y: 10, w: 120 }]; await DB.put('pages', p0);
      await DB.put('cards', { id: 'cS1', bookId: b.id, level: 2, due: 0 });
      await IdeaWeb.add(b.pageIds[0], b.id, b.pageIds[1], b.id);
      await DB.put('exams', { id: 'eS', bookId: b.id, title: 'T', questions: [{ id: 'q', q: 'q', choices: ['a', 'b'], correct: 0, pageId: b.pageIds[1] }], attempts: [] });
      const data = await Share.pack(b.id);
      const z = await Share.gzip(JSON.stringify(data));
      expect(new Uint8Array(await z.slice(0, 2).arrayBuffer())[0]).toBe(0x1f);
      const [nb] = await Share.importData(await Share.readFile(z));
      expect(nb.id === b.id).toBeFalsy(); expect(nb.title).toBe('مشاركة (2)');
      const np = await DB.getMany('pages', nb.pageIds);
      expect(np[0].html).toContain('data-card="c'); expect(np[0].html.includes('cS1')).toBeFalsy();
      expect(IdeaWeb.of(nb.pageIds[0]).length).toBe(1);
      const ex = (await DB.all('exams')).find(x => x.bookId === nb.id);
      expect(ex.questions[0].pageId).toBe(nb.pageIds[1]);
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
