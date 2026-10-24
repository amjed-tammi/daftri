/* استيراد ملفات وورد وإكسل و PDF، واللصق من إكسل/وورد — بملفات حقيقية البنية */
const SUITE = {
  title: 'استيراد الملفات: Word و Excel و CSV و PDF، واللصق المنسّق',
  phases: [async T => {
    const { expect } = T;
    // ===== كاتب zip صغير (نفس اللي بيعمله وورد وإكسل) =====
    const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
    const crc32 = u => { let c = 0xffffffff; for (const b of u) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
    const deflate = async u => new Uint8Array(await new Response(new Blob([u]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
    const zip = async (files, name, type) => {
      const enc = new TextEncoder(), parts = [], cen = [];
      let off = 0;
      for (const [fn, content] of Object.entries(files)) {
        const raw = typeof content === 'string' ? enc.encode(content) : content, comp = await deflate(raw), nm = enc.encode(fn), crc = crc32(raw);
        const lh = new DataView(new ArrayBuffer(30));
        [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, 8, 2], [14, crc, 4], [18, comp.length, 4], [22, raw.length, 4], [26, nm.length, 2]].forEach(([o, v, s]) => s === 4 ? lh.setUint32(o, v, true) : lh.setUint16(o, v, true));
        const ch = new DataView(new ArrayBuffer(46));
        [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, 8, 2], [16, crc, 4], [20, comp.length, 4], [24, raw.length, 4], [28, nm.length, 2], [42, off, 4]].forEach(([o, v, s]) => s === 4 ? ch.setUint32(o, v, true) : ch.setUint16(o, v, true));
        parts.push(new Uint8Array(lh.buffer), nm, comp); cen.push(new Uint8Array(ch.buffer), nm);
        off += 30 + nm.length + comp.length;
      }
      const csize = cen.reduce((a, b) => a + b.length, 0), end = new DataView(new ArrayBuffer(22));
      [[0, 0x06054b50, 4], [8, Object.keys(files).length, 2], [10, Object.keys(files).length, 2], [12, csize, 4], [16, off, 4]].forEach(([o, v, s]) => s === 4 ? end.setUint32(o, v, true) : end.setUint16(o, v, true));
      return new File([...parts, ...cen, new Uint8Array(end.buffer)], name, { type });
    };
    const png = async () => { const c = document.createElement('canvas'); c.width = 320; c.height = 200; const g = c.getContext('2d'); g.fillStyle = '#3d7be0'; g.fillRect(0, 0, 320, 200); g.fillStyle = '#fff'; g.fillRect(40, 40, 120, 60); return new Uint8Array(await (await new Promise(r => c.toBlob(r, 'image/png'))).arrayBuffer()); };
    const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
    const r = (t, pr = '') => `<w:r>${pr ? `<w:rPr>${pr}</w:rPr>` : ''}<w:t xml:space="preserve">${t}</w:t></w:r>`;
    const p = (inner, ppr = '') => `<w:p>${ppr ? `<w:pPr>${ppr}</w:pPr>` : ''}${inner}</w:p>`;
    const docx = async (name = 'ملخص الشبكات.docx', long = 40) => {
      const body = [
        // وورد العربي بيسمّي نمط العنوان "1" واسمه "heading 1"
        p(r('مقدمة في الشبكات'), '<w:pStyle w:val="1"/><w:bidi/>'),
        p(r('الشبكة ', '<w:rtl/>') + r('مهمة جداً', '<w:b/><w:color w:val="C00000"/>') + r(' لكل مبرمج، و ') + r('TCP/IP', '<w:i/><w:highlight w:val="yellow"/>') + r(' أشهر بروتوكول.'), '<w:bidi/>'),
        p(r('سطر بالوسط'), '<w:jc w:val="center"/><w:bidi/>'),
        p(r('English line, aligned left.'), '<w:jc w:val="left"/>'),
        p(r('نص أسود ما لازم ينحفظ لونه', '<w:color w:val="000000"/>')),
        p(r('الطبقات', ''), '<w:pStyle w:val="2"/>'),
        p(r('التطبيقات'), '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>'),
        p(r('HTTP'), '<w:numPr><w:ilvl w:val="1"/><w:numId w:val="1"/></w:numPr>'),
        p(r('النقل'), '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>'),
        p(r('الخطوة الأولى'), '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr>'),
        p(r('الخطوة الثانية'), '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr>'),
        `<w:tbl><w:tr><w:tc><w:p>${r('الطبقة')}</w:p></w:tc><w:tc><w:p>${r('المثال')}</w:p></w:tc><w:tc><w:p>${r('ملاحظة')}</w:p></w:tc></w:tr>`
        + `<w:tr><w:tc><w:tcPr><w:vMerge w:val="restart"/></w:tcPr><w:p>${r('العليا')}</w:p></w:tc><w:tc><w:tcPr><w:gridSpan w:val="2"/><w:shd w:fill="FFF2CC"/></w:tcPr><w:p>${r('HTTP و DNS')}</w:p></w:tc></w:tr>`
        + `<w:tr><w:tc><w:tcPr><w:vMerge/></w:tcPr><w:p/></w:tc><w:tc><w:p>${r('FTP')}</w:p></w:tc><w:tc><w:p>${r('قديم')}</w:p></w:tc></w:tr></w:tbl>`,
        p(`<w:hyperlink r:id="rIdLink">${r('رابط الشرح', '<w:u w:val="single"/>')}</w:hyperlink>`),
        p(`<w:r><w:drawing><wp:inline><a:graphic><a:graphicData><pic:pic><pic:blipFill><a:blip r:embed="rIdImg"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`),
        ...Array.from({ length: long }, (_, i) => p(r(`فقرة رقم ${i + 1}: الشبكات بتربط الأجهزة ببعض، وكل طبقة إلها شغلة واضحة بتساعد اللي فوقها. Layer ${i + 1} sends data.`))),
        p('<w:r><w:br w:type="page"/></w:r>'),
        p(r('بعد فاصل الصفحة'), '<w:pStyle w:val="2"/>'),
      ].join('');
      return zip({
        '[Content_Types].xml': '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
        'word/document.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W}><w:body>${body}<w:sectPr/></w:body></w:document>`,
        'word/styles.xml': `<?xml version="1.0"?><w:styles ${W}><w:style w:type="paragraph" w:styleId="1"><w:name w:val="heading 1"/></w:style><w:style w:type="paragraph" w:styleId="2"><w:name w:val="heading 2"/><w:basedOn w:val="1"/></w:style></w:styles>`,
        'word/numbering.xml': `<?xml version="1.0"?><w:numbering ${W}><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/></w:lvl><w:lvl w:ilvl="1"><w:numFmt w:val="bullet"/></w:lvl></w:abstractNum><w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:numFmt w:val="decimal"/></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num><w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num></w:numbering>`,
        'word/_rels/document.xml.rels': '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdLink" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.com/osi" TargetMode="External"/><Relationship Id="rIdImg" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/></Relationships>',
        'word/media/image1.png': await png(),
      }, name, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    };
    const xlsx = async () => {
      const S = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
      return zip({
        'xl/workbook.xml': `<?xml version="1.0"?><workbook ${S}><sheets><sheet name="الدرجات" sheetId="1" r:id="rId1"/><sheet name="Notes" sheetId="2" r:id="rId2"/></sheets></workbook>`,
        'xl/_rels/workbook.xml.rels': '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="worksheet" Target="/xl/worksheets/sheet2.xml"/></Relationships>',
        'xl/sharedStrings.xml': `<?xml version="1.0"?><sst ${S}><si><t>الطالب</t></si><si><t>الدرجة</t></si><si><t>التاريخ</t></si><si><t>أحمد</t></si><si><r><t>سارة</t></r><r><t> ✦</t></r></si><si><t>معدل الصف</t></si></sst>`,
        'xl/styles.xml': `<?xml version="1.0"?><styleSheet ${S}><fonts><font/><font><b/></font></fonts><fills><fill/><fill/><fill><patternFill patternType="solid"><fgColor rgb="FFFFFF00"/></patternFill></fill></fills><cellXfs><xf numFmtId="0" fontId="0" fillId="0"/><xf numFmtId="0" fontId="1" fillId="2"/><xf numFmtId="14" fontId="0" fillId="0"/><xf numFmtId="10" fontId="0" fillId="0"/></cellXfs></styleSheet>`,
        'xl/worksheets/sheet1.xml': `<?xml version="1.0"?><worksheet ${S}><sheetViews><sheetView rightToLeft="1"/></sheetViews><sheetData>`
          + '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row>'
          + '<row r="2"><c r="A2" t="s"><v>3</v></c><c r="B2" s="1"><v>95</v></c><c r="C2" s="2"><v>46317</v></c></row>'
          + '<row r="3"><c r="A3" t="s"><v>4</v></c><c r="B3"><v>88.5</v></c><c r="C3" s="2"><v>46318</v></c></row>'
          + '<row r="4"><c r="A4" t="s"><v>5</v></c><c r="C4" s="3"><v>0.9175</v></c></row>'
          + '</sheetData><mergeCells><mergeCell ref="A4:B4"/></mergeCells></worksheet>',
        'xl/worksheets/sheet2.xml': `<?xml version="1.0"?><worksheet ${S}><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Bring calculator</t></is></c><c r="B1" t="b"><v>1</v></c></row></sheetData></worksheet>`,
      }, 'درجات الصف.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    };
    const dropOn = (target, file) => { const dt = new DataTransfer(); dt.items.add(file); const r = target.getBoundingClientRect(); for (const t of ['dragover', 'drop']) target.dispatchEvent(new DragEvent(t, { dataTransfer: dt, bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 })); };
    const paste = (target, data) => { const dt = new DataTransfer(); for (const [k, v] of Object.entries(data)) dt.setData(k, v); target.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); };
    const allHtml = () => Reader.pages.map(p => p.html).join('\n');

    await Lazy.need('importer'); // قارئ الملفات بيتحمّل وقت الحاجة
    const b = await T.makeBook('كتاب الاستيراد', { htmls: ['<p>صفحتي الأولى</p>', '', '', ''] });
    await Reader.open(b.id, 0); await T.sleep(700); T.quiet();
    const live = () => Editor.live.get(Editor.curPage) || Editor.live.get(0);

    await T.test('لصق جدول من إكسل (HTML مع أنماط xl) بيصير جدول حقيقي بالعريض والتلوين', async () => {
      const l = Editor.live.get(0); await T.mouse.click(l.c.querySelector('p')); setCaretAt(l.c.querySelector('p'), 3);
      paste(l.c, {
        'text/plain': 'المادة\tالعلامة\nرياضيات\t90\n',
        'text/html': '<html><head><style><!-- .xl65 {font-weight:700; background:#FFFF00;} .xl66 {color:#C00000; text-align:center;} --></style></head><body><table><tr><td class=xl65>المادة</td><td class=xl65>العلامة</td></tr><tr><td>رياضيات</td><td class=xl66>90</td></tr></table></body></html>',
      });
      await T.sleep(300);
      const t = l.c.querySelector('table.tbl');
      expect(!!t, 'ما في جدول').toBeTruthy();
      expect(t.querySelectorAll('th').length).toBe(2);
      expect(t.querySelector('th').getAttribute('style') || '').toContain('background-color:#ffff00');
      const red = t.querySelector('td span[style*="color"]');
      expect(red && red.style.color.replace(/\s/g, '')).toBe('rgb(192,0,0)');
      expect(t.rows[1].cells[1].style.textAlign).toBe('center');
      await T.shot('paste-excel');
    });
    await T.test('لصق نص بأعمدة Tab (من جوجل شيت أو إكسل بدون HTML) بيصير جدول', async () => {
      const l = Editor.live.get(0); const before = l.c.querySelectorAll('table').length;
      Editor.ensureCaret(l);
      paste(l.c, { 'text/plain': 'Name\tScore\tGrade\nAli\t77\tB\nMona\t91\tA' });
      await T.sleep(250);
      expect(l.c.querySelectorAll('table').length).toBe(before + 1);
      expect([...l.c.querySelectorAll('table')].pop().rows.length).toBe(3);
    });
    await T.test('لصق من وورد (HTML فيه mso) بيحافظ على العنوان والعريض والقائمة، وبيشيل الزبالة', async () => {
      const l = Editor.live.get(1) || Editor.live.get(0);
      l.c.focus(); Editor.ensureCaret(l);
      paste(l.c, {
        'text/plain': 'عنوان\nنقطة',
        'text/html': '<html xmlns:o="urn:schemas-microsoft-com:office:office"><body><!--StartFragment--><h1 dir=RTL>عنوان من وورد<o:p></o:p></h1><p class=MsoNormal dir=RTL><b><span lang=AR-SA style="font-family:Arial;color:black">كلمة عريضة</span></b><span lang=AR-SA> وعادية</span><o:p></o:p></p><p class=MsoListParagraphCxSpFirst style="mso-list:l0 level1 lfo1"><span style="mso-list:Ignore">·<span style="font:7.0pt">&nbsp;&nbsp;</span></span>أول نقطة</p><p class=MsoListParagraphCxSpLast style="mso-list:l0 level1 lfo1"><span style="mso-list:Ignore">·</span>ثاني نقطة</p><script>window.__evil=1</script><!--EndFragment--></body></html>',
      });
      await T.sleep(300);
      const h = l.c.innerHTML;
      expect(h).toContain('<h2>عنوان من وورد</h2>');
      expect(h).toContain('<b>كلمة عريضة</b>');
      expect(l.c.querySelectorAll('ul li').length).toBe(2);
      expect(l.c.querySelector('ul li').textContent).toBe('أول نقطة');
      expect(/mso|class="Mso|o:p|script|color:black/i.test(h), 'بقايا وورد').toBeFalsy();
      expect(window.__evil).toBe(undefined);
    });
    await T.test('ملف وورد (.docx) بيتسحب على الصفحة → نافذة → صفحات جديدة بنفس التنسيق', async () => {
      Editor.flushAll();
      const n0 = Reader.pages.length;
      const f = await docx();
      dropOn(live().pg, f);
      await T.waitFor(() => document.querySelector('.import-dlg'), 6000, 'نافذة الاستيراد');
      expect(document.querySelector('.import-dlg h3').textContent).toBe('ملخص الشبكات');
      await T.shot('import-dialog-docx');
      await T.mouse.click('.imp-opt[data-a=pages]');
      await T.waitFor(() => Reader.pages.length > n0 + 1, 6000, 'صفحات جديدة');
      await T.sleep(600); Editor.flushAll();
      const h = allHtml();
      T.info({ pagesAdded: Reader.pages.length - n0 });
      expect(Reader.pages.length - n0).toBeGreaterThan(1);
      expect(Reader.pages.length % 2).toBe(0);
      expect(h).toContain('<h2>مقدمة في الشبكات</h2>');
      expect(h).toContain('<h3>الطبقات</h3>');
      expect(h).toContain('<b><span style="color:#c00000">مهمة جداً</span></b>');
      expect(h).toContain('<i><span style="background-color:#fff176">TCP/IP</span></i>');
      expect(h).toContain('style="text-align:center">سطر بالوسط');
      expect(h).toContain('style="text-align:left">English line');
      expect(/color:#000000/.test(h), 'الأسود لازم يروح (عشان الورق الأسود)').toBeFalsy();
      const imported = document.createElement('div'); imported.innerHTML = h;
      const layers = [...imported.querySelectorAll('ul')].find(x => x.textContent === 'التطبيقاتHTTPالنقل');
      expect(layers.querySelector('li > ul > li').textContent).toBe('HTTP');
      expect([...imported.querySelector('ol').children].map(x => x.textContent)).toEqual(['الخطوة الأولى', 'الخطوة الثانية']);
      expect(h).toContain('rowspan="2"');
      expect(h).toContain('colspan="2" style="background-color:#fff2cc"');
      expect(h).toContain('href="https://example.com/osi"');
      expect(h).toContain('<u>رابط الشرح</u>');
      expect(h).toContain('فقرة رقم 40');
      // الصورة صارت ملاحظة صورة على الصفحة
      const photos = Reader.pages.flatMap(p => (p.stickies || []).filter(s => s.kind === 'photo'));
      expect(photos.length).toBe(1);
      expect(!!(await DB.get('blobs', photos[0].blob))).toBeTruthy();
      // فاصل الصفحة: العنوان الأخير بأول صفحة جديدة
      const last = Reader.pages.find(p => p.html.includes('بعد فاصل الصفحة'));
      expect(last.html.startsWith('<h3>بعد فاصل الصفحة</h3>')).toBeTruthy();
    });
    await T.test('الصفحات المستوردة ما بتطفح (كل صفحة بحدها) والنص المقسوم بيكمل صح', async () => {
      const start = Reader.pages.findIndex(p => p.html.includes('مقدمة في الشبكات'));
      await Reader.goToPage(start + 2); await T.sleep(900);
      const bad = [...Editor.live.values()].filter(l => l.c.scrollHeight > l.c.clientHeight + 2).map(l => l.i + 1);
      expect(bad.join(','), 'صفحات طافحة:').toBe('');
      const words = Reader.pages.map(p => { const d = document.createElement('div'); d.innerHTML = p.html; return d.textContent; }).join(' ');
      for (let i = 1; i <= 40; i++) expect(words.includes(`فقرة رقم ${i}:`), 'ناقصة ' + i).toBeTruthy();
      // لما الفقرة المقسومة ترجع تتجمع، الكلمتين عند القص ما بيلزقوا
      const glued = words.match(/(إلها|طبقة|شغلة|كل|واضحة|بتساعد|اللي)(شغلة|واضحة|بتساعد|اللي|فوقها|طبقة)/);
      expect(glued && glued[0], 'كلمتين لازقين:').toBe(null);
      await T.shot('docx-pages');
    });
    await T.test('ملف إكسل (.xlsx): كل شيت جدول بعنوانه، التواريخ والنسب والدمج والعريض صح', async () => {
      const f = await xlsx();
      const parsed = await Import.parse(f);
      const h = parsed.blocks.join('');
      expect(h).toContain('<h2>الدرجات</h2>');
      expect(h).toContain('<h2>Notes</h2>');
      expect(h).toContain('dir="rtl"');
      expect(h).toContain('2026-10-22');
      expect(h).toContain('91.75%');
      expect(h).toContain('88.5');
      expect(h).toContain('سارة ✦');
      expect(h).toContain('colspan="2"');
      expect(h).toContain('<b>95</b>');
      expect(h).toContain('background-color:#ffff00');
      expect(h).toContain('TRUE');
      // «هون، مكان المؤشر»
      const l = live(); l.c.focus(); Editor.ensureCaret(l);
      const before = l.c.querySelectorAll('table').length;
      dropOn(l.pg, f);
      await T.waitFor(() => document.querySelector('.import-dlg'), 6000);
      await T.mouse.click('.imp-opt[data-a=here]');
      await T.sleep(500);
      const tables = [...Editor.live.values()].reduce((n, x) => n + x.c.querySelectorAll('table').length, 0);
      expect(tables).toBeGreaterThan(before);
    });
    await T.test('شيت عريض حقيقي الشكل (عنوان + ملخص + 20 عمود ونص طويل): بطاقات مرتبة، وما في صفحة طافحة', async () => {
      const head = ['Date', 'Day', 'Week', 'Phase', 'Main Goal', 'Task 1', 'Task 1 Hours', 'Task 1 Status', 'Task 2', 'Task 2 Hours', 'Task 2 Status', 'Topic', 'Concepts to Learn', 'Resource', 'Notes', 'Readiness', 'Role', 'Gate', 'Quiz', 'Blocker'];
      const C = (v, extra = {}) => ({ v, ...extra });
      const grid = [
        [C('Daily Plan — Backend + Data + AI | 2026-08-28 → 2026-12-31')],
        [C('Start Date'), C('2026-08-28'), C('End Date'), C('2026-12-31'), C('Working Days'), C('108'), C('Overall'), C('0%')],
        [C('Task Status'), C('Not Started → Done'), , , C('Mastery'), C('Self-score 0–5')],
        [C('Readiness gates are evidence checkpoints — never automatic claims. Friday is REST; adjust future days only.')],
        [],
        head.map(h => C(h)),
        ...Array.from({ length: 30 }, (_, i) => head.map((h, c) => C(c === 0 ? `2026-09-${String(i + 1).padStart(2, '0')}` : c === 1 ? 'Monday' : c === 2 ? `Week ${1 + (i / 7 | 0)}` : /Hours/.test(h) ? '1.5' : /Status/.test(h) ? 'Not Started' : `${h} ${i + 1}: ` + 'ابنِ واختبر وثّق الخطوة بالتفصيل مع أمثلة عملية واضحة. '.repeat(c % 3 + 1)))),
      ];
      const sheets = [{ name: 'Plan', grid, merges: [{ r0: 0, c0: 0, r1: 0, c1: 19 }], rtl: false }];
      expect(Sheets.wide(sheets)).toBeTruthy();
      const blocks = Sheets.blocks(sheets), h = blocks.join('');
      expect(blocks[0]).toBe('<h2>Daily Plan — Backend + Data + AI | 2026-08-28 → 2026-12-31</h2>');
      expect(h).toContain('<tr><th>Start Date</th><td>2026-08-28</td></tr>');
      expect(h).toContain('<tr><th>Task Status</th><td>Not Started → Done</td></tr>');
      expect(h).toContain('<p>Readiness gates are evidence checkpoints');
      expect(h).toContain('<h3>2026-09-01 · Monday</h3>');
      // «Task 1 Hours/Status» مع «Task 1» بسطر واحد
      expect(h).toContain('<b>Task 1:</b> Task 1 1: ');
      expect(h).toContain('<i>(Hours 1.5 · Status Not Started)</i>');
      expect(/<b>Task 1 Hours:<\/b>/.test(h), 'العمود التابع لحاله').toBeFalsy();
      const pages = Import.paginate(live(), blocks);
      const txt = pages.map(p => p.html).join('');
      const idx = Array.from({ length: 30 }, (_, i) => txt.indexOf(`<h3>2026-09-${String(i + 1).padStart(2, '0')} · Monday</h3>`));
      expect(idx.every((x, k) => x > 0 && (k === 0 || x > idx[k - 1])), 'ترتيب الأيام').toBeTruthy();
      // كل صفحة بحدها (قبل كان في حد 300 قطعة بيخلّي الصفحة الأولى تطفح)
      const l = live(), saved = l.c.innerHTML; const lim = l.c.clientHeight; let over = 0;
      for (const p of pages) { l.c.innerHTML = p.html; if (l.c.scrollHeight > lim + 2) over++; }
      l.c.innerHTML = saved;
      expect(over, 'صفحات طافحة').toBe(0);
      T.info({ pages: pages.length });
      // «جدول كامل»: جدول عريض بخط أصغر
      expect(Sheets.blocks(sheets, 'table').join('')).toContain('class="tbl tbl-wide"');
    });
    await T.test('CSV عربي قديم (windows-1256) بفاصلة منقوطة بينقرأ صح', async () => {
      // «مرحبا;سلام» بترميز ويندوز العربي
      const bytes = new Uint8Array([0xE3, 0xD1, 0xCD, 0xC8, 0xC7, 0x3B, 0xD3, 0xE1, 0xC7, 0xE3, 0x0D, 0x0A, 0x31, 0x3B, 0x32]);
      const parsed = await Import.parse(new File([bytes], 'old.csv', { type: 'text/csv' }));
      const h = parsed.blocks.join('');
      expect(h).toContain('<th>مرحبا</th><th>سلام</th>');
      expect(h).toContain('<td>1</td><td>2</td>');
    });
    await T.test('PDF حقيقي (عربي + إنجليزي) → «الاثنين»: الأصل محفوظ والنص صفحات بترتيب صح', async () => {
      const f = await T.fixture('sample-ar-en.pdf', 'application/pdf');
      const n0 = Reader.pages.length;
      dropOn(live().pg, f);
      await T.waitFor(() => document.querySelector('.import-dlg .imp-pdf'), 8000, 'نافذة PDF');
      expect(document.querySelector('.imp-opt[data-a=text]').disabled).toBeFalsy();
      await T.shot('import-dialog-pdf');
      await T.mouse.click('.imp-opt[data-a=both]');
      await T.waitFor(() => Reader.pages.length > n0, 8000, 'صفحات PDF');
      await T.sleep(600);
      const h = allHtml();
      expect(h).toContain('<h2>مقدمة في الشبكات</h2>');
      expect(h).toContain('<h3>نموذج OSI</h3>');
      expect(h).toContain('نموذج OSI فيه سبع طبقات، وأشهر بروتوكول هو TCP/IP اللي بنستعمله كل يوم.');
      expect(h).toContain('The OSI model has seven layers. TCP is reliable, UDP is fast.');
      expect(h).toContain('<b>ملاحظة مهمة:</b> الطبقة 3 هي طبقة الشبكة.');
      await T.waitFor(async () => (await DB.all('files')).some(x => x.bookId === Reader.book.id && x.name === 'sample-ar-en'), 4000, 'الأصل محفوظ مع الكتاب');
    });
    await T.test('PDF فيه صور بس (ما فيه نص): خيار التحويل مقفول مع شرح', async () => {
      const pdf = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]/Contents 4 0 R>>endobj\n4 0 obj<</Length 18>>stream\n0 0 m 100 100 l S\nendstream endobj\ntrailer<</Root 1 0 R>>\n%%EOF';
      dropOn(live().pg, new File([pdf], 'scan.pdf', { type: 'application/pdf' }));
      await T.waitFor(() => document.querySelector('.import-dlg .imp-pdf'), 6000);
      expect(document.querySelector('.imp-opt[data-a=text]').disabled).toBeTruthy();
      expect(document.querySelector('.imp-opt[data-a=text] span').textContent).toContain('ما فيه نص');
      T.clean();
    });
    await T.test('ملف وورد قديم (.doc) بيطلّع شرح كيف يحفظه docx', async () => {
      dropOn(live().pg, new File(['x'], 'قديم.doc'));
      await T.waitFor(() => [...document.querySelectorAll('.toast b')].some(x => x.textContent.includes('نسخة قديمة')), 3000);
    });
    await T.test('من المكتبة: سحب ملف وورد بيعمل كتاب جديد باسمه', async () => {
      T.clean(); Reader.close(); await T.sleep(500);
      const f = await docx('مذكرة الفصل الأول.docx', 8);
      const dt = new DataTransfer(); dt.items.add(f);
      window.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
      await T.waitFor(() => Reader.book && Reader.book.title === 'مذكرة الفصل الأول', 8000, 'الكتاب الجديد');
      await T.sleep(700);
      expect(Reader.pages[0].html).toContain('<h2>مقدمة في الشبكات</h2>');
      await T.shot('new-book-from-docx');
    });
    await T.test('الأداة موجودة بـ«إدراج» وبكل الأدوات، والجولة بتعرّف عليها', async () => {
      expect(!!Cmd.get('import') && !!Cmd.get('importBook')).toBeTruthy();
      expect(TOURS.book.some(s => s.since === 7 && /Word/.test(s.title + s.text))).toBeTruthy();
      expect(TOUR_V >= 7).toBeTruthy();
    });
  }],
};
