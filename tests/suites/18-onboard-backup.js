/* أول تشغيل (توجيهي / جامعة / كاتب) والنسخ الاحتياطي التلقائي */
const SUITE = {
  title: 'أول تشغيل حسب نوع المستخدم، والنسخ الاحتياطي التلقائي لمجلد',
  allowTour: true,
  phases: [
    async T => {
      const { expect } = T;
      await T.test('طالب توجيهي: بيختار علمي، بيشيل مادة وبيضيف مادة، وبيحط موعد الامتحان', async () => {
        await T.waitFor(() => document.querySelector('.onboard .ob-card'), 4000, 'سؤال أول تشغيل');
        await T.mouse.click('.ob-card[data-p=tawjihi]');
        await T.waitFor(() => document.querySelector('.ob-chip'));
        expect(document.querySelectorAll('.ob-chip.on').length).toBe(8);
        await T.mouse.click('.ob-chip[data-v="التاريخ"]'); // مش إله
        await T.mouse.click('.ob-add input'); await T.typeText('الحاسوب'); await T.key('Enter', 'Enter');
        const d = ymd(Date.now() + 40 * 864e5); // تاريخ محلي (مش UTC) زي ما الطالب بيشوفه
        const date = document.querySelector('.onboard [name=exam]'); date.value = d; date.dispatchEvent(new Event('input'));
        await T.shot('onboard-tawjihi');
        await T.mouse.click('.onboard [data-a=go]');
        await T.waitFor(async () => (await DB.all('books')).length === 8, 5000, 'الدفاتر');
        const subs = (await DB.all('subjects')).filter(s => !s.sys).map(s => s.name);
        expect(subs.includes('الحاسوب') && !subs.includes('التاريخ')).toBeTruthy();
        const books = await DB.all('books');
        expect(books.find(b => b.title === 'دفتر الرياضيات').paper.style).toBe('grid');
        expect(books.find(b => b.title === 'دفتر اللغة العربية').paper.style).toBe('lined');
        expect((await DB.all('plans')).some(p => p.date === d && p.title.includes('الامتحان'))).toBeTruthy();
        expect(Settings.d.app.profile).toBe('tawjihi');
        expect(document.body.classList.contains('no-study')).toBeFalsy();
        await T.waitFor(() => Tour.active === 'lib', 4000, 'الجولة بعدها');
        Tour.end(false);
        // عدّ تنازلي للامتحان بالمكتبة
        const ex = document.querySelector('.ts-exam');
        expect(!!ex, 'العدّ التنازلي').toBeTruthy();
        expect(ex.textContent).toContain('باقي 40 يوم على الامتحان');
        await T.shot('tawjihi-library');
      });
      await T.test('النسخ الاحتياطي: بيكتب نسخة اليوم بالمجلد، وما بيكرر إذا ما تغيّر شي، وبيخلّي آخر 7 أيام', async () => {
        // مجلد وهمي بنفس واجهة المتصفح (اختيار المجلد الحقيقي بدّه ضغطة من المستخدم)
        const files = new Map();
        for (let i = 1; i <= 9; i++) files.set(`دفتري 2026-01-0${i}.daftari.json`, 'old');
        files.set('ملاحظات خاصة.txt', 'لازم ما تنمسح');
        let perm = 'granted';
        const dir = {
          name: 'OneDrive/دفتري', kind: 'directory',
          queryPermission: async () => perm, requestPermission: async () => (perm = 'granted'),
          getFileHandle: async name => ({ createWritable: async () => { let data; return { write: async b => { data = b; }, close: async () => { files.set(name, await data.text()); } }; } }),
          async *entries() { for (const k of [...files.keys()]) yield [k, { kind: 'file' }]; },
          removeEntry: async name => { files.delete(name); },
        };
        AutoBackup.dir = async () => dir;
        Object.assign(Settings.d.backup, { on: true, dir: dir.name, sig: '' });
        expect(await AutoBackup.run()).toBe('ok');
        const today = `دفتري ${ymd()}.daftari.json`;
        const data = JSON.parse(files.get(today));
        expect(data.app).toBe('daftari');
        expect(data.books.length).toBe(8);
        expect(data.subjects.some(s => s.name === 'الحاسوب')).toBeTruthy();
        const kept = [...files.keys()].filter(k => AutoBackup.NAME.test(k));
        expect(kept.length).toBe(7);
        expect(kept.includes(today)).toBeTruthy();
        expect(files.has('ملاحظات خاصة.txt'), 'ملفات المستخدم الثانية').toBeTruthy();
        expect(await AutoBackup.run()).toBe('same');
        const b = (await DB.all('books'))[0]; b.updated = Date.now() + 5; await DB.put('books', b);
        expect(await AutoBackup.run()).toBe('ok');
        T.info({ sizeKB: Math.round(Settings.d.backup.size / 1024), status: AutoBackup.status().replace(/<[^>]+>/g, '') });
        // بعد إعادة تشغيل المتصفح: بيطلب الموافقة بضغطة وحدة
        perm = 'prompt'; b.updated = Date.now() + 10; await DB.put('books', b);
        expect(await AutoBackup.run()).toBe('perm');
        await T.waitFor(() => [...document.querySelectorAll('.toast b')].some(x => x.textContent.includes('بدّه موافقتك')), 2000, 'طلب الموافقة');
        await T.mouse.click([...document.querySelectorAll('.toast .btn.primary')].find(x => x.textContent === 'اسمح'));
        await T.waitFor(() => perm === 'granted' && Settings.d.backup.last, 3000);
      });
      await T.test('بدون نسخ تلقائي: بعد أسبوع بيذكّره (مرة باليوم بس)', async () => {
        T.clean();
        Object.assign(Settings.d.backup, { on: false, last: Date.now() - 8 * 864e5, remindAt: 0 });
        expect(await AutoBackup.remind()).toBe('reminded');
        await T.waitFor(() => [...document.querySelectorAll('.toast b')].some(x => x.textContent.includes('بدون نسخة احتياطية')), 2000);
        expect(await AutoBackup.remind()).toBe('wait');
      });
      await T.test('الإعدادات: قسم النسخ الاحتياطي والوضع الخفيف وأدوات الدراسة', async () => {
        T.clean(); Settings.panel('app'); await T.sleep(300);
        const p = document.querySelector('.settings');
        expect(!!p.querySelector('.st-block')).toBeTruthy();
        expect(!!p.querySelector('[data-k=lite]') && !!p.querySelector('[data-k=study]')).toBeTruthy();
        await T.shot('settings-app');
        T.clean();
      });
    },
    async T => {
      const { expect } = T;
      await T.test('بعد ما جاوب: ما بيرجع يسأله، والجولة ما بترجع', async () => {
        await T.sleep(1500);
        expect(!!document.querySelector('.onboard')).toBeFalsy();
        expect(Tour.active).toBe(null);
      });
      await T.test('كاتب: شريط أنظف (أدوات الدراسة مخفية) وبترجع من الإعدادات', async () => {
        Settings.set('profile', 'writer'); Settings.d.app.studyTools = null; Onboard.applyProfile();
        const b = (await DB.all('books'))[0];
        await Reader.open(b.id, 0); await T.sleep(700); T.quiet(); Bars.show('#topbar'); await T.sleep(400);
        expect(document.querySelector('#tbWeb').offsetParent).toBe(null);
        expect(!!document.querySelector('#tbInsert').offsetParent).toBeTruthy();
        await T.shot('writer-toolbar');
        Settings.set('studyTools', true); Onboard.applyProfile(); await T.sleep(100);
        expect(!!document.querySelector('#tbWeb').offsetParent).toBeTruthy();
      });
    },
  ],
};
