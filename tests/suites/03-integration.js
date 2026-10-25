const SUITE = {
  title: 'Integration — الأجزاء شغّالة مع بعض (كيبورد وماوس حقيقي)',
  phases: [
    async T => {
      const { expect } = T;
      await T.test('إنشاء كتاب من النافذة نفسها (بالكيبورد والماوس)', async () => {
        await T.mouse.click('#btnNew');
        await T.waitFor(() => document.querySelector('.bookform'));
        await T.mouse.click('.bookform input[name=title]');
        await T.typeText('كتاب الدمج Integration');
        await T.mouse.click('.bookform button[type=submit]');
        await T.waitFor(() => Reader.book && Reader.book.title === 'كتاب الدمج Integration', 5000, 'فتح الكتاب');
        await T.sleep(500); T.quiet();
        expect(Reader.book.paper.style).toBe(Settings.d.paper.style);
        expect(Reader.pages.length).toBe(4);
      });
      await T.test('تقليب الغلاف بسحب حقيقي من طرف الصفحة', async () => {
        const z = document.querySelector('.coverpg').getBoundingClientRect();
        // الكتاب عربي: الغلاف على اليسار، والسحب من طرفه الخارجي لليمين
        await T.mouse.drag(z.left + 20, z.top + z.height / 2, z.right + 300, z.top + z.height / 2, 18);
        await T.waitFor(() => !Reader.busy && Reader.s === 0, 4000, 'انفتاح الكتاب');
        expect(Editor.live.size).toBe(2);
        await T.shot('opened-book');
      });
      await T.test('الكتابة عربي وإنجليزي بالكيبورد، والانتقال التلقائي للصفحة التالية لما تمتلي', async () => {
        const c = document.querySelector('.page[data-i="0"] .content');
        await T.mouse.click(c);
        for (let i = 1; i <= 18; i++) { await T.typeText(`السطر ${i}: Networks are made of layers وكل طبقة إلها شغلها`); await T.key('Enter', 'Enter'); }
        await T.sleep(500);
        Editor.flushAll(); await T.sleep(200);
        const p1 = Reader.pages[1].html;
        expect(p1.length, 'الصفحة الثانية لازم يوصلها كلام').toBeGreaterThan(30);
        expect(Reader.pages[0].html).toContain('السطر 1');
        const c0 = document.querySelector('.page[data-i="0"] .content');
        expect(c0.scrollHeight <= c0.clientHeight + 2, 'الصفحة الأولى ما لازم تفيض').toBeTruthy();
      });
      await T.test('ملاحظة لاصقة: النص بيلف حواليها وما بيتغطى، وبتنسحب بالماوس', async () => {
        const l = Editor.live.get(0);
        Stickies.addNote(l, { x: 470, y: 240 }); await T.sleep(500);
        const note = document.querySelector('.page[data-i="0"] .sticky.note');
        const overlapText = () => { const r = note.getBoundingClientRect(); let n = 0; const tw = document.createTreeWalker(l.c, NodeFilter.SHOW_TEXT); let t; while ((t = tw.nextNode())) { const rg = document.createRange(); rg.selectNodeContents(t); for (const q of rg.getClientRects()) if (q.right > r.left + 3 && q.left < r.right - 3 && q.bottom > r.top + 3 && q.top < r.bottom - 3) n++; } return n; };
        expect(overlapText(), 'أسطر تحت الملاحظة').toBe(0);
        const tape = note.querySelector('.tape').getBoundingClientRect();
        const s0 = { ...l.p.stickies[0] };
        await T.mouse.drag(tape.left + tape.width / 2, tape.top + 8, tape.left + tape.width / 2 - 200, tape.top + 120, 10);
        await T.sleep(400);
        expect(l.p.stickies[0].x).toBeLessThan(s0.x - 50);
        expect(overlapText(), 'بعد السحب').toBe(0);
        await T.shot('wrap-after-drag');
      });
      await T.test('هايلايت: تحديد كلمة + لون من شريط التنسيق (ضغطة حقيقية)، وبيطلع بورقة ليلة الامتحان', async () => {
        const l = Editor.live.get(0);
        const p = [...l.c.querySelectorAll('p')].find(x => x.textContent.includes('السطر 2'));
        const t = p.firstChild, i = t.data.indexOf('Networks');
        const r = document.createRange(); r.setStart(t, i); r.setEnd(t, i + 'Networks'.length);
        l.c.focus(); Sel.restore(r); await T.sleep(150);
        await T.mouse.click('#selbar .hl[data-hl]');
        await T.sleep(200); Editor.flushAll();
        const hl = [...l.c.querySelectorAll('span[style*="background"]')].find(x => x.textContent.includes('Networks'));
        expect(!!hl, 'النص المظلّل').toBeTruthy();
        await Sheet.open(); await T.sleep(300);
        expect(document.querySelector('.sheet-paper').textContent).toContain('Networks');
        T.clean();
      });
      await T.test('شبكة الأفكار: ربط صفحتين بسحب الخرزة الذهبية بالماوس', async () => {
        const l1 = Editor.live.get(1);
        await IdeaWeb.open(Reader.pages[0].id); await T.sleep(1600);
        const pin = document.querySelector(`.iw-node[data-id="${Reader.pages[0].id}"] .iw-pin`).getBoundingClientRect();
        const to = document.querySelector(`.iw-node[data-id="${l1.p.id}"]`).getBoundingClientRect();
        await T.mouse.drag(pin.left + 9, pin.top + 9, to.left + to.width / 2, to.top + to.height / 2, 12);
        await T.waitFor(() => IdeaWeb.linked(Reader.pages[0].id, l1.p.id), 3000, 'الربط');
        await T.sleep(1200);
        await T.shot('idea-web-linked');
        document.querySelector('#iw [data-a=close]').click(); await T.sleep(400);
      });
      await T.test('PDF: كل صفحة مكتوبة بتنحط بورقة A4 والفيديو بيتبدل بعلامة', async () => {
        const realPrint = window.print; let printed = 0; window.print = () => { printed++; };
        await Exporter.pdf(); await T.sleep(300);
        window.print = realPrint;
        expect(printed).toBe(1);
        const n = document.querySelectorAll('#print .pp').length;
        expect(n).toBeGreaterThan(2);
        expect(document.querySelectorAll('#print video').length).toBe(0);
        dispatchEvent(new Event('afterprint'));
        expect(document.querySelector('#print').children.length).toBe(0);
      });
      await T.test('حذف صفحة للسلة ثم التراجع: عدد الصفحات زوجي والمحتوى رجع', async () => {
        Editor.flushAll();
        const before = Reader.pages.length, html1 = Reader.pages[1].html;
        await Reader.deletePage(1); await T.sleep(300);
        expect(Reader.pages.length % 2).toBe(0);
        const item = (await DB.all('trash'))[0];
        await Trash.restore(item); await T.sleep(800); T.quiet();
        expect(Reader.pages.length).toBe(before);
        expect(Reader.pages[1].html).toBe(html1);
      });
    },
    // بعد إعادة تحميل التطبيق: كل شي محفوظ
    async T => {
      const { expect } = T;
      await T.test('بعد إعادة التشغيل: الكتاب والكلام والملاحظة والهايلايت كلهم محفوظين', async () => {
        const b = (await DB.all('books')).find(x => x.title === 'كتاب الدمج Integration');
        expect(!!b).toBeTruthy();
        const pages = await DB.getMany('pages', b.pageIds);
        expect(pages[0].html).toContain('السطر 1');
        expect(pages[0].stickies.length).toBe(1);
        expect(pages[0].html).toContain('background');
        expect(b.lastSpread).toBe(0);
      });
      await T.test('البحث بكل الكتب بيلاقي الكلام وبيفتح الصفحة', async () => {
        const b = (await DB.all('books')).find(x => x.title === 'كتاب الدمج Integration');
        await Reader.open(b.id, 0); await T.sleep(500); T.quiet();
        await Finder.open(); await T.sleep(400);
        await T.mouse.click('.finder input'); await T.typeText('السطر 17');
        await T.waitFor(() => document.querySelector('.f-hit'), 3000, 'نتيجة بحث');
        await T.mouse.click('.f-hit');
        await T.waitFor(() => CSS.highlights.has('find'), 4000, 'تلوين الكلمة');
        T.info({ page: Reader.s });
      });
    },
  ],
};
