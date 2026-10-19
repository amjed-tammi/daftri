'use strict';
/* ============ شبكة الأفكار: ربط الصفحات ببعض، والشبكة بتنبني من الخيوط نفسها ============ */
const IdeaWeb = {
  links: [],

  async load() { this.links = (await DB.all('links')) || []; },
  of(pageId) { return this.links.filter(x => x.a === pageId || x.b === pageId); },
  other(x, pageId) { return x.a === pageId ? { pageId: x.b, bookId: x.bb } : { pageId: x.a, bookId: x.ab }; },
  linked(p1, p2) { return this.links.find(x => (x.a === p1 && x.b === p2) || (x.a === p2 && x.b === p1)) || null; },

  // الكتب اللي مسموح الربط معها: نفس الكتاب + كتب نفس السلسلة
  async scopeBooks(book) {
    const all = await DB.all('books');
    if (!book.series || !book.series.name) return [all.find(b => b.id === book.id) || book];
    const k = normTitle(book.series.name);
    return all.filter(b => b.id === book.id || (b.series && normTitle(b.series.name) === k)).sort((a, b) => (+(a.series && a.series.part) || 0) - (+(b.series && b.series.part) || 0));
  },
  pageInfo(p, i) {
    const html = (p && p.html) || '';
    const m = html.match(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/i);
    const text = htmlText(html).replace(/\s+/g, ' ').trim();
    const head = m ? htmlText(m[1]).trim() : '';
    const title = head || text.slice(0, 38) || (p && (p.stickies || []).length ? 'ملاحظات لاصقة' : '');
    const rest = head ? text.replace(head, '').trim() : text.slice(38).trim();
    return { title: title || `صفحة ${i + 1}`, snippet: rest.slice(0, 110), empty: !text && !(p && (p.stickies || []).length) };
  },
  async pagesOf(book) {
    if (Reader.book && Reader.book.id === book.id) { Editor.flushAll(); return Reader.pages; }
    return (await DB.getMany('pages', book.pageIds || [])).map((p, i) => p || { id: book.pageIds[i], html: '' });
  },

  async add(pa, ba, pb, bb, note = '') {
    if (pa === pb || this.linked(pa, pb)) return null;
    const x = { id: 'w' + uid(), a: pa, ab: ba, b: pb, bb, note, at: Date.now() };
    await DB.put('links', x);
    this.links.push(x);
    this.refreshBadges();
    return x;
  },
  async remove(id) {
    await DB.del('links', id);
    this.links = this.links.filter(x => x.id !== id);
    this.refreshBadges();
  },
  async removeForPages(ids) {
    const set = new Set(ids);
    const gone = this.links.filter(x => set.has(x.a) || set.has(x.b));
    if (gone.length) await DB.delMany('links', gone.map(x => x.id));
    this.links = this.links.filter(x => !gone.includes(x));
  },

  /* ===== شارة صغيرة تحت الصفحة ===== */
  badge(pg, p) {
    $('.iw-badge', pg)?.remove();
    const n = this.of(p.id).length;
    const b = el(`<button class="iw-badge ${n ? '' : 'zero'}" title="${n ? `مربوطة بـ ${n} ${n === 1 ? 'صفحة' : 'صفحات'} — اضغط لتشوفهم` : 'اربط هالصفحة بصفحات ثانية'}">${ic('web')}${n ? `<span>${n}</span>` : ''}</button>`);
    b.addEventListener('mousedown', e => e.stopPropagation());
    b.onclick = e => { e.stopPropagation(); n ? this.open(p.id) : this.picker(p, +pg.dataset.i); };
    pg.append(b);
  },
  refreshBadges() { Editor.live.forEach(l => { if (l.pg.isConnected) this.badge(l.pg, l.p); }); },
  async go(bookId, idx) {
    if (!Reader.book || Reader.book.id !== bookId) await Reader.open(bookId, idx);
    else await Reader.showPage(idx);
    const pg = $(`#bookInner .slot .page[data-i="${idx}"]`);
    if (pg) { pg.classList.remove('arrive'); void pg.offsetWidth; pg.classList.add('arrive'); setTimeout(() => pg.classList.remove('arrive'), 1600); }
  },

  /* ===== نافذة الربط: بطاقات ورق، ضغطة بتربط وضغطة بتفك ===== */
  async picker(p, i, onDone = null) {
    const from = Reader.book;
    const books = await this.scopeBooks(from);
    const data = [];
    for (const b of books) {
      const pages = await this.pagesOf(b);
      pages.forEach((pp, k) => { if (!pp) return; const inf = this.pageInfo(pp, k); if (!inf.empty && pp.id !== p.id) data.push({ b, k, pp, inf }); });
    }
    const me = this.pageInfo(p, i);
    let bookSel = from.id;
    const n = el(`<div class="iw-pick">
      <div class="ip-head">
        <div class="ip-me"><b>ص ${i + 1}</b><span>${esc(me.title)}</span></div>
        <div class="ip-thread"><i></i></div>
        <div class="ip-txt"><h3>اربطها بأفكار ثانية</h3><p class="muted">اضغط على أي صفحة لتربطها، واضغط مرة ثانية لتفك الربط.${books.length > 1 ? ' بتقدر تربط مع كتب نفس السلسلة كمان.' : ''}</p></div>
      </div>
      <div class="ip-bar">
        ${books.length > 1 ? `<div class="ip-books">${books.map(b => `<button data-b="${b.id}" style="--bc:${(b.cover && b.cover.color) || '#1d2b53'}">${b.series ? `<small>ج${b.series.part}</small>` : ''}${esc(b.title)}</button>`).join('')}</div>` : ''}
        <label class="ip-search">${ic('search')}<input placeholder="دوّر على صفحة…"></label>
      </div>
      <div class="ip-grid"></div>
      <div class="row end"><span class="ip-count muted"></span><button class="btn primary" data-a="done">تمام</button></div>
    </div>`);
    const m = Modal.open(n, { cls: 'wide iw-modal', onClose: () => onDone && onDone() });
    const grid = $('.ip-grid', n), q = $('input', n);
    const render = () => {
      const s = normMap(q.value.trim()).n;
      const rows = data.filter(d => (s ? true : d.b.id === bookSel) && (!s || normMap(d.inf.title + ' ' + d.inf.snippet).n.includes(s)));
      grid.innerHTML = rows.map(d => {
        const on = !!this.linked(p.id, d.pp.id);
        return `<button class="ip-card ${on ? 'on' : ''}" data-pid="${d.pp.id}" data-bid="${d.b.id}" style="--bc:${(d.b.cover && d.b.cover.color) || '#1d2b53'}">
          <span class="ip-num">${d.k + 1}</span>${d.b.id !== from.id ? `<span class="ip-bk">${esc(d.b.series ? 'ج' + d.b.series.part : d.b.title)}</span>` : ''}
          <strong>${esc(d.inf.title)}</strong><small>${esc(d.inf.snippet)}</small>
          <em class="ip-tick">${ic('web')} مربوطة</em></button>`;
      }).join('') || '<p class="muted empty-j">ما في صفحات مكتوبة هون لسا ✍</p>';
      $$('.ip-books button', n).forEach(x => x.classList.toggle('on', !s && x.dataset.b === bookSel));
      const c = this.of(p.id).length;
      $('.ip-count', n).textContent = c ? `مربوطة بـ ${c} ${c === 1 ? 'صفحة' : 'صفحات'}` : '';
    };
    n.addEventListener('click', async e => {
      if (e.target.closest('[data-a=done]')) { m.close(); return; }
      const bb = e.target.closest('[data-b]'); if (bb) { bookSel = bb.dataset.b; q.value = ''; render(); return; }
      const c = e.target.closest('.ip-card'); if (!c) return;
      const ex = this.linked(p.id, c.dataset.pid);
      if (ex) { await this.remove(ex.id); c.classList.remove('on'); }
      else { await this.add(p.id, from.id, c.dataset.pid, c.dataset.bid); c.classList.add('on', 'pop'); setTimeout(() => c.classList.remove('pop'), 600); }
      const k = this.of(p.id).length;
      $('.ip-count', n).textContent = k ? `مربوطة بـ ${k} ${k === 1 ? 'صفحة' : 'صفحات'}` : '';
    });
    q.addEventListener('input', render);
    render();
    setTimeout(() => q.focus(), 60);
  },

  /* ===== الشبكة ===== */
  async open(centerId = null) {
    if (!Reader.book) return;
    Pop.close(); Editor.hideBars();
    if (!centerId) { const l = Editor.live.get(Editor.curPage) || [...Editor.live.values()][0]; centerId = l ? l.p.id : null; }
    const books = await this.scopeBooks(Reader.book);
    const tints = ['#e8c77a', '#8fb4ff', '#9fe0b5', '#f4a3c0', '#c7a6ff', '#ffb38a'];
    const all = new Map();
    for (const [bi, b] of books.entries()) {
      const pages = await this.pagesOf(b);
      pages.forEach((p, k) => { if (p) { const inf = this.pageInfo(p, k); all.set(p.id, { id: p.id, bookId: b.id, bi, k, title: inf.title, empty: inf.empty, tint: tints[bi % tints.length] }); } });
    }
    if (!all.has(centerId)) centerId = [...all.keys()][0];
    this.S = { books, all, centerId, tints };
    this.build();
  },
  // الشبكة بتنبني حول الصفحة اللي بالنص: المربوطة فيها حلقة أولى، واللي بعدها حلقة ثانية…
  graph() {
    const { all, centerId } = this.S;
    const edges = this.links.filter(x => all.has(x.a) && all.has(x.b));
    const adj = new Map(); edges.forEach(x => { (adj.get(x.a) || adj.set(x.a, []).get(x.a)).push(x.b); (adj.get(x.b) || adj.set(x.b, []).get(x.b)).push(x.a); });
    const level = new Map([[centerId, 0]]), parent = new Map(), order = [centerId];
    for (let i = 0; i < order.length; i++) for (const nb of adj.get(order[i]) || []) if (!level.has(nb)) { level.set(nb, level.get(order[i]) + 1); parent.set(nb, order[i]); order.push(nb); }
    const nodes = order.map(id => ({ ...all.get(id), lv: level.get(id) }));
    // صفحات غير مربوطة بالمركز: بتطلع بحلقة خارجية باهتة لتقدر تربطها بالسحب
    const lonely = [...all.values()].filter(n => !level.has(n.id) && !n.empty).slice(0, 40).map(n => ({ ...n, lv: -1 }));
    // الزوايا
    const maxLv = Math.max(0, ...nodes.map(n => n.lv));
    const ring = lv => 250 + (lv - 1) * 200;
    const angle = new Map([[centerId, 0]]);
    const L1 = nodes.filter(n => n.lv === 1).sort((a, b) => a.bi - b.bi || a.k - b.k);
    L1.forEach((n, i) => angle.set(n.id, -Math.PI / 2 + i * 2 * Math.PI / L1.length));
    for (let lv = 2; lv <= maxLv; lv++) {
      const L = nodes.filter(n => n.lv === lv);
      const groups = new Map(); L.forEach(n => { const pa = parent.get(n.id); (groups.get(pa) || groups.set(pa, []).get(pa)).push(n); });
      groups.forEach((kids, pa) => {
        const base = angle.get(pa) || 0, spread = Math.min(.42, 1.6 / Math.max(1, kids.length + 1) * (ring(lv - 1) / ring(lv)));
        kids.forEach((n, i) => angle.set(n.id, base + (i - (kids.length - 1) / 2) * spread));
      });
    }
    nodes.forEach(n => {
      if (n.lv === 0) { n.x = 0; n.y = 0; return; }
      const a = angle.get(n.id), r = ring(n.lv);
      n.x = Math.cos(a) * r * 1.15; n.y = Math.sin(a) * r * .78; n.a = a;
    });
    const outer = ring(maxLv + 1) + 30;
    lonely.forEach((n, i) => { const a = -Math.PI / 2 + (i + .5) * 2 * Math.PI / Math.max(lonely.length, 6); n.x = Math.cos(a) * outer * 1.15; n.y = Math.sin(a) * outer * .78; n.a = a; });
    const list = [...nodes, ...lonely];
    // نبعد البطاقات المتداخلة
    const BW = 196, BH = 84;
    for (let pass = 0; pass < 140; pass++) {
      let moved = false;
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j], ox = BW - Math.abs(b.x - a.x), oy = BH - Math.abs(b.y - a.y);
        if (ox > 0 && oy > 0) {
          moved = true;
          const fa = a.lv === 0 ? 0 : 1, fb = b.lv === 0 ? 0 : 1, tot = fa + fb || 1;
          if (ox / BW < oy / BH) { const s = (b.x >= a.x ? 1 : -1) * ox; a.x -= s * fa / tot; b.x += s * fb / tot; }
          else { const s = (b.y >= a.y ? 1 : -1) * oy; a.y -= s * fa / tot; b.y += s * fb / tot; }
        }
      }
      if (!moved) break;
    }
    // خيوط الحلقات: بتوصل الصفحات اللي بنفس الحلقة ببعض لتطلع شكل الشبكة
    const rings = [];
    for (let lv = 1; lv <= maxLv; lv++) {
      const L = nodes.filter(n => n.lv === lv).sort((a, b) => Math.atan2(a.y, a.x) - Math.atan2(b.y, b.x));
      if (L.length >= 3) L.forEach((n, i) => rings.push([n, L[(i + 1) % L.length], lv]));
    }
    return { list, edges, rings, byId: new Map(list.map(n => [n.id, n])) };
  },
  curve(a, b, sag = .12) {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    // الخيط بيرتخي شوي باتجاه المركز مثل خيط العنكبوت الحقيقي
    const cx = mx * (1 - sag), cy = my * (1 - sag) + 10;
    return { d: `M${a.x},${a.y} Q${cx},${cy} ${b.x},${b.y}`, cx, cy };
  },
  build(spin = true) {
    const S = this.S, G = this.graph(); S.G = G;
    let ov = $('#iw');
    const first = !ov;
    if (first) {
      ov = el(`<div id="iw" class="iw">
        <div class="iw-top">
          <div class="iw-title">${ic('web')} <b>شبكة الأفكار</b> <small>${esc(S.books.length > 1 ? 'سلسلة ' + S.books[0].series.name : S.books[0].title)}</small></div>
          <div class="iw-legend">${S.books.length > 1 ? S.books.map((b, i) => `<span><i style="background:${S.tints[i % S.tints.length]}"></i>${b.series ? 'ج' + b.series.part : ''} ${esc(b.title)}</span>`).join('') : ''}</div>
          <div class="iw-acts"><button class="ib" data-a="close" title="إغلاق (Esc)">${ic('x')}</button></div>
        </div>
        <div class="iw-stage"><div class="iw-world">
          <svg class="iw-svg" width="1" height="1"><g class="iw-silk"></g><g class="iw-edges"></g><g class="iw-dew"></g><path class="iw-temp" d=""/></svg>
          <div class="iw-nodes"></div>
        </div></div>
        <div class="iw-hint"></div>
      </div>`);
      document.body.append(ov);
      this.wire(ov);
    }
    const center = G.byId.get(S.centerId);
    // الخيوط
    $('.iw-silk', ov).innerHTML = G.rings.map(([a, b, lv]) => `<path class="silk" data-lv="${lv}" d="${this.curve(a, b, .1).d}"/>`).join('');
    let dew = '';
    $('.iw-edges', ov).innerHTML = G.edges.map(x => {
      const a = G.byId.get(x.a), b = G.byId.get(x.b); if (!a || !b) return '';
      const c = this.curve(a, b, a.lv === 0 || b.lv === 0 ? .04 : .14);
      [.3, .62].forEach(t => { const px = (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * c.cx + t * t * b.x, py = (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * c.cy + t * t * b.y; dew += `<circle class="dew" cx="${px}" cy="${py}" r="2.2" style="animation-delay:${(Math.random() * 4).toFixed(2)}s"/>`; });
      return `<path class="thread" data-a="${x.a}" data-b="${x.b}" data-lv="${Math.max(a.lv, b.lv)}" d="${c.d}"><title>${esc(x.note || 'مرتبطين')}</title></path>`;
    }).join('');
    $('.iw-dew', ov).innerHTML = dew;
    // البطاقات (موجودة بتتحرك لمكانها الجديد بنعومة)
    const box = $('.iw-nodes', ov), seen = new Set();
    G.list.forEach(n => {
      seen.add(n.id);
      let d = box.querySelector(`[data-id="${n.id}"]`);
      if (!d) {
        d = el(`<div class="iw-node" data-id="${n.id}"><i class="iw-pin" title="اسحبني لصفحة ثانية لتربطهم 🧵"></i><b>ص ${n.k + 1}${S.books.length > 1 ? ` · ج${S.books[n.bi].series ? S.books[n.bi].series.part : ''}` : ''}</b><span>${esc(n.title)}</span></div>`);
        d.style.left = (center ? center.x : 0) + 'px'; d.style.top = (center ? center.y : 0) + 'px';
        box.append(d);
      }
      d.style.setProperty('--tint', n.tint);
      d.classList.toggle('center', n.lv === 0);
      d.classList.toggle('lonely', n.lv === -1);
      requestAnimationFrame(() => { d.style.left = n.x + 'px'; d.style.top = n.y + 'px'; });
    });
    $$('.iw-node', box).forEach(d => { if (!seen.has(d.dataset.id)) d.remove(); });
    // الخيوط بتنغزل: بتنرسم من البداية للنهاية
    if (spin) {
      const paths = $$('.iw-silk path, .iw-edges path', ov);
      paths.forEach(p => { const L = p.getTotalLength(); p.style.transition = 'none'; p.style.strokeDasharray = L; p.style.strokeDashoffset = L; });
      ov.classList.add('spinning');
      requestAnimationFrame(() => requestAnimationFrame(() => {
        paths.forEach(p => {
          const lv = +p.dataset.lv || 1, delay = (p.classList.contains('silk') ? 500 : 250) + lv * 260 + Math.random() * 180;
          p.style.transition = `stroke-dashoffset 1s cubic-bezier(.4,0,.2,1) ${delay}ms`;
          p.style.strokeDashoffset = 0;
        });
        setTimeout(() => ov.classList.remove('spinning'), 1900);
      }));
    }
    const hint = $('.iw-hint', ov);
    hint.innerHTML = G.edges.length
      ? `<span>اضغط صفحة لتفوت عليها</span><span>دبل كليك = خليها بالنص</span><span>🧵 اسحب الخرزة الذهبية من صفحة لصفحة لتربطهم</span>`
      : `<span>🧵 الشبكة فاضية لسا — اسحب الخرزة الذهبية من الصفحة اللي بالنص لأي صفحة حواليها، وشوف الخيط كيف بينغزل</span>`;
    if (first) this.camera(ov, center);
  },
  camera(ov, center) {
    const world = $('.iw-world', ov), stage = $('.iw-stage', ov);
    const v = this.view = { x: 0, y: 0, k: 1 };
    this.apply = (anim = false) => { world.classList.toggle('anim', anim); world.style.transform = `translate(${v.x}px,${v.y}px) scale(${v.k})`; };
    const W = () => stage.clientWidth, H = () => stage.clientHeight;
    this.fit = () => {
      const L = this.S.G.list;
      const xs = L.map(n => n.x), ys = L.map(n => n.y);
      const x0 = Math.min(...xs) - 130, x1 = Math.max(...xs) + 130, y0 = Math.min(...ys) - 80, y1 = Math.max(...ys) + 80;
      v.k = clamp(Math.min(W() / (x1 - x0), H() / (y1 - y0)), .3, 1.25);
      v.x = W() / 2 - (x0 + x1) / 2 * v.k; v.y = H() / 2 - (y0 + y1) / 2 * v.k;
    };
    const c = center || { x: 0, y: 0 };
    v.k = 3; v.x = W() / 2 - c.x * 3; v.y = H() / 2 - c.y * 3; this.apply();
    requestAnimationFrame(() => requestAnimationFrame(() => { ov.classList.add('in'); this.fit(); this.apply(true); }));
  },
  toWorld(ov, cx, cy) { const r = $('.iw-stage', ov).getBoundingClientRect(), v = this.view; return { x: (cx - r.left - v.x) / v.k, y: (cy - r.top - v.y) / v.k }; },
  wire(ov) {
    const stage = $('.iw-stage', ov), box = $('.iw-nodes', ov), temp = $('.iw-temp', ov);
    let pan = null, thread = null, clickT = 0;
    const close = () => { ov.classList.add('out'); setTimeout(() => ov.remove(), 280); document.removeEventListener('keydown', key, true); };
    const key = e => { if (e.key === 'Escape' && !Pop.cur && !$('.modal-back')) { e.stopPropagation(); close(); } };
    document.addEventListener('keydown', key, true);
    $('[data-a=close]', ov).onclick = close;
    stage.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      const pin = e.target.closest('.iw-pin');
      if (pin) { // نبدأ نغزل خيط من هالصفحة
        e.preventDefault();
        const from = pin.closest('.iw-node').dataset.id, n = this.S.G.byId.get(from);
        thread = { from, x: n.x, y: n.y };
        ov.classList.add('threading'); pin.closest('.iw-node').classList.add('from');
        try { stage.setPointerCapture(e.pointerId); } catch { }
        return;
      }
      if (e.target.closest('.iw-node')) return;
      pan = { x: e.clientX, y: e.clientY, vx: this.view.x, vy: this.view.y };
      try { stage.setPointerCapture(e.pointerId); } catch { } stage.classList.add('grab');
    });
    stage.addEventListener('pointermove', e => {
      if (thread) {
        const p = this.toWorld(ov, e.clientX, e.clientY);
        const mx = (thread.x + p.x) / 2, my = (thread.y + p.y) / 2 + 30;
        temp.setAttribute('d', `M${thread.x},${thread.y} Q${mx},${my} ${p.x},${p.y}`);
        const over = document.elementFromPoint(e.clientX, e.clientY)?.closest('.iw-node');
        $$('.iw-node.drop', ov).forEach(x => x !== over && x.classList.remove('drop'));
        if (over && over.dataset.id !== thread.from) over.classList.add('drop');
        return;
      }
      if (!pan) return;
      this.view.x = pan.vx + e.clientX - pan.x; this.view.y = pan.vy + e.clientY - pan.y; this.apply();
    });
    stage.addEventListener('pointerup', async e => {
      if (thread) {
        const t = thread; thread = null;
        temp.setAttribute('d', '');
        ov.classList.remove('threading');
        $$('.iw-node.from, .iw-node.drop', ov).forEach(x => x.classList.remove('from', 'drop'));
        const over = document.elementFromPoint(e.clientX, e.clientY)?.closest('.iw-node');
        if (over && over.dataset.id !== t.from) {
          const a = this.S.all.get(t.from), b = this.S.all.get(over.dataset.id);
          const ex = this.linked(a.id, b.id);
          if (ex) { this.flash('هدول مربوطين أصلاً ✓'); return; }
          await this.add(a.id, a.bookId, b.id, b.bookId);
          this.build();
          this.flash('🧵 انغزل خيط جديد');
        }
        return;
      }
      pan = null; stage.classList.remove('grab');
    });
    stage.addEventListener('wheel', e => {
      e.preventDefault();
      const r = stage.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, v = this.view;
      const k = clamp(v.k * Math.exp(-e.deltaY * .0015), .25, 3);
      v.x = mx - (mx - v.x) * k / v.k; v.y = my - (my - v.y) * k / v.k; v.k = k; this.apply();
    }, { passive: false });
    const hot = id => {
      ov.classList.toggle('focusing', !!id);
      $$('.iw-node.hot', ov).forEach(x => x.classList.remove('hot'));
      $$('.iw-edges path.hot', ov).forEach(p => p.classList.remove('hot'));
      if (!id) return;
      $(`.iw-node[data-id="${id}"]`, ov)?.classList.add('hot');
      $$('.iw-edges path', ov).forEach(p => {
        if (p.dataset.a !== id && p.dataset.b !== id) return;
        p.classList.add('hot');
        $(`.iw-node[data-id="${p.dataset.a === id ? p.dataset.b : p.dataset.a}"]`, ov)?.classList.add('hot');
      });
    };
    box.addEventListener('mouseover', e => { if (thread) return; const n = e.target.closest('.iw-node'); if (n) hot(n.dataset.id); });
    box.addEventListener('mouseout', e => { if (!e.relatedTarget || !e.relatedTarget.closest('.iw-node')) hot(null); });
    // ضغطة = افتح الصفحة بزوم، دبل كليك = خليها بالنص
    box.addEventListener('click', e => {
      const n = e.target.closest('.iw-node'); if (!n || e.target.closest('.iw-pin')) return;
      clearTimeout(clickT);
      clickT = setTimeout(() => this.enter(ov, n.dataset.id, close), 260);
    });
    box.addEventListener('dblclick', e => {
      const n = e.target.closest('.iw-node'); if (!n) return;
      clearTimeout(clickT);
      this.recenter(n.dataset.id);
    });
    box.addEventListener('contextmenu', e => {
      const n = e.target.closest('.iw-node'); if (!n) return;
      e.preventDefault();
      const id = n.dataset.id, me = this.S.all.get(id);
      const items = [
        { icon: 'open', label: 'افتح الصفحة', act: () => this.enter(ov, id, close) },
        { icon: 'web', label: 'خليها بنص الشبكة', act: () => this.recenter(id) },
        { icon: 'link', label: 'اربطها بصفحات…', act: () => this.pickerFor(id) },
      ];
      const mine = this.links.filter(x => (x.a === id || x.b === id) && this.S.all.has(x.a) && this.S.all.has(x.b));
      if (mine.length) items.push('-', { head: 'فك الخيط مع' });
      mine.forEach(x => {
        const o = this.S.all.get(x.a === id ? x.b : x.a);
        items.push({ icon: 'x', label: `ص ${o.k + 1} · ${o.title}`, danger: true, act: async () => { await this.remove(x.id); this.build(false); this.flash('انقطع الخيط'); } });
      });
      Menu.open({ x: e.clientX, y: e.clientY }, items, { place: 'point' });
    });
  },
  flash(t) {
    const h = $('#iw .iw-hint'); if (!h) return;
    const old = h.innerHTML; h.innerHTML = `<span>${esc(t)}</span>`; h.classList.add('flash');
    setTimeout(() => { if (h.isConnected) { h.classList.remove('flash'); h.innerHTML = old; } }, 1800);
  },
  recenter(id) {
    this.S.centerId = id;
    this.build();
    setTimeout(() => { this.fit(); this.apply(true); }, 60);
  },
  async pickerFor(id) {
    const n = this.S.all.get(id), b = this.S.books.find(x => x.id === n.bookId);
    const pages = await this.pagesOf(b);
    if (b.id !== Reader.book.id) { Toast.show({ icon: 'web', text: 'اسحب الخرزة الذهبية لتربط صفحات الكتاب الثاني' }); return; }
    this.picker(pages[n.k], n.k, async () => {
      if (!$('#iw')) return;
      const books = this.S.books;
      for (const [bi, bk] of books.entries()) (await this.pagesOf(bk)).forEach((p, k) => { if (p && !this.S.all.has(p.id)) { const inf = this.pageInfo(p, k); this.S.all.set(p.id, { id: p.id, bookId: bk.id, bi, k, title: inf.title, empty: inf.empty, tint: this.S.tints[bi % this.S.tints.length] }); } });
      this.build();
    });
  },
  async enter(ov, id, close) {
    const n = this.S.G.byId.get(id); if (!n) return;
    const d = $(`.iw-node[data-id="${id}"]`, ov);
    d.classList.add('entering'); ov.classList.add('leaving');
    const st = $('.iw-stage', ov), v = this.view;
    v.k = 5; v.x = st.clientWidth / 2 - n.x * 5; v.y = st.clientHeight / 2 - n.y * 5; this.apply(true);
    await new Promise(r => setTimeout(r, 620));
    close();
    const b = this.S.books.find(x => x.id === n.bookId);
    this.go(b.id, b.pageIds.indexOf(id));
  },
};
