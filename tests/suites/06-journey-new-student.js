const SUITE = {
  title: 'رحلة مستخدم: طالب جديد من أول تشغيل لآخر يوم دراسة',
  allowTour: true,
  phases: [
    async T => {
      const { expect } = T;
      await T.test('أول ما يفتح: جولة المكتبة بتشتغل لحالها', async () => {
        await T.waitFor(() => Tour.active === 'lib', 4000, 'جولة المكتبة');
      });
      await T.test('بيمشي بالجولة كلها بالضغط على «التالي» وبتفتح الكتاب التجريبي', async () => {
        for (let i = 0; i < 20 && Tour.active === 'lib'; i++) { await T.sleep(500); await T.mouse.click('.tour-card [data-t=next]'); }
        await T.waitFor(() => Reader.book && Reader.book.title.startsWith('كتاب تجريبي'), 5000, 'الكتاب التجريبي');
      });
      await T.test('جولة الكتاب بتكمل جوّا الكتاب وبتقلّب الغلاف', async () => {
        await T.waitFor(() => Tour.active === 'book', 4000, 'جولة الكتاب');
        for (let i = 0; i < 30 && Tour.active === 'book'; i++) { await T.sleep(550); await T.mouse.click('.tour-card [data-t=next]'); }
        expect(Tour.active).toBe(null);
        expect(Reader.s).toBe(0);
        await T.shot('practice-book');
      });
      await T.test('بيكتب ملاحظته الأولى', async () => {
        const c = document.querySelector('.page[data-i="1"] .content');
        await T.mouse.click(c);
        const last = c.querySelector('p'); setCaretAt(last, last.textContent.length); // آخر الفقرة اللي تحت الكود
        await T.key('Enter', 'Enter'); await T.typeText('ملاحظتي: CSS بتنسّق الصفحة');
        await T.sleep(300); Editor.flushAll();
        expect(Reader.pages[1].html).toContain('ملاحظتي');
      });
      await T.test('بيراجع سؤال اليوم (البطاقة التجريبية)', async () => {
        await Study.startReview(); await T.sleep(800);
        await T.waitFor(() => document.querySelector('#reviewbar [data-rv=reveal]'));
        await T.mouse.click('#reviewbar [data-rv=reveal]');
        await T.mouse.click('#reviewbar [data-rv=ok]');
        await T.waitFor(() => !Study.rv, 4000, 'نهاية المراجعة');
        expect(Study.days()).toContain(ymd());
      });
      await T.test('بيعمل امتحان من صفحة ويحلّه', async () => {
        const l = Editor.live.get(0);
        // نضيف سؤال مراجعة ثاني حتى يطلع للامتحان خيارات
        const p = l.c.querySelector('p'); const t = p.firstChild, rg = document.createRange(); rg.setStart(t, 0); rg.setEnd(t, 3);
        await Study.mark(rg, l); await T.sleep(200);
        Exams.editor(null, { pageIndex: 0 }); await T.sleep(300);
        await T.mouse.click('.ex-ed [data-a=save]');
        await T.waitFor(async () => (await Exams.all(Reader.book.id)).length === 1);
        Exams.take((await Exams.all(Reader.book.id))[0]); await T.sleep(400);
        while (Exams.run && document.querySelector('.ex-opt')) { const q = Exams.run.qs[Exams.run.i]; await T.mouse.click(`.ex-opt[data-j="${q.correct}"]`); await T.mouse.click('[data-a=next]'); }
        await T.waitFor(() => document.querySelector('.ex-ring'));
        expect(document.querySelector('.ex-ring b').textContent).toBe('100%');
        Exams.close();
      });
      await T.test('بيبدأ جلسة دراسة بالحبل، وبآخرها بيكتب شو تعلّم', async () => {
        await T.waitFor(() => !document.querySelector('#exam'), 2000, 'إغلاق الامتحان');
        const knot = document.querySelector('#rope .knot').getBoundingClientRect();
        await T.mouse.drag(knot.left + knot.width / 2, knot.top + knot.height / 2, knot.left + knot.width / 2, knot.top + 140, 12);
        await T.waitFor(() => Rope.run, 2000, 'بدء الجلسة');
        expect(document.body.classList.contains('in-session')).toBeTruthy();
        Rope.run.end = Date.now() - 5; Rope.paint();
        await T.waitFor(() => document.querySelector('.journal-form textarea'), 3000, 'سؤال آخر الجلسة');
        await T.mouse.click('.journal-form textarea'); await T.typeText('تعلّمت الفرق بين HTML و CSS');
        await T.mouse.click('.journal-form .btn.primary');
        await T.waitFor(async () => (await DB.all('journal')).length === 1);
      });
    },
    async T => {
      const { expect } = T;
      await T.test('تاني يوم (إعادة تشغيل): كل شي محفوظ', async () => {
        const b = (await DB.all('books')).find(x => x.title.startsWith('كتاب تجريبي'));
        expect(!!b).toBeTruthy();
        const pages = await DB.getMany('pages', b.pageIds);
        expect(pages[1].html).toContain('ملاحظتي');
        const cards = await DB.all('cards');
        expect(cards.some(c => c.level === 1 && c.due > Date.now())).toBeTruthy();
        expect((await Exams.all(b.id))[0].attempts.length).toBe(1);
        expect((await DB.all('journal'))[0].text).toContain('HTML');
      });
      await T.test('ما بترجع الجولة تطلع، والنجمة موجودة بالسماء', async () => {
        await T.sleep(1500);
        expect(Tour.active).toBe(null);
        expect(document.querySelector('#streak').hidden).toBeFalsy();
        await T.shot('day-two-library');
      });
    },
  ],
};
