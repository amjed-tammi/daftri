'use strict';
/* ============ البحث، الفهرس، سلة المحذوفات، ملفات الصوت ============ */
// توحيد النص للبحث مع حفظ مكان كل حرف بالنص الأصلي
function normMap(s) {
  let n = ''; const map = [];
  for (let i = 0; i < s.length; i++) {
    let ch = s[i];
    if (/[ً-ٰٟـ]/.test(ch)) continue;
    if (/[إأآٱ]/.test(ch)) ch = 'ا'; else if (ch === 'ى') ch = 'ي'; else if (ch === 'ة') ch = 'ه';
    const lo = ch.toLowerCase();
    n += lo.length === 1 ? lo : ch; map.push(i);
  }
  return { n, map };
}

const Finder = {
  docs: null,
  async build() {
    Editor.flushAll();
    const books = await DB.all('books');
    const pages = new Map((await DB.all('pages')).map(p => [p.id, p]));
    const docs = [];
    for (const b of books) {
      (b.pageIds || []).forEach((pid, i) => {
        const p = pages.get(pid); if (!p) return;
        const text = (htmlText(p.html) + '\n' + (p.stickies || []).map(s => htmlText(s.text)).join('\n') + '\n' + (p.attach || []).map(a => a.title || '').join(' ')).replace(/[ \t]+/g, ' ');
        if (text.trim()) docs.push({ book: b, i, text, nm: normMap(text) });
      });
    }
    return docs;
  },
  async open() {
    const inBook = !!Reader.book;
    let scope = inBook ? 'book' : 'all';
    const n = el(`<div class="finder">
      <div class="f-in">${ic('search')}<input class="inp" placeholder="ابحث بكتبك… Search" autocomplete="off" spellcheck="false"></div>
      ${inBook ? `<div class="seg f-scope"><button data-s="book">هذا الكتاب</button><button data-s="all">كل الكتب</button></div>` : ''}
      <div class="f-res"><p class="muted f-hint">اكتب كلمة، عربي أو English. البحث بيتجاهل التشكيل والهمزات.</p></div></div>`);
    const m = Modal.open(n, { cls: 'finder-modal', label: 'البحث في الكتب' });
    const inp = $('input', n), res = $('.f-res', n);
    const docs = await this.build();
    // ملفات الـPDF كمان: كل صفحة نص بينبحث فيه (النص بيتجهّز مرة وحدة وبينحفظ)
    const files = (await DB.all('files')).filter(f => f.blob);
    const addPdf = f => (f.text || []).forEach((t, i) => { if (t) docs.push({ pdf: f, i, text: t, nm: normMap(t), scopeBook: f.bookId || null, book: { id: 'pdf:' + f.id, title: '📎 ' + f.name } }); });
    files.filter(f => f.text).forEach(addPdf);
    const missing = files.filter(f => !f.text);
    if (missing.length) (async () => { for (const f of missing) { try { await Files.text(f); addPdf(f); } catch { } } if (n.isConnected && inp.value.trim().length > 1) run(); })();
    const syncScope = () => $$('.f-scope button', n).forEach(b => b.classList.toggle('on', b.dataset.s === scope));
    const run = () => {
      const q = normMap(inp.value.trim()).n;
      if (q.length < 2) { res.innerHTML = '<p class="muted f-hint">اكتب حرفين أو أكثر…</p>'; return; }
      const hits = [];
      for (const d of docs) {
        if (scope === 'book' && (d.pdf ? d.scopeBook : d.book.id) !== Reader.book.id) continue;
        let k = d.nm.n.indexOf(q), c = 0, first = -1;
        while (k > -1 && c < 99) { if (first < 0) first = k; c++; k = d.nm.n.indexOf(q, k + q.length); }
        if (c) hits.push({ d, c, first });
        if (hits.length > 300) break;
      }
      if (!hits.length) { res.innerHTML = '<p class="muted f-hint">ما لقيت شي 🌙</p>'; return; }
      const groups = new Map();
      hits.forEach(h => { const id = h.d.book.id; if (!groups.has(id)) groups.set(id, []); groups.get(id).push(h); });
      const order = [...groups.keys()].sort((a, b) => (b === (Reader.book && Reader.book.id)) - (a === (Reader.book && Reader.book.id)));
      res.innerHTML = order.map(id => {
        const hs = groups.get(id), b = hs[0].d.book;
        return `<section><h5>${ic('books')} ${esc(b.title)} <small>${hs.reduce((s, h) => s + h.c, 0)} نتيجة</small></h5>${hs.map(h => {
          const t = h.d.text, s0 = h.d.nm.map[h.first], s1 = h.d.nm.map[Math.min(h.first + q.length - 1, h.d.nm.map.length - 1)] + 1;
          const a = Math.max(0, s0 - 45), z = Math.min(t.length, s1 + 70);
          const snip = (a ? '…' : '') + esc(t.slice(a, s0)) + '<mark>' + esc(t.slice(s0, s1)) + '</mark>' + esc(t.slice(s1, z)) + (z < t.length ? '…' : '');
          return `<button class="f-hit" ${h.d.pdf ? `data-f="${h.d.pdf.id}"` : `data-b="${b.id}"`} data-i="${h.d.i}"><span class="f-pg">ص ${h.d.i + 1}</span><span class="f-snip">${snip.replace(/\n+/g, ' ')}</span>${h.c > 1 ? `<em>×${h.c}</em>` : ''}</button>`;
        }).join('')}</section>`;
      }).join('');
    };
    inp.addEventListener('input', debounce(run, 120));
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { const f = $('.f-hit', res); if (f) f.click(); } });
    n.addEventListener('click', async e => {
      const s = e.target.closest('[data-s]');
      if (s) { scope = s.dataset.s; syncScope(); run(); inp.focus(); return; }
      const h = e.target.closest('.f-hit'); if (!h) return;
      const q = inp.value.trim();
      m.close();
      if (h.dataset.f) { setTimeout(() => Files.open(h.dataset.f, +h.dataset.i + 1), 250); return; } // نتيجة من PDF: بيفتح على صفحتها
      await this.go(h.dataset.b, +h.dataset.i, q);
    });
    syncScope();
    setTimeout(() => inp.focus(), 60);
  },
  async go(bookId, i, q) {
    if (!Reader.book || Reader.book.id !== bookId) await Reader.open(bookId, i);
    else await Reader.showPage(i);
    setTimeout(() => this.highlight(q), 120);
  },
  // تلوين الكلمة بالصفحات المعروضة بدون تعديل النص
  highlight(q) {
    if (!window.CSS || !CSS.highlights || !q) return;
    const nq = normMap(q).n; if (!nq) return;
    const ranges = [];
    $$('#bookInner .slot .content, #bookInner .slot .stx').forEach(root => {
      const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let t;
      while ((t = tw.nextNode())) {
        const m = normMap(t.data);
        let k = m.n.indexOf(nq);
        while (k > -1) {
          const r = new Range();
          r.setStart(t, m.map[k]); r.setEnd(t, m.map[k + nq.length - 1] + 1);
          ranges.push(r);
          k = m.n.indexOf(nq, k + nq.length);
        }
      }
    });
    CSS.highlights.set('find', new Highlight(...ranges));
    clearTimeout(this._ht);
    this._ht = setTimeout(() => CSS.highlights.delete('find'), 9000);
  },

  /* ===== الفهرس ===== */
  index(anchor) {
    if (!Reader.book) return;
    Editor.flushAll();
    const heads = [];
    Reader.pages.forEach((p, i) => {
      const re = /<(h2|h3)([^>]*)>([\s\S]*?)<\/\1>/gi; let m;
      while ((m = re.exec(p.html || ''))) {
        if (/data-cont=/.test(m[2])) continue;
        const t = htmlText(m[3]).trim();
        if (t) heads.push({ lvl: m[1], t, i });
      }
    });
    const n = el(`<div class="panel toc">
      <h4>${ic('list')} فهرس «${esc(Reader.book.title)}»</h4>
      <div class="toc-list">${heads.length ? heads.map(h => `<button class="toc-i ${h.lvl}" data-i="${h.i}"><span>${esc(h.t)}</span><i></i><b>${h.i + 1}</b></button>`).join('')
        : '<p class="muted sm">العناوين اللي بتكتبها بتظهر هون تلقائياً. حدّد سطر واضغط زر العنوان (H) بشريط التنسيق.</p>'}</div>
    </div>`);
    n.addEventListener('click', e => {
      const b = e.target.closest('[data-i]'); if (!b) return;
      Pop.close(); Reader.showPage(+b.dataset.i);
    });
    Pop.open(anchor, n, { cls: 'panel-pop' });
    if (Pop.cur) Pop.cur._from = '#topbar';
  },
};

