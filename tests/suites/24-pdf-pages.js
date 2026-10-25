/* PDF صفحة بصفحة: أي ملف (نص، سكان، رسومات) بيصير كتاب بنفس عدد الصفحات وشكلها */
const SUITE = {
  title: 'PDF صفحة بصفحة — نفس العدد ونفس الشكل، شو ما كان محتوى الصفحات',
  phases: [async T => {
    const { expect } = T;
    // لون بكسل من صورة الصفحة (لنتأكد إنها انرسمت فعلاً)
    const pixel = async (id, fx, fy) => {
      const r = await DB.get('blobs', id); const bm = await createImageBitmap(r.blob);
      const c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height;
      const g = c.getContext('2d'); g.drawImage(bm, 0, 0);
      return { w: bm.width, h: bm.height, rgb: [...g.getImageData(Math.round(fx * bm.width), Math.round(fy * bm.height), 1, 1).data].slice(0, 3) };
    };
    let book;

    await T.test('من المكتبة: PDF رسومات بدون نص (زي السكان) بيصير كتاب بنفس عدد الصفحات', async () => {
      const f = await T.fixture('drawing-3p.pdf', 'application/pdf');
      const before = (await DB.all('books')).length;
      await Importer.newBook(f);
      await T.waitFor(() => Reader.book && Reader.book.title === 'drawing-3p' && Reader.pages[0] && Reader.pages[0].bg, 20000, 'الكتاب');
      book = Reader.book;
      expect((await DB.all('books')).length).toBe(before + 1);
      const withBg = Reader.pages.filter(p => p.bg);
      expect(withBg.length).toBe(3);
      expect(Reader.pages.slice(0, 3).every(p => p.bg)).toBeTruthy();
      expect(Reader.pages.length % 2).toBe(0); // الكتاب بصفحات زوجية (صفحة فاضية بالآخر)
      expect(Math.abs(Reader.pages[0].bgAR - 842 / 595) < 0.01).toBeTruthy();
      expect((await DB.all('files')).some(x => x.bookId === book.id)).toBeFalsy(); // ما بنخزّن الملف مرتين
    });

    await T.test('كل صفحة انرسمت بمحتواها هي (مربع أحمر، أخضر، أزرق)', async () => {
      // المربع: x 100→495، وارتفاعه 200 من y = 300 + i*100 (من تحت)
      const want = [[255, 0, 0], [0, 153, 0], [0, 0, 255]];
      for (let i = 0; i < 3; i++) {
        const y = 1 - (300 + i * 100 + 100) / 842;
        const p = await pixel(Reader.pages[i].bg, 300 / 595, y);
        expect(p.w).toBe(1300);
        const d = p.rgb.map((v, k) => Math.abs(v - want[i][k])).reduce((a, b) => Math.max(a, b));
        expect(d < 40, `صفحة ${i + 1}: ${p.rgb}`).toBeTruthy();
      }
    });

    await T.test('الصفحة بتنعرض بالكتاب بصورتها، وبتقدر تكتب فوقها', async () => {
      T.quiet();
      if (Reader.s < 0) { await Reader.turn(1); await T.sleep(900); }
      const l = Editor.live.get(0);
      const img = await T.waitFor(() => { const m = l.pg.querySelector('img.pg-bg'); return m && m.complete && m.naturalWidth ? m : null; }, 5000, 'صورة الصفحة');
      expect(l.pg.classList.contains('has-bg')).toBeTruthy();
      expect(!!l.pg.querySelector('.lines')).toBeFalsy();
      await T.shot('pdf-page');
      await T.mouse.click(l.c); await T.typeText('ملاحظتي');
      await T.sleep(300); Editor.flushAll();
      expect(Reader.pages[0].html).toContain('ملاحظتي');
      expect(!!Reader.pages[0].bg).toBeTruthy();
    });

    await T.test('PDF فيه نص بكتاب مفتوح: «صفحة بصفحة» بنفس العدد، والبحث بيلاقي نصه', async () => {
      const f = await T.fixture('sample-ar-en.pdf', 'application/pdf');
      const n = (await (await PdfPages.open(f))).numPages;
      const l = Editor.live.get(0);
      const was = Reader.pages.filter(p => p.bg).length, old = new Set(Reader.pages.map(p => p.id));
      await Importer.file(f, l);
      const opt = await T.waitFor(() => document.querySelector('.import-dlg [data-a=pages]'), 6000, 'نافذة الاختيار');
      expect(opt.classList.contains('rec')).toBeTruthy();
      await T.shot('pdf-choice');
      await T.mouse.click(opt);
      await T.waitFor(() => Reader.pages.filter(p => p.bg).length === was + n, 20000, 'الصفحات');
      const added = Reader.pages.filter(p => !old.has(p.id) && p.bg); // (وممكن صفحة فاضية بالآخر ليضل العدد زوجي)
      expect(added.length).toBe(n);
      expect(added.map(p => p.text || '').join(' | ')).toContain('سبع طبقات');
      const docs = await Finder.build();
      expect(docs.some(d => d.book.id === book.id && d.text.includes('سبع طبقات'))).toBeTruthy();
    });

    await T.test('النسخة الاحتياطية بتشمل صور الصفحات', async () => {
      const out = await Backup.build([book.id]);
      const data = JSON.parse(await out.blob.text());
      const ids = new Set(data.blobs.map(b => b.id));
      expect(Reader.pages.filter(p => p.bg).every(p => ids.has(p.bg))).toBeTruthy();
    });

    await T.test('الطباعة بتطبع الصفحات بصورها', async () => {
      let imgs = null; const real = window.print;
      window.print = () => { imgs = [...document.querySelectorAll('#print img.pg-bg')].filter(m => m.src).length; };
      await Exporter.pdf({ from: 0, to: 2 });
      window.print = real; dispatchEvent(new Event('afterprint'));
      expect(imgs).toBe(3);
    });
  }],
};
