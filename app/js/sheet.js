'use strict';
/* ============ ورقة ليلة الامتحان: ملخص الكتاب بصفحة وحدة ============
   من شغلك نفسه (بدون ذكاء اصطناعي): العناوين، اللي ظلّلته، والكلمات العريضة.
   بتنطبع A4 أو بتنحفظ PDF أو بتنضاف صفحات لآخر الكتاب. */
const Sheet = {
  opt: { hl: true, terms: true },
  // بنقرأ الكتاب صفحة صفحة ومنجمّع حسب العناوين
  async collect(book, pages) {
    const secs = [];
    let cur = { title: '', page: 0, items: [], terms: [] };
    secs.push(cur);
    const isHL = e => { if (e.closest('td, th, h2, h3')) return false; const bg = e.style && e.style.backgroundColor; return e.tagName === 'MARK' || (!!bg && !/transparent|rgba\(0, 0, 0, 0\)|initial|inherit/.test(bg) && !/^rgb\(255, 255, 255\)$/.test(bg)); };
    const tidy = s => s.replace(/\s+/g, ' ').trim();
    pages.forEach((p, pi) => {
      if (!p || !p.html) return;
      const t = document.createElement('template'); t.innerHTML = p.html;
      const root = t.content;
      const blocks = root.querySelectorAll('h2, h3, p, li, blockquote, td, th, pre');
      const seenHL = new Set();
      for (const b of blocks) {
        if (b.closest('li') && b.tagName !== 'LI' && b.closest('li') !== b) continue;
        if (b.tagName === 'H2') { const title = tidy(b.textContent); if (!title) continue; if (b.dataset.cont && cur.title) { continue; } cur = { title, page: pi + 1, items: [], terms: [] }; secs.push(cur); continue; }
        if (b.tagName === 'H3') { const s = tidy(b.textContent); if (s && !b.dataset.cont) cur.items.push({ k: 'sub', text: s, page: pi + 1 }); continue; }
        if (b.tagName === 'PRE') continue;
        // المظلّل (بالهايلايت)
        const hl = [...b.querySelectorAll('span[style], mark, font[style]')].filter(e => isHL(e) && !seenHL.has(e) && !(e.parentElement && isHL(e.parentElement)));
        hl.forEach(e => seenHL.add(e));
        const hlText = hl.map(e => tidy(e.textContent)).filter(Boolean).join(' … ');
        if (hlText) cur.items.push({ k: 'hl', text: hlText.length > 260 ? hlText.slice(0, 257) + '…' : hlText, page: pi + 1 });
        // كلمات مهمة: العريض القصير (مش عناوين جداول ولا «اسم:»)
        for (const e of b.querySelectorAll('b, strong')) { const s = tidy(e.textContent); if (s && s.length <= 40 && !/[:：]$/.test(s) && !e.closest('th') && !cur.terms.includes(s)) cur.terms.push(s); }
      }
    });
    return { secs: secs.filter(s => s.title || s.items.length || s.terms.length) };
  },
  count(d) { const n = { hl: 0, sub: 0, terms: 0 }; d.secs.forEach(s => { s.items.forEach(i => n[i.k]++); n.terms += s.terms.length; }); n.heads = d.secs.filter(s => s.title).length; return n; },
  // HTML الورقة (نفسه للمعاينة وللطباعة)
  html(book, d) {
    const o = this.opt, pg = n => n > 0 ? `<i class="sh-p">ص ${n}</i>` : '';
    let h = `<header class="sh-head"><b dir="auto">${esc(book.title)}</b><span>ورقة ليلة الامتحان ✦ ${new Date().toLocaleDateString('ar', { day: 'numeric', month: 'long', year: 'numeric' })}</span></header>`;
    h += '<div class="sh-cols">';
    for (const s of d.secs) {
      const items = s.items.filter(i => (i.k === 'hl' && o.hl) || i.k === 'sub');
      const terms = o.terms ? s.terms : [];
      // عنوان فرعي بدون أي شي تحته ما بنعرضه لحاله إلا إذا القسم كله عناوين
      const real = items.filter(i => i.k !== 'sub');
      if (!real.length && !terms.length && !s.title) continue;
      h += `<section class="sh-sec">${s.title ? `<h3 dir="auto">${esc(s.title)} ${pg(s.page)}</h3>` : ''}`;
      if (terms.length) h += `<p class="sh-terms" dir="auto">🔑 ${terms.map(esc).join(' · ')}</p>`;
      h += '<ul>' + items.map(i => i.k === 'sub' ? `<li class="sh-sub" dir="auto">${esc(i.text)}</li>`
        : `<li class="sh-hl" dir="auto">${esc(i.text)} ${pg(i.page)}</li>`).join('') + '</ul></section>';
    }
    return h + '</div>';
  },
  async open() {
    const R = Reader; if (!R.book) return;
    Editor.flushAll();
    const d = await this.collect(R.book, R.pages);
    const n = this.count(d);
    const empty = !n.hl && !n.terms;
    const node = el(`<div class="sheet-dlg">
      <div class="jf-head">${ic('page')}<div><h3>ورقة ليلة الامتحان</h3><p class="muted">ملخص «${esc(R.book.title)}» بصفحة وحدة من شغلك: ${n.heads} عنوان، ${n.hl} مظلّل، ${n.terms} كلمة مهمة.</p></div></div>
      ${empty ? `<div class="sh-empty"><p><b>الورقة لسا فاضية.</b> هي بتتعبّى من شغلك:</p><ul><li>ظلّل الأهم بالهايلايت</li><li>اكتب عناوين (H) للدروس</li><li>خلّي المصطلحات المهمة عريضة (B)</li></ul></div>` : `
      <div class="seg wrap sh-opts">
        <label><input type="checkbox" data-o="hl" ${this.opt.hl ? 'checked' : ''}> المظلّل</label>
        <label><input type="checkbox" data-o="terms" ${this.opt.terms ? 'checked' : ''}> الكلمات المهمة</label>
      </div>
      <div class="sheet-paper"></div>`}
      <div class="row end"><button class="btn ghost" data-a="close">سكّر</button>${empty ? '' : `<button class="btn ghost" data-a="add">${ic('addpage')} أضفها لآخر الكتاب</button><button class="btn primary" data-a="print">${ic('pdf')} اطبعها / PDF</button>`}</div></div>`);
    const m = Modal.open(node, { cls: 'wide sheet-modal' });
    const draw = () => { const p = $('.sheet-paper', node); if (p) p.innerHTML = this.html(R.book, d); };
    draw();
    node.addEventListener('change', e => { const k = e.target.dataset.o; if (k) { this.opt[k] = e.target.checked; draw(); } });
    node.addEventListener('click', async e => {
      const a = e.target.closest('[data-a]'); if (!a) return;
      if (a.dataset.a === 'close') m.close();
      else if (a.dataset.a === 'print') { m.close(); this.print(R.book, d); }
      else if (a.dataset.a === 'add') { m.close(); await this.addToBook(R.book, d); }
    });
  },
  async print(book, d) {
    const box = $('#print');
    box.className = ''; box.removeAttribute('style');
    box.innerHTML = `<section class="sheet-print">${this.html(book, d)}</section>`;
    const old = document.title; document.title = book.title + ' — ورقة ليلة الامتحان';
    addEventListener('afterprint', () => { box.innerHTML = ''; document.title = old; document.body.classList.remove('printing'); }, { once: true });
    document.body.classList.add('printing');
    await raf(); await raf();
    window.print();
  },
  // صفحات بالكتاب (بتنقسم لحالها على الورق)
  async addToBook(book, d) {
    const o = this.opt, blocks = ['<h2>ورقة ليلة الامتحان ✦</h2>'];
    for (const s of d.secs) {
      const items = s.items.filter(i => i.k === 'hl' && o.hl);
      const terms = o.terms ? s.terms : [];
      if (!items.length && !terms.length) continue;
      if (s.title) blocks.push(`<h3>${esc(s.title)} (ص ${s.page})</h3>`);
      if (terms.length) blocks.push(`<p>🔑 ${terms.map(esc).join(' · ')}</p>`);
      if (items.length) blocks.push('<ul>' + items.map(i => `<li><span style="background-color:#fff176">${esc(i.text)}</span> (ص ${i.page})</li>`).join('') + '</ul>');
    }
    const R = Reader;
    let last = R.pages.length - 1; while (last > 0 && !R.pages[last].html && !(R.pages[last].stickies || []).length) last--;
    const target = R.pages[last].html ? last + 1 : last;
    if (target >= R.pages.length) R.addPages(2);
    await R.goToPage(target); await new Promise(r => setTimeout(r, 400));
    const l = Editor.live.get(target); if (!l) return;
    await Importer.load();
    const c = await Import.toPages(l, { blocks, images: [] });
    Toast.show({ icon: 'check', title: 'انضافت ورقة ليلة الامتحان ✦', text: `على ${c} ${c === 1 ? 'صفحة' : 'صفحات'} بآخر الكتاب.`, timeout: 4000 });
  },
};
