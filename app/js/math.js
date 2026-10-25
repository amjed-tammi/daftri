'use strict';
/* ============ معادلات بسيطة: كسور، أسس، جذور، ورموز رياضيات وكيمياء ============
   بتكتبها بطريقة سهلة وبتطلع مرتبة: x^2 ← x²، 1/2 ← كسر فوق تحت، sqrt(x) ← جذر، H_2O، Fe^{3+}، a <=> b.
   بتنحفظ كنص بالصفحة (data-src) فبتتعدّل بضغطة، وبتنطبع وبتطلع بالـPDF زي ما هي. بدون مكتبات. */
const MATH_SYMBOLS = {
  pi: 'π', alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', Delta: 'Δ', theta: 'θ', lambda: 'λ', mu: 'μ', sigma: 'σ', Sigma: 'Σ', omega: 'ω', Omega: 'Ω', phi: 'φ', epsilon: 'ε', rho: 'ρ', tau: 'τ',
  inf: '∞', deg: '°', pm: '±', times: '×', div: '÷', cdot: '·', sum: '∑', int: '∫', approx: '≈', neq: '≠', in: '∈', therefore: '∴', angle: '∠', perp: '⊥', parallel: '∥',
};
const MATH_OPS = { '<=>': '⇌', '<->': '↔', '->': '→', '<-': '←', '>=': '≥', '<=': '≤', '!=': '≠', '~=': '≈', '+-': '±', '*': '×', '=': '=', '+': '+', '-': '−', '<': '<', '>': '>', ',': ',', '|': '|' };
const MATH_FUNCS = new Set(['sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'log', 'ln', 'lim', 'max', 'min', 'exp']);

const MathEq = {
  // نص ← رموز
  tokens(src) {
    const out = [], re = /\s*(<=>|<->|->|<-|>=|<=|!=|~=|\+-|[0-9٠-٩]+(?:[.,٫][0-9٠-٩]+)?|[A-Za-z]+|[؀-ۿ]+|[α-ωΑ-Ω]|\S)/gy;
    let m; while ((m = re.exec(src))) out.push(m[1]);
    return out;
  },
  render(src) {
    const t = this.tokens(String(src || '')); let i = 0;
    const peek = () => t[i], next = () => t[i++];
    const esc2 = s => esc(s);
    // ذرّة: رقم، متغيّر، رمز، (…)، {…}، sqrt(…)
    const atom = () => {
      const k = next(); if (k == null) return '';
      if (k === '(' || k === '[') { const close = k === '(' ? ')' : ']'; const inner = expr(close); if (peek() === close) next(); return `<span class="eq-p">${k}</span>${inner}<span class="eq-p">${close}</span>`; }
      if (k === '{') { const inner = expr('}'); if (peek() === '}') next(); return inner; }
      if (k === 'sqrt' || k === 'root' || k === '√') {
        let deg = '';
        if (k === 'root' && peek() === '(') { next(); deg = expr(','); if (peek() === ',') next(); const inner = expr(')'); if (peek() === ')') next(); return `<span class="eq-sqrt">${deg ? `<sup class="eq-deg">${deg}</sup>` : ''}<span class="eq-rad">√</span><span class="eq-under">${inner}</span></span>`; }
        const inner = peek() === '(' ? (next(), ((x) => (peek() === ')' && next(), x))(expr(')'))) : atom();
        return `<span class="eq-sqrt"><span class="eq-rad">√</span><span class="eq-under">${inner}</span></span>`;
      }
      if (MATH_SYMBOLS[k]) return `<span class="eq-sym">${MATH_SYMBOLS[k]}</span>`;
      if (MATH_FUNCS.has(k)) return `<span class="eq-fn">${k}</span>`;
      if (MATH_OPS[k]) return `<span class="eq-op">${MATH_OPS[k]}</span>`;
      if (/^[0-9٠-٩]/.test(k)) return `<span class="eq-n">${esc2(k)}</span>`;
      if (/^[A-Z]$/.test(k)) return `<span class="eq-el">${k}</span>`; // حرف كبير: عنصر كيميائي (H، O) أو نقطة (A، B) — مستقيم
      if (/^[a-z]$/.test(k)) return `<i class="eq-v">${k}</i>`; // متغيّر: مائل
      if (/^[A-Za-z]+$/.test(k)) return k.length <= 2 && /^[A-Z][a-z]?$/.test(k) ? `<span class="eq-el">${k}</span>` : `<i class="eq-v">${esc2(k)}</i>`; // رموز عناصر كيميائية: H، Fe، Cl
      return `<span>${esc2(k)}</span>`;
    };
    // أسس ودلائل: x^2، H_2، x_1^2
    const power = () => {
      let base = atom();
      while (peek() === '^' || peek() === '_') {
        const op = next(), a = atom();
        base += op === '^' ? `<sup>${a}</sup>` : `<sub>${a}</sub>`;
      }
      return base;
    };
    // كسور: a/b (فوق وتحت)
    const frac = () => {
      let n = power();
      while (peek() === '/') { next(); const d = power(); n = `<span class="eq-frac"><span class="eq-num">${n}</span><span class="eq-den">${d}</span></span>`; }
      return n;
    };
    const expr = stop => { let h = ''; while (i < t.length && peek() !== stop && !(stop === ')' && peek() === ']')) { if (stop === ',' && peek() === ')') break; h += frac(); } return h; };
    let h = '';
    while (i < t.length) { const before = i; h += expr(null); if (i === before) { h += esc2(next()); } }
    return h;
  },
  html(src) { return `<span class="eq" contenteditable="false" dir="ltr" data-src="${esc(src)}">${this.render(src)}</span>`; },
  // نافذة الكتابة: معاينة مباشرة وأزرار جاهزة
  open(l, existing = null) {
    if (!l) { Toast.show({ icon: 'page', text: 'افتح الكتاب أولاً' }); return; }
    const sel = Sel.save();
    const picked = !existing && sel && !sel.collapsed && l.c.contains(sel.commonAncestorContainer) ? sel.toString() : '';
    const src0 = existing ? existing.dataset.src : picked;
    const keys = [['x²', '^2'], ['xₙ', '_'], ['a/b', '/'], ['√', 'sqrt()'], ['( )', '()'], ['π', 'pi'], ['±', '+-'], ['×', '*'], ['÷', 'div'], ['≤', '<='], ['≥', '>='], ['≠', '!='], ['→', '->'], ['⇌', '<=>'], ['°', 'deg'], ['∞', 'inf'], ['Δ', 'Delta'], ['θ', 'theta']];
    const n = el(`<form class="eqf" autocomplete="off">
      <div class="jf-head">${ic('math')}<div><h3>${existing ? 'عدّل المعادلة' : 'معادلة'}</h3><p class="muted sm">اكتب ببساطة: <code>x^2</code> · <code>1/2</code> · <code>sqrt(x)</code> · <code>H_2O</code> · <code>Fe^{3+}</code> · <code>{a+b}/c</code></p></div></div>
      <input class="inp eqf-in" dir="ltr" spellcheck="false" value="${esc(src0)}" placeholder="مثلاً: (x+1)^2 = x^2 + 2x + 1" aria-label="المعادلة">
      <div class="eqf-keys">${keys.map(([lb, ins]) => `<button type="button" data-ins="${esc(ins)}" title="${esc(ins)}">${lb}</button>`).join('')}</div>
      <div class="eqf-prev" aria-live="polite"></div>
      <div class="row end">${existing ? '<button type="button" class="btn ghost" data-a="del">احذفها</button>' : ''}<button type="button" class="btn ghost" data-a="cancel">إلغاء</button><button class="btn primary">${ic('check')} ${existing ? 'تمام' : 'حطّها'}</button></div></form>`);
    const m = Modal.open(n, { cls: 'sm eq-modal' });
    const inp = $('.eqf-in', n), prev = $('.eqf-prev', n);
    const draw = () => { prev.innerHTML = inp.value.trim() ? `<span class="eq" dir="ltr">${this.render(inp.value)}</span>` : '<span class="muted sm">المعاينة بتطلع هون</span>'; };
    inp.addEventListener('input', draw); draw();
    setTimeout(() => { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }, 60);
    n.addEventListener('click', e => {
      const k = e.target.closest('[data-ins]');
      if (k) {
        const ins = k.dataset.ins, a = inp.selectionStart, b = inp.selectionEnd, v = inp.value;
        const wrap = ins === 'sqrt()' || ins === '()';
        const body = wrap ? ins.slice(0, -1) + v.slice(a, b) + ')' : (/^[a-zA-Z]/.test(ins) ? ' ' + ins + ' ' : ins);
        inp.value = v.slice(0, a) + body + v.slice(b);
        const pos = a + (wrap && a === b ? body.length - 1 : body.length);
        inp.focus(); inp.setSelectionRange(pos, pos); draw();
        return;
      }
      const a = e.target.closest('[data-a]'); if (!a) return;
      if (a.dataset.a === 'cancel') m.close();
      else if (a.dataset.a === 'del' && existing) { existing.remove(); m.close(); Editor.changed(l); }
    });
    n.onsubmit = e => {
      e.preventDefault();
      const src = inp.value.trim();
      m.close();
      if (!src) return;
      if (existing) { existing.outerHTML = this.html(src); Editor.changed(l); return; }
      l.c.focus();
      if (sel && l.c.contains(sel.startContainer)) Sel.restore(sel); else Editor.ensureCaret(l);
      document.execCommand('insertHTML', false, this.html(src) + '&nbsp;');
      Editor.changed(l);
    };
  },
};
