/* أدوات الطالب: معادلات، صوّر السبورة، ملاحظة سريعة، ساعات كل مادة، طباعة صفحات، البحث بالـPDF، فتح دفتر باسمه، ورق ليلي، آخر نسخة */
const SUITE = {
  title: 'أدوات الطالب — معادلات، كاميرا، ملاحظة سريعة، ساعات المواد، طباعة صفحات، بحث PDF',
  phases: [async T => {
    const { expect } = T;
    const subj = { id: 's' + uid(), name: 'فيزياء', color: '#4f8a6e', created: Date.now() };
    await DB.put('subjects', subj);
    const b = await T.makeBook('دفتر الفيزياء', { subjectId: subj.id, htmls: ['<h2>الحركة</h2><p>السرعة = المسافة ÷ الزمن</p>', '<p>صفحة 2</p>', '<p>صفحة 3</p>', '<p>صفحة 4</p>', '<p>صفحة 5</p>', '<p>صفحة 6</p>'] });
    await Library.load();

    await T.test('Ctrl+/ بيلاقي الدفتر باسمه وبيفتحه', async () => {
      await T.key('/', 'Slash', 2);
      const inp = await T.waitFor(() => document.querySelector('.palette input'));
      inp.value = 'الفيزياء'; inp.dispatchEvent(new Event('input'));
      await T.sleep(100);
      expect(document.querySelector('.pl-g').textContent).toBe('دفاتر');
      await T.key('Enter', 'Enter');
      await T.waitFor(() => Reader.book && Reader.book.id === b.id, 3000, 'فتح الدفتر');
      await T.sleep(900); T.quiet();
    });
    await T.test('معادلة: من شريط التنسيق، بكتابة بسيطة بتطلع مرتبة، وضغطة عليها بتعدّلها', async () => {
      if (Reader.s < 0) { await Reader.turn(1); await T.sleep(900); }
      const l = Editor.live.get(0); const p = l.c.querySelector('p');
      await T.mouse.click(p); setCaretAt(p, p.textContent.length);
      await T.mouse.click('#selbar [data-a=eq]');
      const inp = await T.waitFor(() => document.querySelector('.eqf-in'));
      await T.typeText('v = d/t');
      await T.sleep(100);
      expect(!!document.querySelector('.eqf-prev .eq-frac')).toBeTruthy();
      await T.mouse.click('.eqf-keys [data-ins="^2"]');
      await T.shot('equation-editor');
      await T.key('Enter', 'Enter');
      const eq = await T.waitFor(() => l.c.querySelector('.eq'), 2000, 'المعادلة بالصفحة');
      expect(eq.dataset.src).toBe('v = d/t^2');
      expect(!!eq.querySelector('.eq-frac .eq-den sup')).toBeTruthy();
      expect(eq.getAttribute('contenteditable')).toBe('false');
      // ضغطة عليها بتعدّلها
      await T.mouse.click(eq);
      const inp2 = await T.waitFor(() => document.querySelector('.eqf-in'));
      expect(inp2.value).toBe('v = d/t^2');
      inp2.value = 'H_2O'; inp2.dispatchEvent(new Event('input'));
      await T.mouse.click('.eqf .btn.primary');
      await T.waitFor(() => l.c.querySelector('.eq') && l.c.querySelector('.eq').dataset.src === 'H_2O', 2000);
      expect(!!l.c.querySelector('.eq sub')).toBeTruthy();
      await T.sleep(300); Editor.flushAll();
      expect(Reader.pages[0].html).toContain('data-src="H_2O"');
    });
    await T.test('عرض المعادلات: كسور وجذور وكيمياء', () => {
      const r = s => { const d = document.createElement('span'); d.innerHTML = MathEq.render(s); return d; };
      expect(!!r('sqrt(x+1)').querySelector('.eq-sqrt .eq-under')).toBeTruthy();
      expect(r('2H_2 + O_2 -> 2H_2O').textContent.replace(/\s/g, '')).toBe('2H2+O2→2H2O');
      expect(r('{a+b}/c').querySelector('.eq-num').textContent).toBe('a+b');
      expect(r('a >= b').textContent).toContain('≥');
      expect(r('Fe^{3+}').querySelector('sup').textContent).toBe('3+');
    });
    await T.test('«صوّر السبورة»: كاميرا اللابتوب بنافذة، و«صوّر» بيحط الصورة كبيرة بالصفحة', async () => {
      const l = Editor.live.get(0); const before = (l.p.stickies || []).length;
      Camera.shoot(l);
      await T.waitFor(() => { const v = document.querySelector('.cam video'); return v && v.videoWidth > 0; }, 6000, 'الكاميرا (وهمية بالاختبار)');
      await T.shot('camera');
      await T.mouse.click('.cam [data-a=snap]');
      await T.waitFor(() => (l.p.stickies || []).length === before + 1, 5000, 'الصورة بالصفحة');
      const st = l.p.stickies[l.p.stickies.length - 1];
      expect(st.kind).toBe('photo'); expect(st.w).toBe(380);
      expect(!!(await DB.get('blobs', st.blob))).toBeTruthy();
    });
    await T.test('ملاحظة سريعة (Alt+N) بتنحفظ بدفتر «مسودات» مع الوقت', async () => {
      T.clean(); Reader.close(); await T.sleep(500);
      await T.key('n', 'KeyN', 1);
      const ta = await T.waitFor(() => document.querySelector('.qn textarea'));
      await T.mouse.click(ta); await T.typeText('واجب الفيزياء: حل أسئلة الفصل 3');
      await T.key('Enter', 'Enter', 2); // Ctrl+Enter
      const dr = await T.waitFor(async () => (await DB.all('books')).find(x => x.drafts), 3000, 'دفتر المسودات');
      const pages = await DB.getMany('pages', dr.pageIds);
      expect(pages[0].html).toContain('واجب الفيزياء: حل أسئلة الفصل 3');
      expect(pages[0].html).toContain('<h3>✎ ');
      // ملاحظة ثانية بنفس الدفتر (ما بينعمل دفتر جديد)
      await QuickNote.save('فكرة ثانية');
      expect((await DB.all('books')).filter(x => x.drafts).length).toBe(1);
      expect((await DB.get('pages', dr.pageIds[0])).html).toContain('فكرة ثانية');
      T.clean();
    });
    await T.test('ساعات الدراسة: جلسة الحبل بتنحسب لمادة الكتاب (الوقت الفعلي بس)', async () => {
      localStorage.removeItem('studyLog');
      await Reader.open(b.id, 0); await T.sleep(600); T.quiet();
      Rope.start(25); await T.sleep(100);
      Rope.run.end -= 10 * 60e3; // كأنه مرّ 10 دقائق
      Rope.stop(); T.clean();
      const w = Study.week();
      expect(w.total).toBe(10);
      expect(w.subj[0].name).toBe('فيزياء');
      await Study.journalPanel(); await T.sleep(250);
      expect(document.querySelector('.wk').textContent).toContain('هالأسبوع: 10 د');
      expect(document.querySelector('.wk-row').textContent).toContain('فيزياء');
      await T.shot('study-hours');
      T.clean();
    });
    await T.test('الطباعة: «من صفحة لصفحة» بتطبع هدول بس (بدون غلاف)', async () => {
      let printed = null; const real = window.print;
      window.print = () => { printed = document.querySelectorAll('#print .pp').length; };
      Exporter.choose(); await T.sleep(250);
      const f = document.querySelector('.prt');
      f.from.value = '2'; f.to.value = '4'; f.w.value = 'range';
      await T.shot('print-choose');
      await T.mouse.click('.prt .btn.primary');
      await T.waitFor(() => printed != null, 4000, 'الطباعة');
      window.print = real; dispatchEvent(new Event('afterprint'));
      expect(printed).toBe(3);
    });
    await T.test('البحث بيلاقي الكلمة جوّا ملف PDF، والنتيجة بتفتح الملف على صفحتها', async () => {
      const f = await T.fixture('sample-ar-en.pdf', 'application/pdf');
      const [rec] = await Files.addFiles([f], { subjectId: subj.id, bookId: b.id });
      await Files.text(rec);
      await Finder.open(); await T.sleep(400);
      const inp = document.querySelector('.finder input');
      inp.value = 'سبع طبقات'; inp.dispatchEvent(new Event('input'));
      const hit = await T.waitFor(() => document.querySelector('.f-hit[data-f]'), 4000, 'نتيجة PDF');
      expect(hit.closest('section').querySelector('h5').textContent).toContain('📎 sample-ar-en');
      await T.shot('pdf-search');
      await T.mouse.click(hit);
      const fr = await T.waitFor(() => document.querySelector('.pdfv-frame'), 4000, 'العارض');
      expect(fr.getAttribute('src')).toContain('#page=1&');
      T.clean();
    });
    await T.test('ورق أدفى بالليل: بس بين 9 بالليل و5 الصبح ولما يكون مفعّل', () => {
      Settings.set('nightWarm', true);
      expect(Settings.applyNight(new Date(2026, 9, 25, 22, 0))).toBeTruthy();
      expect(Settings.applyNight(new Date(2026, 9, 25, 14, 0))).toBeFalsy();
      Settings.set('nightWarm', false);
      expect(Settings.applyNight(new Date(2026, 9, 25, 23, 0))).toBeFalsy();
    });
    await T.test('«افتح آخر نسخة»: من المجلد، والكتاب الأحدث بيتحدّث (لتكمّل من جهاز ثاني)', async () => {
      const book = await DB.get('books', b.id);
      const out = await Backup.build([b.id]);
      const data = JSON.parse(await out.blob.text());
      data.books[0].updated = Date.now() + 60000; // كأنه انكتب بجهاز ثاني بعدين
      const pg = data.pages.find(p => p.id === book.pageIds[1]); pg.html = '<p>كتبتها على اللابتوب</p>';
      const files = new Map([['دفتري 2026-01-01.daftari.json', '{}'], ['دفتري 2026-10-25.daftari.json', JSON.stringify(data)]]);
      AutoBackup.dir = async () => ({ queryPermission: async () => 'granted', async *entries() { for (const k of files.keys()) yield [k, { kind: 'file' }]; }, getFileHandle: async nm => ({ getFile: async () => new File([files.get(nm)], nm) }) });
      if (Reader.book) Reader.close();
      const r = await AutoBackup.restoreLatest();
      expect(r.updated).toBe(1);
      expect((await DB.get('pages', book.pageIds[1])).html).toBe('<p>كتبتها على اللابتوب</p>');
    });
  }],
};