/* ============ سلة المحذوفات (30 يوم) ============ */
const Trash = {
  async addPage(p, book, index) {
    const item = { id: 't' + uid(), kind: 'page', at: Date.now(), page: p, bookId: book.id, bookTitle: book.title, index, preview: htmlText(p.html).trim().slice(0, 90) };
    await DB.put('trash', item);
    return item;
  },
  async addBook(b) {
    const item = { id: 't' + uid(), kind: 'book', at: Date.now(), book: b, bookTitle: b.title };
    await DB.put('trash', item);
    await DB.del('books', b.id);
    return item;
  },
  async restore(item) {
    if (!(await DB.get('trash', item.id))) return false;
    if (item.kind === 'book') {
      const books = await DB.all('books');
      let t = item.book.title, k = 2;
      while (books.some(x => normTitle(x.title) === normTitle(t))) t = `${item.book.title} (${k++})`;
      item.book.title = t;
      await DB.put('books', item.book);
    } else {
      const open = Reader.book && Reader.book.id === item.bookId;
      if (open) { Editor.flushAll(); Reader.saveBook.flush(); }
      const b = open ? Reader.book : await DB.get('books', item.bookId);
      if (!b) { Toast.show({ icon: 'x', text: `كتاب «${item.bookTitle}» محذوف — استرجعه أولاً` }); return false; }
      const idx = clamp(item.index, 0, b.pageIds.length);
      b.pageIds.splice(idx, 0, item.page.id);
      await DB.put('pages', item.page);
      if (b.pageIds.length % 2) {
        // عدد الصفحات لازم يكون زوجي: نشيل صفحة فاضية من الآخر إن وجدت، وإلا نضيف وحدة
        const lastId = b.pageIds[b.pageIds.length - 1];
        const last = lastId !== item.page.id && await DB.get('pages', lastId);
        if (last && !last.html && !(last.stickies || []).length && !(last.attach || []).length) { b.pageIds.pop(); await DB.del('pages', lastId); }
        else { const p = { id: 'p' + uid(), bookId: b.id, html: '', stickies: [], attach: [] }; await DB.put('pages', p); b.pageIds.push(p.id); }
      }
      await DB.put('books', b);
      if (open) await Reader.open(b.id, idx);
    }
    await DB.del('trash', item.id);
    Toast.show({ icon: 'check', text: 'تم الاسترجاع ✓', timeout: 2000 });
    if (!$('#library').hidden) Library.load();
    return true;
  },
  async purge(item) {
    if (item.kind === 'book') {
      const b = item.book;
      const pages = (await DB.getMany('pages', b.pageIds || [])).filter(Boolean);
      const blobs = new Set();
      if (b.cover && b.cover.image) blobs.add(b.cover.image);
      pages.forEach(p => collectBlobs(p).forEach(x => blobs.add(x)));
      await DB.delMany('pages', b.pageIds || []);
      await Media.del([...blobs]);
      await IdeaWeb.removeForPages(b.pageIds || []);
      // بقايا ميزة المراجعة والامتحانات القديمة لهالكتاب
      for (const st of LEGACY_STORES) { const old = (await DB.all(st)).filter(x => x.bookId === b.id).map(x => x.id); if (old.length) await DB.delMany(st, old); }
    } else {
      await Media.del(collectBlobs(item.page));
      await IdeaWeb.removeForPages([item.page.id]);
    }
    await DB.del('trash', item.id);
  },
  async autoPurge() {
    const old = (await DB.all('trash')).filter(t => Date.now() - t.at > 30 * DAY);
    for (const t of old) await this.purge(t);
  },
  async panel() {
    const items = (await DB.all('trash')).sort((a, b) => b.at - a.at);
    const left = t => Math.max(0, 30 - Math.floor((Date.now() - t.at) / DAY));
    const n = el(`<div class="trash">
      <div class="jf-head">${ic('trash')}<div><h3>سلة المحذوفات</h3><p class="muted">الكتب والصفحات المحذوفة بتضل هون 30 يوم، وبعدها بتنحذف نهائياً.</p></div></div>
      <div class="t-list">${items.length ? items.map(t => `<div class="t-item" data-id="${t.id}">
        <span class="t-ic">${ic(t.kind === 'book' ? 'books' : 'page')}</span>
        <div class="t-txt"><b>${t.kind === 'book' ? 'كتاب «' + esc(t.bookTitle) + '»' : `صفحة ${t.index + 1} من «${esc(t.bookTitle)}»`}</b><span>${esc(t.preview || (t.kind === 'book' ? (t.book.pageIds || []).length + ' صفحة' : 'صفحة فاضية'))}</span></div>
        <small>باقي ${left(t)} يوم</small>
        <button class="btn ghost sm" data-a="restore">استرجاع</button>
        <button class="ib" data-a="purge" title="حذف نهائي">${ic('x')}</button></div>`).join('') : '<p class="muted empty-j">السلة فاضية ✨</p>'}</div>
      <div class="row end">${items.length ? '<button class="btn ghost danger-t" data-a="empty">إفراغ السلة</button>' : ''}<button class="btn primary" data-a="close">إغلاق</button></div></div>`);
    const m = Modal.open(n, { cls: 'wide' });
    n.addEventListener('click', async e => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      const row = b.closest('.t-item'), item = row && items.find(x => x.id === row.dataset.id);
      if (b.dataset.a === 'close') m.close();
      else if (b.dataset.a === 'restore') { if (await this.restore(item)) row.remove(); }
      else if (b.dataset.a === 'purge') {
        if (await Modal.confirm('حذف نهائي', 'هاد الحذف ما بيرجع. متأكد؟', { ok: 'احذف نهائياً', danger: true })) { await this.purge(item); row.remove(); }
      } else if (b.dataset.a === 'empty') {
        if (await Modal.confirm('إفراغ السلة', `حذف ${items.length} عنصر نهائياً؟ ما بيرجعوا.`, { ok: 'إفراغ', danger: true })) { for (const t of items) await this.purge(t); m.close(); Toast.show({ icon: 'trash', text: 'انفرغت السلة' }); }
      }
    });
  },
  async count() { return (await DB.all('trash')).length; },
};

/* ============ ملف صوتي من الجهاز ============ */
const AudioFile = {
  async attach(l) {
    const f = await pickFile('audio/*');
    if (!f) return;
    if (f.size > 80 * 1048576) { Toast.show({ icon: 'x', text: 'الملف كبير جداً (أكثر من 80 ميجا)' }); return; }
    const id = await Media.save(f);
    const dur = await new Promise(res => {
      const a = new Audio(), u = URL.createObjectURL(f);
      a.preload = 'metadata';
      a.onloadedmetadata = () => { res(isFinite(a.duration) ? a.duration : 0); URL.revokeObjectURL(u); };
      a.onerror = () => { res(0); URL.revokeObjectURL(u); };
      a.src = u;
    });
    Attach.add(l, { type: 'audio', blob: id, dur, name: f.name, at: Date.now() });
    Toast.show({ icon: 'mic', text: 'أُرفق الملف الصوتي بالصفحة (أعلى الصفحة)', timeout: 2500 });
  },
};
