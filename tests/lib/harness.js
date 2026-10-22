/* أدوات الاختبار داخل الصفحة: test / expect / mouse / shot … (بتنحقن بكل مرحلة) */
const __T = (() => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let rpcId = 0; const rpcWait = new Map();
  window.__rpcDone = (id, res) => { const f = rpcWait.get(id); if (f) { rpcWait.delete(id); f(res); } };
  const rpc = (cmd, args = {}) => new Promise(res => { const id = ++rpcId; rpcWait.set(id, res); window.__rpc(JSON.stringify({ id, cmd, args })); });
  class Fail extends Error { }
  const show = v => { try { return typeof v === 'string' ? JSON.stringify(v) : JSON.stringify(v); } catch { return String(v); } };
  const expect = v => ({
    toBe: (x, m = '') => { if (v !== x) throw new Fail(`${m} توقعت ${show(x)} وطلع ${show(v)}`); },
    toEqual: (x, m = '') => { if (show(v) !== show(x)) throw new Fail(`${m} توقعت ${show(x)} وطلع ${show(v)}`); },
    toBeTruthy: (m = '') => { if (!v) throw new Fail(`${m} توقعت قيمة صحيحة وطلع ${show(v)}`); },
    toBeFalsy: (m = '') => { if (v) throw new Fail(`${m} توقعت قيمة فاضية وطلع ${show(v)}`); },
    toBeGreaterThan: (x, m = '') => { if (!(v > x)) throw new Fail(`${m} توقعت أكبر من ${x} وطلع ${show(v)}`); },
    toBeLessThan: (x, m = '') => { if (!(v < x)) throw new Fail(`${m} توقعت أقل من ${x} وطلع ${show(v)}`); },
    toContain: (x, m = '') => { if (!(v && v.includes && v.includes(x))) throw new Fail(`${m} توقعت يحتوي ${show(x)} وطلع ${show(v)}`); },
    toHaveLength: (n, m = '') => { if (!v || v.length !== n) throw new Fail(`${m} توقعت طول ${n} وطلع ${v && v.length}`); },
  });
  const waitFor = async (fn, ms = 6000, msg = 'الشرط') => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { const r = await fn(); if (r) return r; } catch { } await sleep(60); } throw new Fail(`انتظرت ${ms}ms وما تحقق: ${msg}`); };
  const center = elOrSel => { const e = typeof elOrSel === 'string' ? document.querySelector(elOrSel) : elOrSel; if (!e) throw new Fail('ما لقيت العنصر ' + elOrSel); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, el: e }; };
  // نستنى العنصر يوقف حركته (أنيميشن فتح النوافذ) قبل ما نضغط عليه
  const settled = async elOrSel => {
    let last = null;
    const e0 = typeof elOrSel === 'string' ? document.querySelector(elOrSel) : elOrSel;
    if (e0 && !inView(e0)) { e0.scrollIntoView({ block: 'center', inline: 'center' }); await sleep(200); } // مثل المستخدم: بيعمل سكرول للزر
    for (let i = 0; i < 30; i++) {
      const e = typeof elOrSel === 'string' ? document.querySelector(elOrSel) : elOrSel;
      if (e) { const r = e.getBoundingClientRect(), k = `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)}`; if (k === last && r.width) return center(e); last = k; }
      await sleep(50);
    }
    return center(elOrSel);
  };
  // ماوس حقيقي (أحداث المتصفح نفسه، مش محاكاة جافاسكربت)
  const mouse = {
    click: async t => { const c = await settled(t); await rpc('mouse', { events: [{ type: 'mouseMoved', x: c.x, y: c.y, buttons: 0 }, { type: 'mousePressed', x: c.x, y: c.y }, { type: 'mouseReleased', x: c.x, y: c.y }] }); await sleep(120); },
    move: async (x, y) => rpc('mouse', { events: [{ type: 'mouseMoved', x, y, buttons: 0 }] }),
    drag: async (x0, y0, x1, y1, steps = 14) => {
      const ev = [{ type: 'mouseMoved', x: x0, y: y0, buttons: 0 }, { type: 'mousePressed', x: x0, y: y0 }];
      for (let i = 1; i <= steps; i++) ev.push({ type: 'mouseMoved', x: x0 + (x1 - x0) * i / steps, y: y0 + (y1 - y0) * i / steps });
      ev.push({ type: 'mouseReleased', x: x1, y: y1 });
      await rpc('mouse', { events: ev }); await sleep(150);
    },
  };
  const key = (key, code, modifiers = 0) => rpc('key', { key, code, modifiers, ...(key === 'Enter' && !modifiers ? { text: '\r', unmodifiedText: '\r' } : {}), windowsVirtualKeyCode: ({ Enter: 13, Escape: 27, PageDown: 34, PageUp: 33, ArrowLeft: 37, ArrowRight: 39, Tab: 9 })[key] || (key.length === 1 ? key.toUpperCase().charCodeAt(0) : 0) });
  const typeText = text => rpc('text', { text });
  // تهدئة التطبيق للاختبار: بدون جولة، بدون رسائل
  let allowTour = false;
  const quiet = () => {
    if (!allowTour && typeof Tour !== 'undefined' && !Tour.__orig) { Tour.__orig = Tour.maybe; Tour.maybe = () => { }; }
    ['lib', 'book'].forEach(n => { localStorage.setItem('tour-' + n, '1'); localStorage.setItem('tourv-' + n, String(typeof TOUR_V !== 'undefined' ? TOUR_V : 99)); });
    if (typeof Tour !== 'undefined' && Tour.active) Tour.end(false);
    document.querySelectorAll('.toast').forEach(t => t.remove());
  };
  const clean = () => { if (!allowTour) document.querySelectorAll('.toast').forEach(t => t.remove()); if (typeof Pop !== 'undefined') Pop.close(); document.querySelectorAll('.modal-back').forEach(m => m.remove()); if (!allowTour && typeof Tour !== 'undefined' && Tour.active) Tour.end(false); };
  // كتاب جاهز للاختبار
  const makeBook = async (title = 'كتاب اختبار', extra = {}) => {
    const b = { id: 'k' + uid(), title, author: '', dir: 'rtl', cover: { color: '#1d2b53', image: null }, paper: Settings.newPaper(), series: null, pageIds: [], created: Date.now(), updated: Date.now(), lastSpread: 0, ...extra };
    const pages = (extra.htmls || ['', '', '', '']).map(h => ({ id: 'p' + uid(), bookId: b.id, html: h, stickies: [], attach: [] }));
    delete b.htmls;
    pages.forEach(p => b.pageIds.push(p.id));
    await DB.putMany('pages', pages); await DB.put('books', b);
    await Library.load();
    return b;
  };
  // فحص بصري عام: عناصر بتطلع برا الشاشة أو متداخلة
  const inView = e => { const r = e.getBoundingClientRect(); return r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1; };
  const overlap = (a, b) => { const r = a.getBoundingClientRect(), s = b.getBoundingClientRect(); return !(r.right <= s.left || s.right <= r.left || r.bottom <= s.top || s.bottom <= r.top); };

  async function runPhase(SUITE, ph, suiteName) {
    const tests = [];
    let cur = null;
    const T = {
      sleep, expect, waitFor, mouse, key, typeText, quiet, clean, makeBook, inView, overlap, center,
      shot: async name => { const p = await rpc('shot', { suite: suiteName, name }); if (cur) (cur.shots = cur.shots || []).push(p); return p; },
      viewport: async (w, h) => { await rpc('viewport', { w, h }); await sleep(350); },
      metrics: () => rpc('metrics'),
      // ملف حقيقي من tests/fixtures كـ File
      fixture: async (name, type = '') => { const b64 = await rpc('fixture', { name }); const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new File([u], name, { type }); },
      gc: () => rpc('gc'),
      info: v => { if (cur) cur.info = v; },
      test: async (name, fn) => {
        cur = { name, ok: true, ms: 0 };
        const t0 = performance.now();
        try { await fn(); } catch (e) { cur.ok = false; cur.err = (e && e.message || String(e)) + (e instanceof Fail ? '' : '\n' + String(e && e.stack || '').split('\n').slice(1, 3).join('\n')); try { await T.shot('FAIL-' + tests.length); } catch { } }
        cur.ms = Math.round(performance.now() - t0);
        tests.push(cur); cur = null;
        clean();
      },
    };
    allowTour = !!SUITE.allowTour;
    if (!allowTour) quiet();
    T.allowTour = () => { if (Tour.__orig) { Tour.maybe = Tour.__orig; delete Tour.__orig; } };
    await SUITE.phases[ph](T);
    return { title: SUITE.title, tests };
  }
  return { runPhase };
})();
