const SUITE = {
  title: 'رحلة مستخدم: طالب جديد من أول تشغيل لآخر يوم دراسة',
  allowTour: true,
  phases: [
    async T => {
      const { expect } = T;
      await T.test('أول ما يفتح: بيسأله «شو بتعمل؟»، وبعد «تخطّي» جولة المكتبة بتشتغل لحالها', async () => {
        await T.waitFor(() => document.querySelector('.onboard .ob-card'), 4000, 'سؤال أول تشغيل');
        expect(document.querySelectorAll('.ob-card').length).toBe(4);
        await T.shot('onboard');
        await T.mouse.click('.onboard [data-a=skip]');
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
      await T.test('بيطلّع ورقة ليلة الامتحان من الكتاب التجريبي (فيها الهايلايت)', async () => {
        Editor.flushAll();
        await Sheet.open(); await T.sleep(300);
        expect(document.querySelector('.sheet-paper').textContent).toContain('HTML لغة لبناء هيكل صفحات الويب');
        T.clean();
      });
      await T.test('بيبدأ جلسة دراسة بالحبل، وبآخرها بيكتب شو تعلّم', async () => {
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
        expect(Study.days()).toContain(ymd()); // نجمة اليوم من الجلسة
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
