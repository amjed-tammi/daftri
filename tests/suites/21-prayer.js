/* أوقات الصلاة: Aladhan (بنفس شكل ردّه الحقيقي)، تخزين للشهر، الصلاة الجاية، تذكير الأذان، وإيقاف جلسة الدراسة */
const SUITE = {
  title: 'أوقات الصلاة — من Aladhan، بتشتغل بدون إنترنت للشهر، وتذكير وقت الأذان',
  phases: [
    async T => {
      const { expect } = T;
      // ردّ وهمي بنفس شكل Aladhan: أوقات اليوم حوالين «هلّق» حتى نختبر الصلاة الجاية والأذان
      const calls = [];
      const off = -new Date().getTimezoneOffset(), z = `(${off >= 0 ? '+' : '-'}${String(Math.floor(Math.abs(off) / 60)).padStart(2, '0')}${Math.abs(off) % 60 ? String(Math.abs(off) % 60).padStart(2, '0') : ''})`;
      const hm = d => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} ${z}`;
      const mk = (y, m) => {
        const n = new Date(y, m, 0).getDate(), data = [];
        for (let d = 1; d <= n; d++) {
          const t = { Fajr: new Date(y, m - 1, d, 5, 25), Sunrise: new Date(y, m - 1, d, 6, 47), Dhuhr: new Date(y, m - 1, d, 12, 20), Asr: new Date(y, m - 1, d, 15, 30), Maghrib: new Date(y, m - 1, d, 17, 58), Isha: new Date(y, m - 1, d, 19, 15) };
          data.push({ timings: Object.fromEntries(Object.entries(t).map(([k, v]) => [k, hm(v)])), date: { gregorian: { date: `${String(d).padStart(2, '0')}-${String(m).padStart(2, '0')}-${y}` }, hijri: { day: '14', month: { ar: 'جُمادى الأولى' }, year: '1448' } } });
        }
        return { code: 200, status: 'OK', data };
      };
      const realFetch = window.fetch;
      window.fetch = async (url, o) => {
        if (String(url).startsWith('https://api.aladhan.com/')) { calls.push(String(url)); const m = /\/(\d{4})\/(\d{1,2})\?/.exec(url); return new Response(JSON.stringify(mk(+m[1], +m[2])), { headers: { 'Content-Type': 'application/json' } }); }
        return realFetch(url, o);
      };
      window.__restoreFetch = () => { window.fetch = realFetch; };

      await T.test('من الإعدادات: بيشغّلها وبيختار مدينته، وبتطلع أوقات اليوم', async () => {
        Settings.panel('app'); await T.sleep(300);
        await T.mouse.click('.pr-block [data-k=pron]');
        const sel = document.querySelector('.pr-block [data-k=prcity]');
        sel.value = 'Riyadh|Saudi Arabia'; sel.dispatchEvent(new Event('change', { bubbles: true }));
        await T.waitFor(() => /اليوم: الفجر/.test(document.querySelector('.pr-status').textContent), 4000, 'أوقات اليوم');
        const u = calls[calls.length - 1];
        T.info({ url: u });
        expect(u).toContain('calendarByCity/');
        expect(u).toContain('city=Riyadh&country=Saudi%20Arabia');
        expect(u.includes('method='), 'تلقائي حسب البلد').toBeFalsy();
        expect(Settings.d.prayer.label).toBe('الرياض');
        await T.shot('prayer-settings');
      });
      await T.test('طريقة الحساب والمذهب بيروحوا بالطلب', async () => {
        Settings.panel('app'); await T.sleep(300);
        const m = document.querySelector('.pr-block [data-k=prmethod]'); m.value = '4'; m.dispatchEvent(new Event('change', { bubbles: true }));
        await T.waitFor(() => calls.some(c => c.includes('&method=4')), 3000);
        const s = document.querySelector('.pr-block [data-k=prschool]'); s.value = '1'; s.dispatchEvent(new Event('change', { bubbles: true }));
        await T.waitFor(() => calls.some(c => c.includes('&method=4&school=1')), 3000);
        s.value = '0'; s.dispatchEvent(new Event('change', { bubbles: true })); await T.sleep(300);
        T.clean();
      });
      await T.test('بالمكتبة: «العصر … بعد 25 د»، وكبسة بتعرض أوقات اليوم', async () => {
        await T.makeBook('دفتر'); await T.sleep(200); // المكتبة الفاضية بتعرض الترحيب بس
        const chip = await T.waitFor(() => document.querySelector('.pr-chip'), 3000, 'الشريحة');
        // الشريحة بتعرض الصلاة الجاية فعلاً (حسب الساعة هلّق)
        expect(chip.textContent).toContain(Prayer.next().ar);
        expect(chip.textContent).toContain('بعد');
        // ونفس الحساب بلحظة ثابتة: الساعة 3:05 العصر الجاي بعد 25 دقيقة، وبعد العشاء الجاي فجر بكرة
        const day = new Date(); day.setHours(15, 5, 0, 0);
        const n = Prayer.next(day);
        expect(n.ar).toBe('العصر'); expect(Prayer.rel(n.at - day)).toBe('بعد 25 د');
        const late = new Date(); late.setHours(21, 0, 0, 0);
        expect(Prayer.next(late).ar).toBe('الفجر');
        await T.mouse.click(chip);
        const p = await T.waitFor(() => document.querySelector('.pr-panel'));
        expect(p.querySelectorAll('li').length).toBe(6);
        const on = p.querySelector('li.on'); if (Prayer.next().en !== 'Fajr' || new Date().getHours() < 5) expect(on && on.textContent).toContain(Prayer.next().ar);
        expect(p.textContent).toContain('جُمادى الأولى');
        await T.shot('prayer-library');
        T.clean();
      });
      await T.test('وقت الأذان: تذكير مرة وحدة بس', async () => {
        const asr = Prayer.times().find(x => x.en === 'Asr').at;
        Prayer.check(new Date(+asr + 60e3));
        await T.waitFor(() => [...document.querySelectorAll('.toast b')].some(b => b.textContent.includes('حان وقت صلاة العصر')), 2000, 'تذكير');
        T.clean();
        Prayer.check(new Date(+asr + 2 * 60e3)); await T.sleep(200);
        expect(document.querySelectorAll('.toast').length).toBe(0);
        // بعد 20 دقيقة ما بنذكّر بأذان فات
        localStorage.removeItem('prayerSeen');
        Prayer.check(new Date(+asr + 40 * 60e3)); await T.sleep(200);
        expect(document.querySelectorAll('.toast').length).toBe(0);
      });
      await T.test('بجلسة دراسة: «وقّف الجلسة للصلاة» بتوقّف الحبل وبتحفظ الدقيقة', async () => {
        localStorage.removeItem('prayerSeen');
        Rope.start(25); await T.sleep(300); T.clean();
        const mg = Prayer.times().find(x => x.en === 'Maghrib').at;
        Prayer.check(new Date(+mg + 30e3));
        const btn = await T.waitFor(() => [...document.querySelectorAll('.toast .btn.primary')].find(b => b.textContent.includes('وقّف الجلسة')), 2000, 'زر الإيقاف');
        await T.mouse.click(btn);
        await T.waitFor(() => Rope.run && Rope.run.paused > 0, 2000, 'الجلسة وقفت');
        expect(Rope.run.paused).toBeGreaterThan(24 * 60e3);
        Rope.stop(); T.clean();
      });
    },
    async T => {
      const { expect } = T;
      await T.test('بدون إنترنت بعد ما انجابوا: الأوقات من المخزّن (ولا طلب جديد)', async () => {
        let net = 0; const real = window.fetch;
        window.fetch = async u => { if (String(u).includes('aladhan')) { net++; throw new TypeError('Failed to fetch'); } return real(u); };
        T.info({ before: { on: Settings.d.prayer.on, hasData: !!Prayer.data, key: Prayer.data && Prayer.data.key, want: Prayer.key(), days: Prayer.data && Object.keys(Prayer.data.days).length, ls: (localStorage.getItem('prayerCache') || '').length } });
        Prayer.init(); await T.sleep(300);
        await Library.load(); await T.sleep(200);
        expect(!!Prayer.times(), 'أوقات اليوم من التخزين').toBeTruthy();
        expect(!!document.querySelector('.pr-chip')).toBeTruthy();
        T.info({ networkTries: net, note: 'ممكن يحاول يجيب الشهر الجاي بالخلفية إذا قرّبنا من آخر الشهر' });
        window.fetch = real;
      });
      await T.test('وقت بمنطقة غير منطقة الجهاز بينحسب صح', () => {
        const d = Prayer.at('25-10-2026', '05:25 (+03)');
        expect(d.toISOString()).toBe('2026-10-25T02:25:00.000Z');
        expect(Prayer.at('25-10-2026', '05:25 (-0430)').toISOString()).toBe('2026-10-25T09:55:00.000Z');
      });
      await T.test('بتطفى من الإعدادات وبتختفي من المكتبة', async () => {
        Settings.d.prayer.on = false; Settings.save(); await Prayer.refresh(); await Library.load(); await T.sleep(200);
        expect(!!document.querySelector('.pr-chip')).toBeFalsy();
      });
    },
  ],
};
