'use strict';
/* ============ الخطوط: خط عربي وخط إنجليزي منفصلين (من خطوط ويندوز الموجودة) ============ */
const FontKit = {
  // [اسم الخط بالويندوز, الاسم الظاهر, تكبير العربي الافتراضي %]
  AR: [
    ['Sakkal Majalla', 'مجلة — نسخ أنيق', 128], ['Traditional Arabic', 'تقليدي', 122], ['Arabic Typesetting', 'تنضيد — مصحفي', 145],
    ['Simplified Arabic', 'مبسّط', 104], ['Aldhabi', 'الذهبي — زخرفي', 118], ['Andalus', 'أندلس', 100],
    ['Urdu Typesetting', 'نستعليق', 135], ['Microsoft Uighur', 'أويغور', 135], ['Segoe UI', 'سيغو — حديث', 100],
    ['Tahoma', 'تاهوما', 96], ['Arial', 'آريال', 100], ['Times New Roman', 'تايمز', 112],
    ['Courier New', 'كورير — آلة كاتبة', 100], ['Microsoft Sans Serif', 'مايكروسوفت', 100],
  ],
  EN: [
    ['Ink Free', 'Ink Free ✍'], ['Segoe Print', 'Segoe Print ✍'], ['Segoe Script', 'Segoe Script ✍'],
    ['Lucida Handwriting', 'Lucida Handwriting ✍'], ['Bradley Hand ITC', 'Bradley Hand ✍'], ['Comic Sans MS', 'Comic Sans'],
    ['Gabriola', 'Gabriola'], ['Georgia', 'Georgia'], ['Cambria', 'Cambria'], ['Palatino Linotype', 'Palatino'],
    ['Constantia', 'Constantia'], ['Times New Roman', 'Times New Roman'], ['Segoe UI', 'Segoe UI'], ['Calibri', 'Calibri'],
    ['Candara', 'Candara'], ['Corbel', 'Corbel'], ['Bahnschrift', 'Bahnschrift'], ['Verdana', 'Verdana'],
    ['Consolas', 'Consolas'], ['Cascadia Code', 'Cascadia Code'], ['Courier New', 'Courier New'],
  ],
  PRESETS: {
    hand: { ar: 'Sakkal Majalla', en: 'Ink Free' },
    classic: { ar: 'Traditional Arabic', en: 'Georgia' },
    modern: { ar: 'Segoe UI', en: 'Segoe UI' },
    type: { ar: 'Courier New', en: 'Courier New' },
  },
  _avail: new Map(),
  // هل الخط موجود على الجهاز؟ (نقيس عرض النص مقارنة بخط احتياطي)
  has(name, sample) {
    const key = name + '|' + sample;
    if (this._avail.has(key)) return this._avail.get(key);
    const c = this._c || (this._c = document.createElement('canvas').getContext('2d'));
    let ok = false;
    for (const base of ['monospace', 'serif', 'sans-serif']) {
      c.font = `40px ${base}`; const w0 = c.measureText(sample).width;
      c.font = `40px "${name}", ${base}`; const w1 = c.measureText(sample).width;
      if (Math.abs(w0 - w1) > 0.5) { ok = true; break; }
    }
    this._avail.set(key, ok);
    return ok;
  },
  list(kind) {
    const sample = kind === 'ar' ? 'أبجد هوز حطي كلمن' : 'The quick brown fox 0123';
    return (kind === 'ar' ? this.AR : this.EN).filter(([n]) => this.has(n, sample));
  },
  ar(p) { return p.fontAr || (this.PRESETS[p.font] || this.PRESETS.hand).ar; },
  en(p) { return p.fontEn || (this.PRESETS[p.font] || this.PRESETS.hand).en; },
  label(kind, name) { const f = (kind === 'ar' ? this.AR : this.EN).find(x => x[0] === name); return f ? f[1] : name; },
  enStack(p) { return `"${this.en(p)}"`; },
  apply(p) {
    const ar = this.ar(p);
    const base = (this.AR.find(x => x[0] === ar) || [0, 0, 100])[2];
    const adj = Math.round(base * (p.arScale || 100) / 100);
    const range = 'U+0600-06FF, U+0750-077F, U+08A0-08FF, U+FB50-FDFF, U+FE70-FEFF';
    const css = `@font-face{font-family:"DfAr";src:local("${ar}");size-adjust:${adj}%;unicode-range:${range};}
@font-face{font-family:"DfAr";src:local("${ar} Bold");font-weight:700;size-adjust:${adj}%;unicode-range:${range};}`;
    let st = $('#bookFonts');
    if (!st) { st = document.createElement('style'); st.id = 'bookFonts'; document.head.append(st); }
    if (st.textContent !== css) st.textContent = css;
    const en = this.enStack(p);
    ['#book', '#print'].forEach(s => { const x = $(s); if (x) x.style.setProperty('--font-en', en); });
  },
  fillList(box, kind, current) {
    const items = this.list(kind);
    const sample = kind === 'ar' ? 'الدرس الأول: المتغيرات' : 'Lesson 1: Variables';
    box.innerHTML = items.map(([n, t, adj = 100]) => `<button class="fontopt ${n === current ? 'on' : ''}" data-font="${esc(n)}"><b style="font-family:'${esc(n)}';font-size:${Math.round(18 * adj / 100)}px">${esc(sample)}</b><small>${esc(t)}</small></button>`).join('') || '<p class="muted sm">ما لقيت خطوط إضافية</p>';
  },
  // قائمة لتغيير خط/حجم النص المحدد فقط
  selectionPanel(anchor, l) {
    const saved = Sel.save();
    const fonts = [...this.list('ar').map(x => [x[0], x[1]]), ...this.list('en').map(x => [x[0], x[1]])]
      .filter((x, i, a) => a.findIndex(y => y[0] === x[0]) === i);
    const n = el(`<div class="panel selfont">
      <h4>حجم النص المحدد</h4>
      <div class="seg" data-k="size"><button data-v=".85">صغير</button><button data-v="1">عادي</button><button data-v="1.25">كبير</button><button data-v="1.5">أكبر</button></div>
      <h4>خط النص المحدد</h4>
      <div class="fontlist">${fonts.map(([f, t]) => `<button class="fontopt" data-font="${esc(f)}"><b style="font-family:'${esc(f)}'">${esc(t)} · Aa أب</b></button>`).join('')}</div>
      <button class="btn ghost sm" data-k="reset">رجّع خط الكتاب</button>
    </div>`);
    n.addEventListener('mousedown', e => { if (e.target.closest('button')) e.preventDefault(); });
    n.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      l.c.focus(); Sel.restore(saved);
      if (b.dataset.v) this.sizeSel(l, +b.dataset.v);
      else if (b.dataset.font) document.execCommand('fontName', false, b.dataset.font);
      else if (b.dataset.k === 'reset') {
        const r = getSelection().getRangeAt(0);
        $$('span, font', l.c).filter(s => r.intersectsNode(s)).forEach(s => { s.style.fontFamily = ''; s.removeAttribute('face'); if (!s.getAttribute('style')) s.removeAttribute('style'); });
      }
      Editor.changed(l);
    });
    Pop.open(anchor, n, { cls: 'panel-pop' });
  },
  sizeSel(l, v) {
    document.execCommand('styleWithCSS', false, true);
    document.execCommand('fontSize', false, '7');
    $$('font[size="7"]', l.c).forEach(f => { const s = document.createElement('span'); s.append(...f.childNodes); f.replaceWith(s); s.style.fontSize = v === 1 ? '' : v + 'em'; });
    $$('span', l.c).filter(s => s.style.fontSize === 'xxx-large' || s.style.fontSize === '-webkit-xxx-large').forEach(s => { s.style.fontSize = v === 1 ? '' : v + 'em'; if (!s.getAttribute('style')) s.removeAttribute('style'); });
  },
};
