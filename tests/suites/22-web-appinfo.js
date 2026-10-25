/* شبكة الأفكار الأقوى (اقتراحات ربط، بحث، كتب المادة) + «في نسخة جديدة» و«أبلغ عن مشكلة» */
const SUITE = {
  title: 'شبكة الأفكار: اقتراحات وبحث وكتب المادة — و«في نسخة جديدة» و«أبلغ عن مشكلة»',
  phases: [async T => {
    const { expect } = T;
    const subj = { id: 's' + uid(), name: 'أحياء', color: '#4f8a6e', created: Date.now() };
    await DB.put('subjects', subj);
    const b = await T.makeBook('الخلية', { subjectId: subj.id, htmls: [
      '<h2>الميتوكوندريا</h2><p>الميتوكوندريا بتنتج الطاقة للخلية عن طريق التنفس الخلوي.</p>',
      '<h2>التنفس الخلوي</h2><p>التنفس الخلوي بيصير جوّا الميتوكوندريا وبينتج طاقة ATP للخلية.</p>',
      '<h2>الحرب العالمية</h2><p>معركة العلمين صارت سنة 1942 بشمال أفريقيا.</p>',
      '',
    ] });
    const b2 = await T.makeBook('الوراثة', { subjectId: subj.id, htmls: ['<h2>الجينات</h2><p>الجينات بالنواة بتحمل الصفات الوراثية.</p>', '', '', ''] });
    await Reader.open(b.id, 0); await T.sleep(700); T.quiet();

    await T.test('الشبكة بتشمل كل كتب المادة (مش بس السلسلة)', async () => {
      const books = await IdeaWeb.scopeBooks(Reader.book);
      expect(books.map(x => x.id)).toEqual([b.id, b2.id]);
      expect(IdeaWeb.scopeName(books)).toBe('مادة أحياء · 2 كتب');
    });
    await T.test('بتقترح ربط الصفحة اللي بتحكي عن نفس الشي (ومش اللي ما إلها علاقة)', async () => {
      await IdeaWeb.open(b.pageIds[0]); await T.sleep(900);
      const sug = IdeaWeb.S.sug.map(x => x.id);
      T.info({ suggestions: IdeaWeb.S.sug.map(x => ({ page: b.pageIds.indexOf(x.id) + 1, words: x.words, score: +x.score.toFixed(2) })) });
      expect(sug[0]).toBe(b.pageIds[1]);
      expect(sug.includes(b.pageIds[2]), 'صفحة الحرب ما إلها علاقة').toBeFalsy();
      expect(!!document.querySelector(`.iw-node.suggested[data-id="${b.pageIds[1]}"] .iw-sugg`)).toBeTruthy();
      expect(!!document.querySelector('.iw-svg .thread.sugg')).toBeTruthy();
      await T.shot('web-suggestions');
    });
    await T.test('«🧵 اربط» على الاقتراح بيربطهم فعلاً (مع سبب الربط)', async () => {
      await T.mouse.click(`.iw-node[data-id="${b.pageIds[1]}"] .iw-sugg`);
      await T.waitFor(() => IdeaWeb.linked(b.pageIds[0], b.pageIds[1]), 3000, 'الربط');
      expect(IdeaWeb.linked(b.pageIds[0], b.pageIds[1]).note).toContain('مقترح');
      await T.sleep(500);
      expect(!!document.querySelector('#iw') && IdeaWeb.S.centerId === b.pageIds[0], '«اربط» ما بيفتح الصفحة ولا بيسكّر الشبكة').toBeTruthy();
      await T.sleep(300);
      expect(IdeaWeb.S.sug.some(x => x.id === b.pageIds[1]), 'ما بيرجع يقترح المربوطة').toBeFalsy();
    });
    await T.test('شكل السماء: الصفحات نجوم، والمربوطة أكبر، وعالماوس بتطلع بطاقة فيها محتوى الصفحة', async () => {
      const ov = document.querySelector('#iw');
      expect(ov.classList.contains('stars')).toBeTruthy();
      const st = id => parseFloat(document.querySelector(`.iw-node[data-id="${id}"]`).style.getPropertyValue('--st'));
      expect(st(b.pageIds[1])).toBeGreaterThan(st(b.pageIds[2])); // ص2 انربطت، ص3 لا
      const pin = document.querySelector(`.iw-node[data-id="${b.pageIds[2]}"] .iw-pin`).getBoundingClientRect();
      await T.mouse.move(pin.left + pin.width / 2, pin.top + pin.height / 2); await T.sleep(400);
      const tip = document.querySelector(`.iw-node[data-id="${b.pageIds[2]}"] .iw-tip`);
      expect(+getComputedStyle(tip).opacity).toBeGreaterThan(.9);
      expect(tip.textContent).toContain('معركة العلمين');
      expect(tip.textContent).toContain('ص 3');
      await T.mouse.move(5, 300); await T.sleep(200);
    });
    await T.test('البحث بالشبكة: بيبهّت الباقي، وEnter بيحط الصفحة بالنص', async () => {
      const inp = document.querySelector('.iw-find input');
      inp.focus(); inp.value = 'العلمين'; inp.dispatchEvent(new Event('input'));
      await T.sleep(100);
      expect(document.querySelector(`.iw-node[data-id="${b.pageIds[2]}"]`).classList.contains('hit')).toBeTruthy();
      expect(document.querySelector(`.iw-node[data-id="${b.pageIds[0]}"]`).classList.contains('dim')).toBeTruthy();
      await T.key('Enter', 'Enter');
      await T.waitFor(() => IdeaWeb.S.centerId === b.pageIds[2], 2000, 'التوسيط');
    });
    await T.test('ضغطة على نجمة بتفتح صفحتها بالكتاب', async () => {
      const pin = document.querySelector(`.iw-node[data-id="${b.pageIds[1]}"] .iw-pin`);
      await T.mouse.click(pin);
      await T.waitFor(() => !document.querySelector('#iw') && Reader.s === 0, 4000, 'فتح الصفحة');
    });
    // ===== النسخة والتحديث والإبلاغ =====
    const opened = []; const realOpen = window.open; window.open = u => { opened.push(String(u)); return null; };
    const realFetch = window.fetch; let remote = { version: '9.9.9', date: '2027-01-01', notes: ['ميزة جديدة حلوة', 'تصليحات'] };
    window.fetch = async (u, o) => String(u).includes('raw.githubusercontent.com') ? new Response(JSON.stringify(remote)) : realFetch(u, o);
    await T.test('مقارنة النسخ صح', () => {
      expect(AppInfo.newer('1.10.0', '1.9.9')).toBeTruthy();
      expect(AppInfo.newer('1.1.0', '1.1.0')).toBeFalsy();
      expect(AppInfo.newer('1.0.9', '1.1')).toBeFalsy();
      expect(typeof APP_VERSION).toBe('string');
    });
    await T.test('في نسخة أحدث على GitHub: بيخبّره، و«شو الجديد؟» بيعرض الملاحظات ورابط التنزيل', async () => {
      expect(await AppInfo.check()).toBe('new');
      const btn = await T.waitFor(() => [...document.querySelectorAll('.toast .btn.primary')].find(x => x.textContent.includes('شو الجديد')), 2000);
      expect([...document.querySelectorAll('.toast b')].some(x => x.textContent.includes('9.9.9'))).toBeTruthy();
      await T.mouse.click(btn);
      const m = await T.waitFor(() => document.querySelector('.upd'));
      expect(m.textContent).toContain('ميزة جديدة حلوة');
      await T.shot('update');
      await T.mouse.click('.upd [data-a=get]');
      expect(opened.pop()).toBe(`https://github.com/${APP_REPO}/archive/refs/heads/main.zip`);
    });
    await T.test('«لاحقاً» بيسكّت هالنسخة بالتشييك التلقائي، والتشييك اليدوي بيقول «عندك آخر نسخة» لما ما في جديد', async () => {
      localStorage.setItem('updSkip', '9.9.9');
      expect(await AppInfo.check()).toBe('skipped');
      remote = { version: APP_VERSION, notes: ['x'] };
      T.clean();
      expect(await AppInfo.check(true)).toBe('latest');
      await T.waitFor(() => [...document.querySelectorAll('.toast')].some(x => x.textContent.includes('عندك آخر نسخة')), 2000);
    });
    await T.test('«أبلغ عن مشكلة» بيفتح GitHub Issue جاهز فيه النسخة والجهاز', async () => {
      AppInfo.report('bug');
      const u = new URL(opened.pop());
      expect(u.href.startsWith(`https://github.com/${APP_REPO}/issues/new`)).toBeTruthy();
      expect(u.searchParams.get('labels')).toBe('bug');
      expect(u.searchParams.get('body')).toContain('النسخة: ' + APP_VERSION);
      expect(u.searchParams.get('body')).toContain('شو صار؟');
      AppInfo.report('idea');
      expect(new URL(opened.pop()).searchParams.get('labels')).toBe('enhancement');
      expect(!!Cmd.get('report') && !!Cmd.get('suggest') && !!Cmd.get('update')).toBeTruthy();
    });
    window.open = realOpen; window.fetch = realFetch;
  }],
};
