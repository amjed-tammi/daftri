'use strict';
/* ============ مشاركة كتاب بملف .daftar (امتداد تطبيقنا) ============
   الملف = JSON مضغوط gzip فيه: الكتاب، صفحاته، صوره وتسجيلاته، روابط الشبكة، أسئلة المراجعة والامتحانات */
const Share = {
  async pack(bookId) {
    Editor.flushAll();
    if (Reader.book) { Reader.saveBook.flush(); }
    const b = await DB.get('books', bookId);
    const pages = (await DB.getMany('pages', b.pageIds || [])).filter(Boolean);
    const pid = new Set(pages.map(p => p.id));
    const ids = new Set(); if (b.cover && b.cover.image) ids.add(b.cover.image);
    pages.forEach(p => collectBlobs(p).forEach(x => ids.add(x)));
    const blobs = [];
    for (const id of ids) { const r = await DB.get('blobs', id); if (r) blobs.push({ id, type: r.type, data: await blobToDataURL(r.blob) }); }
    const links = (await DB.all('links')).filter(x => pid.has(x.a) && pid.has(x.b));
    const exams = (await DB.all('exams')).filter(x => x.bookId === bookId);
    const cards = (await DB.all('cards')).filter(x => x.bookId === bookId);
    const book = { ...b }; delete book.music; // الموسيقى ملفات عندك إنت، ما بتنشارك
    return { app: 'daftari', kind: 'book', v: 2, at: Date.now(), books: [book], pages, blobs, links, exams, cards };
  },
  async gzip(text) { return new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))).blob(); },
  async gunzip(blob) { return new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).text(); },
  async exportBook(bookId) {
    const close = Toast.show({ icon: 'share', text: 'جاري تجهيز ملف المشاركة…', timeout: 0 });
    try {
      const data = await this.pack(bookId);
      const z = await this.gzip(JSON.stringify(data));
      close();
      downloadBlob(new Blob([z], { type: 'application/x-daftari' }), data.books[0].title + '.daftar');
      Toast.show({ icon: 'share', title: 'ملف المشاركة جاهز ✓', text: 'انحفظ بمجلد التنزيلات. ابعته لأي حدا عنده دفتري، وبيفتحه بدبل كليك أو من «فتح كتاب مشارَك».', timeout: 8000 });
    } catch (e) { close(); Toast.show({ icon: 'x', text: 'تعذّر تجهيز الملف: ' + e.message }); }
  },
  async readFile(blob) {
    const head = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
    const text = head[0] === 0x1f && head[1] === 0x8b ? await this.gunzip(blob) : await blob.text();
    const data = JSON.parse(text);
    if (data.app !== 'daftari') throw new Error('مش ملف دفتري');
    return data;
  },
  // بيستورد الكتاب كنسخة جديدة (معرّفات جديدة) حتى لو فتحته مرتين ما بيخرب كتبك
  async importData(data) {
    const existing = await DB.all('books');
    const out = [];
    for (const ob of data.books || []) {
      const nb = { ...ob, id: 'k' + uid(), created: Date.now(), updated: Date.now(), lastSpread: -1 };
      let t = ob.title, k = 2;
      while (existing.some(x => normTitle(x.title) === normTitle(t))) t = `${ob.title} (${k++})`;
      nb.title = t;
      if (nb.series && nb.series.name && existing.some(x => x.series && normTitle(x.series.name) === normTitle(nb.series.name) && +x.series.part === +nb.series.part)) nb.series = { ...nb.series, name: nb.series.name + ' (مشارَك)' };
      const pmap = new Map(), cmap = new Map();
      const pages = (data.pages || []).filter(p => (ob.pageIds || []).includes(p.id));
      (data.cards || []).filter(c => c.bookId === ob.id).forEach(c => cmap.set(c.id, 'c' + uid()));
      pages.forEach(p => pmap.set(p.id, 'p' + uid()));
      const np = pages.map(p => {
        let html = p.html || '';
        cmap.forEach((n, o) => { html = html.split(`data-card="${o}"`).join(`data-card="${n}"`); });
        return { ...p, id: pmap.get(p.id), bookId: nb.id, html };
      });
      nb.pageIds = (ob.pageIds || []).map(id => pmap.get(id)).filter(Boolean);
      for (const bl of data.blobs || []) if (!(await DB.get('blobs', bl.id))) { const blob = dataURLToBlob(bl.data); await DB.put('blobs', { id: bl.id, blob, type: bl.type || blob.type, size: blob.size }); }
      await DB.putMany('pages', np);
      await DB.put('books', nb);
      for (const c of (data.cards || []).filter(c => c.bookId === ob.id)) await DB.put('cards', { ...c, id: cmap.get(c.id), bookId: nb.id, due: Date.now() });
      for (const x of (data.links || []).filter(x => pmap.has(x.a) && pmap.has(x.b))) await DB.put('links', { ...x, id: 'w' + uid(), a: pmap.get(x.a), b: pmap.get(x.b), ab: nb.id, bb: nb.id });
      for (const e of (data.exams || []).filter(e => e.bookId === ob.id)) await DB.put('exams', { ...e, id: 'e' + uid(), bookId: nb.id, attempts: [], questions: (e.questions || []).map(q => ({ ...q, pageId: pmap.get(q.pageId) || null })) });
      existing.push(nb); out.push(nb);
    }
    await IdeaWeb.load();
    await Library.load();
    return out;
  },
  async importFile(file) {
    try {
      const data = await this.readFile(file);
      const books = await this.importData(data);
      if (!books.length) { Toast.show({ icon: 'x', text: 'ما لقيت كتاب بالملف' }); return; }
      Toast.show({ icon: 'share', title: 'وصلك كتاب ✦', text: `«${books[0].title}» انضاف لمكتبتك`, timeout: 6000, actions: [{ label: 'افتحه', primary: true, act: () => Reader.open(books[0].id) }] });
      return books[0];
    } catch (e) { Toast.show({ icon: 'x', text: 'تعذّر فتح الملف: ' + e.message }); }
  },
  async pick() { const f = await pickFile('.daftar,application/x-daftari,application/octet-stream'); if (f) this.importFile(f); },
  // دبل كليك على ملف .daftar: ملف التشغيل بيحطه بـ app/inbox وبيفتح التطبيق
  async inbox() {
    const q = new URLSearchParams(location.search);
    if (!q.has('inbox')) return;
    await new Promise(res => { const s = document.createElement('script'); s.src = 'inbox/pending.js?' + q.get('inbox'); s.onload = res; s.onerror = res; document.head.append(s); });
    const items = window.DAFTARI_INBOX || [];
    window.DAFTARI_INBOX = [];
    for (const it of items) {
      const bin = atob(it.b64), u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      const b = await this.importFile(new Blob([u]));
      if (b && items.length === 1) Reader.open(b.id);
    }
    history.replaceState(null, '', location.pathname);
  },
  // سحب ملف .daftar وإفلاته على نافذة المكتبة
  wireDrop() {
    addEventListener('dragover', e => { if ($('#library').hidden) return; if ([...(e.dataTransfer?.types || [])].includes('Files')) { e.preventDefault(); document.body.classList.add('dropbook'); } });
    addEventListener('dragleave', e => { if (!e.relatedTarget) document.body.classList.remove('dropbook'); });
    addEventListener('drop', e => {
      document.body.classList.remove('dropbook');
      if ($('#library').hidden) return;
      // ملفات PDF بتنضاف للمادة المفتوحة
      const pdfs = [...(e.dataTransfer?.files || [])].filter(x => Files.isPdf(x));
      if (pdfs.length) { e.preventDefault(); Files.addFiles(pdfs, { subjectId: Library.cur || NO_SUBJECT }); return; }
      const f = [...(e.dataTransfer?.files || [])].find(x => /\.(daftar|json)$/i.test(x.name));
      if (!f) return;
      e.preventDefault();
      this.importFile(f);
    });
  },
};
