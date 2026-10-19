const SUITE = {
  title: 'رحلة مستخدم: مشاركة كتاب مع صاحبه',
  phases: [
    async T => {
      const { expect } = T;
      await T.test('صاحب الكتاب: بيعمل كتاب فيه صورة وسؤال وامتحان وروابط، وبيصدّره .daftar', async () => {
        const c = document.createElement('canvas'); c.width = 200; c.height = 140; c.getContext('2d').fillRect(0, 0, 200, 140);
        const img = await Media.save(await new Promise(r => c.toBlob(r, 'image/webp')));
        const b = await T.makeBook('ملخص الشبكات', { htmls: ['<h2>OSI</h2><p>كم طبقة؟ <span class="ans" data-card="cX">سبعة</span></p>', '<h2>TCP</h2><p>اتصال موثوق</p>', '', ''] });
        const p = await DB.get('pages', b.pageIds[0]); p.stickies = [{ id: 's', kind: 'photo', blob: img, x: 300, y: 300, w: 180 }]; await DB.put('pages', p);
        await IdeaWeb.add(b.pageIds[0], b.id, b.pageIds[1], b.id);
        await DB.put('exams', { id: 'eX', bookId: b.id, title: 'اختبار', questions: [{ id: 'q', q: 'كم طبقة؟', choices: ['سبعة', 'أربعة'], correct: 0, pageId: b.pageIds[0] }], attempts: [] });
        let file = null; const real = downloadBlob;
        downloadBlob = (blob, name) => { file = { blob, name }; };
        await Share.exportBook(b.id);
        downloadBlob = real;
        expect(file.name).toBe('ملخص الشبكات.daftar');
        // منحفظ الملف (base64) لنكمل كأننا بجهاز الصاحب
        const buf = new Uint8Array(await file.blob.arrayBuffer()); let s = ''; buf.forEach(x => s += String.fromCharCode(x));
        localStorage.setItem('__shared', btoa(s));
        T.info({ size: Math.round(file.blob.size / 1024 * 10) / 10 + ' KB' });
      });
      await T.test('جهاز الصاحب: مكتبة فاضية', async () => {
        for (const st of ['books', 'pages', 'blobs', 'cards', 'links', 'exams']) { const all = await DB.all(st); if (all.length) await DB.delMany(st, all.map(x => x.id)); }
        await IdeaWeb.load(); await Library.load();
        expect((await DB.all('books')).length).toBe(0);
      });
    },
    async T => {
      const { expect } = T;
      await T.test('الصاحب بيسحب الملف ويفلته على المكتبة', async () => {
        const bin = atob(localStorage.getItem('__shared')), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
        const f = new File([u], 'ملخص الشبكات.daftar');
        const dt = new DataTransfer(); dt.items.add(f);
        window.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
        await T.waitFor(async () => (await DB.all('books')).length === 1, 5000, 'استيراد الكتاب');
      });
      await T.test('الكتاب وصل كامل: الصفحات والصورة والسؤال والامتحان والشبكة', async () => {
        const b = (await DB.all('books'))[0];
        expect(b.title).toBe('ملخص الشبكات');
        const pages = await DB.getMany('pages', b.pageIds);
        expect(pages[0].html).toContain('OSI');
        expect(!!(await DB.get('blobs', pages[0].stickies[0].blob))).toBeTruthy();
        expect((await Exams.all(b.id))[0].questions[0].pageId).toBe(b.pageIds[0]);
        expect(IdeaWeb.of(b.pageIds[0]).length).toBe(1);
        await Reader.open(b.id, 0); await T.sleep(700); T.quiet();
        await T.waitFor(() => document.querySelector('.sticky.photo img')?.naturalWidth > 0, 3000, 'الصورة ظاهرة');
        await T.shot('shared-book-opened');
        localStorage.removeItem('__shared');
      });
      await T.test('فتح نفس الملف مرة ثانية بيعمل نسخة جديدة وما بيخرّب الأولى', async () => {
        const data = await Share.pack((await DB.all('books'))[0].id);
        await Share.importData(data);
        const titles = (await DB.all('books')).map(x => x.title).sort();
        expect(titles).toEqual(['ملخص الشبكات', 'ملخص الشبكات (2)']);
      });
    },
  ],
};
