'use strict';
/* ============ ورقة ليلة الامتحان: ملخص الكتاب بصفحة وحدة ============
   من شغلك نفسه (بدون ذكاء اصطناعي): العناوين، اللي ظلّلته، أسئلة المراجعة وأجوبتها، الكلمات العريضة،
   والأسئلة اللي غلطت فيها بالامتحانات. بتنطبع A4 أو بتنحفظ PDF أو بتنضاف صفحات لآخر الكتاب. */
const Sheet = {
  opt: { hl: true, cards: true, terms: true, wrong: true, hide: false },
  // بنقرأ الكتاب صفحة صفحة ومنجمّع حسب العناوين
  async collect(book, pages) {
    const secs = [];
    let cur = { title: '', page: 0, items: [], terms: [] };
    secs.push(cur);
    const isHL = e => { if (e.closest('.ans, td, th, h2, h3')) return false; const bg = e.style && e.style.backgroundColor; return e.tagName === 'MARK' || (!!bg && !/transparent|rgba\(0, 0, 0, 0\)|initial|inherit/.test(bg) && !/^rgb\(255, 255, 255\)$/.test(bg)); };
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
        // سؤال مراجعة: الجملة مع فراغ مكان الجواب
        for (const a of b.querySelectorAll(':scope .ans')) {
          if (a.closest('li, p, blockquote, td, th') !== b) continue;
          const ans = tidy(a.textContent); if (!ans) continue;
          const c = b.cloneNode(true); const ca = c.querySelector(`[data-card="${a.dataset.card}"]`); if (ca) ca.replaceWith('⟨…⟩');
          const q = tidy(c.textContent).replace(/\s*(الجواب|الإجابة|answer)\s*[:：]\s*⟨…⟩\s*$/i, ' ⟨…⟩');
          cur.items.push({ k: 'card', q, a: ans, page: pi + 1 });
        }
        // المظلّل (بالهايلايت)
        const hl = [...b.querySelectorAll('span[style], mark, font[style]')].filter(e => isHL(e) && !seenHL.has(e) && !(e.parentElement && isHL(e.parentElement)));
        hl.forEach(e => seenHL.add(e));
        const hlText = hl.map(e => tidy(e.textContent)).filter(Boolean).join(' … ');
        if (hlText) cur.items.push({ k: 'hl', text: hlText.length > 260 ? hlText.slice(0, 257) + '…' : hlText, page: pi + 1 });
        // كلمات مهمة: العريض القصير (مش عناوين جداول ولا «اسم:»)
        for (const e of b.querySelectorAll('b, strong')) { const s = tidy(e.textContent); if (s && s.length <= 40 && !/[:：]$/.test(s) && !e.closest('.ans, th') && !cur.terms.includes(s)) cur.terms.push(s); }
      }
    });
    // الأسئلة اللي غلطت فيها (آخر محاولة بكل امتحان)
    const wrong = [];
    for (const ex of (await DB.all('exams')).filter(x => x.bookId === book.id)) {
      const last = (ex.attempts || []).slice(-1)[0]; if (!last) continue;
      for (const id of last.wrong || []) { const q = ex.questions.find(x => x.id === id); if (q) wrong.push({ q: q.q, a: q.choices[q.correct], page: book.pageIds.indexOf(q.pageId) + 1, exam: ex.title }); }
    }
    return { secs: secs.filter(s => s.title || s.items.length || s.terms.length), wrong };
  },
  count(d) { const n = { hl: 0, card: 0, sub: 0, terms: 0 }; d.secs.forEach(s => { s.items.forEach(i => n[i.k]++); n.terms += s.terms.length; }); n.wrong = d.wrong.length; n.heads = d.secs.filter(s => s.title).length; return n; },
  // HTML الورقة (نفسه للمعاينة وللطباعة)
  html(book, d) {
    const o = this.opt, pg = n => n > 0 ? `<i class="sh-p">ص ${n}</i>` : '';
    const ans = a => o.hide ? '<span class="sh-blank"></span>' : `<b>${esc(a)}</b>`;
    let h = `<header class="sh-head"><b dir="auto">${esc(book.title)}</b><span>ورقة ليلة الامتحان ✦ ${new Date().toLocaleDateString('ar', { day: 'numeric', month: 'long', year: 'numeric' })}</span></header>`;
    if (o.wrong && d.wrong.length) h += `<section class="sh-wrong"><h4>⚠ راجع هدول — غلطت فيهم آخر مرة</h4><ol>${d.wrong.map(w => `<li><span dir="auto">${esc(w.q)}</span> ← ${ans(w.a)} ${pg(w.page)}</li>`).join('')}</ol></section>`;
    h += '<div class="sh-cols">';
    for (const s of d.secs) {
      const items = s.items.filter(i => (i.k === 'hl' && o.hl) || (i.k === 'card' && o.cards) || i.k === 'sub');
      const terms = o.terms ? s.terms : [];
      // عنوان فرعي بدون أي شي تحته ما بنعرضه لحاله إلا إذا القسم كله عناوين
      const real = items.filter(i => i.k !== 'sub');
      if (!real.length && !terms.length && !s.title) continue;
      h += `<section class="sh-sec">${s.title ? `<h3 dir="auto">${esc(s.title)} ${pg(s.page)}</h3>` : ''}`;
      if (terms.length) h += `<p class="sh-terms" dir="auto">🔑 ${terms.map(esc).join(' · ')}</p>`;
      h += '<ul>' + items.map(i => i.k === 'sub' ? `<li class="sh-sub" dir="auto">${esc(i.text)}</li>`
        : i.k === 'hl' ? `<li class="sh-hl" dir="auto">${esc(i.text)} ${pg(i.page)}</li>`
          : `<li class="sh-card" dir="auto">❓ ${esc(i.q).replace('⟨…⟩', '<u>&nbsp;…&nbsp;</u>')} ← ${ans(i.a)} ${pg(i.page)}</li>`).join('') + '</ul></section>';
    }
    return h + '</div>';
  },
  async open() {
    const R = Reader; if (!R.book) return;
    Editor.flushAll();
    const d = await this.collect(R.book, R.pages);
    const n = this.count(d);
    const empty = !n.hl && !n.card && !n.wrong && !n.terms;
    const node = el(`<div class="sheet-dlg">
      <div class="jf-head">${ic('page')}<div><h3>ورقة ليلة الامتحان</h3><p class="muted">ملخص «${esc(R.book.title)}» بصفحة وحدة من شغلك: ${n.heads} عنوان، ${n.hl} مظلّل، ${n.card} سؤال مراجعة${n.wrong ? `، ${n.wrong} غلطة من الامتحانات` : ''}.</p></div></div>
      ${empty ? `<div class="sh-empty"><p><b>الورقة لسا فاضية.</b> هي بتتعبّى من شغلك:</p><ul><li>ظلّل الأهم بالهايلايت</li><li>حدّد جواب واضغط 🩹 ليصير سؤال مراجعة</li><li>اكتب عناوين (H) للدروس</li><li>حل امتحان من قسم الامتحانات</li></ul></div>` : `
      <div class="seg wrap sh-opts">
        <label><input type="checkbox" data-o="hl" ${this.opt.hl ? 'checked' : ''}> المظلّل</label>
        <label><input type="checkbox" data-o="cards" ${this.opt.cards ? 'checked' : ''}> أسئلة المراجعة</label>
        <label><input type="checkbox" data-o="terms" ${this.opt.terms ? 'checked' : ''}> الكلمات المهمة</label>
        <label><input type="checkbox" data-o="wrong" ${this.opt.wrong ? 'checked' : ''}> أخطائي</label>
        <label><input type="checkbox" data-o="hide" ${this.opt.hide ? 'checked' : ''}> خبّي الأجوبة (للتسميع)</label>
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
    if (o.wrong && d.wrong.length) { blocks.push('<h3>⚠ راجع هدول</h3>'); blocks.push('<ol>' + d.wrong.map(w => `<li>${esc(w.q)} ← <b>${esc(w.a)}</b>${w.page > 0 ? ` (ص ${w.page})` : ''}</li>`).join('') + '</ol>'); }
    for (const s of d.secs) {
      const items = s.items.filter(i => (i.k === 'hl' && o.hl) || (i.k === 'card' && o.cards));
      const terms = o.terms ? s.terms : [];
      if (!items.length && !terms.length) continue;
      if (s.title) blocks.push(`<h3>${esc(s.title)} (ص ${s.page})</h3>`);
      if (terms.length) blocks.push(`<p>🔑 ${terms.map(esc).join(' · ')}</p>`);
      blocks.push('<ul>' + items.map(i => i.k === 'hl' ? `<li><span style="background-color:#fff176">${esc(i.text)}</span> (ص ${i.page})</li>` : `<li>❓ ${esc(i.q).replace('⟨…⟩', '…')} ← <b>${esc(i.a)}</b> (ص ${i.page})</li>`).join('') + '</ul>');
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
