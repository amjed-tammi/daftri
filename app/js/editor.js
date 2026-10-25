'use strict';
/* ============ المحرر: الكتابة داخل الصفحات ============ */
const BLOCKS = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'UL', 'OL', 'PRE', 'TABLE', 'FIGURE', 'BLOCKQUOTE', 'HR']);
const HL_COLORS = ['#fff176', '#b9f6ca', '#ffc1e3', '#b3e5fc', '#ffd59e'];
const TEXT_COLORS = ['#1f2a5a', '#222222', '#c62828', '#1565c0', '#2e7d32', '#6a1b9a', '#e65100'];

function textOffset(block, node, off) {
  const r = document.createRange();
  r.setStart(block, 0);
  try { r.setEnd(node, off); } catch { return 0; }
  return r.toString().length;
}
function setCaretAt(block, k) {
  const s = getSelection();
  const tw = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  let n, last = null;
  while ((n = tw.nextNode())) {
    if (k <= n.length) { s.collapse(n, k); return; }
    k -= n.length; last = n;
  }
  if (last) s.collapse(last, last.length); else s.collapse(block, block.childNodes.length && block.lastChild.nodeName === 'BR' ? 0 : block.childNodes.length);
}
function topBlock(c, node) {
  while (node && node.parentNode !== c) node = node.parentNode;
  return node && node.parentNode === c ? node : null;
}
function anchorEl() {
  const s = getSelection();
  if (!s.rangeCount) return null;
  const n = s.anchorNode;
  return n ? (n.nodeType === 1 ? n : n.parentElement) : null;
}
function looksLikeCode(t) {
  const lines = t.split(/\r?\n/);
  let score = 0;
  if (/[{};]\s*$/m.test(t)) score++;
  if (/^( {2,}|\t)\S/m.test(t)) score++;
  if (/=>|\bfunction\b|\bdef\s+\w+\(|\bclass\s+\w+|<\/?[a-z][\w-]*[\s>]|#include|^\s*import\s|\bconsole\.|\bprint\(|\breturn\b|\bconst\s|\blet\s|\bvar\s|==|!=|\+\+|&&|\|\|/m.test(t)) score++;
  if (/^\s*(\/\/|#|\/\*)/m.test(t)) score++;
  return lines.length >= 2 ? score >= 2 : (score >= 2 && /[;{}]\s*$/.test(t) && /\w\(/.test(t));
}

/* تلوين بسيط للكود */
const CODE_KW = 'function|return|if|else|elif|for|while|do|switch|case|break|continue|const|let|var|class|extends|new|this|self|import|from|export|default|try|catch|except|finally|throw|raise|async|await|def|lambda|pass|None|True|False|null|undefined|true|false|public|private|protected|static|void|int|float|double|char|bool|boolean|string|include|using|namespace|struct|in|of|and|or|not|is|with|as|yield|typeof|instanceof|interface|type|enum|package|fun|val|echo|println|print|SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|JOIN';
const CODE_RE = new RegExp(`(\\/\\*[\\s\\S]*?\\*\\/|\\/\\/[^\\n]*|#[^\\n]*|<!--[\\s\\S]*?-->)|("(?:\\\\.|[^"\\\\\\n])*"|'(?:\\\\.|[^'\\\\\\n])*'|\`(?:\\\\.|[^\`\\\\])*\`)|(\\b\\d+(?:\\.\\d+)?\\b)|(\\b(?:${CODE_KW})\\b)|(\\b[A-Za-z_]\\w*(?=\\())`, 'g');
function highlightCode(text) {
  let out = '', last = 0, m;
  CODE_RE.lastIndex = 0;
  while ((m = CODE_RE.exec(text))) {
    out += esc(text.slice(last, m.index));
    const cls = m[1] ? 'c' : m[2] ? 's' : m[3] ? 'n' : m[4] ? 'k' : 'f';
    out += `<span class="t-${cls}">${esc(m[0])}</span>`;
    last = m.index + m[0].length;
  }
  return out + esc(text.slice(last));
}
function highlightPre(pre) { const t = pre.textContent; const h = highlightCode(t); if (pre.innerHTML !== h) pre.innerHTML = h; }

const Editor = {
  live: new Map(), curPage: null, pending: null, lastPre: null,

  init() {
    this.buildSelbar();
    document.addEventListener('selectionchange', debounce(() => this.onSel(), 70));
    addEventListener('resize', () => this.hideBars());
  },

  bind(pg, p) {
    const c = $('.content', pg), i = +pg.dataset.i;
    const l = { pg, p, c, i };
    l.save = debounce(() => {
      p.html = this.serialize(c);
      DB.put('pages', p);
      Reader.touch();
    }, 450);
    this.live.set(i, l);
    c.addEventListener('focus', () => {
      this.curPage = i;
      document.execCommand('defaultParagraphSeparator', false, 'p');
      document.execCommand('styleWithCSS', false, true);
      if (!c.querySelector(':scope > :not(.wrapx)')) { c.append(el('<p><br></p>')); setCaretAt(c.lastElementChild, 0); }
    });
    c.addEventListener('input', () => this.changed(l, true));
    // الصفحة ورق: ما بتنزلق لفوق لما المؤشر يوصل لآخرها (المتصفح بيعمل هيك تلقائياً)
    c.addEventListener('scroll', () => { if (c.scrollTop || c.scrollLeft) { c.scrollTop = 0; c.scrollLeft = 0; } });
    c.addEventListener('keydown', e => this.keydown(e, l));
    c.addEventListener('paste', e => this.paste(e, l));
    c.addEventListener('click', e => this.click(e, l));
    pg.addEventListener('contextmenu', e => {
      if (e.target.closest('.sticky .stx') && !getSelection().isCollapsed) return;
      e.preventDefault(); Ctx.open(e, l);
    });
    pg.addEventListener('dragover', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { e.preventDefault(); pg.classList.add('dropping'); } });
    pg.addEventListener('dragleave', () => pg.classList.remove('dropping'));
    pg.addEventListener('drop', e => {
      pg.classList.remove('dropping');
      const files = [...(e.dataTransfer && e.dataTransfer.files || [])];
      if (!files.length) return;
      e.preventDefault();
      const pt = this.pagePoint(pg, e.clientX, e.clientY);
      const imgs = files.filter(f => f.type.startsWith('image/'));
      const vids = files.filter(f => f.type.startsWith('video/'));
      // ملفات وورد/إكسل/PDF/CSV: بتتحوّل لصفحات بنفس تنسيقها
      const doc = files.find(f => Importer.can(f) || Importer.legacy(f));
      if (doc) Importer.file(doc, l);
      if (imgs.length) Stickies.addPhotos(l, imgs, pt);
      if (vids.length) Media2.insertVideo(l, vids[0], pt);
    });
  },
  pagePoint(pg, x, y) {
    const r = pg.getBoundingClientRect(), k = r.width / PW;
    return { x: (x - r.left) / k, y: (y - r.top) / k };
  },
  unbindAll() { this.flushAll(); this.live.clear(); this.hideBars(); this.lastPre = null; },
  flushAll() { this.live.forEach(l => l.save.flush()); },
  persist(p) {
    for (const l of this.live.values()) if (l.p === p) { l.save(); return; }
    DB.put('pages', p);
  },
  liveOf(node) {
    const pg = node && (node.nodeType === 1 ? node : node.parentElement).closest('.page[data-i]');
    return pg ? this.live.get(+pg.dataset.i) : null;
  },
  changed(l, fromInput = false) {
    // لو انمسح شكل الالتفاف (تحديد الكل وحذف/لصق) بنرجّعه
    if ((l.p.stickies || []).some(s => s.wrap !== false)) {
      const f = l.c.firstElementChild;
      if (!f || !f.classList.contains('wrapx')) Wrap.apply(l.pg, l.p);
    }
    this.normalize(l.c);
    this.reflow(l);
    l.save();
  },
  serialize(c) {
    const k = c.cloneNode(true);
    $$('img[data-blob], video[data-blob]', k).forEach(m => m.removeAttribute('src'));
    $$('.wrapx', k).forEach(x => x.remove());
    // أصناف العرض المؤقتة (التركيز/المراجعة) ما بتنحفظ
    $$('.is-current, .rv-focus, .rv-target, .shown', k).forEach(x => { x.classList.remove('is-current', 'rv-focus', 'rv-target', 'shown'); if (!x.className) x.removeAttribute('class'); });
    let h = k.innerHTML.trim();
    if (/^(<p><br><\/p>|<br>|<p><\/p>)?$/.test(h)) h = '';
    return h;
  },
  isEmpty(c) { return !c.textContent.trim() && !c.querySelector('img,video,figure,table,hr,.cb,pre'); },

  normalize(c) {
    this.listDirections(c);
    const kids = [...c.childNodes];
    if (kids.some(n => (n.nodeType === 3 && n.textContent.trim()) || (n.nodeType === 1 && !BLOCKS.has(n.tagName)))) {
      const s = getSelection(), an = s.anchorNode, ao = s.anchorOffset;
      let p = null;
      kids.forEach(n => {
        const loose = (n.nodeType === 3 && (n.textContent.trim() || p)) || (n.nodeType === 1 && !BLOCKS.has(n.tagName));
        if (loose) { if (!p) { p = document.createElement('p'); c.insertBefore(p, n); } p.appendChild(n); } else p = null;
      });
      if (an && c.contains(an)) try { s.collapse(an, ao); } catch { }
    }
    $$('ul.check > li', c).forEach(li => {
      if (li.querySelector(':scope > .cb')) return;
      const s = getSelection();
      const atStart = s.anchorNode === li && s.anchorOffset === 0;
      li.prepend(el('<span class="cb" contenteditable="false"></span>'));
      if (atStart) s.collapse(li, 1); // المؤشر بعد المربع لا قبله
    });
  },

  listDirections(c) {
    // plaintext يرتّب النص فقط؛ علامة القائمة تحتاج اتجاه العنصر نفسه.
    $$('ol,ul,li', c).forEach(n => {
      if (n.hasAttribute('dir')) return;
      const parent = n.parentElement.closest('[dir]');
      if (parent && c.contains(parent) && /^(rtl|ltr)$/.test(parent.dir)) return;
      n.dir = 'auto';
    });
  },
  listValueAt(list, index) {
    const items = [...list.children].filter(n => n.tagName === 'LI');
    const step = list.reversed ? -1 : 1;
    let value = list.hasAttribute('start') ? list.start : list.reversed ? items.length : 1;
    for (let i = 0; i <= index; i++) {
      if (items[i].hasAttribute('value')) value = items[i].value;
      if (i < index) value += step;
    }
    return value;
  },

  /* ===== انسياب النص للصفحة التالية عند امتلاء الصفحة ===== */
  reflowAll() { this.live.forEach(l => { if (l.c.isConnected) this.reflow(l, false); }); },
  reflow(l, follow = true) {
    const c = l.c;
    c.scrollTop = 0; c.scrollLeft = 0; // القياس لازم يكون من أول الصفحة
    const limit = c.clientHeight;
    if (!limit || c.scrollHeight <= limit + 1) return;
    const s = getSelection();
    let cb = null, co = 0;
    if (follow && s.rangeCount && c.contains(s.anchorNode)) {
      cb = topBlock(c, s.anchorNode);
      if (cb) co = textOffset(cb, s.anchorNode, s.anchorOffset);
    }
    const t = this.takeOverflow(c, limit, cb, co);
    cb = t.cb; co = t.co;
    const moved = t.moved;
    if (!moved.length) return;
    this.pushToNext(l, moved, cb && moved.includes(cb) ? cb : null, co);
    l.save();
  },
  // بيشيل من آخر الصفحة كل اللي طالع عن حدّها (وبيقسم الفقرة/الجدول/القائمة عند حد السطر)
  takeOverflow(c, limit, cb = null, co = 0) {
    const cr = c.getBoundingClientRect();
    const M = { top: cr.top, sc: cr.height / c.offsetHeight || 1 };
    const relB = n => (n.getBoundingClientRect().bottom - M.top) / M.sc;
    const relT = n => (n.getBoundingClientRect().top - M.top) / M.sc;
    const moved = [];
    let guard = 0;
    while (c.scrollHeight > limit + 1 && guard++ < 300) {
      const last = c.lastChild;
      if (!last || (last.nodeType === 1 && last.classList.contains('wrapx'))) break;
      if (last.nodeType !== 1) { moved.unshift(last); last.remove(); continue; }
      if (relB(last) <= limit + 1) break;
      const only = c.childNodes.length === 1;
      if (relT(last) >= limit - 1 && !only) { moved.unshift(last); last.remove(); continue; }
      const res = this.split(last, limit, M, relB);
      if (res && res.tail) {
        moved.unshift(res.tail);
        if (cb === last && co > res.at) { cb = res.tail; co = Math.max(0, co - res.at - (res.shift || 0)); }
        continue;
      }
      if (res === 'whole' && !only) { moved.unshift(last); last.remove(); continue; }
      break;
    }
    return { moved, cb, co };
  },
  split(block, limit, M, relB) {
    const tag = block.tagName;
    if (tag === 'UL' || tag === 'OL' || tag === 'TABLE') {
      const items = tag === 'TABLE' ? $$('tr', block) : [...block.children].filter(x => x.tagName === 'LI');
      if (items.length < 2) return 'whole';
      let k = items.length;
      while (k > 1 && relB(items[k - 1]) > limit + 1) k--;
      if (k >= items.length) return null;
      const r = document.createRange(); r.setStart(block, 0); r.setEndBefore(items[k]);
      const at = r.toString().length;
      const tail = block.cloneNode(false);
      if (tag === 'TABLE') { const tb = document.createElement('tbody'); tail.append(tb); items.slice(k).forEach(x => tb.append(x)); }
      else {
        const start = tag === 'OL' ? this.listValueAt(block, k) : null;
        if (tag === 'OL' && block.reversed && !block.hasAttribute('start')) block.start = items.length;
        items.slice(k).forEach(x => tail.append(x));
        if (tag === 'OL') tail.start = start;
      }
      this.linkHead(block, tail);
      return { tail, at };
    }
    if (tag === 'FIGURE' || tag === 'HR') return 'whole';
    const texts = []; let total = 0;
    const tw = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = tw.nextNode())) if (n.length) { texts.push([n, total]); total += n.length; }
    if (!total) return 'whole';
    const loc = k => {
      let lo = 0, hi = texts.length - 1;
      while (lo < hi) { const m = (lo + hi + 1) >> 1; if (texts[m][1] <= k) lo = m; else hi = m - 1; }
      return [texts[lo][0], k - texts[lo][1]];
    };
    const rng = document.createRange();
    const bot = k => {
      const [nd, o] = loc(k);
      rng.setStart(nd, o); rng.setEnd(nd, Math.min(o + 1, nd.length));
      const rs = rng.getClientRects();
      const rc = rs.length ? rs[rs.length - 1] : null;
      return rc ? (rc.bottom - M.top) / M.sc : -1;
    };
    if (bot(0) > limit + 1) return 'whole';
    // المسافات بآخر الفقرة ما إلها مكان على السطر، فبنقيس على آخر حرف حقيقي
    let lo = 0, hi = total - 1;
    const chAt = k => { const [nd, o] = loc(k); return nd.data[o]; };
    while (hi > 0 && /\s/.test(chAt(hi))) hi--;
    if (bot(hi) <= limit + 1) return null;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (bot(mid) > limit + 1) hi = mid; else lo = mid + 1; }
    const [nd, o] = loc(lo);
    const r = document.createRange();
    r.setStart(nd, o); r.setEndAfter(block.lastChild);
    const frag = r.extractContents();
    const tail = block.cloneNode(false);
    tail.append(frag);
    let shift = 0;
    if (tag !== 'PRE') {
      const tw2 = document.createTreeWalker(tail, NodeFilter.SHOW_TEXT);
      const ft = tw2.nextNode();
      if (ft) { const t = ft.textContent, t2 = t.replace(/^\s+/, ''); shift = t.length - t2.length; ft.textContent = t2; }
    }
    // كان في مسافة عند القص؟ منتذكرها حتى لما القطعتين يرجعوا يتجمّعوا ما تلزق الكلمتين
    if (shift || /\s$/.test(block.textContent)) tail.dataset.sp = '1'; else tail.removeAttribute('data-sp');
    if (!block.textContent && !block.querySelector('br,img')) block.innerHTML = '<br>';
    this.linkHead(block, tail);
    return { tail, at: lo, shift };
  },
  linkHead(head, tail) {
    const id = head.dataset.head || ('h' + uid().slice(-6));
    head.dataset.head = id;
    tail.dataset.cont = id;
    tail.removeAttribute('data-head');
  },
  mergeMoved(container, moved) {
    // دمج تكملة الفقرة مع بقيتها في الصفحة التالية
    const last = moved[moved.length - 1], first = container.firstElementChild;
    if (!last || last.nodeType !== 1) return null;
    const ok = first && first.tagName === last.tagName && first.dataset.cont &&
      (first.dataset.cont === last.dataset.head || first.dataset.cont === last.dataset.cont);
    if (!ok) { last.removeAttribute('data-head'); return null; }
    if (first.tagName === 'TABLE') {
      const tb = first.tBodies[0] || first;
      [...last.querySelectorAll('tr')].reverse().forEach(tr => tb.prepend(tr));
    } else {
      if (first.tagName === 'OL') first.start = this.listValueAt(last, 0);
      const glue = first.dataset.sp && !/\s$/.test(last.textContent) && !/^\s/.test(first.textContent);
      first.prepend(...last.childNodes, ...(glue ? [document.createTextNode(' ')] : []));
    }
    if (last.dataset.cont) first.dataset.cont = last.dataset.cont; else first.removeAttribute('data-cont');
    if (last.dataset.sp) first.dataset.sp = '1'; else first.removeAttribute('data-sp');
    moved.pop();
    return { from: last, to: first };
  },
  pushToNext(l, moved, cb, co) {
    const ni = l.i + 1;
    if (ni >= Reader.pages.length) Reader.addPages(2);
    const nl = this.live.get(ni);
    if (nl && nl.c.isConnected) {
      const nc = nl.c;
      if (this.isEmpty(nc)) nc.innerHTML = '';
      const mg = this.mergeMoved(nc, moved);
      if (mg && cb === mg.from) cb = mg.to;
      nc.prepend(...moved);
      Wrap.apply(nl.pg, nl.p);
      if (cb) { nc.focus(); setCaretAt(cb, co); }
      this.normalize(nc);
      this.reflow(nl, !!cb);
      nl.save();
    } else {
      const np = Reader.pages[ni];
      const tmp = document.createElement('div');
      tmp.innerHTML = np.html || '';
      if (this.isEmpty(tmp)) tmp.innerHTML = '';
      const mg = this.mergeMoved(tmp, moved);
      if (mg && cb === mg.from) cb = mg.to;
      tmp.prepend(...moved);
      if (cb && cb.nodeType === 1) cb.setAttribute('data-caret', co);
      np.html = this.serialize(tmp);
      DB.put('pages', np);
      if (cb) {
        this.pending = { i: ni };
        l.save.flush();
        Reader.turn(1);
      }
    }
  },
  restorePendingCaret() {
    if (!this.pending) return;
    const { i } = this.pending; this.pending = null;
    const l = this.live.get(i); if (!l) return;
    const m = $('[data-caret]', l.c); if (!m) return;
    const k = +m.dataset.caret; m.removeAttribute('data-caret');
    l.c.focus(); setCaretAt(m, k);
  },
  focusPage(i) {
    const l = this.live.get(i); if (!l) return;
    l.c.focus();
    const last = l.c.lastElementChild;
    if (last) setCaretAt(last, last.textContent.length);
  },

  /* ===== لوحة المفاتيح ===== */
  insertText(t) {
    const s = getSelection(); if (!s.rangeCount) return;
    const r = s.getRangeAt(0); r.deleteContents();
    const n = document.createTextNode(t);
    r.insertNode(n); r.setStartAfter(n); r.collapse(true);
    s.removeAllRanges(); s.addRange(r);
  },
  keydown(e, l) {
    const ae = anchorEl();
    const pre = ae && ae.closest('pre.code');
    const mod = e.ctrlKey || e.metaKey;
    if (pre && l.c.contains(pre)) {
      if (e.key === 'Enter' && !e.shiftKey && !mod) { e.preventDefault(); this.codeEnter(pre, l); return; }
      if (e.key === 'Tab') { e.preventDefault(); this.insertText('  '); this.changed(l); return; }
      if (e.key === 'Escape') { e.preventDefault(); this.exitBlock(pre, l); return; }
    }
    const cell = ae && ae.closest('td,th');
    if (e.key === 'Tab') {
      e.preventDefault();
      if (cell) {
        const cells = $$('td,th', cell.closest('table'));
        let k = cells.indexOf(cell) + (e.shiftKey ? -1 : 1);
        if (k >= cells.length) { this.tableOp('row+'); return; }
        k = clamp(k, 0, cells.length - 1);
        setCaretAt(cells[k], cells[k].textContent.length);
      } else if (ae && ae.closest('li')) document.execCommand(e.shiftKey ? 'outdent' : 'indent');
      else this.insertText('    ');
      return;
    }
    if (mod && !e.shiftKey && e.code === 'KeyK') { e.preventDefault(); Links.open(Sel.save(), l); return; }
    if (mod && e.shiftKey && e.code === 'KeyH') { e.preventDefault(); document.execCommand('hiliteColor', false, HL_COLORS[0]); return; }
    if (mod && e.shiftKey && e.code === 'KeyC') { e.preventDefault(); this.inlineCode(); return; }
    // المحاذاة: Ctrl+R يمين، Ctrl+E وسط، Ctrl+L يسار (بتشتغل حتى مع الكيبورد العربي)
    const AL = { KeyR: 'right', KeyE: 'center', KeyL: 'left' };
    if (mod && !e.shiftKey && !e.altKey && AL[e.code]) { e.preventDefault(); this.align(AL[e.code]); this.updateStates(); return; }
  },
  codeEnter(pre, l) {
    const s = getSelection(); const r = s.getRangeAt(0);
    if (!r.collapsed) r.deleteContents();
    const off = textOffset(pre, r.startContainer, r.startOffset);
    const text = pre.textContent, before = text.slice(0, off), after = text.slice(off);
    const ls = before.lastIndexOf('\n') + 1, line = before.slice(ls);
    if (line.trim() === '' && after.trim() === '' && ls > 0) {
      pre.textContent = before.slice(0, ls - 1);
      this.exitBlock(pre, l);
      return;
    }
    const ind = (line.match(/^[ \t]*/) || [''])[0] + (/[{[(:]\s*$/.test(line) ? '  ' : '');
    const ins = '\n' + ind;
    pre.textContent = before + ins + (after === '' ? '\n' : after);
    setCaretAt(pre, off + ins.length);
    this.changed(l);
  },
  exitBlock(blk, l) {
    if (blk.tagName === 'PRE') highlightPre(blk);
    let nx = blk.nextElementSibling;
    if (!nx || nx.tagName !== 'P' || nx.textContent.trim()) { nx = el('<p><br></p>'); blk.after(nx); }
    setCaretAt(nx, 0);
    this.changed(l);
  },
  inlineCode() {
    const s = getSelection(); if (!s.rangeCount || s.isCollapsed) return;
    document.execCommand('insertHTML', false, `<code>${esc(s.toString())}</code>&#8203;`);
  },

  /* ===== اللصق ===== */
  paste(e, l) {
    const dt = e.clipboardData; if (!dt) return;
    const imgs = [...dt.files].filter(f => f.type.startsWith('image/'));
    if (imgs.length) { e.preventDefault(); Stickies.addPhotos(l, imgs); return; }
    let text = dt.getData('text/plain');
    const html = dt.getData('text/html');
    e.preventDefault();
    if (!text && !html) return;
    text = (text || '').replace(/\r\n?/g, '\n');
    const ae = anchorEl(), pre = ae && ae.closest('pre.code');
    if (pre) { this.insertText(text); this.changed(l); return; }
    // نص عادي بسطر واحد: فوراً بدون ما نحمّل شي
    if (!html && !/[\t\n]/.test(text)) { if (looksLikeCode(text)) this.insertCode(l, text); else this.pastePlain(text); return; }
    // منسّق أو جدول أو قائمة: منظّف اللصق بيتحمّل أول مرة بس
    if (typeof Clean !== 'undefined') { this.pasteRich(l, html, text); return; } // محمّل من قبل: فوراً
    Importer.load().then(() => this.pasteRich(l, html, text)).catch(() => { if (text) this.pastePlain(text); });
  },
  pasteRich(l, html, text) {
    // لصق منسّق (إكسل/وورد/مواقع): جداول وعناوين وخط عريض وألوان بتضل
    if (html) {
      const blocks = Clean.html(html);
      if (blocks.length) { this.pasteBlocks(l, blocks); return; }
    }
    // نص بأعمدة (Tab) = جدول من إكسل أو جوجل شيت
    const tsv = Clean.tsv(text);
    if (tsv) { this.pasteBlocks(l, [tsv]); return; }
    if (!text) return;
    const numbered = Clean.numbered(text);
    if (numbered) { this.pasteBlocks(l, numbered); return; }
    if (looksLikeCode(text)) { this.insertCode(l, text); return; }
    this.pastePlain(text);
  },
  pasteBlocks(l, blocks) {
    this.ensureCaret(l);
    let html = blocks.join('');
    if (blocks.length === 1 && /^<p>/.test(html)) html = html.replace(/^<p>|<\/p>$/g, '');
    // أمر المتصفح يستبدل التحديد ويحتفظ بموضع المؤشر وسجل التراجع.
    document.execCommand('insertHTML', false, html);
    this.changed(l);
  },
  pastePlain(text) {
    const lines = text.split('\n');
    if (lines.length === 1) document.execCommand('insertText', false, text);
    else document.execCommand('insertHTML', false, lines.map(x => `<p>${esc(x) || '<br>'}</p>`).join(''));
  },
  ensureCaret(l) {
    const s = getSelection();
    if (s.rangeCount && l.c.contains(s.anchorNode)) return;
    l.c.focus();
    let last = [...l.c.children].reverse().find(x => !x.classList.contains('wrapx'));
    if (!last) { last = el('<p><br></p>'); l.c.append(last); }
    setCaretAt(last, last.textContent.length);
  },
  insertBlock(l, node) {
    this.ensureCaret(l);
    const blk = topBlock(l.c, getSelection().anchorNode);
    if (!blk) l.c.append(node);
    else if (!blk.textContent.trim() && !blk.querySelector('img,video,.cb') && blk.tagName === 'P') blk.replaceWith(node);
    else blk.after(node);
    if (!node.nextElementSibling) node.after(el('<p><br></p>'));
    return node;
  },
  insertCode(l, text = '') {
    const pre = el('<pre class="code" dir="ltr" spellcheck="false"></pre>');
    pre.innerHTML = text ? highlightCode(text.replace(/\n+$/, '')) : '\n';
    this.insertBlock(l, pre);
    if (text) { const nx = pre.nextElementSibling; setCaretAt(nx, 0); } else setCaretAt(pre, 0);
    this.changed(l);
  },
  insertTable(l, rows, cols) {
    let h = '<table class="tbl"><tbody>';
    for (let r = 0; r < rows; r++) {
      h += '<tr>';
      for (let c = 0; c < cols; c++) h += r === 0 ? '<th><br></th>' : '<td><br></td>';
      h += '</tr>';
    }
    const t = this.insertBlock(l, el(h + '</tbody></table>'));
    setCaretAt($('th,td', t), 0);
    this.changed(l);
  },
  insertChecklist(l) {
    const ul = this.insertBlock(l, el('<ul class="check"><li><span class="cb" contenteditable="false"></span><br></li></ul>'));
    const li = ul.firstElementChild;
    getSelection().collapse(li, 1);
    this.changed(l);
  },
  tableOp(op) {
    const ae = anchorEl(); if (!ae) return;
    const table = ae.closest('table'); if (!table) return;
    const l = this.liveOf(table);
    const cell = ae.closest('td,th') || $('td,th', table);
    const row = cell.parentElement, ci = [...row.children].indexOf(cell);
    const rows = $$('tr', table);
    if (op === 'row+') {
      const nr = document.createElement('tr');
      for (let k = 0; k < row.children.length; k++) nr.append(el('<td><br></td>'));
      row.after(nr); setCaretAt(nr.children[Math.max(0, ci)], 0);
    } else if (op === 'col+') {
      rows.forEach(tr => { const ref = tr.children[ci]; const c = el(ref && ref.tagName === 'TH' ? '<th><br></th>' : '<td><br></td>'); ref ? ref.after(c) : tr.append(c); });
    } else if (op === 'row-') {
      if (rows.length > 1) { const nx = row.nextElementSibling || row.previousElementSibling; row.remove(); setCaretAt(nx.children[0], 0); }
    } else if (op === 'col-') {
      if (row.children.length > 1) rows.forEach(tr => tr.children[ci] && tr.children[ci].remove());
    } else if (op === 'del') {
      const nx = table.nextElementSibling; table.remove(); if (nx) setCaretAt(nx, 0);
    }
    if (l) this.changed(l);
  },

  click(e, l) {
    const t = e.target;
    const eq = t.closest('.eq'); if (eq) { e.preventDefault(); MathEq.open(l, eq); return; } // المعادلة: ضغطة بتعدّلها
    const cb = t.closest('.cb');
    if (cb) { cb.parentElement.classList.toggle('done'); this.changed(l); return; }
    const mx = t.closest('figure.media .mx');
    if (mx) { const f = mx.closest('figure'); f.remove(); this.changed(l); return; }
    const a = t.closest('a');
    if (a && l.c.contains(a)) { e.preventDefault(); Links.menuFor(a, l); return; }
    const v = t.closest('span.voice');
    if (v && getSelection().isCollapsed) Voice.menuFor(v, l);
  },

  /* ===== شريط التنسيق العائم ===== */
  buildSelbar() {
    const b = $('#selbar');
    b.innerHTML = `
      <button data-c="bold" title="عريض (Ctrl+B)"><b>B</b></button>
      <button data-c="italic" title="مائل (Ctrl+I)"><i>I</i></button>
      <button data-c="underline" title="تسطير (Ctrl+U)"><u>U</u></button>
      <button data-c="strikeThrough" title="شطب"><s>S</s></button>
      <span class="sep"></span>
      ${HL_COLORS.map(c => `<button class="hl" data-hl="${c}" style="--c:${c}" title="هايلايت"></button>`).join('')}
      <button class="hl none" data-hl="transparent" title="إزالة الهايلايت"></button>
      <button data-a="ink" title="لون الخط">${ic('ink')}</button>
      <span class="sep"></span>
      <button data-a="heading" title="عنوان">${ic('heading')}</button>
      <button data-c="insertUnorderedList" title="قائمة">${ic('list')}</button>
      <button data-c="insertOrderedList" title="قائمة مرقّمة">${ic('olist')}</button>
      <button data-a="quote" title="اقتباس">${ic('quote')}</button>
      <button data-a="icode" title="كود داخل السطر">${ic('code')}</button>
      <span class="sep"></span>
      <button data-al="right" title="محاذاة لليمين (Ctrl+R)">${ic('alr')}</button>
      <button data-al="center" title="توسيط (Ctrl+E)">${ic('alc')}</button>
      <button data-al="left" title="محاذاة لليسار (Ctrl+L)">${ic('all')}</button>
      <button data-al="auto" title="محاذاة تلقائية حسب لغة السطر">${ic('swap')}</button>
      <span class="sep"></span>
      <button data-a="link" title="ربط برابط أو فيديو (Ctrl+K)">${ic('link')}</button>
      <button data-a="eq" title="معادلة: كسور، أسس، جذور، كيمياء (Alt+=)">${ic('math')}</button>
      <button data-a="voice" title="ربط تسجيل صوتي بالكلمة">${ic('mic')}</button>
      <button data-a="font" title="خط وحجم النص المحدد">${ic('font')}</button>
      <button data-a="clear" title="مسح التنسيق">${ic('eraser')}</button>
      <span class="sep"></span>
      <button data-a="dock" class="dockbtn">${ic('pin')}</button>`;
    b.addEventListener('mousedown', e => e.preventDefault());
    b.addEventListener('click', e => {
      const x = e.target.closest('button'); if (!x) return;
      if (x.dataset.a === 'dock') { this.setDock(!this.docked()); return; }
      const ae = anchorEl(); const l = this.liveOf(ae);
      if (x.dataset.al) { this.align(x.dataset.al); this.updateStates(); return; }
      if (x.dataset.c) document.execCommand(x.dataset.c);
      else if (x.dataset.hl) document.execCommand('hiliteColor', false, x.dataset.hl);
      else switch (x.dataset.a) {
        case 'ink': {
          const m = el(`<div class="swatches pad">${TEXT_COLORS.map(c => `<button class="sw" data-v="${c}" style="--c:${c}"></button>`).join('')}</div>`);
          const r = Sel.save();
          m.addEventListener('mousedown', ev => ev.preventDefault());
          m.onclick = ev => { const s = ev.target.closest('[data-v]'); if (!s) return; Sel.restore(r); document.execCommand('foreColor', false, s.dataset.v); Pop.close(); };
          Pop.open(x, m, { cls: 'mini-pop' });
          return;
        }
        case 'heading': {
          const blk = ae && ae.closest('h2,h3,p,div,li,blockquote');
          const tag = blk ? blk.tagName : 'P';
          document.execCommand('formatBlock', false, tag === 'H2' ? 'h3' : tag === 'H3' ? 'p' : 'h2');
          break;
        }
        case 'quote': {
          const q = ae && ae.closest('blockquote');
          document.execCommand('formatBlock', false, q ? 'p' : 'blockquote');
          break;
        }
        case 'icode': this.inlineCode(); break;
        case 'link': if (l) Links.open(Sel.save(), l); return;
        case 'eq': if (l) MathEq.open(l); return;
        case 'voice': if (l) Voice.attachToSelection(Sel.save(), l); return;
        case 'font': if (l) FontKit.selectionPanel(x, l); return;
        case 'clear': document.execCommand('removeFormat'); document.execCommand('hiliteColor', false, 'transparent'); break;
      }
      if (l) this.changed(l);
      this.onSel();
    });
    const bb = $('#blockbar');
    bb.addEventListener('mousedown', e => e.preventDefault());
    bb.addEventListener('click', e => {
      const x = e.target.closest('button'); if (!x) return;
      const op = x.dataset.op;
      if (op === 'copy') {
        const pre = anchorEl() && anchorEl().closest('pre');
        if (pre) navigator.clipboard.writeText(pre.textContent).then(() => Toast.show({ icon: 'copy', text: 'تم نسخ الكود', timeout: 1600 }));
        return;
      }
      if (op === 'delpre') {
        const pre = anchorEl() && anchorEl().closest('pre'); const l = this.liveOf(pre);
        if (pre) { const nx = pre.nextElementSibling; pre.remove(); if (nx) setCaretAt(nx, 0); if (l) this.changed(l); }
        bb.hidden = true; return;
      }
      this.tableOp(op);
      this.onSel();
    });
  },
  hideBars() {
    if (!this.docked() || $('#reader').hidden) $('#selbar').hidden = true;
    else this.updateStates();
    $('#blockbar').hidden = true;
  },

  /* ===== المحاذاة: يمين / وسط / يسار / تلقائي حسب لغة السطر ===== */
  align(v) {
    const s = getSelection(); if (!s.rangeCount) return;
    const ae = anchorEl();
    const host = ae && ae.closest('.content[contenteditable], .stx[contenteditable]');
    if (!host) { Toast.show({ icon: 'alr', text: 'حط المؤشر على السطر أولاً', timeout: 1800 }); return; }
    const r = s.getRangeAt(0), SEL = 'p,div,li,h2,h3,blockquote,td,th';
    let blocks = $$(SEL, host).filter(b => r.intersectsNode(b) && !b.querySelector(SEL + ',table,ul,ol'));
    if (!blocks.length) { const b = ae.closest(SEL); blocks = [b && host.contains(b) ? b : host]; }
    blocks.forEach(b => { b.style.textAlign = v === 'auto' ? '' : v; if (!b.getAttribute('style')) b.removeAttribute('style'); });
    if (host.classList.contains('stx')) host.dispatchEvent(new Event('input'));
    else { const l = this.liveOf(host); if (l) this.changed(l); }
  },

  /* ===== شريط التنسيق: مثبّت تحت الكتاب أو عائم فوق النص المحدد ===== */
  docked() { return localStorage.getItem('fmtDock') !== '0'; },
  setDock(on) {
    localStorage.setItem('fmtDock', on ? '1' : '0');
    this.dockSync();
    Reader.layout();
    Toast.show({ icon: 'pin', text: on ? 'الشريط مثبّت تحت الكتاب' : 'الشريط بيطلع فوق النص لما تحدّده', timeout: 2200 });
  },
  dockSync() {
    const sb = $('#selbar'), on = this.docked() && !$('#reader').hidden;
    document.body.classList.toggle('fmt-docked', on);
    sb.classList.toggle('docked', on);
    if (on) { sb.style.left = ''; sb.style.top = ''; sb.hidden = false; }
    else sb.hidden = true;
    const d = $('.dockbtn', sb);
    if (d) { d.title = on ? 'خلّي الشريط يطلع فوق النص المحدد بس' : 'ثبّت الشريط تحت الكتاب'; d.classList.toggle('on', on); }
    this.updateStates();
  },
  updateStates() {
    const sb = $('#selbar');
    const ae = anchorEl();
    const host = ae && ae.closest('.content[contenteditable], .stx[contenteditable]');
    sb.classList.toggle('idle', !host);
    $$('[data-a=link],[data-a=voice],[data-a=card],[data-a=heading],[data-a=quote],[data-c^=insert]', sb).forEach(x => x.hidden = !!host && !host.classList.contains('content'));
    ['bold', 'italic', 'underline', 'strikeThrough'].forEach(c => {
      const b = $(`[data-c=${c}]`, sb);
      let on = false; try { on = !!host && document.queryCommandState(c); } catch { }
      b.classList.toggle('on', on);
    });
    const blk = host && (ae.closest('p,div,li,h2,h3,blockquote,td,th') || host);
    const al = blk && host.contains(blk) ? blk.style.textAlign : '';
    $$('[data-al]', sb).forEach(b => b.classList.toggle('on', !!host && (b.dataset.al === (al || 'auto'))));
  },
  onSel() {
    const s = getSelection();
    if (!s.rangeCount) { this.hideBars(); return; }
    const r = s.getRangeAt(0);
    const n = r.commonAncestorContainer;
    const e = n.nodeType === 1 ? n : n.parentElement;
    if (!e) return;
    const pre = e.closest('pre.code');
    if (this.lastPre && this.lastPre !== pre) { if (this.lastPre.isConnected) highlightPre(this.lastPre); this.lastPre = null; }
    if (pre) this.lastPre = pre;
    if (e.closest('.pop,.modal,#selbar,#blockbar')) return;
    const host = e.closest('.content[contenteditable], .stx[contenteditable]');
    if (!host) { this.hideBars(); return; }
    const sb = $('#selbar');
    const docked = this.docked();
    if (docked) this.updateStates();
    else if (!s.isCollapsed && s.toString().trim()) {
      sb.hidden = false;
      $$('[data-a=link],[data-a=voice],[data-a=card],[data-a=heading],[data-a=quote],[data-c^=insert]', sb).forEach(x => x.hidden = !host.classList.contains('content'));
      const rc = r.getBoundingClientRect();
      const w = sb.offsetWidth, h = sb.offsetHeight;
      let y = rc.top - h - 10; if (y < 8) y = rc.bottom + 10;
      sb.style.left = clamp(rc.left + rc.width / 2 - w / 2, 8, innerWidth - w - 8) + 'px';
      sb.style.top = y + 'px';
    } else sb.hidden = true;
    const bb = $('#blockbar');
    const blk = host.classList.contains('content') ? e.closest('table, pre.code') : null;
    if (blk) {
      bb.innerHTML = blk.tagName === 'TABLE'
        ? `<button data-op="row+">+ صف</button><button data-op="col+">+ عمود</button><button data-op="row-">− صف</button><button data-op="col-">− عمود</button><button data-op="del" class="danger">${ic('trash')}</button>`
        : `<span class="lbl-code">${ic('code')} كود</span><button data-op="copy">${ic('copy')} نسخ</button><button data-op="delpre" class="danger">${ic('trash')}</button>`;
      bb.hidden = false;
      const rc = blk.getBoundingClientRect();
      const w = bb.offsetWidth, h = bb.offsetHeight;
      let y = rc.top - h - 6; if (y < 8) y = rc.bottom + 6;
      if (!sb.hidden && !docked) y = rc.bottom + 6;
      bb.style.left = clamp(rc.left + rc.width / 2 - w / 2, 8, innerWidth - w - 8) + 'px';
      bb.style.top = y + 'px';
    } else bb.hidden = true;
  },
};

/* ============ الملاحظات اللاصقة وصور الستيكر ============ */
const Stickies = {
  COLORS: ['#fff1a1', '#ffd0dc', '#c8f0d4', '#cfe5ff', '#e2d4ff', '#ffd8ae'],
  // ارتفاع تقريبي لما ما نقدر نقيس (مثلاً بالطباعة)
  guessH(s) { return s.h || (s.kind === 'photo' ? s.w * .82 : s.kind === 'video' ? s.w * .5625 + 30 : 140); },
  renderAll(pg, p, live) {
    const layer = $('.stickies', pg);
    layer.innerHTML = '';
    (p.stickies || []).forEach(s => layer.append(this.el(s, p, live, pg)));
  },
  el(s, p, live, pg) {
    const photo = s.kind === 'photo', video = s.kind === 'video', wrap = s.wrap !== false;
    const d = el(`<div class="sticky ${s.kind} ${wrap ? '' : 'over'}" data-sid="${s.id}" style="left:${s.x}px;top:${s.y}px;width:${s.w}px;--rot:${video ? 0 : s.rot}deg;--sc:${s.color || '#fff1a1'}">
      ${video ? `<div class="v-bar">${ic('film')}<span>اسحب من هون</span></div><video data-blob="${s.blob}" ${live ? 'controls' : ''} preload="${live ? 'metadata' : 'none'}" playsinline></video>` : '<div class="tape"></div>'}
      ${photo ? `<img data-blob="${s.blob}" alt="" draggable="false">` : ''}
      ${video ? '' : `<div class="stx${photo ? ' cap' : ''}" ${live ? 'contenteditable="true"' : ''} spellcheck="false" dir="auto" ${photo ? 'data-ph="اكتب تعليقاً…"' : 'data-ph="ملاحظة…"'}>${s.text || ''}</div>`}
      ${live ? `<button class="s-x" title="حذف">${ic('x')}</button>
        <button class="s-w" title="${wrap ? 'النص حواليها — اضغط لتصير فوق النص' : 'فوق النص — اضغط ليلتف النص حواليها'}">${ic(wrap ? 'wrapon' : 'wrapoff')}</button>
        ${photo || video ? '' : '<button class="s-c" title="تغيير اللون"></button>'}<div class="s-rz" title="تغيير الحجم"></div>` : ''}
    </div>`);
    if (!live) return d;
    const save = () => Editor.persist(p);
    const tx = $('.stx', d);
    if (tx) {
      tx.addEventListener('input', () => { s.text = tx.innerHTML === '<br>' ? '' : tx.innerHTML; save(); });
      tx.addEventListener('paste', e => { e.preventDefault(); const t = (e.clipboardData && e.clipboardData.getData('text/plain')) || ''; document.execCommand('insertText', false, t); });
    }
    // نقيس الارتفاع الحقيقي ونخزّنه (لالتفاف النص حتى بالطباعة)
    if (window.ResizeObserver) new ResizeObserver(() => {
      if (!d.isConnected || d.classList.contains('drag')) return;
      const h = d.offsetHeight;
      if (h && Math.abs((s.h || 0) - h) > 2) { s.h = h; save(); Wrap.apply(pg, p); }
    }).observe(d);
    d.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      const t = e.target;
      if (t.closest('.s-x,.s-c,.s-w')) return;
      if (t.closest('video')) return; // أزرار الفيديو نفسه
      const rz = t.closest('.s-rz');
      const arr = p.stickies; const k = arr.indexOf(s);
      if (k > -1 && k < arr.length - 1) { arr.splice(k, 1); arr.push(s); d.parentElement.append(d); }
      if (t.closest('.stx') && !rz) return;
      e.preventDefault();
      const sx = e.clientX, sy = e.clientY, x0 = s.x, y0 = s.y, w0 = s.w, k2 = Reader.scale;
      try { d.setPointerCapture(e.pointerId); } catch { } d.classList.add('drag');
      let raf = 0;
      const mv = ev => {
        const dx = (ev.clientX - sx) / k2, dy = (ev.clientY - sy) / k2;
        if (rz) { s.w = Math.round(clamp(w0 + dx, video ? 180 : 110, 540)); d.style.width = s.w + 'px'; }
        else {
          s.x = Math.round(clamp(x0 + dx, -s.w + 60, PW - 60)); s.y = Math.round(clamp(y0 + dy, -30, PH - 60));
          d.style.left = s.x + 'px'; d.style.top = s.y + 'px';
        }
        if (!raf) raf = requestAnimationFrame(() => { raf = 0; s.h = d.offsetHeight; Wrap.apply(pg, p); });
      };
      const up = () => {
        d.removeEventListener('pointermove', mv); d.removeEventListener('pointerup', up); d.classList.remove('drag');
        s.h = d.offsetHeight; Wrap.apply(pg, p); save();
        const l = Editor.liveOf(pg); if (l) Editor.reflow(l, false);
      };
      d.addEventListener('pointermove', mv); d.addEventListener('pointerup', up);
    });
    $('.s-x', d).onclick = () => {
      const k = p.stickies.indexOf(s); if (k < 0) return;
      p.stickies.splice(k, 1); d.remove(); save(); Wrap.apply(pg, p);
      let undone = false;
      Toast.show({ icon: 'trash', text: photo ? 'حُذفت الصورة' : video ? 'حُذف الفيديو' : 'حُذفت الملاحظة', timeout: 6000, actions: [{ label: 'تراجع', act: () => { undone = true; p.stickies.push(s); Reader.render(); save(); } }] });
      if (s.blob) setTimeout(() => { if (!undone) Media.del(s.blob); }, 6500);
    };
    $('.s-w', d).onclick = () => {
      s.wrap = !(s.wrap !== false);
      d.classList.toggle('over', !s.wrap);
      $('.s-w', d).innerHTML = ic(s.wrap ? 'wrapon' : 'wrapoff');
      $('.s-w', d).title = s.wrap ? 'النص حواليها — اضغط لتصير فوق النص' : 'فوق النص — اضغط ليلتف النص حواليها';
      Wrap.apply(pg, p); save();
      const l = Editor.liveOf(pg); if (l) Editor.reflow(l, false);
      Toast.show({ icon: s.wrap ? 'wrapon' : 'wrapoff', text: s.wrap ? 'النص صار يلتف حواليها' : 'صارت فوق النص', timeout: 1800 });
    };
    const cbtn = $('.s-c', d);
    if (cbtn) cbtn.onclick = () => {
      const i = (this.COLORS.indexOf(s.color) + 1) % this.COLORS.length;
      s.color = this.COLORS[i]; d.style.setProperty('--sc', s.color); save();
    };
    return d;
  },
  add(l, s) {
    (l.p.stickies = l.p.stickies || []).push(s);
    const d = this.el(s, l.p, true, l.pg);
    $('.stickies', l.pg).append(d);
    Media.hydrate(d);
    requestAnimationFrame(() => { s.h = d.offsetHeight; Wrap.apply(l.pg, l.p); Editor.reflow(l, false); });
    Editor.persist(l.p);
    return d;
  },
  addNote(l, pt) {
    const w = 200;
    const s = { id: uid(), kind: 'note', w, x: Math.round(pt ? clamp(pt.x - w / 2, 10, PW - w - 10) : PW - w - 50), y: Math.round(pt ? clamp(pt.y - 20, 10, PH - 180) : 90), rot: +(Math.random() * 6 - 3).toFixed(1), color: this.COLORS[(Math.random() * this.COLORS.length) | 0], text: '' };
    const d = this.add(l, s);
    setTimeout(() => $('.stx', d).focus(), 30);
  },
  async addPhotos(l, files, pt, size = 220) {
    files = files.slice(0, 8);
    let k = 0;
    for (const f of files) {
      const b = await Media.downscale(f, 900);
      const id = await Media.save(b);
      const w = size;
      const bx = pt ? pt.x - w / 2 : 70, by = pt ? pt.y - 60 : 110;
      this.add(l, { id: uid(), kind: 'photo', blob: id, w, x: Math.round(clamp(bx + k * 28, -60, PW - w + 40)), y: Math.round(clamp(by + k * 34, 0, PH - 200)), rot: +(Math.random() * 8 - 4).toFixed(1), text: '' });
      k++;
    }
  },
  addVideo(l, blobId, pt) {
    const w = 300;
    return this.add(l, { id: uid(), kind: 'video', blob: blobId, w, x: Math.round(pt ? clamp(pt.x - w / 2, 20, PW - w - 20) : PW - w - 60), y: Math.round(pt ? clamp(pt.y - 40, 70, PH - 260) : 120), rot: 0 });
  },
};

/* ============ التفاف النص حول الملاحظات والصور والفيديو ============
   شكل غير مرئي على طرف الصفحة (float + shape-outside) والنص بيلف حواليه.
   كل عنصر بينحسب على الطرف الأقرب إله، مثل «التفاف مربّع» بالوورد. */
const Wrap = {
  apply(pg, p) {
    const c = pg && $('.content', pg);
    if (!c) return;
    $$(':scope > .wrapx', c).forEach(x => x.remove());
    const list = (p.stickies || []).filter(s => s.wrap !== false);
    if (!list.length || !c.isConnected) return;
    const cs = getComputedStyle(c);
    const cl = parseFloat(cs.left) || 0, ct = parseFloat(cs.top) || 0;
    const cw = PW - cl - (parseFloat(cs.right) || 0), ch = parseFloat(cs.height) || 700;
    const lh = parseFloat(cs.lineHeight) || 32;
    const sides = { left: [], right: [] };
    list.forEach(s => {
      const h = Stickies.guessH(s);
      const x0 = s.x - cl, x1 = s.x + s.w - cl, y0 = s.y - ct - 8, y1 = s.y + h - ct + 8;
      if (x1 <= 4 || x0 >= cw - 4 || y1 <= 0 || y0 >= ch) return;
      const top = Math.max(0, Math.floor(y0 / lh) * lh), bottom = Math.min(ch, Math.ceil(y1 / lh) * lh);
      if ((x0 + x1) / 2 < cw / 2) sides.left.push({ top, bottom, w: clamp(x1 + 14, 0, cw - 90) });
      else sides.right.push({ top, bottom, w: clamp(cw - x0 + 14, 0, cw - 90) });
    });
    const out = [];
    for (const side of ['left', 'right']) {
      const R = sides[side].sort((a, b) => a.top - b.top), M = [];
      R.forEach(r => { const last = M[M.length - 1]; if (last && r.top <= last.bottom) { last.bottom = Math.max(last.bottom, r.bottom); last.w = Math.max(last.w, r.w); } else M.push({ ...r }); });
      if (!M.length) continue;
      const W = Math.max(...M.map(r => r.w)), H = Math.max(...M.map(r => r.bottom));
      const pts = [];
      if (side === 'left') {
        pts.push('0px 0px');
        M.forEach(r => pts.push(`0px ${r.top}px`, `${r.w}px ${r.top}px`, `${r.w}px ${r.bottom}px`, `0px ${r.bottom}px`));
        pts.push(`0px ${H}px`);
      } else {
        pts.push(`${W}px 0px`);
        M.forEach(r => pts.push(`${W}px ${r.top}px`, `${W - r.w}px ${r.top}px`, `${W - r.w}px ${r.bottom}px`, `${W}px ${r.bottom}px`));
        pts.push(`${W}px ${H}px`);
      }
      const f = document.createElement('div');
      f.className = 'wrapx'; f.contentEditable = 'false';
      f.style.cssText = `float:${side};width:${W}px;height:${H}px;shape-outside:polygon(${pts.join(',')});margin:0`;
      out.push(f);
    }
    c.prepend(...out);
  },
};

/* ============ مرفقات الصفحة (صوت/روابط) ============ */
const Attach = {
  render(pg, p, live) {
    const box = $('.attach', pg);
    box.innerHTML = '';
    (p.attach || []).forEach(a => {
      const isVid = a.type === 'link' && Links.isVideo(a.url);
      const title = a.type === 'audio' ? 'تسجيل صوتي' + (a.dur ? ' · ' + fmtTime(a.dur) : '') : (a.title || a.url);
      const b = el(`<button class="att att-${a.type}" title="${esc(title)}">${ic(a.type === 'audio' ? 'mic' : isVid ? 'video' : 'link')}<span>${esc(a.type === 'audio' ? fmtTime(a.dur || 0) : (a.title || Links.short(a.url)))}</span></button>`);
      if (live) {
        b.onclick = e => {
          e.stopPropagation();
          if (a.type === 'audio') Player.toggle(a.blob, b);
          else this.menu(b, p, a);
        };
        b.oncontextmenu = e => { e.preventDefault(); e.stopPropagation(); this.menu(b, p, a); };
      }
      box.append(b);
    });
  },
  menu(btn, p, a) {
    const items = a.type === 'audio'
      ? [{ icon: 'play', label: 'تشغيل / إيقاف', act: () => Player.toggle(a.blob, btn) }]
      : [{ icon: 'open', label: 'فتح الرابط', act: () => Links.openUrl(a.url) }, { icon: 'copy', label: 'نسخ الرابط', act: () => navigator.clipboard.writeText(a.url) }];
    items.push('-', { icon: 'trash', label: 'إزالة من الصفحة', danger: true, act: () => this.remove(p, a) });
    Menu.open(btn, items);
  },
  add(l, a) {
    (l.p.attach = l.p.attach || []).push(a);
    this.render(l.pg, l.p, true);
    Editor.persist(l.p);
  },
  remove(p, a) {
    const k = p.attach.indexOf(a); if (k < 0) return;
    p.attach.splice(k, 1);
    if (a.blob) Media.del(a.blob);
    Editor.persist(p);
    Reader.render();
  },
};

/* ============ قائمة الكليك يمين ============ */
const Ctx = {
  open(e, l) {
    const s = getSelection();
    const inThis = s.rangeCount && l.c.contains(s.anchorNode);
    const onContent = e.target.closest('.content');
    if (onContent && (!inThis || s.isCollapsed)) {
      const r = document.caretRangeFromPoint && document.caretRangeFromPoint(e.clientX, e.clientY);
      if (r && l.c.contains(r.startContainer)) { l.c.focus(); Sel.restore(r); }
    }
    const pt = Editor.pagePoint(l.pg, e.clientX, e.clientY);
    const hasSel = !getSelection().isCollapsed && l.c.contains(getSelection().anchorNode);
    const saved = Sel.save();
    const doAt = fn => () => { if (saved && l.c.contains(saved.startContainer)) { l.c.focus(); Sel.restore(saved); } fn(); };
    const items = [];
    if (hasSel) items.push(
      { icon: 'cut', label: 'قص', hint: 'Ctrl+X', act: doAt(() => document.execCommand('cut')) },
      { icon: 'copy', label: 'نسخ', hint: 'Ctrl+C', act: doAt(() => document.execCommand('copy')) });
    items.push(
      { icon: 'paste', label: 'لصق', hint: 'Ctrl+V', act: doAt(() => navigator.clipboard.readText().then(t => { if (looksLikeCode(t)) Editor.insertCode(l, t); else Editor.pastePlain(t); }).catch(() => Toast.show({ icon: 'paste', text: 'استخدم Ctrl+V للصق' }))) },
      { icon: 'code', label: 'لصق ككود', act: doAt(() => navigator.clipboard.readText().then(t => Editor.insertCode(l, t)).catch(() => Editor.insertCode(l))) },
      '-', { head: 'إدراج' },
      { icon: 'table', label: 'جدول', act: doAt(() => this.tablePicker(e, l)) },
      { icon: 'code', label: 'صندوق كود', act: doAt(() => Editor.insertCode(l)) },
      { icon: 'math', label: 'معادلة (½ x² √)', hint: 'Alt+=', act: doAt(() => MathEq.open(l)) },
      { icon: 'check', label: 'قائمة مهام', act: doAt(() => Editor.insertChecklist(l)) },
      { icon: 'note', label: 'ملاحظة لاصقة', act: () => Stickies.addNote(l, pt) },
      { icon: 'image', label: 'صور من جهازك (ستيكر)', act: async () => { const fs = await pickFile('image/*', true); if (fs.length) Stickies.addPhotos(l, fs, pt); } },
      { icon: 'film', label: 'فيديو قصير', act: doAt(() => Media2.insertVideo(l)) },
      { icon: 'video', label: 'رابط فيديو/موقع', act: doAt(() => Links.open(Sel.save(), l)) },
      { icon: 'page', label: 'رابط لصفحة أو كتاب', act: doAt(() => Links.open(Sel.save(), l, 'page')) },
      { icon: 'mic', label: hasSel ? 'تسجيل صوت للكلمة المحددة' : 'تسجيل صوت للصفحة', act: doAt(() => hasSel ? Voice.attachToSelection(Sel.save(), l) : Voice.attachToPage(l, e)) },
      { icon: 'music', label: 'ملف صوتي من جهازك', act: () => AudioFile.attach(l) },
      { icon: 'upload', label: 'ملف Word / Excel / PDF…', act: () => Importer.pick(l) },
      '-', { head: `الصفحة ${l.i + 1}` },
      { icon: 'web', label: 'اربطها بصفحة ثانية…', act: () => IdeaWeb.picker(l.p, l.i) },
      { icon: 'web', label: 'شبكة الأفكار', hint: 'Ctrl+G', act: () => IdeaWeb.open(l.p.id) },
      { icon: 'sliders', label: 'ورق هذه الصفحة…', act: () => this.pageStyle(e, l) },
      { icon: 'addpage', label: 'إضافة صفحة بعدها', act: () => Reader.insertPageAfter(l.i) },
      { icon: 'trash', label: 'حذف هذه الصفحة', danger: true, act: () => Reader.deletePage(l.i) });
    Menu.open({ x: e.clientX, y: e.clientY }, items, { place: 'point' });
  },
  tablePicker(e, l) {
    const saved = Sel.save();
    const g = el(`<div class="tpick"><div class="tgrid"></div><div class="tlbl">جدول 3 × 3</div></div>`);
    const grid = $('.tgrid', g);
    for (let r = 1; r <= 8; r++) for (let c = 1; c <= 8; c++) grid.append(el(`<i data-r="${r}" data-c="${c}"></i>`));
    let R = 3, C = 3;
    const paint = () => { $$('i', grid).forEach(x => x.classList.toggle('on', +x.dataset.r <= R && +x.dataset.c <= C)); $('.tlbl', g).textContent = `جدول ${R} × ${C}`; };
    grid.addEventListener('mouseover', ev => { const x = ev.target.closest('i'); if (!x) return; R = +x.dataset.r; C = +x.dataset.c; paint(); });
    grid.addEventListener('mousedown', ev => ev.preventDefault());
    grid.addEventListener('click', () => { Pop.close(); l.c.focus(); Sel.restore(saved); Editor.insertTable(l, R, C); });
    paint();
    Pop.open({ x: e.clientX, y: e.clientY }, g, { place: 'point', cls: 'mini-pop' });
  },
  pageStyle(e, l) {
    const cur = l.p.style || null;
    Menu.open({ x: e.clientX, y: e.clientY }, [
      { icon: 'books', label: (cur ? '' : '✓ ') + 'مثل باقي الكتاب', act: () => { l.p.style = null; Editor.persist(l.p); Reader.render(); } },
      ...PAPER_STYLES.map(([v, t]) => ({ icon: 'page', label: (cur === v ? '✓ ' : '') + t, act: () => { l.p.style = v; Editor.persist(l.p); Editor.flushAll(); Reader.render(); } })),
    ], { place: 'point' });
  },
};
