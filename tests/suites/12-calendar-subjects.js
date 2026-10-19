const SUITE = {
  title: 'المواد، ملفات PDF، وتقويم الدراسة',
  phases: [
    async T => {
      const { expect } = T;
      const day = n => ymd(Date.now() + n * 864e5);
      const pdfFile = name => new File(['%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF'], name, { type: 'application/pdf' });
      const pick = async (sel, value) => { const s = document.querySelector(sel); s.focus(); s.value = value; s.dispatchEvent(new Event('change', { bubbles: true })); await T.sleep(80); };
      const typeIn = async (sel, text) => { await T.mouse.click(sel); await T.typeText(text); };
      const openCal = async () => { if (!document.querySelector('.modal-back .cal')) { await T.mouse.click('#btnCal'); await T.waitFor(() => document.querySelector('.cal-add'), 2000, 'التقويم'); await T.sleep(250); } };
      const menuItem = label => [...document.querySelectorAll('.menu .m-item')].find(b => b.textContent.includes(label));
      let subj, book;

      await T.test('الترقية من نسخة 4: الكتب القديمة بتروح لـ«بدون مادة» بدون ما يضيع شي', async () => {
        await T.sleep(1200); if (Tour.active) Tour.end(false); T.quiet(); // نستنى مؤقت جولة أول مرة
        (await DB.open()).close(); DB._p = null;
        await new Promise((res, rej) => { const r = indexedDB.deleteDatabase('daftari'); r.onsuccess = res; r.onerror = rej; r.onblocked = res; });
        await new Promise((res, rej) => {
          const r = indexedDB.open('daftari', 4);
          r.onupgradeneeded = () => { for (const s of ['books', 'pages', 'blobs', 'trash', 'cards', 'journal', 'links', 'exams']) r.result.createObjectStore(s, { keyPath: 'id' }); };
          r.onsuccess = () => {
            const d = r.result, tx = d.transaction(['books', 'pages'], 'readwrite');
            tx.objectStore('pages').put({ id: 'pOld', bookId: 'kOld', html: '<p>ملاحظات قديمة</p>', stickies: [], attach: [] });
            tx.objectStore('books').put({ id: 'kOld', title: 'كتاب قديم', author: '', dir: 'rtl', cover: { color: '#1d2b53', image: null }, paper: Settings.newPaper(), series: null, pageIds: ['pOld'], created: 1, updated: 1, lastSpread: -1 });
            tx.oncomplete = () => { d.close(); res(); }; tx.onerror = rej;
          };
          r.onerror = rej;
        });
        const d = await DB.open();
        expect(d.version).toBe(5);
        for (const s of ['subjects', 'files', 'plans']) expect(d.objectStoreNames.contains(s), 'مخزن ' + s).toBeTruthy();
        const old = await DB.get('books', 'kOld');
        expect(old.subjectId).toBe(NO_SUBJECT);
        expect(old.title).toBe('كتاب قديم');
        expect((await DB.get('pages', 'pOld')).html).toContain('ملاحظات قديمة');
        expect((await DB.get('subjects', NO_SUBJECT)).name).toBe('بدون مادة');
        await Library.load();
        expect(!!document.querySelector('.bk[data-id="kOld"]'), 'الكتاب القديم بالمكتبة').toBeTruthy();
      });

      await T.test('مادة جديدة بالماوس والكيبورد، وبتفتح على صفحتها', async () => {
        await T.mouse.click('#btnSubj');
        await T.waitFor(() => document.querySelector('.subj-form'), 2000, 'نافذة المادة');
        expect(document.querySelector('.subj-form input[name=name]').dir).toBe('auto');
        await typeIn('.subj-form input[name=name]', 'رياضيات');
        await T.mouse.click('.subj-form .sw[data-c="#4f8a6e"]');
        await T.shot('subject-form');
        await T.mouse.click('.subj-form .btn.primary');
        await T.waitFor(() => Library.cur && document.querySelector('.subj-head'), 3000, 'صفحة المادة');
        subj = Library.subject(Library.cur);
        expect(subj.name).toBe('رياضيات');
        expect(subj.color).toBe('#4f8a6e');
        expect(document.querySelector('.subj-head h2').textContent).toContain('رياضيات');
        expect(!!document.querySelector('.bk[data-id="kOld"]'), 'الكتاب القديم مش بالمادة').toBeFalsy();
      });

      await T.test('ما بيقبل مادة بنفس الاسم', async () => {
        await T.mouse.click('#btnSubj');
        await T.waitFor(() => document.querySelector('.subj-form'));
        await typeIn('.subj-form input[name=name]', 'رياضيات');
        await T.mouse.click('.subj-form .btn.primary');
        await T.waitFor(() => document.querySelector('.subj-form .err').textContent, 2000, 'رسالة الخطأ');
        await T.key('Escape', 'Escape');
      });

      await T.test('كتاب جديد جوّا المادة (من زر المادة)', async () => {
        await T.mouse.click('.subj-head [data-a=book]');
        await T.waitFor(() => document.querySelector('.bookform'), 2000, 'نافذة الكتاب');
        expect(document.querySelector('.bookform select[name=subject]').value).toBe(subj.id);
        await typeIn('.bookform input[name=title]', 'دفتر التفاضل');
        await T.mouse.click('.bookform .btn.primary[type=submit]');
        await T.waitFor(() => Reader.book && Reader.book.title === 'دفتر التفاضل', 4000, 'فتح الكتاب');
        book = Reader.book;
        expect(book.subjectId).toBe(subj.id);
        T.quiet();
        Reader.close(); await T.sleep(500);
        expect(Library.cur, 'رجع لنفس المادة').toBe(subj.id);
        expect(!!document.querySelector(`.bk[data-id="${book.id}"]`)).toBeTruthy();
      });

      await T.test('السلاسل (الجزء ١ و٢) شغّالة جوّا المادة', async () => {
        await T.makeBook('تفاضل ١', { subjectId: subj.id, series: { name: 'سلسلة التفاضل', part: 1 } });
        await T.makeBook('تفاضل ٢', { subjectId: subj.id, series: { name: 'سلسلة التفاضل', part: 2 } });
        const sh = document.querySelector('.shelf.series');
        expect(!!sh, 'رف السلسلة').toBeTruthy();
        expect(sh.querySelectorAll('.bk').length).toBe(2);
        expect(sh.querySelector('.shelf-head h3').textContent).toContain('سلسلة التفاضل');
        await T.shot('subject-view');
      });

      await T.test('الرئيسية: المواد أول شي، وكتب «بدون مادة» تحتها', async () => {
        await T.mouse.click('.subj-head [data-a=home]');
        await T.waitFor(() => !Library.cur && document.querySelector('.subjects'), 2000, 'الرئيسية');
        const sec = [...document.querySelectorAll('#shelves > section')];
        expect(sec[0].classList.contains('subjects'), 'المواد أول قسم').toBeTruthy();
        const card = document.querySelector(`.subj[data-sid="${subj.id}"]`);
        expect(card.textContent).toContain('3 كتاب');
        expect(!!document.querySelector('.bk[data-id="kOld"]')).toBeTruthy();
        expect(document.querySelector('.shelf .shelf-head h3').textContent).toContain('بدون مادة');
        expect(!!document.querySelector(`.bk[data-id="${book.id}"]`), 'كتب المادة مش بالرئيسية').toBeFalsy();
        await T.shot('library-subjects-first');
      });

      await T.test('نقل كتاب قديم لمادة من «تعديل»', async () => {
        const bk = document.querySelector('.bk[data-id="kOld"]');
        await T.mouse.move(bk.getBoundingClientRect().left + 40, bk.getBoundingClientRect().top + 60); await T.sleep(250);
        await T.mouse.click('.bk[data-id="kOld"] .bk-more');
        await T.mouse.click(menuItem('تعديل الغلاف'));
        await T.waitFor(() => document.querySelector('.bookform'));
        await pick('.bookform select[name=subject]', subj.id);
        await T.mouse.click('.bookform .btn.primary[type=submit]');
        await T.waitFor(async () => (await DB.get('books', 'kOld')).subjectId === subj.id, 3000, 'النقل');
        expect(!!document.querySelector('.bk[data-id="kOld"]'), 'راح من الرئيسية').toBeFalsy();
        expect(document.querySelector(`.subj[data-sid="${subj.id}"]`).textContent).toContain('4 كتاب');
      });

      await T.test('ملف PDF للمادة: بينحفظ وبيفتح بالعارض جوّا التطبيق', async () => {
        await T.mouse.click(`.subj[data-sid="${subj.id}"]`);
        await T.waitFor(() => Library.cur === subj.id);
        expect(!!document.querySelector('.shelf.pdfs [data-a=up]'), 'زر رفع PDF بالمادة').toBeTruthy();
        const [rec] = await Files.addFiles([pdfFile('محاضرة 1.pdf')], { subjectId: Library.cur });
        expect(rec.subjectId).toBe(subj.id);
        await T.waitFor(() => document.querySelector(`.pdf-card[data-fid="${rec.id}"]`), 2000, 'بطاقة الملف');
        T.clean();
        await T.mouse.click(`.pdf-card[data-fid="${rec.id}"]`);
        const fr = await T.waitFor(() => document.querySelector('.pdfv-frame'), 2000, 'العارض');
        expect(fr.src.startsWith('blob:')).toBeTruthy();
        const blob = await (await fetch(fr.src)).blob();
        expect(blob.type).toBe('application/pdf');
        expect(blob.size).toBeGreaterThan(100);
        expect(document.querySelector('.pdfv-top b').textContent).toBe('محاضرة 1');
        await T.shot('pdf-viewer');
        await T.key('Escape', 'Escape');
        await T.waitFor(() => !document.querySelector('.pdfv'), 2000, 'إغلاق العارض');
      });

      await T.test('مش PDF؟ ما بينضاف', async () => {
        const out = await Files.addFiles([new File(['hi'], 'notes.txt', { type: 'text/plain' })], { subjectId: subj.id });
        expect(out.length).toBe(0);
      });

      await T.test('جوّا الكتاب: «ملفات PDF لهالكتاب» من قائمة ⋯', async () => {
        await Reader.open(book.id, 0); await T.sleep(700); T.quiet();
        Bars.show('#topbar'); await T.sleep(400);
        await T.mouse.click('#tbMore');
        await T.waitFor(() => menuItem('ملفات PDF لهالكتاب'));
        expect(!!menuItem('خطّط لهالكتاب بالتقويم')).toBeTruthy();
        await T.mouse.click(menuItem('ملفات PDF لهالكتاب'));
        await T.waitFor(() => document.querySelector('.files-panel'), 2000, 'نافذة الملفات');
        await Files.addFiles([pdfFile('سلايدات الفصل.pdf')], { bookId: book.id });
        await T.waitFor(() => [...document.querySelectorAll('.fp-item b')].some(b => b.textContent === 'سلايدات الفصل'), 2000, 'الملف بالقائمة');
        const f = Library.files.find(x => x.name === 'سلايدات الفصل');
        expect(f.bookId).toBe(book.id);
        expect(f.subjectId, 'ملف الكتاب بياخذ مادته').toBe(subj.id);
        expect(document.querySelector('.fp-g').textContent).toContain('نفس المادة');
        await T.shot('book-pdfs');
        T.clean(); Reader.close(); await T.sleep(500);
      });

      await T.test('التقويم: صفحة شهر، اليوم محدد، والأسبوع بيبدأ السبت', async () => {
        await T.mouse.click('#btnCal');
        await T.waitFor(() => document.querySelector('.cal'), 2000, 'التقويم');
        expect(document.querySelector('.cal-week span').textContent).toBe('سبت');
        const t = document.querySelector(`.cal-d[data-d="${ymd()}"]`);
        expect(t.classList.contains('today') && t.classList.contains('sel')).toBeTruthy();
        expect(document.querySelectorAll('.cal-d').length >= 28).toBeTruthy();
        expect(document.querySelector('.cal-add input[name=title]').dir).toBe('auto');
      });

      await T.test('بيضغط على بكرة ويضيف مهمة مربوطة بكتاب وصفحات', async () => {
        const k = day(1);
        await openCal();
        if (!document.querySelector(`.cal-d[data-d="${k}"]`)) await T.mouse.click('.cal [data-a=next]');
        await T.mouse.click(`.cal-d[data-d="${k}"]`);
        expect(document.querySelector('.cal-d.sel').dataset.d).toBe(k);
        await typeIn('.cal-add input[name=title]', 'الفصل الثالث');
        await pick('.cal-add select[name=subject]', subj.id);
        await pick('.cal-add select[name=link]', 'b:' + book.id);
        await typeIn('.cal-add input[name=pages]', '3');
        await T.mouse.click('.cal-add .btn.primary');
        await T.waitFor(() => document.querySelector('.cal-task'), 2000, 'المهمة');
        const p = Cal.plans.find(x => x.title === 'الفصل الثالث');
        expect(p.date).toBe(k); expect(p.bookId).toBe(book.id); expect(p.subjectId).toBe(subj.id); expect(p.pages).toBe('3');
        const cell = document.querySelector(`.cal-d[data-d="${k}"]`);
        expect(cell.classList.contains('due'), 'اليوم اللي فيه شي مطلوب بيلمع').toBeTruthy();
        // المتصفح المخفي بيطلب «تقليل الحركة»: وقتها اللمعة ثابتة، وإلا بتنبض
        const still = matchMedia('(prefers-reduced-motion: reduce)').matches, after = getComputedStyle(cell, '::after');
        T.info({ reducedMotion: still, glow: after.animationName, shadow: after.boxShadow });
        if (still) expect(after.boxShadow !== 'none', 'لمعة ثابتة').toBeTruthy(); else expect(after.animationName).toBe('dayglow');
        expect(cell.querySelectorAll('.cal-dots i').length).toBe(1);
      });

      await T.test('مهمة بالـEnter، وزر «افتح» بيفتح الكتاب على الصفحة', async () => {
        await openCal();
        await T.mouse.click(`.cal-d[data-d="${day(1)}"]`);
        await typeIn('.cal-add input[name=title]', 'اقرأ المحاضرة');
        await T.key('Enter', 'Enter');
        await T.waitFor(() => document.querySelectorAll('.cal-task').length === 2, 2000, 'مهمة ثانية');
        await T.mouse.click(`.cal-task[data-pid="${Cal.plans.find(x => x.title === 'الفصل الثالث').id}"] [data-go]`);
        await T.waitFor(() => Reader.book && Reader.book.id === book.id, 3000, 'فتح الكتاب');
        expect(Reader.s, 'الصفحة 3 = الفرد الثاني').toBe(1);
        T.quiet(); Reader.close(); await T.sleep(500);
      });

      await T.test('مهام اليوم: «مطلوب اليوم» بالمكتبة والمادة بتلمع', async () => {
        await openCal();
        await typeIn('.cal-add input[name=title]', 'حل التمارين');
        await pick('.cal-add select[name=subject]', subj.id);
        await T.mouse.click('.cal-add .btn.primary');
        await typeIn('.cal-add input[name=title]', 'لخّص الدرس');
        await T.mouse.click('.cal-add .btn.primary');
        await T.waitFor(() => Cal.of(ymd()).length === 2, 2000);
        await T.shot('calendar');
        await T.key('Escape', 'Escape');
        await T.waitFor(() => document.querySelector('.today-strip'), 2000, 'شريط مطلوب اليوم');
        await T.sleep(400); // المكتبة بتتحدّث بعد ما يتسكّر التقويم
        expect(document.querySelector('.today-strip').textContent).toContain('حل التمارين');
        expect(document.querySelector('#calBadge').hidden).toBeFalsy();
        expect(document.querySelector('#calBadge').textContent).toBe('2');
        expect(document.querySelector('#btnCal').classList.contains('due')).toBeTruthy();
        await T.mouse.click('.subj-head [data-a=home]');
        await T.waitFor(() => document.querySelector(`.subj[data-sid="${subj.id}"] .subj-due`), 2000, 'المادة بتلمع');
        await T.shot('library-today');
      });

      await T.test('خلّص كل مهام اليوم = نجمة بالسماء', async () => {
        expect(Study.days().includes(ymd())).toBeFalsy();
        await T.mouse.click('.today-strip .ts-chip');
        await T.waitFor(() => document.querySelectorAll('.cal-task').length === 2, 2000, 'مهام اليوم');
        for (const id of Cal.of(ymd()).map(p => p.id)) await T.mouse.click(`.cal-task[data-pid="${id}"] .ct-chk`);
        await T.waitFor(() => Study.days().includes(ymd()), 2000, 'النجمة');
        expect(Cal.of(ymd()).every(p => p.done)).toBeTruthy();
        expect([...document.querySelectorAll('.toast b')].some(b => b.textContent.includes('خلّصت كل مهام'))).toBeTruthy();
        const cell = document.querySelector(`.cal-d[data-d="${ymd()}"]`);
        expect(cell.classList.contains('done') && !!cell.querySelector('.cal-star')).toBeTruthy();
        expect(document.querySelector('#streak').hidden).toBeFalsy();
        await T.shot('calendar-done');
        await T.key('Escape', 'Escape');
        await T.waitFor(() => !document.querySelector('.today-strip') && document.querySelector('#calBadge').hidden, 2000, 'ما ضل شي مطلوب');
      });

      await T.test('حذف مهمة وتراجع', async () => {
        await T.mouse.click('#btnCal');
        await T.waitFor(() => document.querySelector('.cal-task'));
        const id = Cal.of(ymd())[0].id;
        await T.mouse.click(`.cal-task[data-pid="${id}"] [data-del]`);
        await T.waitFor(() => !Cal.plans.some(p => p.id === id), 2000);
        expect(await DB.get('plans', id)).toBe(undefined);
        await T.mouse.click([...document.querySelectorAll('.toast .btn')].find(b => b.textContent === 'تراجع'));
        await T.waitFor(async () => !!(await DB.get('plans', id)), 2000, 'رجعت');
        await T.key('Escape', 'Escape');
      });

      await T.test('كل الأدوات (Ctrl+/) فيها الأوامر الجديدة', async () => {
        await T.key('/', 'Slash', 2);
        await T.waitFor(() => document.querySelector('.palette'));
        let labels = [...document.querySelectorAll('.pl-item span')].map(s => s.textContent);
        for (const l of ['تقويم الدراسة', 'مادة جديدة', 'رفع ملف PDF (محاضرة، سلايدات)']) expect(labels, 'ناقص: ' + l).toContain(l);
        await T.key('Escape', 'Escape'); await T.sleep(300);
        await Reader.open(book.id, 0); await T.sleep(600); T.quiet();
        await T.key('/', 'Slash', 2);
        await T.waitFor(() => document.querySelector('.palette'));
        labels = [...document.querySelectorAll('.pl-item span')].map(s => s.textContent);
        for (const l of ['ملفات PDF لهالكتاب', 'خطّط لهالكتاب بالتقويم', 'تقويم الدراسة']) expect(labels, 'ناقص: ' + l).toContain(l);
        await T.key('Escape', 'Escape'); await T.sleep(300);
        Reader.close(); await T.sleep(400);
      });

      await T.test('الجولة: نسخة 6 وخطواتها الجديدة إلها هدف', async () => {
        expect(TOUR_V).toBe(6);
        const fresh = [...TOURS.lib, ...TOURS.book].filter(s => s.since === 6);
        expect(fresh.length).toBeGreaterThan(3);
        for (const s of TOURS.lib.filter(x => x.since === 6)) expect(!!Tour.target(s), s.title).toBeTruthy();
      });

      await T.test('مهمة اليوم لبكرة الصبح (للمرحلة الجاية)', async () => {
        await DB.put('plans', { id: 'tNext', date: ymd(), title: 'مراجعة سريعة', subjectId: subj.id, bookId: null, fileId: null, pages: '', done: false, created: Date.now() });
      });

      await T.test('حذف المادة ما بيحذف كتبها ولا ملفاتها', async () => {
        Library.cur = null; await Library.load();
        const card = document.querySelector(`.subj[data-sid="${subj.id}"]`);
        await T.mouse.move(card.getBoundingClientRect().left + 60, card.getBoundingClientRect().top + 40); await T.sleep(250);
        await T.mouse.click(`.subj[data-sid="${subj.id}"] .subj-more`);
        await T.mouse.click(menuItem('حذف المادة'));
        await T.waitFor(() => document.querySelector('.confirm'));
        await T.mouse.click('.confirm [data-a=ok]');
        await T.waitFor(async () => !(await DB.get('subjects', subj.id)), 2000, 'انحذفت');
        const books = (await DB.all('books')).filter(b => ['دفتر التفاضل', 'تفاضل ١', 'تفاضل ٢', 'كتاب قديم'].includes(b.title));
        expect(books.length).toBe(4);
        expect(books.every(b => b.subjectId === NO_SUBJECT)).toBeTruthy();
        expect((await DB.all('files')).every(f => f.subjectId === NO_SUBJECT)).toBeTruthy();
        expect(!!document.querySelector('.bk[data-id="kOld"]')).toBeTruthy();
        expect(!!document.querySelector('.shelf.pdfs'), 'الملفات صارت بالرئيسية').toBeTruthy();
      });
    },
    async T => {
      const { expect } = T;
      await T.test('بعد إعادة التشغيل: كل شي محفوظ، و«مطلوب اليوم» بتطلع لحالها', async () => {
        expect((await DB.all('files')).length).toBe(2);
        expect((await DB.all('plans')).length).toBeGreaterThan(3);
        expect(Study.days()).toContain(ymd());
        await T.waitFor(() => [...document.querySelectorAll('.toast b')].some(b => b.textContent.includes('مطلوب اليوم')), 5000, 'رسالة مطلوب اليوم');
        expect(document.querySelector('.today-strip').textContent).toContain('مراجعة سريعة');
        await T.shot('day-two-nudge');
      });
      await T.test('الرسالة مرة وحدة باليوم بس', async () => {
        document.querySelectorAll('.toast').forEach(t => t.remove());
        Cal.nudge(); await T.sleep(300);
        expect(document.querySelectorAll('.toast').length).toBe(0);
      });
    },
  ],
};
