/* ورقة ليلة الامتحان: ملخص الكتاب بصفحة وحدة من شغل الطالب */
const SUITE = {
  title: 'ورقة ليلة الامتحان — العناوين والمظلّل وأسئلة المراجعة والأخطاء بصفحة وحدة',
  phases: [async T => {
    const { expect } = T;
    const hl = t => `<span style="background-color: rgb(255, 241, 118);">${t}</span>`;
    const b = await T.makeBook('أحياء', {
      htmls: [
        `<h2>الخلية</h2><p>الخلية هي ${hl('وحدة بناء الكائن الحي')} الأساسية.</p><p>شو بيعمل الميتوكوندريا؟ الجواب: <span class="ans" data-card="c1">بتنتج الطاقة</span></p><p>من أجزائها <b>النواة</b> و<b>الغشاء</b>.</p>`,
        `<h3>الانقسام</h3><p>الانقسام المتساوي بيعطي ${hl('خليتين متطابقتين')}.</p>`,
        `<h2>الوراثة</h2><p>مندل هو ${hl('أبو علم الوراثة')}.</p><table class="tbl"><tbody><tr><th>صفة</th></tr><tr><td style="background-color:#fff2cc">خلية جدول ما بتنحسب</td></tr></tbody></table>`,
        '',
      ],
    });
    await DB.put('cards', { id: 'c1', bookId: b.id, level: 0, due: Date.now(), created: Date.now(), reviews: 0 });
    await DB.put('exams', { id: 'e1', bookId: b.id, title: 'اختبار', created: Date.now(), updated: Date.now(), questions: [{ id: 'q1', q: 'كم كروموسوم بالإنسان؟', choices: ['46', '23'], correct: 0, pageId: b.pageIds[2] }, { id: 'q2', q: 'سؤال صح', choices: ['أ', 'ب'], correct: 0, pageId: b.pageIds[0] }], attempts: [{ at: Date.now(), score: 1, total: 2, wrong: ['q1'] }] });
    await Reader.open(b.id, 0); await T.sleep(700); T.quiet();

    // الأداة بتسكّر النوافذ بعد كل اختبار: كل اختبار بيفتح الورقة إذا مسكّرة
    const ensure = async () => { if (!document.querySelector('.sheet-paper')) { await Sheet.open(); await T.sleep(250); } };
    await T.test('من «مراجعة» ← «ورقة ليلة الامتحان» بتنفتح الورقة', async () => {
      Bars.show('#topbar'); await T.sleep(300);
      await T.mouse.click('#tbReview');
      const item = await T.waitFor(() => [...document.querySelectorAll('.menu .m-item')].find(x => x.textContent.includes('ورقة ليلة الامتحان')));
      await T.mouse.click(item);
      await T.waitFor(() => document.querySelector('.sheet-paper .sh-head'), 3000, 'الورقة');
      await T.shot('sheet');
    });
    await T.test('فيها العناوين بأرقام صفحاتها، والمظلّل، والسؤال بفراغ مكان الجواب، والكلمات المهمة', async () => {
      await ensure();
      const p = document.querySelector('.sheet-paper');
      const secs = [...p.querySelectorAll('.sh-sec h3')].map(h => h.textContent);
      expect(secs[0]).toContain('الخلية'); expect(secs[0]).toContain('ص 1');
      expect(secs[1]).toContain('الوراثة'); expect(secs[1]).toContain('ص 3');
      const t = p.textContent;
      expect(t).toContain('وحدة بناء الكائن الحي');
      expect(t).toContain('خليتين متطابقتين');
      expect(t).toContain('أبو علم الوراثة');
      expect(t.includes('خلية جدول'), 'تلوين خلايا الجداول مش هايلايت').toBeFalsy();
      const card = p.querySelector('.sh-card');
      expect(card.textContent).toContain('شو بيعمل الميتوكوندريا؟');
      expect(card.textContent).toContain('بتنتج الطاقة');
      expect(!!card.querySelector('u'), 'فراغ مكان الجواب').toBeTruthy();
      expect(p.querySelector('.sh-terms').textContent).toContain('النواة · الغشاء');
      expect(p.querySelector('.sh-sub').textContent).toBe('الانقسام');
    });
    await T.test('الأسئلة اللي غلطت فيها فوق، مع الجواب الصح وصفحته (والصح ما بيطلع)', async () => {
      await ensure();
      const w = document.querySelector('.sh-wrong');
      expect(w.textContent).toContain('كم كروموسوم بالإنسان؟');
      expect(w.textContent).toContain('46');
      expect(w.textContent).toContain('ص 3');
      expect(w.textContent.includes('سؤال صح')).toBeFalsy();
    });
    await T.test('«خبّي الأجوبة» للتسميع، وكل قسم بيتطفى لحاله', async () => {
      await ensure();
      const chk = k => document.querySelector(`.sh-opts [data-o=${k}]`);
      await T.mouse.click(chk('hide'));
      expect(document.querySelector('.sheet-paper').textContent.includes('بتنتج الطاقة')).toBeFalsy();
      expect(document.querySelectorAll('.sheet-paper .sh-blank').length).toBe(2);
      await T.mouse.click(chk('hl'));
      expect(document.querySelector('.sheet-paper').textContent.includes('أبو علم الوراثة')).toBeFalsy();
      await T.mouse.click(chk('hl')); await T.mouse.click(chk('hide'));
      await T.shot('sheet-hidden-answers-off');
    });
    await T.test('«اطبعها / PDF»: الورقة لحالها بصفحة A4', async () => {
      await ensure();
      let printed = null; const real = window.print;
      window.print = () => { printed = document.querySelector('#print').innerHTML; };
      await T.mouse.click('.sheet-dlg [data-a=print]');
      await T.waitFor(() => printed, 3000, 'الطباعة');
      window.print = real; dispatchEvent(new Event('afterprint'));
      expect(printed).toContain('sheet-print');
      expect(printed).toContain('وحدة بناء الكائن الحي');
      expect(printed.includes('class="page')).toBeFalsy();
    });
    await T.test('«أضفها لآخر الكتاب»: صفحات جديدة بعد آخر صفحة مكتوبة', async () => {
      await Sheet.open(); await T.sleep(300);
      const before = Reader.pages.length;
      await T.mouse.click('.sheet-dlg [data-a=add]');
      await T.waitFor(() => Reader.pages.some(p => p.html.includes('ورقة ليلة الامتحان')), 6000, 'صفحة الورقة');
      const i = Reader.pages.findIndex(p => p.html.includes('ورقة ليلة الامتحان'));
      expect(i).toBe(3); // الصفحة 4 كانت فاضية: بتنكتب فيها
      expect(Reader.pages[i].html).toContain('كم كروموسوم بالإنسان؟');
      expect(Reader.pages.length >= before).toBeTruthy();
      await T.shot('sheet-in-book');
    });
    await T.test('كتاب فاضي: بتشرح كيف تتعبّى بدل ورقة فاضية', async () => {
      T.clean();
      const e = await T.makeBook('فاضي'); await Reader.open(e.id, 0); await T.sleep(600); T.quiet();
      await Sheet.open(); await T.sleep(200);
      expect(!!document.querySelector('.sh-empty')).toBeTruthy();
      expect(!!document.querySelector('.sheet-dlg [data-a=print]')).toBeFalsy();
      T.clean();
    });
  }],
};
