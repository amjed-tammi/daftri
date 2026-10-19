const SUITE = {
  title: 'رحلة مستخدم: واحد راجع بعد تحديث (شوف الجديد)',
  allowTour: true,
  phases: [
    async T => {
      await T.test('مستخدم قديم: شاف الجولة بالنسخة السابقة وعنده كتب', async () => {
        await T.sleep(1200); if (Tour.active) Tour.end(false); // نستنى مؤقت جولة أول مرة يخلص قبل ما نكتب نسخة قديمة
        await T.makeBook('كتابي القديم');
        localStorage.setItem('tour-lib', '1'); localStorage.setItem('tour-book', '1');
        localStorage.setItem('tourv-lib', '3'); localStorage.setItem('tourv-book', '3');
      });
    },
    async T => {
      const { expect } = T;
      await T.test('بعد التحديث: بتطلعله رسالة «في ميزات جديدة» مش الجولة كاملة', async () => {
        await T.waitFor(() => [...document.querySelectorAll('.toast b')].some(b => b.textContent.includes('ميزات جديدة')), 4000, 'رسالة الجديد');
        expect(Tour.active).toBe(null);
      });
      await T.test('«شوف الجديد» بيعرض بس الخطوات الجديدة', async () => {
        const btn = [...document.querySelectorAll('.toast .btn.primary')].find(b => b.textContent.includes('الجديد'));
        await T.mouse.click(btn);
        await T.waitFor(() => Tour.active === 'lib');
        const fresh = TOURS.lib.filter(s => (s.since || 0) > 3).length;
        expect(Tour.steps().length).toBe(fresh + 2);
        await T.shot('whats-new');
        Tour.end(false);
      });
      await T.test('وجوّا الكتاب كمان بيطلعله الجديد مرة وحدة بس', async () => {
        const b = (await DB.all('books'))[0];
        await Reader.open(b.id, 0);
        await T.waitFor(() => [...document.querySelectorAll('.toast b')].some(x => x.textContent.includes('ميزات جديدة')), 4000);
        document.querySelectorAll('.toast').forEach(t => t.remove()); T.clean(); Reader.close(); await T.sleep(300);
        await Reader.open(b.id, 0); await T.sleep(2000);
        expect([...document.querySelectorAll('.toast b')].some(x => x.textContent.includes('ميزات جديدة')), 'مرة ثانية').toBeFalsy();
      });
    },
  ],
};
