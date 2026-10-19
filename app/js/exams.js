'use strict';
/* ============ الامتحانات: اختيار من متعدد، وكل سؤال مربوط بالصفحة اللي انكتب منها ============
   صيغة الاستيراد/التصدير (جاهزة لما يكتب الذكاء الاصطناعي الامتحانات لاحقاً):
   { "title": "…", "questions": [ { "q": "…", "choices": ["…", "…"], "correct": 0, "page": 12, "explain": "…" } ] }
   page = رقم الصفحة بالكتاب (يبدأ من 1) */
const AR_RE = /[؀-ۿ]/;
const Exams = {
  run: null,

  async all(bookId) { return (await DB.all('exams')).filter(x => x.bookId === bookId).sort((a, b) => b.updated - a.updated); },
  pageIndex(pageId) { return Reader.book ? Reader.book.pageIds.indexOf(pageId) : -1; },
  pageLabel(pageId) {
    const i = this.pageIndex(pageId); if (i < 0) return '';
    return `ص ${i + 1} · ${IdeaWeb.pageInfo(Reader.pages[i], i).title}`;
  },
  letters(q) { return AR_RE.test(q) ? 'أبجدهوزح' : 'ABCDEFGH'; },

  /* ===== قسم الامتحانات بالكتاب ===== */
  async panel() {
    if (!Reader.book) return;
    Editor.flushAll();
    const list = await this.all(Reader.book.id);
    const n = el(`<div class="exams">
      <div class="jf-head">${ic('exam')}<div><h3>امتحانات «${esc(Reader.book.title)}»</h3><p class="muted">اختيار من متعدد. كل سؤال مربوط بصفحته، فإذا غلطت بتعرف وين ترجع تقرأ.</p></div></div>
      <div class="ex-list">${list.length ? list.map(x => {
        const last = (x.attempts || []).slice(-1)[0];
        const pages = [...new Set(x.questions.map(q => this.pageIndex(q.pageId)).filter(i => i >= 0))].sort((a, b) => a - b);
        return `<div class="ex-item" data-id="${x.id}">
          <div class="ex-ic">${ic('exam')}</div>
          <div class="ex-t"><b dir="auto">${esc(x.title)}</b><small>${x.questions.length} سؤال${pages.length ? ' · صفحات ' + pages.slice(0, 6).map(i => i + 1).join('، ') + (pages.length > 6 ? '…' : '') : ''}${last ? ` · آخر نتيجة ${last.score}/${last.total}` : ''}</small></div>
          <button class="btn primary sm" data-a="take">${ic('play')} ابدأ</button>
          <button class="ib" data-a="edit" title="تعديل">${ic('edit')}</button>
          <button class="ib" data-a="export" title="تصدير JSON">${ic('download')}</button>
          <button class="ib" data-a="del" title="حذف">${ic('trash')}</button></div>`;
      }).join('') : '<p class="muted empty-j">لسا ما في امتحانات. اعمل واحد من الصفر، أو من صفحة معيّنة (كليك يمين ← اعمل امتحان من هالصفحة)، أو استورد ملف JSON.</p>'}</div>
      <div class="row end"><button class="btn ghost" data-a="import">${ic('upload')} استيراد JSON</button><button class="btn ghost" data-a="close">إغلاق</button><button class="btn primary" data-a="new">${ic('plus')} امتحان جديد</button></div>
    </div>`);
    const m = Modal.open(n, { cls: 'wide' });
    n.addEventListener('click', async e => {
      const a = e.target.closest('[data-a]'); if (!a) return;
      const row = a.closest('.ex-item'), x = row && list.find(k => k.id === row.dataset.id);
      switch (a.dataset.a) {
        case 'close': m.close(); break;
        case 'new': m.close(); this.editor(null); break;
        case 'import': m.close(); this.importFile(); break;
        case 'take': m.close(); this.take(x); break;
        case 'edit': m.close(); this.editor(x); break;
        case 'export': this.exportFile(x); break;
        case 'del': if (await Modal.confirm('حذف الامتحان', `حذف «${x.title}»؟`, { ok: 'حذف', danger: true })) { await DB.del('exams', x.id); row.remove(); } break;
      }
    });
  },

  /* ===== اقتراح أسئلة من أسئلة المراجعة (الأجوبة اللي عليها شريط لاصق) ===== */
  suggest(pageIdxs) {
    const doc = i => new DOMParser().parseFromString(Reader.pages[i].html || '', 'text/html').body;
    const allAns = [];
    Reader.pages.forEach((p, i) => $$('.ans', doc(i)).forEach(a => { const t = a.textContent.trim(); if (t) allAns.push(t); }));
    const pool = [...new Set(allAns)];
    const out = [];
    for (const i of pageIdxs) {
      $$('.ans', doc(i)).forEach(a => {
        const ans = a.textContent.trim(); if (!ans) return;
        const blk = a.closest('p,li,td,th,h2,h3,blockquote,div') || a.parentElement;
        const q = blk.textContent.replace(ans, ' ______ ').replace(/\s+/g, ' ').trim();
        const others = pool.filter(x => x !== ans).sort(() => Math.random() - .5).slice(0, 3);
        if (!others.length) return;
        const choices = [ans, ...others].sort(() => Math.random() - .5);
        out.push({ id: 'q' + uid(), q, choices, correct: choices.indexOf(ans), pageId: Reader.pages[i].id, explain: '' });
      });
    }
    return out;
  },

  /* ===== محرر الامتحان ===== */
  editor(exam, { pageIndex = null } = {}) {
    const book = Reader.book;
    const x = exam ? JSON.parse(JSON.stringify(exam)) : { id: 'e' + uid(), bookId: book.id, title: '', created: Date.now(), questions: [], attempts: [] };
    const defPage = pageIndex != null ? Reader.pages[pageIndex].id : null;
    if (!exam && pageIndex != null) {
      x.title = 'امتحان: ' + IdeaWeb.pageInfo(Reader.pages[pageIndex], pageIndex).title;
      x.questions = this.suggest([pageIndex]);
    }
    const blankQ = () => ({ id: 'q' + uid(), q: '', choices: ['', '', '', ''], correct: 0, pageId: defPage, explain: '' });
    if (!x.questions.length) x.questions.push(blankQ());
    const pageOpts = cur => `<option value="">— بدون صفحة —</option>` + Reader.pages.map((p, i) => { const inf = IdeaWeb.pageInfo(p, i); return inf.empty ? '' : `<option value="${p.id}" ${p.id === cur ? 'selected' : ''}>ص ${i + 1} · ${esc(inf.title)}</option>`; }).join('');
    const n = el(`<div class="ex-ed">
      <div class="jf-head">${ic('exam')}<div><h3>${exam ? 'تعديل الامتحان' : 'امتحان جديد'}</h3><p class="muted">لكل سؤال اختار الجواب الصح بالدائرة ⦿، وحدد الصفحة اللي انكتب منها.</p></div></div>
      <input class="inp ex-title" dir="auto" placeholder="اسم الامتحان — مثلاً: امتحان الفصل الأول" value="${esc(x.title)}">
      <div class="row ex-tools">
        <button class="btn ghost sm" data-a="sugpage">${ic('cards')} اقترح أسئلة من أسئلة المراجعة بصفحة…</button>
        <button class="btn ghost sm" data-a="sugbook">${ic('books')} من كل الكتاب</button>
      </div>
      <div class="ex-qs"></div>
      <div class="row"><button class="btn ghost" data-a="addq">${ic('plus')} سؤال</button></div>
      <p class="err ex-err"></p>
      <div class="row end"><button class="btn ghost" data-a="cancel">إلغاء</button><button class="btn primary" data-a="save">حفظ الامتحان</button></div>
    </div>`);
    const m = Modal.open(n, { cls: 'wide ex-modal' });
    const box = $('.ex-qs', n);
    const render = () => {
      box.innerHTML = x.questions.map((q, k) => {
        const L = this.letters(q.q);
        return `<div class="ex-q" data-k="${k}">
          <div class="ex-qh"><span class="ex-n">${k + 1}</span><textarea class="inp" rows="2" dir="auto" data-f="q" placeholder="نص السؤال…">${esc(q.q)}</textarea><button class="ib" data-a="delq" title="حذف السؤال">${ic('trash')}</button></div>
          <div class="ex-chs">${q.choices.map((c, j) => `<label class="ex-ch ${q.correct === j ? 'ok' : ''}"><input type="radio" name="c${k}" data-f="correct" value="${j}" ${q.correct === j ? 'checked' : ''}><b>${L[j] || j + 1}</b><input class="inp" dir="auto" data-f="ch" data-j="${j}" value="${esc(c)}" placeholder="خيار ${L[j] || j + 1}">${q.choices.length > 2 ? `<button class="ib" type="button" data-a="delc" data-j="${j}" title="شيل الخيار">${ic('x')}</button>` : ''}</label>`).join('')}
            ${q.choices.length < 6 ? `<button class="btn ghost sm ex-addc" data-a="addc">${ic('plus')} خيار</button>` : ''}</div>
          <div class="ex-qf"><label>${ic('page')} من صفحة <select class="inp sm" data-f="page">${pageOpts(q.pageId)}</select></label><input class="inp sm" dir="auto" data-f="explain" placeholder="شرح الجواب (اختياري)" value="${esc(q.explain || '')}"></div>
        </div>`;
      }).join('');
    };
    const qOf = t => x.questions[+t.closest('.ex-q').dataset.k];
    n.addEventListener('input', e => {
      const f = e.target.dataset.f; if (!f) return;
      const q = qOf(e.target);
      if (f === 'q') q.q = e.target.value;
      else if (f === 'ch') q.choices[+e.target.dataset.j] = e.target.value;
      else if (f === 'explain') q.explain = e.target.value;
    });
    n.addEventListener('change', e => {
      const f = e.target.dataset.f; if (!f) return;
      const q = qOf(e.target);
      if (f === 'correct') { q.correct = +e.target.value; $$('.ex-ch', e.target.closest('.ex-q')).forEach((l, j) => l.classList.toggle('ok', j === q.correct)); }
      else if (f === 'page') q.pageId = e.target.value || null;
    });
    n.addEventListener('click', async e => {
      const a = e.target.closest('[data-a]'); if (!a) return;
      switch (a.dataset.a) {
        case 'cancel': m.close(); return;
        case 'addq': x.questions.push(blankQ()); render(); box.lastElementChild.querySelector('textarea').focus(); return;
        case 'delq': x.questions.splice(+a.closest('.ex-q').dataset.k, 1); if (!x.questions.length) x.questions.push(blankQ()); render(); return;
        case 'addc': { const q = qOf(a); q.choices.push(''); render(); return; }
        case 'delc': { const q = qOf(a), j = +a.dataset.j; q.choices.splice(j, 1); if (q.correct >= q.choices.length || q.correct === j) q.correct = 0; else if (q.correct > j) q.correct--; render(); return; }
        case 'sugbook': case 'sugpage': {
          let idxs;
          if (a.dataset.a === 'sugbook') idxs = Reader.pages.map((_, i) => i);
          else {
            const pick = await new Promise(res => {
              const sel = el(`<div class="panel"><h4>من أي صفحة؟</h4><select class="inp">${pageOpts(defPage)}</select><button class="btn primary sm">اقترح</button></div>`);
              sel.querySelector('button').onclick = () => { const v = sel.querySelector('select').value; Pop.close(); res(v); };
              Pop.open(a, sel, { cls: 'panel-pop' });
              Pop.onclose = () => res(null);
            });
            if (!pick) return;
            idxs = [Reader.book.pageIds.indexOf(pick)];
          }
          const sug = this.suggest(idxs);
          if (!sug.length) { Toast.show({ icon: 'cards', title: 'ما لقيت أسئلة مراجعة', text: 'حدّد جواب بالصفحة واضغط 🩹 لتعمل سؤال مراجعة، وبحاجة سؤالين على الأقل بالكتاب لتطلع خيارات.', timeout: 6000 }); return; }
          x.questions = x.questions.filter(q => q.q.trim() || q.choices.some(c => c.trim())).concat(sug);
          render();
          Toast.show({ icon: 'cards', text: `انضاف ${sug.length} سؤال — راجعهم وعدّل اللي بدك`, timeout: 3000 });
          return;
        }
        case 'save': {
          x.title = $('.ex-title', n).value.trim() || 'امتحان بدون اسم';
          const qs = x.questions.map(q => ({ ...q, q: q.q.trim(), choices: q.choices.map(c => c.trim()) })).filter(q => q.q || q.choices.some(Boolean));
          for (const [k, q] of qs.entries()) {
            const filled = q.choices.filter(Boolean).length;
            if (!q.q) { $('.ex-err', n).textContent = `السؤال ${k + 1}: اكتب نص السؤال`; return; }
            if (filled < 2) { $('.ex-err', n).textContent = `السؤال ${k + 1}: بحاجة خيارين على الأقل`; return; }
            if (!q.choices[q.correct]) { $('.ex-err', n).textContent = `السؤال ${k + 1}: الجواب الصح فاضي`; return; }
          }
          if (!qs.length) { $('.ex-err', n).textContent = 'ضيف سؤال واحد على الأقل'; return; }
          qs.forEach(q => { const ok = q.choices[q.correct]; q.choices = q.choices.filter(Boolean); q.correct = q.choices.indexOf(ok); });
          x.questions = qs; x.updated = Date.now();
          await DB.put('exams', x);
          m.close();
          Toast.show({ icon: 'exam', title: 'انحفظ الامتحان ✓', text: `${qs.length} سؤال`, timeout: 4000, actions: [{ label: 'ابدأ هلأ', primary: true, act: () => this.take(x) }] });
        }
      }
    });
    render();
    setTimeout(() => $('.ex-title', n).focus(), 60);
  },

  /* ===== قاعة الامتحان ===== */
  take(exam, onlyWrong = null) {
    $$('.toast').forEach(t => t.remove()); // ما بدنا رسائل تغطي الخيارات
    let qs = exam.questions.slice();
    if (onlyWrong) qs = qs.filter(q => onlyWrong.includes(q.id));
    qs = qs.sort(() => Math.random() - .5).map(q => {
      const order = q.choices.map((_, j) => j).sort(() => Math.random() - .5);
      return { ...q, choices: order.map(j => q.choices[j]), correct: order.indexOf(q.correct) };
    });
    this.run = { exam, qs, i: 0, score: 0, wrong: [], answered: false };
    $('#exam')?.remove();
    const ov = el(`<div id="exam" class="exam-ov"><div class="ex-top"><b>${ic('exam')} <span dir="auto">${esc(exam.title)}</span></b><div class="ex-prog"><i></i></div><span class="ex-cnt"></span><button class="ib" data-a="quit" title="إنهاء">${ic('x')}</button></div><div class="ex-stage"></div></div>`);
    document.body.append(ov);
    requestAnimationFrame(() => ov.classList.add('in'));
    ov.addEventListener('click', e => this.onClick(e));
    this.showQ();
  },
  showQ() {
    const R = this.run, ov = $('#exam'), q = R.qs[R.i];
    $('.ex-cnt', ov).textContent = `${R.i + 1} من ${R.qs.length}`;
    $('.ex-prog i', ov).style.width = (R.i / R.qs.length * 100) + '%';
    const L = this.letters(q.q);
    R.answered = false;
    $('.ex-stage', ov).innerHTML = `<div class="ex-card">
      <div class="ex-qtext" dir="auto">${esc(q.q)}</div>
      <div class="ex-opts">${q.choices.map((c, j) => `<button class="ex-opt" data-j="${j}"><b>${L[j] || j + 1}</b><span dir="auto">${esc(c)}</span></button>`).join('')}</div>
      <div class="ex-fb"></div></div>`;
  },
  answer(j) {
    const R = this.run; if (R.answered) return;
    R.answered = true;
    const q = R.qs[R.i], ov = $('#exam'), ok = j === q.correct;
    $$('.ex-opt', ov).forEach((b, k) => { b.disabled = true; b.classList.toggle('right', k === q.correct); b.classList.toggle('wrong', k === j && !ok); });
    if (ok) R.score++; else R.wrong.push(q.id);
    const pi = this.pageIndex(q.pageId);
    const where = pi >= 0 ? `<div class="ex-src">${ic('page')} هالسؤال من <b>صفحة ${pi + 1}</b> <span dir="auto">«${esc(IdeaWeb.pageInfo(Reader.pages[pi], pi).title)}»</span>${ok ? '' : ` <button class="btn ghost sm" data-a="page" data-i="${pi}">${ic('open')} افتح الصفحة</button>`}</div>` : '';
    $('.ex-fb', ov).innerHTML = `<div class="ex-res ${ok ? 'ok' : 'no'}">${ok ? '✓ صح! أحسنت' : `✗ مش هيك — الجواب الصح: <b dir="auto">${esc(q.choices[q.correct])}</b>`}</div>
      ${q.explain ? `<p class="ex-exp" dir="auto">${esc(q.explain)}</p>` : ''}${where}
      <div class="row end"><button class="btn primary" data-a="next">${R.i + 1 < R.qs.length ? 'السؤال التالي ←' : 'النتيجة'}</button></div>`;
    (ok ? Sound.chime(true) : null);
  },
  finish() {
    const R = this.run, ov = $('#exam'), pct = Math.round(R.score / R.qs.length * 100);
    $('.ex-prog i', ov).style.width = '100%';
    const ex = R.exam;
    ex.attempts = (ex.attempts || []).concat({ at: Date.now(), score: R.score, total: R.qs.length, wrong: R.wrong });
    DB.put('exams', ex);
    Study.markToday();
    const wrongQs = R.qs.filter(q => R.wrong.includes(q.id));
    $('.ex-stage', ov).innerHTML = `<div class="ex-card ex-end">
      <div class="ex-ring" style="--pct:${pct}"><b>${pct}%</b></div>
      <h3>${pct >= 90 ? 'ممتاز! 🌟' : pct >= 70 ? 'شغل حلو 👏' : pct >= 50 ? 'مش بطّال — راجع الأخطاء' : 'ولا يهمك، المراجعة بتفرق 💪'}</h3>
      <p class="muted">عرفت ${R.score} من ${R.qs.length}</p>
      ${wrongQs.length ? `<div class="ex-wrongs"><h4>راجع هدول:</h4>${wrongQs.map(q => { const pi = this.pageIndex(q.pageId); return `<div class="ex-w"><span dir="auto">${esc(q.q)}</span>${pi >= 0 ? `<button class="chipbtn" data-a="page" data-i="${pi}">${ic('page')} ص ${pi + 1}</button>` : ''}</div>`; }).join('')}</div>` : ''}
      <div class="row end">${wrongQs.length ? '<button class="btn ghost" data-a="retrywrong">أعد الأخطاء بس</button>' : ''}<button class="btn ghost" data-a="retry">أعد الامتحان</button><button class="btn primary" data-a="quit">تمام</button></div></div>`;
  },
  onClick(e) {
    const o = e.target.closest('.ex-opt'); if (o) { this.answer(+o.dataset.j); return; }
    const a = e.target.closest('[data-a]'); if (!a) return;
    const R = this.run;
    switch (a.dataset.a) {
      case 'next': R.i++; if (R.i < R.qs.length) this.showQ(); else this.finish(); break;
      case 'quit': this.close(); break;
      case 'retry': this.take(R.exam); break;
      case 'retrywrong': this.take(R.exam, R.wrong.slice()); break;
      case 'page': this.peek(+a.dataset.i); break;
    }
  },
  // نفتح الصفحة، ومعنا زر نرجع فيه للامتحان مكان ما وقفنا
  async peek(i) {
    const ov = $('#exam'); ov.classList.add('away');
    await IdeaWeb.go(Reader.book.id, i);
    $('#exResume')?.remove();
    const b = el(`<button id="exResume" class="ex-resume">${ic('exam')} ارجع للامتحان</button>`);
    b.onclick = () => { b.remove(); ov.classList.remove('away'); };
    document.body.append(b);
  },
  close() {
    const ov = $('#exam'); if (!ov) return;
    ov.classList.remove('in'); ov.style.pointerEvents = 'none'; setTimeout(() => ov.remove(), 300);
    $('#exResume')?.remove();
    this.run = null;
  },

  /* ===== استيراد/تصدير JSON ===== */
  exportFile(x) {
    const out = { title: x.title, questions: x.questions.map(q => ({ q: q.q, choices: q.choices, correct: q.correct, page: this.pageIndex(q.pageId) + 1 || null, explain: q.explain || '' })) };
    downloadBlob(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }), x.title + '.exam.json');
  },
  async importFile() {
    const f = await pickFile('.json,application/json'); if (!f) return;
    let data; try { data = JSON.parse(await f.text()); } catch { Toast.show({ icon: 'x', text: 'الملف مش JSON صالح' }); return; }
    const arr = Array.isArray(data) ? data : [data];
    let n = 0;
    for (const d of arr) {
      const qs = (d.questions || []).filter(q => q && q.q && Array.isArray(q.choices) && q.choices.length >= 2).map(q => ({
        id: 'q' + uid(), q: String(q.q), choices: q.choices.map(String), correct: clamp(+q.correct || 0, 0, q.choices.length - 1),
        pageId: q.page && Reader.book.pageIds[q.page - 1] || null, explain: q.explain ? String(q.explain) : '',
      }));
      if (!qs.length) continue;
      await DB.put('exams', { id: 'e' + uid(), bookId: Reader.book.id, title: d.title || 'امتحان مستورد', created: Date.now(), updated: Date.now(), questions: qs, attempts: [], source: 'import' });
      n++;
    }
    Toast.show({ icon: 'exam', text: n ? `انستورد ${n} امتحان ✓` : 'ما لقيت أسئلة صالحة بالملف' });
    if (n) this.panel();
  },
  async removeForBook(bookId) { const ids = (await DB.all('exams')).filter(x => x.bookId === bookId).map(x => x.id); if (ids.length) await DB.delMany('exams', ids); },
};
