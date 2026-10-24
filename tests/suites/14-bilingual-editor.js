const SUITE = {
  title: 'القوائم العربية والإنجليزية — الاتجاه واللصق والترقيم والتراجع',
  phases: [async T => {
    await Lazy.need('importer'); // منظّف اللصق بيتحمّل وقت الحاجة (بالتطبيق: بهدوء بعد الإقلاع)
    const { expect } = T;
    const book = await T.makeBook('قوائم باللغتين', { htmls: ['<h2>Important Rules</h2><ol><li>A concrete subclass must implement all inherited abstract methods.</li><li>A subclass can define additional methods.</li></ol><ol><li>قاعدة عربية</li><li>English inside an Arabic book</li></ol>', '', '', ''] });
    await Reader.open(book.id, 0); await T.sleep(600); T.quiet();
    const live = () => Editor.live.get(0);
    const reset = html => { const l = live(); l.c.innerHTML = html || '<p><br></p>'; Editor.normalize(l.c); l.c.focus(); setCaretAt(l.c.firstElementChild, 0); return l; };
    const paste = (text, html = '') => {
      const dt = new DataTransfer(); dt.setData('text/plain', text); if (html) dt.setData('text/html', html);
      live().c.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    };
    await T.test('القوائم المحفوظة سابقاً: الأرقام والنص بنفس الاتجاه حتى بالقائمة المختلطة', async () => {
      const items = [...live().c.querySelectorAll('li')];
      expect(items.map(n => getComputedStyle(n).direction)).toEqual(['ltr', 'ltr', 'rtl', 'ltr']);
      for (const item of items) {
        const r = document.createRange(); r.selectNodeContents(item);
        const box = item.getBoundingClientRect(), text = r.getBoundingClientRect();
        expect(getComputedStyle(item).direction === 'rtl' ? box.right - text.right < 3 : text.left - box.left < 3).toBeTruthy();
      }
      await T.shot('bilingual-lists-desktop');
      await T.viewport(390, 844); await T.sleep(400); await T.shot('bilingual-lists-mobile');
      await T.viewport(1366, 800); await T.sleep(300);
    });
    await T.test('لصق 1 و١ و۱: قوائم حقيقية بقيمة البداية وشكل الرقم الصحيح', () => {
      for (const [digits, style] of [['7', 'decimal'], ['٧', 'arabic-indic'], ['۷', 'persian']]) {
        reset(); paste(`${digits}. First rule\n${digits}. قاعدة عربية`);
        const ol = live().c.querySelector('ol');
        expect(ol.start).toBe(7); expect(getComputedStyle(ol).listStyleType).toBe(style);
        expect([...ol.children].map(n => getComputedStyle(n).direction)).toEqual(['ltr', 'rtl']);
        expect([...ol.children].map((_, i) => Editor.listValueAt(ol, i))).toEqual([7, 7]);
      }
    });
    await T.test('الترقيم العشري العادي لا يتحول لقائمة', () => {
      reset(); paste('3.14\nالإصدار ٢.٥');
      expect(live().c.querySelector('ol')).toBeFalsy(); expect(live().c.textContent).toContain('3.14');
    });
    await T.test('لصق شرح برمجي منسق لا يتحول لصندوق كود', () => {
      reset(); paste('class Example\n  return an explanation;', '<h2>Important Rules</h2><ol start="5"><li>class Example</li><li>return an explanation;</li></ol>');
      expect(live().c.querySelector('pre')).toBeFalsy(); expect(live().c.querySelector('ol').start).toBe(5);
    });
    await T.test('اللصق المنسق يستبدل التحديد ويحافظ على التراجع', () => {
      const l = reset('<p>before REMOVE after</p>'), p = l.c.firstChild;
      const r = document.createRange(); r.setStart(p.firstChild, 7); r.setEnd(p.firstChild, 13);
      getSelection().removeAllRanges(); getSelection().addRange(r);
      paste('KEEP', '<p><b>KEEP</b></p>');
      expect(l.c.textContent.replace(/\u00a0/g, ' ')).toBe('before KEEP after'); expect(l.c.querySelector('b')).toBeTruthy();
      document.execCommand('undo'); expect(l.c.textContent).toBe('before REMOVE after');
    });
    await T.test('لصق قائمة وسط الفقرة يحافظ على النص قبل المؤشر وبعده', () => {
      const l = reset('<p>before after</p>'); setCaretAt(l.c.firstChild, 7);
      paste('first\nsecond', '<ol><li>first</li><li>second</li></ol>');
      const text = l.c.textContent;
      expect(text.indexOf('before') < text.indexOf('first')).toBeTruthy();
      expect(text.indexOf('second') < text.indexOf('after')).toBeTruthy();
      expect(l.c.querySelectorAll('ol > li').length).toBe(2);
      document.execCommand('undo'); expect(l.c.textContent).toBe('before after');
    });
    await T.test('اللصق المنسق يحفظ البداية والقيمة والترقيم العكسي والقوائم المتداخلة', () => {
      reset(); paste('', '<ol start="١٠" reversed style="list-style-type:arabic-indic"><li>الأول<ol start="3"><li>Nested English</li></ol></li><li value="٦">الثاني</li></ol>');
      const ol = live().c.querySelector('ol'); expect(ol.start).toBe(10); expect(ol.reversed).toBeTruthy();
      expect(ol.lastElementChild.value).toBe(6); expect(ol.querySelector('ol').start).toBe(3);
      expect(getComputedStyle(ol.querySelector('ol').querySelector('li')).direction).toBe('ltr');
    });
    await T.test('الاتجاه الصريح في المحتوى المستورد يبقى محفوظاً', () => {
      reset(); paste('', '<ol dir="rtl"><li>English intentionally RTL</li></ol>');
      expect(getComputedStyle(live().c.querySelector('li')).direction).toBe('rtl');
    });
    await T.test('تقسيم قائمة طويلة لا يعيد الترقيم إلى 1 ويحترم تغيير القيمة والعكس', () => {
      for (const reversed of [false, true]) {
        const items = Array.from({ length: 45 }, (_, i) => `<li${i === 12 ? ' value="80"' : ''}>Item ${i}: A long rule for the next page.</li>`).join('');
        const source = el(`<ol start="${reversed ? 100 : 0}"${reversed ? ' reversed' : ''}>${items}</ol>`);
        const expected = [...source.children].map((_, i) => Editor.listValueAt(source, i));
        const pages = Import.paginate(live(), [source.outerHTML]);
        expect(pages.length).toBeGreaterThan(1);
        const actual = pages.flatMap(p => {
          const c = el('<div></div>'); c.innerHTML = p.html;
          return [...c.querySelectorAll('ol')].flatMap(ol => [...ol.children].map((_, i) => Editor.listValueAt(ol, i)));
        });
        expect(actual).toEqual(expected);
      }
    });
    await T.test('قائمة من شريط التنسيق تتبع لغة النص ويتغير الاتجاه عند تعديلها', () => {
      const l = reset('<p>English rule</p>');
      document.execCommand('insertOrderedList'); Editor.changed(l);
      expect(getComputedStyle(l.c.querySelector('li')).direction).toBe('ltr');
      l.c.querySelector('li').textContent = 'قاعدة عربية'; Editor.changed(l);
      expect(getComputedStyle(l.c.querySelector('li')).direction).toBe('rtl');
    });
    await T.test('Enter يكمل ترقيم القائمة الملصوقة بدل تكرار آخر رقم', async () => {
      const l = reset(); paste('١. الأولى\n٢. الثانية');
      const ol = l.c.querySelector('ol'); setCaretAt(ol.lastElementChild, ol.lastElementChild.textContent.length);
      await T.key('Enter', 'Enter'); await T.typeText('الثالثة');
      expect(ol.children.length).toBe(3); expect(Editor.listValueAt(ol, 2)).toBe(3);
    });
    await T.test('الانتقال لصفحة يقبل الأرقام العربية ويرفض القيم خارج النطاق بدون إغلاق النافذة', async () => {
      Bars.show('#navbar'); document.querySelector('#pgInfo').click(); await T.sleep(100);
      const form = document.querySelector('.goto'), input = form.querySelector('input');
      input.value = '٩٩٩'; form.requestSubmit();
      expect(input.validationMessage).toContain('اكتب رقم صفحة'); expect(document.querySelector('.goto')).toBeTruthy();
      input.value = '٣'; input.dispatchEvent(new Event('input')); form.requestSubmit();
      await T.waitFor(() => Reader.s === 1 && !Reader.busy, 4000);
      expect(document.querySelector('.goto')).toBeFalsy();
      await Reader.goToPage(0); await T.sleep(600);
    });
    await T.test('حفظ وإعادة فتح القائمة يحافظان على الترقيم والاتجاه', async () => {
      reset(); paste('٣. قاعدة عربية\n٤. English rule'); Editor.flushAll(); await T.sleep(200);
      Reader.close(); await Reader.open(book.id, 0); await T.sleep(500);
      const ol = live().c.querySelector('ol'); expect(ol.start).toBe(3);
      expect(getComputedStyle(ol.lastElementChild).direction).toBe('ltr');
    });
  }],
};
