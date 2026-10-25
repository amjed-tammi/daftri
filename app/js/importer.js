'use strict';
/* ============ استيراد الملفات: Word و Excel و CSV و PDF، واللصق المنسّق من أي مكان ============
   كله بدون مكتبات: فك الضغط من المتصفح نفسه (DecompressionStream)، وقراءة XML و PDF بإيدينا. */


async function inflateBytes(u8, fmt = 'deflate-raw') {
  const out = new Blob([u8]).stream().pipeThrough(new DecompressionStream(fmt));
  return new Uint8Array(await new Response(out).arrayBuffer());
}
const xmlDoc = t => t ? new DOMParser().parseFromString(t, 'application/xml') : null;
// عناصر XML بالاسم المحلي (بدون البادئة w: أو a:)
const xk = (e, n) => e ? [...e.children].filter(c => c.localName === n) : [];
const x1 = (e, n) => e ? [...e.children].find(c => c.localName === n) || null : null;
const xall = (e, n) => e ? [...e.getElementsByTagNameNS('*', n)] : [];
const xa = (e, n) => { if (!e) return null; for (const a of e.attributes) if (a.localName === n) return a.value; return null; };
const xon = e => !!e && !/^(0|false|off|none)$/i.test(xa(e, 'val') || '1');

// ألوان: ما منحتفظ بالأسود/الأبيض (حتى يضل الحبر شغّال على كل أنواع الورق، حتى الورق الأسود)
function importColor(v, { bg = false } = {}) {
  if (!v) return null;
  v = String(v).trim().toLowerCase();
  if (/^(auto|none|transparent|windowtext|window|inherit|initial|currentcolor)$/.test(v)) return null;
  let r, g, b, m;
  if ((m = v.match(/^#?([0-9a-f]{8})$/))) v = '#' + m[1].slice(2); // ARGB من إكسل
  if ((m = v.match(/^#?([0-9a-f]{6})$/))) { const n = parseInt(m[1], 16); r = n >> 16; g = (n >> 8) & 255; b = n & 255; }
  else if ((m = v.match(/^#([0-9a-f]{3})$/))) { r = parseInt(m[1][0] + m[1][0], 16); g = parseInt(m[1][1] + m[1][1], 16); b = parseInt(m[1][2] + m[1][2], 16); }
  else if ((m = v.match(/^rgba?\(([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:[ ,/]+([\d.]+))?/))) { if (m[4] != null && +m[4] < .2) return null; r = +m[1]; g = +m[2]; b = +m[3]; }
  else {
    const named = { black: '#000000', white: '#ffffff', red: '#e53935', green: '#2e7d32', blue: '#1e63c4', yellow: '#fff176', cyan: '#b3e5fc', magenta: '#ffc1e3', darkblue: '#1a237e', darkred: '#8e1b1b', darkgreen: '#1b5e20', darkyellow: '#ffd59e', darkcyan: '#00838f', darkmagenta: '#7b1fa2', lightgray: '#e0e0e0', darkgray: '#616161', gray: '#9e9e9e', orange: '#ef6c00', purple: '#6a1b9a', pink: '#ffc1e3' };
    return named[v] ? importColor(named[v], { bg }) : null;
  }
  const L = (.2126 * r + .7152 * g + .0722 * b) / 255;
  if (bg ? L > .96 : (L < .16 || L > .9)) return null;
  return '#' + [r, g, b].map(x => Math.round(x).toString(16).padStart(2, '0')).join('');
}
// هايلايت وورد بالأسماء
const WORD_HL = { yellow: '#fff176', green: '#b9f6ca', brightgreen: '#b9f6ca', cyan: '#b3e5fc', turquoise: '#b3e5fc', magenta: '#ffc1e3', pink: '#ffc1e3', red: '#ff9e9e', blue: '#b3c7ff', darkyellow: '#ffd59e', lightgray: '#e6e6e6', gray: '#d0d0d0' };

/* ===== قارئ ZIP صغير (docx و xlsx أصلاً ملفات zip) ===== */
const Zip = {
  async open(blob) {
    const buf = new Uint8Array(await blob.arrayBuffer()), dv = new DataView(buf.buffer);
    let e = buf.length - 22;
    while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
    if (e < 0) throw new Error('الملف مش سليم أو مش docx/xlsx حقيقي');
    const n = dv.getUint16(e + 10, true);
    let p = dv.getUint32(e + 16, true);
    const files = new Map(), dec = new TextDecoder();
    for (let i = 0; i < n && dv.getUint32(p, true) === 0x02014b50; i++) {
      const nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
      files.set(dec.decode(buf.subarray(p + 46, p + 46 + nl)), { method: dv.getUint16(p + 10, true), size: dv.getUint32(p + 20, true), off: dv.getUint32(p + 42, true) });
      p += 46 + nl + xl + cl;
    }
    const bytes = async name => {
      const f = files.get(name.replace(/^\//, '')); if (!f) return null;
      const start = f.off + 30 + dv.getUint16(f.off + 26, true) + dv.getUint16(f.off + 28, true);
      const raw = buf.subarray(start, start + f.size);
      return f.method === 0 ? raw : f.method === 8 ? inflateBytes(raw) : null;
    };
    return { files, bytes, text: async name => { const b = await bytes(name); return b ? dec.decode(b) : null; } };
  },
  // مسار نسبي داخل الحزمة (word/_rels → word/media/x.png)
  resolve(base, target) {
    if (!target) return '';
    if (target.startsWith('/')) return target.slice(1);
    const parts = base.split('/').filter(Boolean);
    for (const s of target.split('/')) { if (s === '..') parts.pop(); else if (s !== '.') parts.push(s); }
    return parts.join('/');
  },
  async rels(z, path, base) {
    const d = xmlDoc(await z.text(path)), m = {};
    xall(d, 'Relationship').forEach(r => { m[r.getAttribute('Id')] = { target: xa(r, 'TargetMode') === 'External' ? r.getAttribute('Target') : this.resolve(base, r.getAttribute('Target')), ext: xa(r, 'TargetMode') === 'External', type: r.getAttribute('Type') || '' }; });
    return m;
  },
};

/* ===== وورد (.docx) ===== */
const Docx = {
  async read(file) {
    const z = await Zip.open(file);
    const doc = xmlDoc(await z.text('word/document.xml'));
    if (!doc || !xall(doc, 'body').length) throw new Error('هاد مش ملف وورد (.docx) سليم');
    const rels = await Zip.rels(z, 'word/_rels/document.xml.rels', 'word');
    // الأنماط: نعرف العناوين حتى لو اسم النمط بالعربي
    const styles = {};
    xall(xmlDoc(await z.text('word/styles.xml')), 'style').forEach(s => {
      const id = xa(s, 'styleId'); if (!id) return;
      const rpr = x1(s, 'rPr'), ppr = x1(s, 'pPr');
      styles[id] = { name: (xa(x1(s, 'name'), 'val') || '').toLowerCase(), based: xa(x1(s, 'basedOn'), 'val'), outline: xa(x1(ppr, 'outlineLvl'), 'val'), b: rpr && x1(rpr, 'b') ? xon(x1(rpr, 'b')) : null, i: rpr && x1(rpr, 'i') ? xon(x1(rpr, 'i')) : null, color: xa(x1(rpr, 'color'), 'val') };
    });
    const level = id => {
      for (let k = 0, s = styles[id]; s && k < 8; k++, s = styles[s.based]) {
        const m = s.name.match(/^heading (\d)$/) || (id && id.match(/^heading(\d)$/i));
        if (m) return +m[1];
        if (s.name === 'title') return 1;
        if (s.outline != null && +s.outline < 6) return +s.outline + 1;
        id = s.based;
      }
      return 0;
    };
    // الترقيم: نقاط ولا أرقام
    const numFmt = {};
    const nd = xmlDoc(await z.text('word/numbering.xml'));
    if (nd) {
      const abs = {};
      xall(nd, 'abstractNum').forEach(a => { abs[xa(a, 'abstractNumId')] = xk(a, 'lvl').map(l => xa(x1(l, 'numFmt'), 'val') || 'bullet'); });
      xall(nd, 'num').forEach(n => { numFmt[xa(n, 'numId')] = abs[xa(x1(n, 'abstractNumId'), 'val')] || []; });
    }
    const images = [], blocks = [];
    const imgCache = {};
    const image = async rid => {
      const r = rels[rid]; if (!r || r.ext) return '';
      if (!(r.target in imgCache)) {
        const b = await z.bytes(r.target);
        const ext = (r.target.split('.').pop() || '').toLowerCase();
        const type = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp' }[ext];
        imgCache[r.target] = b && type ? images.push(new Blob([b], { type })) - 1 : -1;
      }
      return imgCache[r.target] >= 0 ? `<p data-imgph="${imgCache[r.target]}"><br></p>` : '';
    };

    const run = async (r, out) => {
      const pr = x1(r, 'rPr'), cs = styles[xa(x1(pr, 'rStyle'), 'val')] || {};
      const on = n => { const e = x1(pr, n); return e ? xon(e) : null; };
      const b = on('b') ?? on('bCs') ?? cs.b, i = on('i') ?? on('iCs') ?? cs.i;
      const u = (xa(x1(pr, 'u'), 'val') || 'none') !== 'none', s = on('strike') || on('dstrike');
      const color = importColor(xa(x1(pr, 'color'), 'val') || cs.color);
      const hl = WORD_HL[(xa(x1(pr, 'highlight'), 'val') || '').toLowerCase()] || importColor(xa(x1(pr, 'shd'), 'fill'), { bg: true });
      const va = xa(x1(pr, 'vertAlign'), 'val');
      let t = '';
      for (const c of r.children) {
        const n = c.localName;
        if (n === 't') t += esc(c.textContent);
        else if (n === 'tab') t += '&emsp;';
        else if (n === 'br' || n === 'cr') { if (xa(c, 'type') === 'page') out.pb = true; else t += '<br>'; }
        else if (n === 'noBreakHyphen') t += '-';
        else if (n === 'drawing' || n === 'pict' || n === 'object' || n === 'AlternateContent') {
          const blip = xall(c, 'blip')[0], vml = xall(c, 'imagedata')[0];
          const rid = blip ? xa(blip, 'embed') : vml ? xa(vml, 'id') : null;
          if (rid) out.imgs.push(await image(rid));
        }
      }
      if (!t) return '';
      if (va === 'superscript') t = `<sup>${t}</sup>`; else if (va === 'subscript') t = `<sub>${t}</sub>`;
      if (hl) t = `<span style="background-color:${hl}">${t}</span>`;
      if (color) t = `<span style="color:${color}">${t}</span>`;
      if (s) t = `<s>${t}</s>`;
      if (u) t = `<u>${t}</u>`;
      if (i) t = `<i>${t}</i>`;
      if (b) t = `<b>${t}</b>`;
      return t;
    };
    const inline = async (e, out) => {
      let h = '';
      for (const c of e.children) {
        const n = c.localName;
        if (n === 'r') h += await run(c, out);
        else if (n === 'hyperlink') {
          const r = rels[xa(c, 'id')], inner = await inline(c, out);
          h += r && r.ext && /^(https?:|mailto:)/i.test(r.target) ? `<a href="${esc(r.target)}" target="_blank" rel="noopener">${inner}</a>` : inner;
        } else if (n === 'del' || n === 'pPr' || n === 'rPr' || n === 'moveFrom') continue;
        else if (n === 'oMath' || n === 'oMathPara') h += esc(c.textContent);
        else if (c.children.length) h += await inline(c, out); // ins, smartTag, sdt, fldSimple…
      }
      return h;
    };
    const ALIGN = { center: 'center', left: 'left', right: 'right', start: 'left', end: 'right' };
    const para = async p => {
      const pr = x1(p, 'pPr'), out = { imgs: [], pb: false };
      const sid = xa(x1(pr, 'pStyle'), 'val');
      const html = (await inline(p, out)).replace(/^(\s|&emsp;)+$/, '');
      const lv = level(sid);
      const num = x1(pr, 'numPr');
      const numId = xa(x1(num, 'numId'), 'val'), ilvl = +(xa(x1(num, 'ilvl'), 'val') || 0);
      let al = ALIGN[xa(x1(pr, 'jc'), 'val')] || '';
      // بالفقرات العربية (bidi) وورد بيكتب «يسار/يمين» بمعنى البداية/النهاية
      if (al && al !== 'center' && x1(pr, 'bidi') && xon(x1(pr, 'bidi'))) al = al === 'left' ? 'right' : 'left';
      if (x1(pr, 'pageBreakBefore') && xon(x1(pr, 'pageBreakBefore'))) out.pbBefore = true;
      return { html, lv, list: numId && numId !== '0' ? { ordered: !/bullet|none/.test((numFmt[numId] || [])[ilvl] || 'bullet'), ilvl, numId } : null, al, out };
    };
    const st = al => al ? ` style="text-align:${al}"` : '';
    const table = async t => {
      const rows = xk(t, 'tr'), grid = [];
      const spanAt = {}; // عمود → خلية بدأت دمج عمودي
      let h = '<table class="tbl"><tbody>';
      for (let ri = 0; ri < rows.length; ri++) {
        const cells = []; let col = 0;
        for (const tc of xk(rows[ri], 'tc')) {
          const pr = x1(tc, 'tcPr');
          const span = +(xa(x1(pr, 'gridSpan'), 'val') || 1);
          const vm = x1(pr, 'vMerge'), vmv = vm ? (xa(vm, 'val') || 'continue') : null;
          if (vmv === 'continue' && spanAt[col]) { spanAt[col].rs++; col += span; continue; }
          const parts = [];
          for (const c of tc.children) {
            if (c.localName === 'p') { const q = await para(c); parts.push((q.list ? '• ' : '') + q.html); }
            else if (c.localName === 'tbl') parts.push(esc(c.textContent));
          }
          const cell = { html: parts.filter((x, k) => x || k < parts.length - 1).join('<br>') || '<br>', cs: span, rs: 1, bg: importColor(xa(x1(pr, 'shd'), 'fill'), { bg: true }) };
          if (vmv === 'restart') spanAt[col] = cell; else delete spanAt[col];
          cells.push(cell); col += span;
        }
        grid.push(cells);
      }
      grid.forEach((cells, ri) => {
        h += '<tr>' + cells.map(c => { const tag = ri === 0 ? 'th' : 'td'; return `<${tag}${c.cs > 1 ? ` colspan="${c.cs}"` : ''}${c.rs > 1 ? ` rowspan="${c.rs}"` : ''}${c.bg ? ` style="background-color:${c.bg}"` : ''}>${c.html}</${tag}>`; }).join('') + '</tr>';
      });
      return h + '</tbody></table>';
    };

    // القوائم: منبني كل قائمة كاملة (مع التداخل) قبل ما نسكّرها
    let L = null;
    const flushL = () => {
      if (!L) return;
      let h = '';
      const stack = [];
      for (const it of L) {
        const d = Math.min(it.ilvl, stack.length);
        while (stack.length > d + 1) h += `</li></${stack.pop()}>`;
        if (stack.length === d + 1) h += '</li>';
        else { const tag = it.ordered ? 'ol' : 'ul'; h += `<${tag}>`; stack.push(tag); }
        h += `<li>${it.html || '<br>'}`;
      }
      while (stack.length) h += `</li></${stack.pop()}>`;
      blocks.push(h);
      L = null;
    };
    let blank = 0;
    const walk = async parent => {
      for (const e of parent.children) {
        const n = e.localName;
        if (n === 'p') {
          const q = await para(e);
          if (q.out.pbBefore) { flushL(); blocks.push('\f'); }
          if (q.list && (q.html || !q.out.imgs.length)) { if (L && L[0].numId !== q.list.numId && !q.list.ilvl) flushL(); (L = L || []).push({ ...q.list, html: q.html }); }
          else {
            flushL();
            if (q.html) {
              blank = 0;
              const tag = q.lv === 1 ? 'h2' : q.lv > 1 ? 'h3' : 'p';
              blocks.push(`<${tag}${st(q.al)}>${q.html}</${tag}>`);
            } else if (!q.out.imgs.length && !q.out.pb && ++blank === 1 && blocks.length) blocks.push('<p><br></p>');
          }
          q.out.imgs.forEach(x => x && blocks.push(x));
          if (q.out.pb) { flushL(); blocks.push('\f'); }
        } else if (n === 'tbl') { flushL(); blank = 0; blocks.push(await table(e)); }
        else if (n === 'sdt') await walk(x1(e, 'sdtContent') || e);
        else if (n === 'sectPr') continue;
        else if (e.children.length && n !== 'del') await walk(e);
      }
    };
    await walk(xall(doc, 'body')[0]);
    flushL();
    while (blocks.length && (blocks[blocks.length - 1] === '<p><br></p>' || blocks[blocks.length - 1] === '\f')) blocks.pop();
    return { blocks, images };
  },
};

/* ===== إكسل (.xlsx) و CSV ===== */
const Sheets = {
  col(ref) { let n = 0; for (const ch of ref.replace(/\d+/g, '')) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; },
  isDateFmt(id, code) {
    if ((id >= 14 && id <= 22) || (id >= 45 && id <= 47)) return true;
    return !!code && /[dmy]/i.test(code.replace(/"[^"]*"|\[[^\]]*\]|\\./g, '')) && !/^[#0.,%\s]+$/.test(code);
  },
  fmtDate(v) {
    const d = new Date(Math.round((v - 25569) * 864e5));
    const p = n => String(n).padStart(2, '0');
    const t = v % 1 ? ` ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}` : '';
    return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}${t}`;
  },
  async readXlsx(file) {
    const z = await Zip.open(file);
    const wb = xmlDoc(await z.text('xl/workbook.xml'));
    if (!wb) throw new Error('هاد مش ملف إكسل (.xlsx) سليم');
    const rels = await Zip.rels(z, 'xl/_rels/workbook.xml.rels', 'xl');
    const shared = xall(xmlDoc(await z.text('xl/sharedStrings.xml')), 'si').map(si => xall(si, 't').filter(t => t.parentNode.localName !== 'rPh').map(t => t.textContent).join(''));
    const sd = xmlDoc(await z.text('xl/styles.xml'));
    const fmts = {}; xall(sd, 'numFmt').forEach(f => { fmts[xa(f, 'numFmtId')] = xa(f, 'formatCode'); });
    const fonts = xk(x1(sd && sd.documentElement, 'fonts'), 'font').map(f => ({ b: !!x1(f, 'b') && xon(x1(f, 'b')), i: !!x1(f, 'i') && xon(x1(f, 'i')), color: importColor(xa(x1(f, 'color'), 'rgb')) }));
    const fills = xk(x1(sd && sd.documentElement, 'fills'), 'fill').map(f => { const p = x1(f, 'patternFill'); return p && xa(p, 'patternType') === 'solid' ? importColor(xa(x1(p, 'fgColor'), 'rgb'), { bg: true }) : null; });
    const xfs = xk(x1(sd && sd.documentElement, 'cellXfs'), 'xf').map(x => ({ num: +(xa(x, 'numFmtId') || 0), font: fonts[+(xa(x, 'fontId') || 0)] || {}, fill: fills[+(xa(x, 'fillId') || 0)] || null, al: xa(x1(x, 'alignment'), 'horizontal') }));
    const out = [];
    for (const sh of xall(wb, 'sheet')) {
      const r = rels[xa(sh, 'id')]; if (!r) continue;
      const d = xmlDoc(await z.text(r.target)); if (!d) continue;
      const rtl = xall(d, 'sheetView').some(v => v.getAttribute('rightToLeft') === '1');
      const grid = [];
      for (const row of xall(d, 'row').slice(0, 1000)) {
        const ri = +(row.getAttribute('r') || grid.length + 1) - 1;
        for (const c of xk(row, 'c')) {
          const ci = this.col(c.getAttribute('r') || 'A'); if (ci > 40) continue;
          const t = c.getAttribute('t'), v = x1(c, 'v'), xf = xfs[+(c.getAttribute('s') || 0)] || { font: {} };
          let s = '';
          if (t === 's') s = shared[+(v && v.textContent)] ?? '';
          else if (t === 'inlineStr') s = xall(c, 't').map(x => x.textContent).join('');
          else if (t === 'b') s = v && v.textContent === '1' ? 'TRUE' : 'FALSE';
          else if (v) {
            s = v.textContent;
            if (t !== 'str' && t !== 'e' && s !== '' && !isNaN(+s)) {
              const n = +s;
              if (this.isDateFmt(xf.num, fmts[xf.num])) s = this.fmtDate(n);
              else if (xf.num === 9 || xf.num === 10 || /%/.test(fmts[xf.num] || '')) s = +(n * 100).toFixed(2) + '%';
              else s = String(+n.toPrecision(12));
            }
          }
          (grid[ri] = grid[ri] || [])[ci] = { v: s, b: xf.font.b, i: xf.font.i, color: xf.font.color, bg: xf.fill, al: { center: 'center', left: 'left', right: 'right' }[xf.al] };
        }
      }
      const merges = xall(d, 'mergeCell').map(m => m.getAttribute('ref').split(':')).map(([a, b]) => ({ r0: +a.replace(/\D/g, '') - 1, c0: this.col(a), r1: +b.replace(/\D/g, '') - 1, c1: this.col(b) }));
      out.push({ name: sh.getAttribute('name') || '', grid, merges, rtl });
    }
    return out;
  },
  // CSV: بنعرف الفاصل لحاله، وملفات إكسل العربي القديمة (windows-1256) كمان
  async readCsv(file) {
    const buf = new Uint8Array(await file.arrayBuffer());
    let text = new TextDecoder('utf-8').decode(buf);
    if (text.includes('�')) { try { text = new TextDecoder('windows-1256').decode(buf); } catch { } }
    text = text.replace(/^﻿/, '');
    const first = text.split(/\r?\n/)[0] || '';
    const delim = /\.tsv$/i.test(file.name) ? '\t' : [',', ';', '\t'].sort((a, b) => first.split(b).length - first.split(a).length)[0];
    const rows = [[]]; let cur = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"' && !cur) q = true;
      else if (ch === delim) { rows[rows.length - 1].push(cur); cur = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; rows[rows.length - 1].push(cur); cur = ''; rows.push([]); }
      else cur += ch;
    }
    if (cur || rows[rows.length - 1].length) rows[rows.length - 1].push(cur);
    return [{ name: '', grid: rows.filter(r => r.some(x => x.trim())).slice(0, 1000).map(r => r.map(v => ({ v }))), merges: [], rtl: false }];
  },
  toHtml(sheet) {
    const g = sheet.grid;
    let rows = g.length, cols = 0;
    g.forEach(r => r && r.forEach((c, i) => { if (c && String(c.v).trim()) cols = Math.max(cols, i + 1); }));
    while (rows && !(g[rows - 1] || []).some(c => c && String(c.v).trim())) rows--;
    if (!rows || !cols) return '';
    let r0 = 0; while (r0 < rows && !(g[r0] || []).some(c => c && String(c.v).trim())) r0++;
    const skip = new Set(), span = {};
    sheet.merges.forEach(m => { span[m.r0 + ',' + m.c0] = m; for (let r = m.r0; r <= m.r1; r++) for (let c = m.c0; c <= m.c1; c++) if (r !== m.r0 || c !== m.c0) skip.add(r + ',' + c); });
    let h = `<table class="tbl"${sheet.rtl ? ' dir="rtl"' : ''}><tbody>`;
    for (let r = r0; r < rows; r++) {
      h += '<tr>';
      for (let c = 0; c < cols; c++) {
        if (skip.has(r + ',' + c)) continue;
        const x = (g[r] || [])[c] || { v: '' }, m = span[r + ',' + c];
        const tag = r === r0 ? 'th' : 'td';
        let v = esc(String(x.v)).replace(/\n/g, '<br>') || '<br>';
        if (x.color) v = `<span style="color:${x.color}">${v}</span>`;
        if (x.i) v = `<i>${v}</i>`;
        if (x.b && tag === 'td') v = `<b>${v}</b>`;
        const css = (x.bg ? `background-color:${x.bg};` : '') + (x.al ? `text-align:${x.al};` : '');
        h += `<${tag}${m && m.c1 > m.c0 ? ` colspan="${Math.min(cols, m.c1 + 1) - c}"` : ''}${m && m.r1 > m.r0 ? ` rowspan="${Math.min(rows - 1, m.r1) - r + 1}"` : ''}${css ? ` style="${css}"` : ''}>${v}</${tag}>`;
      }
      h += '</tr>';
    }
    return h + '</tbody></table>';
  },
  // بطاقات: كل سطر من الجدول العريض = بطاقة (عنوان + «العمود: القيمة»)
  cards(head, data, val, out) {
    const names = head.map((h, c) => val(h) || `عمود ${c + 1}`);
    // أعمدة تابعة لعمود قبلها: «Task 1» ← «Task 1 Hours» و «Task 1 Status» بسطر واحد
    const parent = names.map((nm, c) => { for (let q = c - 1; q >= Math.max(0, c - 4); q--) if (nm.toLowerCase().startsWith(names[q].toLowerCase() + ' ')) return q; return -1; });
    const kidsOf = names.map((_, c) => parent.map((pp, k) => pp === c ? k : -1).filter(k => k >= 0));
    // عمود تجميع (مثل «الأسبوع» المدموج على كذا سطر) بيصير عنوان قسم
    const col0 = data.map(r => val(r[0])), filled = col0.filter(Boolean);
    const groupCol = filled.length && filled.length < data.length && (new Set(filled).size <= Math.max(1, data.length / 3) || filled.length < data.length * .6);
    let lastGroup = '';
    data.forEach((r, k) => {
      const has = c => !!val(r[c]);
      let cols = r.map((_, c) => c).filter(has);
      if (groupCol) {
        const gv = col0[k] || lastGroup;
        if (gv && gv !== lastGroup) { out.push(`<h2>${esc(names[0])}: ${esc(gv)}</h2>`); lastGroup = gv; }
        cols = cols.filter(c => c !== 0);
      }
      if (!cols.length) return;
      // عنوان البطاقة: أول خانة أو خانتين قصار (مثل التاريخ واليوم)
      const title = [];
      for (const c of cols) { if (val(r[c]).length <= 40 && title.length < 2 && !kidsOf[c].some(has)) title.push(c); else break; }
      if (!title.length) title.push(cols[0]);
      out.push(`<h3>${title.map(c => this.cell(r[c])).join(' · ')}</h3>`);
      const shortL = [], lines = [];
      for (const c of cols) {
        if (title.includes(c)) continue;
        if (parent[c] >= 0 && has(parent[c])) continue; // بيطلع مع أبوه
        const kids = kidsOf[c].filter(has).map(kk => `${esc(names[kk].slice(names[c].length).trim())} ${this.cell(r[kk])}`);
        const line = `<b>${esc(names[c])}:</b> ${this.cell(r[c])}${kids.length ? ` <i>(${kids.join(' · ')})</i>` : ''}`;
        if (!kids.length && val(r[c]).length <= 24 && names[c].length <= 26) shortL.push(line); else lines.push(line);
      }
      if (shortL.length) out.push(`<p>${shortL.join(' &nbsp;·&nbsp; ')}</p>`);
      lines.forEach(x => out.push(`<p>${x}</p>`));
      out.push('<p><br></p>');
    });
  },
  // بنفهم الشيت متل الإنسان: سطر عنوان، سطر ملخّص (اسم/قيمة)، وجدول البيانات
  analyze(sheet) {
    const g = sheet.grid, val = c => c && String(c.v).trim() ? String(c.v).trim() : '';
    const rows = [];
    for (let r = 0; r < g.length; r++) rows.push(g[r] || []);
    // الأعمدة الفاضية بالكامل (تنسيق بس) منشيلها
    let maxC = 0; rows.forEach(r => r.forEach((c, i) => { if (val(c)) maxC = Math.max(maxC, i + 1); }));
    const used = []; for (let c = 0; c < maxC; c++) if (rows.some(r => val(r[c]))) used.push(c);
    const vmerge = new Set(); // خلايا مغطّاة بدمج عمودي → نفس قيمة اللي فوق
    sheet.merges.forEach(m => { for (let r = m.r0 + 1; r <= m.r1; r++) vmerge.add(r + ',' + m.c0); });
    const info = rows.map(r => { const cells = used.map(c => r[c] || { v: '' }); return { cells, n: cells.filter(val).length }; });
    const numish = s => /^[-+]?[\d.,]+%?$|^\d{4}-\d{2}-\d{2}/.test(s);
    // سطر ملخّص: اسم ← قيمة (رقم/تاريخ/نسبة) ← اسم ← قيمة…
    const isPairs = i => { const v = info[i].cells.filter(val).map(val); if (v.length < 4 || v.length % 2) return false; const vals = v.filter((_, k) => k % 2), keys = v.filter((_, k) => !(k % 2)); return vals.filter(numish).length >= vals.length * .7 && keys.every(x => !numish(x)); };
    // سطر العناوين: بعده سطور بيانات شبهه (مش لحاله)
    const isHeader = i => {
      const n = info[i].n; if (n < 2 || isPairs(i)) return false;
      const next = []; for (let j = i + 1; j < info.length && next.length < 3; j++) if (info[j].n) next.push(info[j].n); else if (next.length) break;
      return next.length >= 1 && next.some(m => m >= Math.max(2, n * .3)) && (next.length >= 2 || next[0] >= n * .6);
    };
    const parts = [];
    for (let i = 0; i < info.length; i++) {
      const { cells, n } = info[i];
      if (!n) continue;
      if (isHeader(i)) {
        const grp = { type: 'table', rows: [cells], ri: [i] };
        for (let j = i + 1; j < info.length && info[j].n; j++) { grp.rows.push(info[j].cells); grp.ri.push(j); i = j; }
        parts.push(grp);
      } else if (n === 1) {
        const c = cells.find(val);
        parts.push({ type: val(c).length > 70 ? 'note' : 'title', text: val(c), cell: c });
      } else {
        // سطر لحاله فيه كذا خانة = أزواج «اسم: قيمة»
        const v = cells.filter(val); const pairs = [];
        for (let k = 0; k < v.length; k += 2) pairs.push([v[k], v[k + 1] || { v: '' }]);
        const last = parts[parts.length - 1];
        if (last && last.type === 'pairs') last.pairs.push(...pairs); else parts.push({ type: 'pairs', pairs });
      }
    }
    return { parts, used, vmerge, val };
  },
  // بيتّسع الجدول بعرض صفحة الدفتر؟ (تقدير: ~7px للحرف، حد 24 حرف للعمود)
  fits(rows, val) {
    const cols = rows[0] ? rows[0].length : 0;
    let w = 0;
    for (let c = 0; c < cols; c++) w += 18 + 7 * Math.min(24, Math.max(3, ...rows.map(r => Math.min(60, val(r[c]).length))));
    const long = rows.flat().filter(x => val(x).length > 60).length;
    return cols <= 6 && w <= 560 && long <= rows.length;
  },
  wide(sheets) { return sheets.some(s => { const a = this.analyze(s); return a.parts.some(p => p.type === 'table' && p.rows.length > 1 && !this.fits(p.rows, a.val)); }); },
  cell(x) { let v = esc(String(x.v).trim()).replace(/\n/g, '<br>'); if (x.color) v = `<span style="color:${x.color}">${v}</span>`; if (x.i) v = `<i>${v}</i>`; return v; },
  // اتجاه الجدول: زي الشيت (أو حسب لغة محتواه)
  dir(s, rows, val) {
    if (s.rtl) return 'rtl';
    const t = rows.flat().map(val).join('');
    return (t.match(/[\u0600-\u06ff]/g) || []).length > (t.match(/[A-Za-z]/g) || []).length ? 'rtl' : 'ltr';
  },
  blocks(sheets, mode = 'auto') {
    const out = [];
    const many = sheets.filter(s => s.grid.length).length > 1;
    for (const s of sheets) {
      const a = this.analyze(s), val = a.val;
      if (!a.parts.length) continue;
      if (many && s.name) out.push(`<h2>${esc(s.name)}</h2>`);
      // شيت بسيط (جدول واحد بيتّسع): زي ما هو مع الدمج والألوان
      const tables = a.parts.filter(p => p.type === 'table');
      if (a.parts.length === 1 && tables.length === 1 && (mode === 'table' || this.fits(tables[0].rows, val))) { out.push(this.toHtml(s), '<p><br></p>'); continue; }
      a.parts.forEach((p, k) => {
        // أول سطر بالشيت = عنوانه (حتى لو طويل)
        if (p.type === 'title' || (p.type === 'note' && k === 0)) { out.push(k === 0 && !many ? `<h2>${esc(p.text)}</h2>` : `<h3>${esc(p.text)}</h3>`); return; }
        if (p.type === 'note') { const v = this.cell(p.cell); out.push(`<p>${p.cell.b ? `<b>${v}</b>` : v}</p>`); return; }
        if (p.type === 'pairs') {
          out.push(`<table class="tbl" dir="${this.dir(s, p.pairs, val)}"><tbody>` + p.pairs.map(([k2, v]) => `<tr><th>${this.cell(k2)}</th><td>${this.cell(v) || '<br>'}</td></tr>`).join('') + '</tbody></table>', '<p><br></p>');
          return;
        }
        const [head, ...data] = p.rows;
        if (mode === 'table' || !data.length || this.fits(p.rows, val)) {
          // جدول بالأعمدة المستعملة بس
          const keep = head.map((_, c) => p.rows.some(r => val(r[c])));
          const tr = (r, tag) => '<tr>' + r.filter((_, c) => keep[c]).map(x => { const css = (x.bg ? `background-color:${x.bg};` : '') + (x.al ? `text-align:${x.al};` : ''); let v = this.cell(x) || '<br>'; if (x.b && tag === 'td') v = `<b>${v}</b>`; return `<${tag}${css ? ` style="${css}"` : ''}>${v}</${tag}>`; }).join('') + '</tr>';
          out.push(`<table class="tbl${keep.filter(Boolean).length > 6 ? ' tbl-wide' : ''}" dir="${this.dir(s, p.rows, val)}"><tbody>` + tr(head, 'th') + data.map(r => tr(r, 'td')).join('') + '</tbody></table>', '<p><br></p>');
          return;
        }
        this.cards(head, data, val, out);
      });
    }
    while (out[out.length - 1] === '<p><br></p>') out.pop();
    return out;
  },
};

const W1252 = new TextDecoder('windows-1252');
/* ===== PDF: بنطلّع النص منه (عربي وإنجليزي) بدون مكتبات ===== */
/* ===== PDF صفحة بصفحة: كل صفحة بترتسم صورة على صفحة بالكتاب (نص، سكان، رسومات، جداول — شو ما كان)
   بمكتبة pdf.js (موزيلا، مفتوحة المصدر) محفوظة جوّا التطبيق بـ lib/ — بتشتغل بدون إنترنت، وبتتحمّل بس وقت الحاجة. */
const PdfPages = {
  W: 1300, // عرض الصورة: أوضح من الصفحة على الشاشة، ومش كبيرة على التخزين
  async lib() {
    await Lazy.need('pdfjs');
    const L = window.pdfjsLib;
    if (!L.GlobalWorkerOptions.workerSrc) L.GlobalWorkerOptions.workerSrc = Lazy.files.pdfworker; // بملف محلي (file://) بيرجع لحاله للخيط الرئيسي
    return L;
  },
  async open(f) {
    const L = await this.lib();
    return L.getDocument({ data: new Uint8Array(await f.arrayBuffer()), isEvalSupported: false, useSystemFonts: true }).promise;
  },
  // كل صفحة → { blob: صورة الصفحة, text: نصها للبحث }. progress(i, n) بعد كل صفحة
  async read(f, progress = () => {}) {
    const doc = await this.open(f), n = doc.numPages, out = [];
    const c = document.createElement('canvas'), g = c.getContext('2d', { alpha: false });
    try {
      for (let i = 1; i <= n; i++) {
        const page = await doc.getPage(i);
        const v1 = page.getViewport({ scale: 1 });
        const vp = page.getViewport({ scale: Math.min(4, this.W / v1.width) });
        c.width = Math.round(vp.width); c.height = Math.round(vp.height);
        g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
        await page.render({ canvasContext: g, viewport: vp }).promise;
        const blob = await new Promise(r => c.toBlob(r, 'image/webp', 0.82)) || await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85));
        let text = '';
        try { const tc = await page.getTextContent(); text = tc.items.map(t => t.str + (t.hasEOL ? '\n' : ' ')).join('').replace(/[ \t]+/g, ' ').trim().slice(0, 20000); } catch { }
        out.push({ blob, text, w: c.width, h: c.height });
        page.cleanup();
        progress(i, n);
        await new Promise(r => setTimeout(r, 0)); // منخلي الواجهة تتنفس بين الصفحات
      }
    } finally { c.width = c.height = 0; doc.destroy(); }
    return out;
  },
  // صفحات الكتاب: الصورة خلفية الصفحة، والنص للبحث، وفوقها بتقدر تكتب وتلزّق ملاحظات
  async records(f, bookId, onStep) {
    const pages = await this.read(f, onStep);
    // النص للبحث: قارئنا (بيفهم العربي صح)، ولو ما زبط منرجع لنص pdf.js
    let ours = [];
    try { ours = await PdfText.read(f); } catch { }
    const recs = [];
    pages.forEach((p, i) => { const t = ours.length === pages.length && !ours.garbled ? htmlText((ours[i] || []).join('\n')).replace(/[ \t]+/g, ' ').trim() : ''; if (t) p.text = t.slice(0, 20000); });
    for (const p of pages) recs.push({ id: 'p' + uid(), bookId, html: '', stickies: [], attach: [], bg: await Media.save(p.blob), bgAR: +(p.h / p.w).toFixed(4), text: p.text });
    return recs;
  },
  // تقدّم القراءة بإشعار واحد بيتحدّث
  progress(name) {
    let t = null, last = 0;
    const step = (i, n) => {
      const now = Date.now(); if (i < n && now - last < 250) return; last = now;
      if (t) t();
      t = Toast.show({ icon: 'download', title: `عم نحوّل «${name}»…`, text: `صفحة ${i} من ${n}`, timeout: 0 });
    };
    step.done = () => t && t();
    return step;
  },
};

const PdfText = {
  async read(file) {
    const u8 = new Uint8Array(await file.arrayBuffer());
    let s = ''; for (let i = 0; i < u8.length; i += 32768) s += String.fromCharCode.apply(null, u8.subarray(i, i + 32768));
    if (!s.startsWith('%PDF')) throw new Error('هاد مش ملف PDF');
    if (/\/Encrypt\s/.test(s.slice(-4096)) || /\/Encrypt\s+\d+\s+\d+\s+R/.test(s)) throw new Error('الـPDF محمي بكلمة سر — بنرفقه زي ما هو بس');
    const objs = new Map();
    const re = /(\d+)\s+(\d+)\s+obj\b/g; let m;
    while ((m = re.exec(s))) {
      const P = new PdfLex(s, re.lastIndex);
      try {
        const v = P.value(); P.ws();
        let stream = null;
        if (s.startsWith('stream', P.i)) {
          let a = P.i + 6; if (s[a] === '\r') a++; if (s[a] === '\n') a++;
          let len = v && typeof v.Length === 'number' ? v.Length : -1;
          if (len < 0 || !/^\s*endstream/.test(s.slice(a + len, a + len + 24))) { const e = s.indexOf('endstream', a); len = (e < 0 ? s.length : e) - a; }
          stream = [a, a + len];
          re.lastIndex = a + len;
        }
        objs.set(+m[1], { v, stream });
      } catch { }
    }
    const R = v => { for (let k = 0; v && v.ref != null && k < 20; k++) v = (objs.get(v.ref) || {}).v; return v; };
    const data = async o => {
      if (!o || !o.stream) return null;
      let b = u8.subarray(o.stream[0], o.stream[1]);
      let f = R(o.v.Filter); f = Array.isArray(f) ? f.map(R) : f ? [f] : [];
      for (const x of f) {
        const n = x && x.name;
        if (n === 'FlateDecode' || n === 'Fl') { try { b = await inflateBytes(b, 'deflate'); } catch { try { b = await inflateBytes(b.subarray(2)); } catch { return null; } } }
        else if (n === 'ASCII85Decode' || n === 'A85') b = this.a85(str(b));
        else if (n === 'ASCIIHexDecode' || n === 'AHx') { const h = str(b).replace(/[^0-9a-f]/gi, ''); b = new Uint8Array(h.length >> 1); for (let k = 0; k < b.length; k++) b[k] = parseInt(h.substr(k * 2, 2), 16); }
        else return null;
      }
      return b;
    };
    const str = b => { let t = ''; for (let i = 0; i < b.length; i += 32768) t += String.fromCharCode.apply(null, b.subarray(i, i + 32768)); return t; };
    // الكائنات المضغوطة جوّا ObjStm
    for (const [, o] of [...objs]) {
      if (!o.v || R(o.v.Type)?.name !== 'ObjStm') continue;
      const b = await data(o); if (!b) continue;
      const t = str(b), P = new PdfLex(t, 0), n = R(o.v.N), first = R(o.v.First), heads = [];
      for (let k = 0; k < n; k++) heads.push([P.value(), P.value()]);
      for (const [num, off] of heads) { if (objs.has(num)) continue; try { objs.set(num, { v: new PdfLex(t, first + off).value(), stream: null }); } catch { } }
    }
    const cat = [...objs.values()].find(o => o.v && R(o.v.Type)?.name === 'Catalog');
    const pages = [];
    const walkPages = (node, inh, depth = 0) => {
      node = R(node); if (!node || depth > 30) return;
      const res = node.Resources || inh;
      if (R(node.Type)?.name === 'Page' || (!node.Kids && node.Contents)) pages.push({ node, res });
      else (R(node.Kids) || []).forEach(k => walkPages(k, res, depth + 1));
    };
    if (cat) walkPages(cat.v.Pages, null);
    if (!pages.length) [...objs.values()].filter(o => o.v && R(o.v.Type)?.name === 'Page').forEach(o => pages.push({ node: o.v, res: o.v.Resources }));

    const fontCache = new Map();
    const font = async ref => {
      const key = ref && ref.ref != null ? ref.ref : ref;
      if (fontCache.has(key)) return fontCache.get(key);
      const f = R(ref) || {};
      const F = { two: R(f.Subtype)?.name === 'Type0', map: null, widths: {}, dw: 1000, bold: /bold|black|heavy|semibold|demi/i.test(R(f.BaseFont)?.name || '') };
      const tu = f.ToUnicode && objs.get(f.ToUnicode.ref);
      if (tu) { const b = await data(tu); if (b) F.map = this.cmap(str(b), F); }
      if (F.two) {
        const d = R((R(f.DescendantFonts) || [])[0]) || {};
        F.dw = R(d.DW) ?? 1000;
        const W = R(d.W) || [];
        for (let i = 0; i < W.length;) {
          const a = R(W[i]), b = R(W[i + 1]);
          if (Array.isArray(b)) { b.forEach((w, k) => { F.widths[a + k] = R(w); }); i += 2; }
          else { const w = R(W[i + 2]); for (let c = a; c <= b && c - a < 65536; c++) F.widths[c] = w; i += 3; }
        }
        if (!F.bold) F.bold = /bold|black|heavy/i.test(R(R(d.FontDescriptor)?.FontName)?.name || '');
      } else {
        const fc = R(f.FirstChar) || 0; (R(f.Widths) || []).forEach((w, k) => { F.widths[fc + k] = R(w); });
        F.dw = 500;
        const enc = R(f.Encoding);
        if (enc && enc.Differences) {
          F.diff = {}; let c = 0;
          for (const x of R(enc.Differences)) { const v = R(x); if (typeof v === 'number') c = v; else if (v && v.name) F.diff[c++] = this.glyph(v.name); }
        }
      }
      fontCache.set(key, F);
      return F;
    };
    const out = [], C = { R, font, objs, data, str, nul: 0, ar: 0 };
    for (const pg of pages) {
      const items = [];
      let cont = R(pg.node.Contents); cont = Array.isArray(cont) ? cont : [pg.node.Contents];
      let cs = '';
      for (const c of cont) { const o = c && c.ref != null ? objs.get(c.ref) : null; const b = await data(o); if (b) cs += str(b) + '\n'; }
      await this.run(cs, R(pg.res) || {}, items, C, [1, 0, 0, 1, 0, 0], 0);
      out.push(items);
    }
    const res = out.map(items => this.layout(items));
    // ملفات (مثل جوجل دوكس) بتخزّن نقاط الحروف العربية كرموز بلا نص: النص بيطلع ناقص
    res.garbled = C.ar > 40 && C.nul > C.ar * .08;
    return res;
  },
  a85(s) {
    s = s.replace(/\s+/g, '').replace(/^<~/, '').replace(/~>[\s\S]*$/, '');
    const out = [];
    for (let i = 0; i < s.length;) {
      if (s[i] === 'z') { out.push(0, 0, 0, 0); i++; continue; }
      const c = s.slice(i, i + 5); i += 5;
      let v = 0; for (const ch of c.padEnd(5, 'u')) v = v * 85 + ch.charCodeAt(0) - 33;
      out.push(...[v >>> 24 & 255, v >>> 16 & 255, v >>> 8 & 255, v & 255].slice(0, c.length - 1));
    }
    return new Uint8Array(out);
  },
  // ToUnicode: الرمز → النص
  cmap(t, F) {
    const map = {};
    const hex = h => { if (h.length <= 2) return String.fromCharCode(parseInt(h || '0', 16)); let s = ''; for (let i = 0; i < h.length; i += 4) s += String.fromCharCode(parseInt(h.substr(i, 4).padEnd(4, '0'), 16)); return s; };
    const cs = t.match(/begincodespacerange([\s\S]*?)endcodespacerange/);
    if (cs) { const m = cs[1].match(/<([0-9a-f]+)>/i); if (m) F.two = m[1].length >= 4; }
    for (const blk of t.match(/beginbfchar([\s\S]*?)endbfchar/g) || []) {
      for (const m of blk.matchAll(/<([0-9a-f]+)>\s*<([0-9a-f]*)>/gi)) { map[parseInt(m[1], 16)] = hex(m[2]); if (m[1].length >= 4) F.two = true; }
    }
    for (const blk of t.match(/beginbfrange([\s\S]*?)endbfrange/g) || []) {
      for (const m of blk.matchAll(/<([0-9a-f]+)>\s*<([0-9a-f]+)>\s*(<[0-9a-f]*>|\[[^\]]*\])/gi)) {
        const lo = parseInt(m[1], 16), hi = parseInt(m[2], 16);
        if (m[1].length >= 4) F.two = true;
        if (m[3][0] === '[') { [...m[3].matchAll(/<([0-9a-f]*)>/gi)].forEach((d, k) => { map[lo + k] = hex(d[1]); }); }
        else { const d = m[3].slice(1, -1); const base = hex(d); for (let c = lo; c <= hi && c - lo < 65536; c++) map[c] = base.slice(0, -1) + String.fromCharCode(base.charCodeAt(base.length - 1) + c - lo); }
      }
    }
    return map;
  },
  glyph(n) {
    if (/^uni([0-9A-F]{4})/i.test(n)) return String.fromCharCode(parseInt(n.slice(3, 7), 16));
    if (/^u([0-9A-F]{4,6})$/i.test(n)) return String.fromCodePoint(parseInt(n.slice(1), 16));
    if (n.length === 1) return n;
    const G = { space: ' ', period: '.', comma: ',', hyphen: '-', minus: '-', colon: ':', semicolon: ';', parenleft: '(', parenright: ')', bracketleft: '[', bracketright: ']', braceleft: '{', braceright: '}', quoteright: '’', quoteleft: '‘', quotedbl: '"', quotesingle: "'", quotedblleft: '“', quotedblright: '”', exclam: '!', question: '?', slash: '/', backslash: '\\', at: '@', ampersand: '&', percent: '%', dollar: '$', asterisk: '*', plus: '+', equal: '=', less: '<', greater: '>', underscore: '_', numbersign: '#', endash: '–', emdash: '—', bullet: '•', ellipsis: '…', fi: 'fi', fl: 'fl', ff: 'ff', zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', degree: '°', copyright: '©', registered: '®', trademark: '™', nbspace: ' ' };
    return G[n] || '';
  },
  // تشغيل أوامر محتوى الصفحة (BT/Tf/Td/Tm/TJ…) وجمع كل حرف بمكانه
  async run(cs, res, items, ctx, ctm0, depth) {
    const { R, font } = ctx;
    const fonts = R(res.Font) || {}, xobj = R(res.XObject) || {};
    const P = new PdfLex(cs, 0, true);
    let ctm = ctm0.slice(), stack = [], tm = [1, 0, 0, 1, 0, 0], tlm = tm.slice();
    let F = null, size = 0, Tc = 0, Tw = 0, Th = 1, TL = 0, rise = 0;
    const mul = (a, b) => [a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3], a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3], a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5]];
    const move = (tx, ty) => { tlm = mul([1, 0, 0, 1, tx, ty], tlm); tm = tlm.slice(); };
    const show = sv => {
      if (!F || !sv || sv.str == null) return;
      const b = sv.str;
      for (let i = 0; i < b.length;) {
        let code;
        if (F.two) { code = (b.charCodeAt(i) << 8) | (b.charCodeAt(i + 1) || 0); i += 2; } else { code = b.charCodeAt(i); i += 1; }
        let ch = F.map && F.map[code] != null ? F.map[code] : F.diff && F.diff[code] != null ? F.diff[code] : F.two ? '' : W1252.decode(new Uint8Array([code]));
        const w = (F.widths[code] ?? F.dw) / 1000;
        const adv = (w * size + Tc + (code === 32 && !F.two ? Tw : 0)) * Th;
        const M = mul(tm, ctm);
        const x = M[4], y = M[5] + rise * M[3], fs = Math.abs(size * M[3]) || Math.abs(size * M[1]) || size;
        const x2 = mul([1, 0, 0, 1, adv, 0], M)[4];
        if (ch === '\u0000') ctx.nul++; else if (/[\u0600-\u06ff\ufb50-\ufefc]/.test(ch)) ctx.ar++;
        ch = ch && ch.replace(/[\u0000-\u001f\ufffd\u200b-\u200f\u2028-\u202e\ufeff]/g, '');
        if (ch) items.push({ x: Math.min(x, x2), x2: Math.max(x, x2), y, fs, ch: ch.normalize('NFKC'), b: F.bold, w: Math.abs(x2 - x) });
        tm = mul([1, 0, 0, 1, adv, 0], tm);
      }
    };
    const ops = [];
    for (let guard = 0; guard < 2e6; guard++) {
      const t = P.value(); if (t === undefined) break;
      if (!(t && t.op)) { ops.push(t); continue; }
      const a = ops.splice(0), op = t.op;
      switch (op) {
        case 'q': stack.push(ctm.slice()); break;
        case 'Q': ctm = stack.pop() || ctm0.slice(); break;
        case 'cm': if (a.length >= 6) ctm = mul(a.slice(-6), ctm); break;
        case 'BT': tm = [1, 0, 0, 1, 0, 0]; tlm = tm.slice(); break;
        case 'Tf': F = fonts[a[0] && a[0].name] ? await font(fonts[a[0].name]) : null; size = +a[1] || 0; break;
        case 'Tc': Tc = +a[0] || 0; break;
        case 'Tw': Tw = +a[0] || 0; break;
        case 'Tz': Th = (+a[0] || 100) / 100; break;
        case 'TL': TL = +a[0] || 0; break;
        case 'Ts': rise = +a[0] || 0; break;
        case 'Td': move(+a[0] || 0, +a[1] || 0); break;
        case 'TD': TL = -(+a[1] || 0); move(+a[0] || 0, +a[1] || 0); break;
        case 'Tm': if (a.length >= 6) { tlm = a.slice(-6).map(Number); tm = tlm.slice(); } break;
        case 'T*': move(0, -TL); break;
        case 'Tj': show(a[0]); break;
        case "'": move(0, -TL); show(a[0]); break;
        case '"': Tw = +a[0] || 0; Tc = +a[1] || 0; move(0, -TL); show(a[2]); break;
        case 'TJ': for (const x of a[0] || []) { if (typeof x === 'number') tm = mul([1, 0, 0, 1, -x / 1000 * size * Th, 0], tm); else show(x); } break;
        case 'BI': { const e = cs.indexOf('EI', P.i); P.i = e < 0 ? cs.length : e + 2; break; }
        case 'Do': {
          const x = a[0] && xobj[a[0].name]; const o = x && ctx.objs.get(x.ref);
          if (depth < 3 && o && R(o.v.Subtype)?.name === 'Form') {
            const b = await ctx.data(o);
            if (b) await this.run(ctx.str(b), R(o.v.Resources) || res, items, ctx, mul(R(o.v.Matrix) || [1, 0, 0, 1, 0, 0], ctm), depth + 1);
          }
          break;
        }
      }
    }
  },
  // من حروف بمواقعها → أسطر → فقرات (مع ترتيب العربي من اليمين لليسار)
  layout(items) {
    const AR = /[֐-ࣿיִ-ﻼ]/, LTR = /[A-Za-z0-9À-ɏ]/, LATIN = /[A-Za-z\u00c0-\u024f]/;
    items = items.filter(i => i.ch.trim() || i.ch === ' ');
    if (!items.length) return [];
    items.sort((a, b) => b.y - a.y || a.x - b.x);
    const lines = [];
    for (const it of items) {
      const L = lines[lines.length - 1];
      if (L && Math.abs(L.y - it.y) < Math.max(2, Math.min(L.fs, it.fs) * .45)) { L.items.push(it); L.fs = Math.max(L.fs, it.fs); }
      else lines.push({ y: it.y, fs: it.fs, items: [it] });
    }
    for (const L of lines) {
      // اتجاه السطر من الحروف القوية بس (الأرقام محايدة)
      const ar = L.items.filter(i => AR.test(i.ch)).length, en = L.items.filter(i => LATIN.test(i.ch)).length;
      L.rtl = ar > en;
      const g = L.items.slice().sort((a, b) => L.rtl ? b.x2 - a.x2 : a.x - b.x);
      const units = [];
      for (let k = 0; k < g.length; k++) {
        const it = g[k], prev = g[k - 1];
        if (prev && prev.ch !== ' ' && it.ch !== ' ') { const gap = L.rtl ? prev.x - it.x2 : it.x - prev.x2; if (gap > it.fs * .18) units.push({ ch: ' ', sp: true }); }
        units.push(it);
      }
      // المقاطع بعكس اتجاه السطر بترجع لترتيبها: إنجليزي وأرقام جوّا العربي، أو عربي جوّا الإنجليزي
      const other = L.rtl ? LTR : AR;
      for (let i = 0; i < units.length;) {
        if (!other.test(units[i].ch)) { i++; continue; }
        let j = i;
        while (j + 1 < units.length && (other.test(units[j + 1].ch) || (/^[\s.,:%\-+/()_'’]$/.test(units[j + 1].ch) && units[j + 2] && other.test(units[j + 2].ch)))) j++;
        units.splice(i, j - i + 1, ...units.slice(i, j + 1).reverse());
        i = j + 1;
      }
      L.text = units.map(u => u.ch).join('').replace(/\s+/g, ' ').trim();
      L.bold = g.length && g.every(i => i.b);
      // الخط العريض لجزء من السطر (مثل «ملاحظة مهمة:») بيضل عريض
      let h = '', on = false;
      units.forEach((u, k) => {
        const b = u.sp ? on && !!(units[k + 1] && units[k + 1].b) : !!u.b;
        if (b !== on) { h += b ? '<b>' : '</b>'; on = b; }
        h += esc(u.ch);
      });
      if (on) h += '</b>';
      L.html = h.replace(/\s+/g, ' ').trim().replace(/<b>(\s*)<\/b>/g, '$1');
    }
    const sizes = lines.map(l => l.fs).sort((a, b) => a - b), body = sizes[Math.floor(sizes.length / 2)] || 12;
    const blocks = [];
    let cur = null;
    for (let k = 0; k < lines.length; k++) {
      const L = lines[k]; if (!L.text) continue;
      const tag = L.fs > body * 1.6 ? 'h2' : L.fs > body * 1.25 ? 'h3' : 'p';
      const prev = lines[k - 1];
      const gap = prev ? prev.y - L.y : 0;
      // نفس الفقرة إذا السطر قريب وبنفس الحجم (وما بيبدأ بنقطة قائمة)
      const cont = cur && prev && tag === cur.tag && gap < L.fs * (tag === 'p' ? 1.75 : 1.6) && Math.abs(prev.fs - L.fs) < 1 && !(tag === 'p' && /^([•▪●◦\-–]|\d{1,2}[.)-])\s/.test(L.text));
      if (cont) { cur.text += ' ' + L.text; cur.html += ' ' + L.html; }
      else { cur = { tag, text: L.text, html: L.html }; blocks.push(cur); }
    }
    return blocks.map(b => `<${b.tag}>${b.tag === 'p' ? b.html.replace(/<\/b> <b>/g, ' ') : esc(b.text)}</${b.tag}>`);
  },
};
// قارئ رموز PDF (قيم وأوامر)
class PdfLex {
  constructor(s, i, ops = false) { this.s = s; this.i = i; this.ops = ops; }
  ws() { const s = this.s; for (;;) { const c = s.charCodeAt(this.i); if (c === 37) { while (this.i < s.length && s[this.i] !== '\n' && s[this.i] !== '\r') this.i++; } else if (c === 32 || c === 10 || c === 13 || c === 9 || c === 12 || c === 0) this.i++; else return; } }
  value() {
    this.ws();
    const s = this.s, c = s[this.i];
    if (this.i >= s.length) return undefined;
    if (c === '<' && s[this.i + 1] === '<') {
      this.i += 2; const d = {};
      for (let g = 0; g < 1e5; g++) { this.ws(); if (s[this.i] === '>' && s[this.i + 1] === '>') { this.i += 2; break; } if (this.i >= s.length) break; const k = this.value(); if (!k || !k.name) { this.i++; continue; } d[k.name] = this.value(); }
      return d;
    }
    if (c === '[') { this.i++; const a = []; for (let g = 0; g < 1e6; g++) { this.ws(); if (s[this.i] === ']' || this.i >= s.length) { this.i++; break; } a.push(this.value()); } return a; }
    if (c === '(') {
      this.i++; let d = 1, o = '';
      while (this.i < s.length) {
        const ch = s[this.i++];
        if (ch === '\\') {
          const n = s[this.i++];
          const E = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f' };
          if (E[n]) o += E[n];
          else if (n >= '0' && n <= '7') { let v = n; while (v.length < 3 && s[this.i] >= '0' && s[this.i] <= '7') v += s[this.i++]; o += String.fromCharCode(parseInt(v, 8) & 255); }
          else if (n === '\r') { if (s[this.i] === '\n') this.i++; }
          else if (n !== '\n') o += n;
        } else if (ch === '(') { d++; o += ch; }
        else if (ch === ')') { if (--d === 0) break; o += ch; }
        else o += ch;
      }
      return { str: o };
    }
    if (c === '<') { const e = s.indexOf('>', this.i); let h = s.slice(this.i + 1, e).replace(/\s+/g, ''); this.i = e + 1; if (h.length % 2) h += '0'; let o = ''; for (let k = 0; k < h.length; k += 2) o += String.fromCharCode(parseInt(h.substr(k, 2), 16)); return { str: o }; }
    if (c === '/') { let j = this.i + 1; while (j < s.length && !/[\s/\[\]<>(){}%]/.test(s[j])) j++; const n = s.slice(this.i + 1, j).replace(/#([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))); this.i = j; return { name: n }; }
    const m = /^[+-]?(\d+\.?\d*|\.\d+)/.exec(s.slice(this.i, this.i + 32));
    if (m) {
      this.i += m[0].length;
      if (!this.ops && /^\d+$/.test(m[0])) { const r = /^\s+(\d+)\s+R(?![A-Za-z])/.exec(s.slice(this.i, this.i + 24)); if (r) { this.i += r[0].length; return { ref: +m[0] }; } }
      return +m[0];
    }
    let j = this.i; while (j < s.length && !/[\s/\[\]<>(){}%]/.test(s[j])) j++;
    if (j === this.i) { this.i++; return this.value(); }
    const w = s.slice(this.i, j); this.i = j;
    if (w === 'true') return true; if (w === 'false') return false; if (w === 'null') return null;
    return { op: w };
  }
}

/* ===== لصق منسّق: من إكسل (جدول)، وورد، المواقع… بنظّفه وبنخلي الشكل ===== */
const Clean = {
  // أسطر مرقّمة من الحافظة: نحتفظ بالقيمة وشكل الأرقام، والنص يحدد الاتجاه.
  numbered(text) {
    const lines = text.split('\n'), out = [];
    let found = false;
    const match = line => line.match(/^\s*([0-9٠-٩۰-۹]+)[.)۔]\s+(.+)$/);
    for (let i = 0; i < lines.length;) {
      const first = match(lines[i]);
      if (!first || !Number.isSafeInteger(+latinDigits(first[1]))) { out.push(`<p>${esc(lines[i++]) || '<br>'}</p>`); continue; }
      const style = digits => /[٠-٩]/.test(digits) ? 'arabic-indic' : /[۰-۹]/.test(digits) ? 'persian' : 'decimal';
      const kind = style(first[1]);
      let h = `<ol start="${+latinDigits(first[1])}" style="list-style-type:${kind}">`;
      let next = +latinDigits(first[1]);
      while (i < lines.length) {
        const m = match(lines[i]);
        if (!m || style(m[1]) !== kind || !Number.isSafeInteger(+latinDigits(m[1]))) break;
        const value = +latinDigits(m[1]);
        h += `<li${value !== next ? ` value="${value}"` : ''}>${esc(m[2])}</li>`;
        next = value + 1; i++;
      }
      out.push(h + '</ol>'); found = true;
    }
    return found ? out : null;
  },
  BLOCK: /^(P|DIV|H[1-6]|UL|OL|LI|TABLE|BLOCKQUOTE|PRE|SECTION|ARTICLE|HEADER|FOOTER|MAIN|ASIDE|NAV|FIGURE|DL|DT|DD|CENTER|ADDRESS|TR|TBODY|THEAD|TFOOT|HR|FORM)$/,
  SKIP: /^(SCRIPT|STYLE|META|LINK|TITLE|HEAD|SVG|IFRAME|OBJECT|EMBED|BUTTON|INPUT|SELECT|TEXTAREA|NOSCRIPT|TEMPLATE|IMG|VIDEO|AUDIO|CANVAS|XML|COLGROUP|COL)$/,
  html(src) {
    const d = new DOMParser().parseFromString(src, 'text/html');
    const rules = {};
    d.querySelectorAll('style').forEach(st => st.textContent.replace(/<!--|-->/g, '').replace(/([^{}]+)\{([^}]*)\}/g, (_, sel, body) => {
      sel.split(',').forEach(x => { const m = x.trim().match(/^(?:[a-z]+)?\.([\w-]+)$/i); if (m) rules[m[1]] = (rules[m[1]] || '') + ';' + body; });
    }));
    const css = e => { let s = ''; if (e.classList) e.classList.forEach(c => { if (rules[c]) s += ';' + rules[c]; }); return (s + ';' + (e.getAttribute('style') || '')).toLowerCase(); };
    const prop = (s, p) => { const m = s.match(new RegExp('(?:^|;)\\s*' + p + '\\s*:\\s*([^;]+)', 'g')); return m ? m[m.length - 1].replace(/^[;\s]*[\w-]+\s*:\s*/, '').replace(/!important/, '').trim() : ''; };
    const out = [];
    let cur = null; // الفقرة اللي عم نعبّيها
    const para = () => { if (!cur) { cur = { tag: 'p', h: '', al: '' }; } return cur; };
    const flush = () => { if (cur && cur.h.replace(/<br>|&nbsp;|\s/g, '')) out.push(`<${cur.tag}${cur.al ? ` style="text-align:${cur.al}"` : ''}>${cur.h.replace(/(<br>)+$/, '')}</${cur.tag}>`); cur = null; };
    const align = s => { const a = prop(s, 'text-align'); return /^(center|right|left)$/.test(a) ? a : ''; };
    const wrapFmt = (e, s, inner) => {
      if (!inner) return '';
      const tag = e.tagName;
      const fw = prop(s, 'font-weight'), fs = prop(s, 'font-style'), td = prop(s, 'text-decoration') + ' ' + prop(s, 'text-decoration-line');
      const color = importColor(prop(s, 'color') || e.getAttribute('color'));
      const bg = importColor(prop(s, 'background-color') || prop(s, 'background').split(' ')[0] || prop(s, 'mso-highlight'), { bg: true });
      if (bg) inner = `<span style="background-color:${bg}">${inner}</span>`;
      if (color) inner = `<span style="color:${color}">${inner}</span>`;
      if (/line-through/.test(td) || /^(S|STRIKE|DEL)$/.test(tag)) inner = `<s>${inner}</s>`;
      if (/underline/.test(td) || (tag === 'U' || tag === 'INS')) inner = `<u>${inner}</u>`;
      if (fs === 'italic' || /^(I|EM|CITE)$/.test(tag)) inner = `<i>${inner}</i>`;
      if (/^(bold|bolder|[6-9]00)$/.test(fw) || /^(B|STRONG)$/.test(tag)) inner = `<b>${inner}</b>`;
      if (tag === 'SUP' || tag === 'SUB' || tag === 'CODE') inner = `<${tag.toLowerCase()}>${inner}</${tag.toLowerCase()}>`;
      if (tag === 'A') { const h = e.getAttribute('href') || ''; if (/^(https?:|mailto:)/i.test(h)) inner = `<a href="${esc(h)}" target="_blank" rel="noopener">${inner}</a>`; }
      return inner;
    };
    const inline = (e, pre) => {
      let h = '';
      for (const n of e.childNodes) {
        if (n.nodeType === 3) { h += esc(pre ? n.data : n.data.replace(/[\s ]+/g, m => m.includes(' ') ? ' ' : ' ')); continue; }
        if (n.nodeType !== 1 || this.SKIP.test(n.tagName)) continue;
        const s = css(n);
        if (/mso-list\s*:\s*ignore/.test(s) || prop(s, 'display') === 'none') continue;
        if (n.tagName === 'BR') { h += '<br>'; continue; }
        h += wrapFmt(n, s, inline(n, pre));
      }
      return h;
    };
    const table = t => {
      let h = '<table class="tbl"><tbody>', first = true;
      for (const tr of t.rows) {
        h += '<tr>';
        for (const td of tr.cells) {
          const s = css(td), tag = first || td.tagName === 'TH' ? 'th' : 'td';
          const bg = importColor(prop(s, 'background-color') || prop(s, 'background').split(' ')[0] || td.getAttribute('bgcolor'), { bg: true });
          const al = align(s) || ({ center: 'center', right: 'right', left: 'left' })[(td.getAttribute('align') || '').toLowerCase()] || '';
          const cs = +td.getAttribute('colspan') || 1, rs = +td.getAttribute('rowspan') || 1;
          let inner = '';
          if ([...td.children].some(x => this.BLOCK.test(x.tagName) && x.tagName !== 'BR')) inner = [...td.childNodes].map(x => x.nodeType === 1 ? wrapFmt(x, css(x), inline(x)) : esc(x.data || '')).filter(x => x.trim()).join('<br>');
          else inner = inline(td);
          inner = wrapFmt({ tagName: 'TD', getAttribute: () => null }, s.replace(/background[^;]*|text-align[^;]*/g, ''), inner.trim()) || '<br>';
          h += `<${tag}${cs > 1 ? ` colspan="${cs}"` : ''}${rs > 1 ? ` rowspan="${rs}"` : ''}${bg || al ? ` style="${bg ? `background-color:${bg};` : ''}${al ? `text-align:${al};` : ''}"` : ''}>${inner}</${tag}>`;
        }
        h += '</tr>'; first = false;
      }
      return h + '</tbody></table>';
    };
    const list = (e, ordered) => {
      const direction = n => /^(rtl|ltr|auto)$/i.test(n.getAttribute('dir') || '') ? ` dir="${n.getAttribute('dir').toLowerCase()}"` : '';
      const number = (n, attr) => {
        const raw = latinDigits(n.getAttribute(attr)).trim();
        return /^-?\d+$/.test(raw) && Number.isSafeInteger(+raw) ? ` ${attr}="${+raw}"` : '';
      };
      const type = e.getAttribute('type');
      const style = prop(css(e), 'list-style-type');
      let h = `<${ordered ? 'ol' : 'ul'}${direction(e)}${ordered ? number(e, 'start') + (e.hasAttribute('reversed') ? ' reversed' : '') + (/^(1|a|A|i|I)$/.test(type || '') ? ` type="${type}"` : '') : ''}${/^(decimal|decimal-leading-zero|arabic-indic|persian|lower-alpha|upper-alpha|lower-roman|upper-roman|disc|circle|square)$/.test(style) ? ` style="list-style-type:${style}"` : ''}>`;
      for (const li of e.children) {
        if (li.tagName === 'LI') {
          let inner = '';
          for (const n of li.childNodes) {
            if (n.nodeType === 1 && (n.tagName === 'UL' || n.tagName === 'OL')) inner += list(n, n.tagName === 'OL');
            else if (n.nodeType === 1 && !this.SKIP.test(n.tagName)) inner += wrapFmt(n, css(n), inline(n));
            else if (n.nodeType === 3) inner += esc(n.data.replace(/\s+/g, ' '));
          }
          h += `<li${direction(li)}${ordered ? number(li, 'value') : ''}>${inner.trim() || '<br>'}</li>`;
        } else if (li.tagName === 'UL' || li.tagName === 'OL') h += list(li, li.tagName === 'OL');
      }
      return h + `</${ordered ? 'ol' : 'ul'}>`;
    };
    let wl = null; // قوائم وورد (فقرات فيها mso-list)
    const block = e => {
      for (const n of e.childNodes) {
        if (n.nodeType === 3) { if (n.data.trim()) para().h += esc(n.data.replace(/\s+/g, ' ')); continue; }
        if (n.nodeType !== 1 || this.SKIP.test(n.tagName)) continue;
        const tag = n.tagName, s = css(n);
        if (prop(s, 'display') === 'none') continue;
        // عناصر غريبة (مثل غلاف جوجل شيت) جوّاها جداول أو فقرات: بننزل جوّاها
        if (!this.BLOCK.test(tag) && n.querySelector('table,p,div,ul,ol,h1,h2,h3,h4,li,blockquote,pre')) { flush(); block(n); continue; }
        if (!this.BLOCK.test(tag)) { if (tag === 'BR') para().h += '<br>'; else para().h += wrapFmt(n, s, inline(n)); continue; }
        const msoList = /mso-list\s*:\s*l\d/.test(s) || /^msolistparagraph/i.test(n.className || '');
        if (!msoList && wl) { flush(); out.push(`<ul>${wl.join('')}</ul>`); wl = null; }
        if (msoList) { flush(); (wl = wl || []).push(`<li>${inline(n).replace(/^[\s ·•o§\d.)-]+(?=\S)/, '').trim() || '<br>'}</li>`); continue; }
        if (tag === 'TABLE') { flush(); out.push(table(n)); continue; }
        if (tag === 'UL' || tag === 'OL') { flush(); out.push(list(n, tag === 'OL')); continue; }
        if (tag === 'PRE') { flush(); out.push(`<pre class="code" dir="ltr" spellcheck="false">${highlightCode(n.textContent.replace(/\n+$/, ''))}</pre>`); continue; }
        if (tag === 'HR') { flush(); continue; }
        if (/^H[1-6]$/.test(tag) || /msotitle/i.test(n.className || '')) { flush(); const h = inline(n).trim(); if (h) out.push(`<${tag === 'H1' || tag === 'H2' || !/^H/.test(tag) ? 'h2' : 'h3'}${align(s) ? ` style="text-align:${align(s)}"` : ''}>${h}</${tag === 'H1' || tag === 'H2' || !/^H/.test(tag) ? 'h2' : 'h3'}>`); continue; }
        if (tag === 'BLOCKQUOTE') { flush(); const h = inline(n).trim(); if (h) out.push(`<blockquote>${h}</blockquote>`); continue; }
        // div/p: إذا جوّاه بلوكات بننزل جوّاه، وإلا فقرة وحدة
        if ([...n.children].some(x => this.BLOCK.test(x.tagName))) { flush(); block(n); flush(); continue; }
        flush(); cur = { tag: 'p', h: wrapFmt({ tagName: 'P', getAttribute: () => null }, s, inline(n).trim()), al: align(s) }; flush();
      }
    };
    block(d.body);
    flush();
    if (wl) out.push(`<ul>${wl.join('')}</ul>`);
    return out;
  },
  // نص منسوخ من جدول (إكسل بدون html): أعمدة بـ Tab
  tsv(text) {
    const rows = text.replace(/\n+$/, '').split('\n');
    if (rows.length < 1 || !rows.every(r => r.includes('\t'))) return null;
    const n = rows[0].split('\t').length;
    if (n < 2 || rows.some(r => Math.abs(r.split('\t').length - n) > 1)) return null;
    return Sheets.toHtml({ grid: rows.map(r => r.split('\t').map(v => ({ v }))), merges: [], rtl: false });
  },
};

/* ===== الاستيراد للكتاب: نافذة الاختيار، تقسيم الصفحات، والإدراج ===== */
const Import = {
  can(f) { return Importer.can(f); },
  legacy(f) { return Importer.legacy(f); },
  kind(f) { const e = (f.name.match(/\.(\w+)$/) || [])[1]?.toLowerCase(); return e === 'xlsm' ? 'xlsx' : e === 'tsv' ? 'csv' : e === 'md' ? 'txt' : f.type === 'application/pdf' ? 'pdf' : e; },
  title(f) { return (f.name || 'ملف').replace(/\.\w+$/, '').replace(/[_]+/g, ' ').trim() || 'ملف'; },
  label: { docx: 'وورد', xlsx: 'إكسل', csv: 'جدول CSV', txt: 'نص', pdf: 'PDF' },
  // قراءة الملف → بلوكات HTML (و'\f' = صفحة جديدة) + صور
  async parse(f) {
    const k = this.kind(f);
    if (k === 'docx') return Docx.read(f);
    if (k === 'xlsx' || k === 'csv') { const sheets = k === 'xlsx' ? await Sheets.readXlsx(f) : await Sheets.readCsv(f); return { blocks: Sheets.blocks(sheets), images: [], sheets }; }
    if (k === 'txt') { const t = (await f.text()).replace(/\r\n?/g, '\n'); return { blocks: t.split(/\n/).map(x => /^#{1,2}\s/.test(x) ? `<h2>${esc(x.replace(/^#+\s*/, ''))}</h2>` : /^#{3,}\s/.test(x) ? `<h3>${esc(x.replace(/^#+\s*/, ''))}</h3>` : `<p>${esc(x) || '<br>'}</p>`), images: [] }; }
    if (k === 'pdf') { const pages = await PdfText.read(f); const blocks = []; pages.forEach((p, i) => { if (i && blocks.length) blocks.push('\f'); blocks.push(...p); }); return { blocks, images: [], pdfPages: pages.length, garbled: !!pages.garbled, chars: pages.flat().join('').replace(/<[^>]+>/g, '').length }; }
    throw new Error('نوع الملف مش مدعوم');
  },
  // تقسيم المحتوى على صفحات بنفس مقاس وخط ورق هالكتاب (بصفحة شبح مخفية)
  paginate(l, blocks, images = []) {
    const slot = l.pg.closest('.slot') || l.pg.parentNode;
    const ghost = slot.cloneNode(true);
    ghost.setAttribute('aria-hidden', 'true');
    Object.assign(ghost.style, { visibility: 'hidden', pointerEvents: 'none' });
    ghost.classList.add('import-ghost');
    $$('[data-i]', ghost).forEach(x => x.removeAttribute('data-i'));
    slot.parentNode.append(ghost);
    const pg = ghost.querySelector('.page') || ghost;
    $$('.sticky, .wrapx, .attach, .pg-attach', pg).forEach(x => x.remove());
    const c = pg.querySelector('.content'); c.removeAttribute('contenteditable');
    const limit = c.clientHeight;
    const pages = [];
    const take = () => {
      const st = [];
      const cr = c.getBoundingClientRect(), sc = cr.height / c.offsetHeight || 1;
      $$('[data-imgph]', c).forEach(ph => {
        const top = (ph.getBoundingClientRect().top - cr.top) / sc, k = +ph.dataset.imgph;
        st.push({ k, y: Math.round(top) }); ph.remove();
      });
      pages.push({ html: Editor.serialize(c), imgs: st });
    };
    const groups = [[]];
    blocks.forEach(b => { if (b === '\f') groups.push([]); else groups[groups.length - 1].push(b); });
    // منعبّي الصفحة قطعة قطعة (متل الكتابة)، ولما تطفح منقص الزيادة ومنكمّل بصفحة جديدة
    for (const g of groups) {
      if (!g.length) continue;
      const tmp = document.createElement('div'); tmp.innerHTML = g.join('');
      Editor.normalize && Editor.normalize(tmp);
      const queue = [...tmp.childNodes];
      c.innerHTML = '';
      for (let guard = 0; queue.length && guard < 200000; guard++) {
        c.append(queue.shift());
        c.scrollTop = 0;
        if (!limit || c.scrollHeight <= limit + 1) continue;
        const t = Editor.takeOverflow(c, limit);
        take(); // ما بينقسم (صورة أو سطر ضخم)؟ بنخليه بصفحته زي ما هو
        c.innerHTML = '';
        queue.unshift(...t.moved);
      }
      if (c.childNodes.length) take();
    }
    ghost.remove();
    return pages.filter(p => p.html || p.imgs.length);
  },
  // الصور: ملاحظات صور على الصفحة بنفس مكانها تقريباً، والنص بيلف حواليها
  async stickers(pg, images, rtl) {
    const st = [];
    for (const im of pg.imgs) {
      const blob = images[im.k]; if (!blob) continue;
      let w = 240, h = 180;
      try { const bm = await createImageBitmap(blob); w = Math.min(260, Math.max(120, bm.width)); h = Math.round(w * bm.height / bm.width); bm.close && bm.close(); } catch { continue; }
      const id = await Media.save(await Media.downscale(blob, 900));
      st.push({ id: uid(), kind: 'photo', blob: id, w, x: rtl ? 36 : PW - w - 36, y: clamp(im.y, 20, PH - h - 30), rot: 0, text: '' });
    }
    return st;
  },
  async toPages(l, parsed, { replace = false } = {}) {
    Editor.flushAll();
    const rtl = Reader.book.dir === 'rtl';
    const pages = this.paginate(l, parsed.blocks, parsed.images);
    if (!pages.length) return 0;
    const recs = [];
    for (const p of pages) recs.push({ id: 'p' + uid(), bookId: Reader.book.id, html: p.html, stickies: await this.stickers(p, parsed.images, rtl), attach: [] });
    return this.insert(l, recs, { replace });
  },
  // PDF صفحة بصفحة: نفس العدد ونفس الشكل
  async pdfPages(l, f, { replace = false } = {}) {
    const step = PdfPages.progress(this.title(f));
    let recs;
    try { recs = await PdfPages.records(f, Reader.book.id, step); }
    catch (e) { step.done(); Toast.show({ icon: 'x', title: 'ما قدرنا نقرأ الـPDF', text: e.message, timeout: 6000 }); console.warn(e); return 0; }
    step.done();
    if (!recs.length) return 0;
    Editor.flushAll();
    return this.insert(l, recs, { replace });
  },
  async insert(l, recs, { replace = false } = {}) {
    let at = l.i + 1;
    const curEmpty = Editor.isEmpty(l.c) && !(l.p.stickies || []).length && !(l.p.attach || []).length && !l.p.bg;
    if (replace || curEmpty) {
      at = l.i;
      const old = Reader.pages[at];
      Reader.pages.splice(at, 1); Reader.book.pageIds.splice(at, 1);
      if (old) DB.del('pages', old.id).catch(() => {});
    }
    Reader.pages.splice(at, 0, ...recs);
    Reader.book.pageIds.splice(at, 0, ...recs.map(r => r.id));
    await DB.putMany('pages', recs);
    // صفحات فاضية زيادة بآخر الكتاب منشيلها، ومنخلي العدد زوجي
    if (Reader.pages.length % 2) Reader.addPages(1);
    Reader.saveBook(); Reader.saveBook.flush && Reader.saveBook.flush();
    Editor.unbindAll();
    Reader.render();
    Reader.goToPage(at);
    return recs.length;
  },
  insertHere(l, blocks) {
    const html = blocks.filter(b => b !== '\f' && !/data-imgph/.test(b));
    if (!html.length) return;
    l.c.focus(); Editor.ensureCaret(l);
    const one = html.length === 1 && /^<p>/.test(html[0]) && !/<p>[\s\S]*<p>/.test(html[0]);
    if (one) { document.execCommand('insertHTML', false, html[0].replace(/^<p[^>]*>|<\/p>$/g, '')); Editor.changed(l); return; }
    const frag = el('<div></div>'); frag.innerHTML = html.join('');
    let last = null;
    const blk = topBlock(l.c, getSelection().anchorNode);
    const nodes = [...frag.childNodes];
    if (blk && blk.tagName === 'P' && !blk.textContent.trim() && !blk.querySelector('img,video,.cb')) { blk.replaceWith(...nodes); }
    else if (blk) blk.after(...nodes); else l.c.append(...nodes);
    last = nodes[nodes.length - 1];
    if (last && !last.nextElementSibling) last.after(el('<p><br></p>'));
    const nx = last && last.nextElementSibling; if (nx) setCaretAt(nx, 0);
    Editor.normalize(l.c);
    Editor.changed(l);
  },
  // نقطة الدخول: ملف انسحب على الصفحة أو انختار من «إدراج»
  async file(f, l) {
    if (this.legacy(f)) { Toast.show({ icon: 'page', title: 'نسخة قديمة من الملف', text: 'افتحه بوورد/إكسل واحفظه كـ .docx أو .xlsx، وبعدين اسحبه هون.', timeout: 7000 }); return; }
    if (!this.can(f)) return;
    const k = this.kind(f), name = this.title(f);
    if (!l) { Toast.show({ icon: 'page', text: 'افتح الكتاب أولاً (اسحب الغلاف)' }); return; }
    const busy = Toast.show({ icon: 'download', title: `عم نقرأ «${name}»…`, text: 'لحظة', timeout: 0 });
    let parsed = null, err = null;
    try { parsed = await this.parse(f); } catch (e) { err = e; }
    busy();
    if (k === 'pdf') return this.pdfChoice(f, l, parsed, err);
    if (err || !parsed || !parsed.blocks.length) { Toast.show({ icon: 'x', title: 'ما قدرنا نقرأ الملف', text: (err && err.message) || 'الملف فاضي', timeout: 6000 }); if (err) console.warn(err); return; }
    this.choose(f, l, parsed);
  },
  choose(f, l, parsed, extra = '') {
    const name = this.title(f), k = this.kind(f);
    // شيت عريض: بنخيّر بين بطاقات (لكل سطر) وجدول كامل
    const wide = parsed.sheets && Sheets.wide(parsed.sheets);
    let pages = this.paginate(l, parsed.blocks, parsed.images).length;
    const count = n => `${n} ${n === 1 ? 'صفحة' : 'صفحات'}`;
    const small = pages <= 1 && !parsed.images.length;
    const n = el(`<div class="import-dlg">
      <div class="imp-head"><span class="imp-ic imp-${k}">${esc(k === 'xlsx' || k === 'csv' ? 'XLS' : k.toUpperCase())}</span><div><h3 dir="auto">${esc(name)}</h3><p class="muted sm">${esc(this.label[k] || '')} · <span class="imp-count">${count(pages)}</span> بهالكتاب${parsed.images.length ? ` · ${parsed.images.length} صور` : ''}${extra}</p></div></div>
      <p class="muted">${wide ? 'الجدول عريض على صفحة الدفتر، فخلّينا كل سطر منه «بطاقة» واضحة: عنوانه، وتحته كل عمود مع قيمته.' : 'العناوين والخط العريض والألوان والجداول والقوائم بتضل زي ما هي، والنص بيتوزع على الصفحات لحاله.'}</p>
      ${wide ? `<div class="imp-mode" role="radiogroup" aria-label="شكل الجدول"><button class="on" data-m="auto" role="radio" aria-checked="true">${ic('note')} بطاقات (أسهل للقراءة)</button><button data-m="table" role="radio" aria-checked="false">${ic('table')} جدول كامل</button></div>` : ''}
      <div class="imp-opts">
        <button class="imp-opt" data-a="pages">${ic('addpage')}<b>صفحات جديدة بعد هالصفحة</b><span><span class="imp-count">${count(pages)}</span> — بيضل اللي كاتبه زي ما هو</span></button>
        <button class="imp-opt" data-a="here">${ic('plus')}<b>هون، مكان المؤشر</b><span>بيتدخّل جوّا الصفحة وبيكمل على اللي بعدها</span></button>
      </div>
      <div class="row end"><button class="btn ghost" data-a="cancel">إلغاء</button></div></div>`);
    const m = Modal.open(n, { cls: 'import-modal' });
    $(`[data-a=${small ? 'here' : 'pages'}]`, n).classList.add('rec');
    n.onclick = async e => {
      const mb = e.target.closest('[data-m]');
      if (mb) {
        $$('[data-m]', n).forEach(x => { x.classList.toggle('on', x === mb); x.setAttribute('aria-checked', x === mb); });
        parsed.blocks = Sheets.blocks(parsed.sheets, mb.dataset.m);
        pages = this.paginate(l, parsed.blocks, parsed.images).length;
        $$('.imp-count', n).forEach(x => { x.textContent = count(pages); });
        return;
      }
      const b = e.target.closest('[data-a]'); if (!b) return;
      m.close();
      if (b.dataset.a === 'pages') { const c = await this.toPages(l, parsed); this.done(name, c); }
      else if (b.dataset.a === 'here') { this.insertHere(l, parsed.blocks); if (parsed.images.length) { const st = await this.stickers({ imgs: parsed.images.map((_, k) => ({ k, y: 140 + k * 40 })) }, parsed.images, Reader.book.dir === 'rtl'); st.forEach(s => Stickies.add(l, s)); } this.done(name, 0); }
    };
    setTimeout(() => $('.imp-opt.rec', n)?.focus(), 30);
  },
  done(name, pages) { Toast.show({ icon: 'check', title: `انضاف «${name}» ✦`, text: pages ? `على ${pages} ${pages === 1 ? 'صفحة' : 'صفحات'}. بتقدر تعدّل عليه زي أي نص.` : 'بتقدر تعدّل عليه زي أي نص.', timeout: 4500 }); },
  // PDF: يا بنحفظه زي ما هو (عارض PDF)، يا بنحوّل نصه لصفحات
  pdfChoice(f, l, parsed, err) {
    const name = this.title(f);
    const text = parsed && parsed.chars > 20;
    const n = el(`<div class="import-dlg">
      <div class="imp-head"><span class="imp-ic imp-pdf">PDF</span><div><h3 dir="auto">${esc(name)}</h3><p class="muted sm">${parsed ? `${parsed.pdfPages} ${parsed.pdfPages === 1 ? 'صفحة' : 'صفحات'}` : ''}${!text ? ' · صور أو سكان (بيتحوّل صفحة بصفحة عادي)' : ''}</p></div></div>
      <div class="imp-opts">
        <button class="imp-opt rec" data-a="pages">${ic('books')}<b>صفحة بصفحة بالكتاب</b><span>${parsed && parsed.pdfPages > 1 ? `الـ${parsed.pdfPages} صفحات` : 'نفس الصفحات'} بنفس شكلها بالزبط — نص، سكان، صور، جداول، رسومات. وبتقدر تكتب وتلزّق ملاحظات فوقها، والبحث بيلاقي نصها</span></button>
        <button class="imp-opt" data-a="text" ${text ? '' : 'disabled'}>${ic('page')}<b>نصه بس، قابل للتعديل</b><span>${!text ? (err && err.message) || 'هالملف صور بس، ما فيه نص نطلّعه' : parsed.garbled ? '⚠ الحروف العربية بهالملف مخزّنة ناقصة (بيصير بملفات جوجل دوكس) — النص بيطلع مش دقيق، الأفضل «صفحة بصفحة»' : 'النص والعناوين بيتوزعوا على صفحات الكتاب وبتعدّل عليهم زي أي نص (عدد الصفحات ممكن يختلف)'}</span></button>
        <button class="imp-opt" data-a="keep">${ic('attach')}<b>ملف مرفق بس</b><span>بيفتح بعارض PDF، ومربوط بهالكتاب</span></button>
      </div>
      <div class="row end"><button class="btn ghost" data-a="cancel">إلغاء</button></div></div>`);
    const m = Modal.open(n, { cls: 'import-modal' });
    n.onclick = async e => {
      const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
      m.close();
      const a = b.dataset.a;
      if (a === 'keep') await Files.addFiles([f], { subjectId: Library.sid(Reader.book), bookId: Reader.book.id });
      if (a === 'text') { const c = await this.toPages(l, parsed); this.done(name, c); }
      if (a === 'pages') { const c = await this.pdfPages(l, f); if (c) Toast.show({ icon: 'check', title: `انضاف «${name}» ✦`, text: `${c} ${c === 1 ? 'صفحة' : 'صفحات'} بنفس شكلها. اكتب أو لزّق ملاحظات فوقها.`, timeout: 4500 }); }
    };
    setTimeout(() => $('.imp-opt.rec', n)?.focus(), 30);
  },
  pick(l) { pickFile(Importer.ACCEPT, false).then(fs => { if (fs && fs.length) this.file(fs[0], l); }); },
  // من المكتبة: ملف وورد/إكسل → كتاب جديد باسمه
  async newBook(f) {
    if (this.legacy(f)) return this.file(f, null);
    let title = this.title(f), k = 2;
    while (Library.titleTaken(title)) title = `${this.title(f)} ${k++}`;
    const nb = { id: 'k' + uid(), subjectId: Library.cur || NO_SUBJECT, title, author: '', dir: Settings.d.dir, cover: { color: COVER_COLORS[(Library.books.length + 1) % COVER_COLORS.length][0], image: null }, paper: Settings.newPaper(), series: null, music: { track: 'default', auto: null }, pageIds: [], created: Date.now(), updated: Date.now(), lastSpread: 0 };
    const pages = [0, 1].map(() => ({ id: 'p' + uid(), bookId: nb.id, html: '', stickies: [], attach: [] }));
    pages.forEach(p => nb.pageIds.push(p.id));
    const pdf = this.kind(f) === 'pdf';
    let parsed;
    if (!pdf) try { parsed = await this.parse(f); } catch (e) { Toast.show({ icon: 'x', title: 'ما قدرنا نقرأ الملف', text: e.message, timeout: 6000 }); return; }
    await DB.putMany('pages', pages); await DB.put('books', nb);
    await Library.load();
    await Reader.open(nb.id, 0);
    await new Promise(r => setTimeout(r, 350));
    const l = Editor.live.get(0) || [...Editor.live.values()][0];
    if (!l) return;
    const c = pdf ? await this.pdfPages(l, f, { replace: true }) : await this.toPages(l, parsed, { replace: true });
    if (!c) return;
    Toast.show({ icon: 'books', title: `صار عندك كتاب «${title}» ✦`, text: pdf ? `${c} صفحات زي الملف بالزبط. غيّر غلافه واسمه من ⚙.` : `من الملف، على ${c} صفحات. غيّر غلافه واسمه من ⚙.`, timeout: 6000 });
  },
};
