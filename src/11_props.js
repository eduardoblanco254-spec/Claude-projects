// 11_props.js — edificios y fauna: portal, campamento de vagabundos, muros, torres, granja con arroyo,
// centro (fogata, estandarte, tiendas, antorchas), estatua, muelle y conejos.
// Todos los sprites se pre-renderizan en init(); por frame solo se eligen frames y se copian.
(function (K) {
  const U = K.util;
  const GY = K.GROUND_Y, WY = K.WATER_Y;

  // ------------------------------------------------------------------ lienzo de píxeles
  // Buffer de colores hex con operaciones enteras; se vuelca a un sprite {r, l, w, h}.
  class Pix {
    constructor(w, h) { this.w = w; this.h = h; this.d = new Array(w * h).fill(null); }
    in(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
    set(x, y, c) { x = Math.round(x); y = Math.round(y); if (c && this.in(x, y)) this.d[y * this.w + x] = c; }
    clr(x, y) { x = Math.round(x); y = Math.round(y); if (this.in(x, y)) this.d[y * this.w + x] = null; }
    get(x, y) { x = Math.round(x); y = Math.round(y); return this.in(x, y) ? this.d[y * this.w + x] : null; }
    rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); }
    line(x0, y0, x1, y1, c) {
      x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let e = dx + dy;
      for (;;) {
        this.set(x0, y0, c);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * e;
        if (e2 >= dy) { e += dy; x0 += sx; }
        if (e2 <= dx) { e += dx; y0 += sy; }
      }
    }
    // Elipse rellena con color por fila: fn(dy, ry) → color (permite luz arriba y sombra abajo).
    blob(cx, cy, rx, ry, fn) {
      for (let dy = -ry; dy <= ry; dy++) {
        const hw = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry + 0.01))) + 0.5);
        for (let dx = -hw; dx <= hw; dx++) this.set(cx + dx, cy + dy, typeof fn === 'function' ? fn(dx, dy, hw) : fn);
      }
    }
    // Estampa una matriz de caracteres (misma convención que U.sprite).
    rows(x, y, rows, pal, name = 'rows') {
      rows.forEach((r, j) => {
        for (let i = 0; i < r.length; i++) {
          const ch = r[i];
          if (ch === '.' || ch === ' ') continue;
          if (!pal[ch]) throw new Error(`${name}: el carácter '${ch}' no tiene color`);
          this.set(x + i, y + j, pal[ch]);
        }
      });
    }
    canvas() {
      const { c, x } = U.canvas(this.w, this.h);
      const img = x.createImageData(this.w, this.h), d = img.data;
      for (let i = 0; i < this.d.length; i++) {
        const col = this.d[i];
        if (!col) continue;
        const [r, g, b] = U.rgb(col);
        d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255;
      }
      x.putImageData(img, 0, 0);
      return c;
    }
    sprite() { return U.withFlip(this.canvas()); }
  }

  // ------------------------------------------------------------------ paletas (0 grieta … 5 brillo)
  const C = {
    wood:  ['#2C2019', '#3E2C20', '#553D2A', '#6E5036', '#8A6746', '#A5825A'],
    stone: ['#393D34', '#4A4F43', '#5C6154', '#737868', '#8B8F7F', '#A3A695'],
    black: ['#0F0F13', '#18171D', '#212026', '#2C2B33', '#393842', '#4A4853'],
    moss:  ['#3F4320', '#555A2A', '#6E7338', '#8A9046', '#ADA955'],
    straw: ['#5E5033', '#7E6C45', '#9E8A5A', '#BCA672', '#D4C08C'],
    cloth: ['#3F392F', '#575042', '#716853', '#8C8268', '#A69C7F'],
    iron:  ['#28272A', '#3C3A3B', '#57544F', '#7A766D', '#99958A'],
    fire:  ['#C9482A', '#EE7630', '#FFAA45', '#FFD873', '#FFF3C8'],
    soil:  ['#3A281A', '#4A3322', '#5E4229', '#7A5836', '#94704A'],
  };

  // ------------------------------------------------------------------ utilidades de construcción
  // Piedras: celdas de Voronoi en hileras trabadas; grieta entre celdas, luz arriba y sombra abajo.
  // pal = [grieta, muy oscuro, oscuro, base, claro, brillo]. shade(x, y) oscurece un tono (lado en sombra).
  function stoneFill(p, inside, pal, o) {
    const rr = U.mulberry32(o.seed), cw = o.cw, ch = o.ch, ax = ch / cw;
    const pts = [];
    for (let gy = -1; gy * ch < p.h + ch; gy++) {
      const off = (gy & 1) ? cw / 2 : 0;
      for (let gx = -1; gx * cw < p.w + cw; gx++) {
        pts.push([gx * cw + off + (rr() - 0.5) * cw * 0.55, gy * ch + ch / 2 + (rr() - 0.5) * ch * 0.45, rr()]);
      }
    }
    const id = new Int32Array(p.w * p.h).fill(-2);
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
      if (!inside(x, y)) continue;
      let d1 = 1e9, d2 = 1e9, i1 = -1;
      for (let i = 0; i < pts.length; i++) {
        const dx = (x - pts[i][0]) * ax, dy = y - pts[i][1], d = dx * dx + dy * dy;
        if (d < d1) { d2 = d1; d1 = d; i1 = i; } else if (d < d2) d2 = d;
      }
      id[y * p.w + x] = Math.sqrt(d2) - Math.sqrt(d1) < (o.gap || 0.9) ? -1 : i1;
    }
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
      const i = id[y * p.w + x];
      if (i === -2) continue;
      if (i === -1) { p.set(x, y, pal[0]); continue; }
      const t = pts[i][2];
      let k = t < 0.3 ? 2 : t < 0.8 ? 3 : 4;
      const up = y === 0 || id[(y - 1) * p.w + x] !== i;
      const dn = y === p.h - 1 || id[(y + 1) * p.w + x] !== i;
      if (up) k += 1; else if (dn) k -= 1;
      if (o.shade && o.shade(x, y)) k -= 1;
      p.set(x, y, pal[U.clamp(k, 1, 5)]);
    }
    return id;
  }

  // Musgo: cae desde las superficies que miran arriba y forma parches con ruido.
  function mossOver(p, seed, amount = 1, patches = 0.62) {
    const m = C.moss, orig = p.d.slice();
    const solid = (x, y) => p.in(x, y) && orig[y * p.w + x] !== null;
    for (let x = 0; x < p.w; x++) {
      for (let y = 0; y < p.h; y++) {
        if (!solid(x, y) || solid(x, y - 1)) continue;
        // superficie superior: gotea hacia abajo 1–4 px
        const len = Math.round((1 + U.noise1(x * 0.7, seed) * 3.5) * amount);
        for (let k = 0; k < len; k++) if (solid(x, y + k)) p.set(x, y + k, k === 0 ? m[4] : k === len - 1 ? m[1] : k === 1 ? m[3] : m[2]);
      }
    }
    if (patches < 1) {
      for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
        if (!solid(x, y)) continue;
        const n = U.fbm2(x * 0.18, y * 0.22, 3, seed + 5);
        if (n > patches) p.set(x, y, n > patches + 0.08 ? (solid(x, y - 1) && n > patches + 0.14 ? m[2] : m[3]) : m[1]);
      }
    }
  }

  // Llama en bucle: capas anidadas (fuera → dentro) con lenguas que oscilan y pavesas que se desprenden.
  // tongues: [x (−1..1), alto (0..1), ancho, fase, vaivén].
  function flameFrames(w, h, n, o) {
    const out = [], cx = (w - 1) / 2, cols = o.cols || C.fire, L = cols.length;
    for (let f = 0; f < n; f++) {
      const p = new Pix(w, h), ph = (f / n) * Math.PI * 2;
      const tg = o.tongues.map((t) => ({ x: t[0] + Math.sin(ph + t[3]) * t[4], h: t[1] * (0.8 + 0.2 * Math.sin(ph * 2 + t[3] * 1.7)), w: t[2] }));
      const top = (dx) => {
        let m = 0;
        for (const t of tg) { const k = 1 - Math.abs(dx - t.x) / t.w; if (k > 0) m = Math.max(m, t.h * Math.pow(k, 0.6)); }
        return m;
      };
      for (let l = 0; l < L; l++) {
        const s = 1 - (l / L) * 0.82, hw = o.halfW * s;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const dx = (x - cx) / hw;
          if (dx <= -1 || dx >= 1) continue;
          const up = (h - 1 - y) / (h - 1);
          if (up < o.round * s * (1 - Math.sqrt(1 - dx * dx))) continue;
          if (up <= top(dx) * Math.pow(s, 1.15)) p.set(x, y, cols[l]);
        }
      }
      for (const b of o.bits || []) {
        const u = (f / n + b[2]) % 1;
        if (u > 0.8) continue;
        const y = Math.round((h - 1) * (1 - (b[1] + u * (1 - b[1]))));
        const x = Math.round(cx + b[0] * o.halfW + Math.sin(u * 6 + b[2] * 9));
        p.set(x, y, cols[u < 0.3 ? 2 : u < 0.55 ? 1 : 0]);
      }
      out.push(p.sprite());
    }
    return out;
  }

  // ------------------------------------------------------------------ sprites
  const S = {};

  function buildPortal() {
    const W = 48, H = 58, cx = 23.5, p = new Pix(W, H);
    const outerTop = (x) => {
      const dx = (x - cx) / 19.5;
      if (Math.abs(dx) > 1) return 1e9;
      let t = 3 + 17 * (1 - Math.sqrt(1 - dx * dx));
      t += (U.noise1(x * 0.55, 31) - 0.5) * 6 + (U.hash(x, 1, 7) < 0.12 ? -2 : 0);
      return Math.round(t);
    };
    const inner = (x, y) => {
      const dx = (x - cx) / 10.2;
      if (Math.abs(dx) >= 1 || y >= H - 3) return false;
      return y >= 20 + 10 * (1 - Math.sqrt(1 - dx * dx));
    };
    // escombros en la base, a ambos lados
    const rubble = (x, y) => {
      const a = ((x - 3) / 4.5) ** 2 + ((y - (H - 2)) / 4) ** 2 < 1;
      const b = ((x - (W - 4)) / 4) ** 2 + ((y - (H - 2)) / 3.5) ** 2 < 1;
      const c = ((x - 8) / 3) ** 2 + ((y - (H - 1)) / 2.5) ** 2 < 1;
      return a || b || c;
    };
    const ring = (x, y) => (y >= outerTop(x) && !inner(x, y)) || rubble(x, y);
    stoneFill(p, ring, C.black, { seed: 12, cw: 8, ch: 5, gap: 0.85, shade: (x) => x > W * 0.62 });
    // borde interior teñido por el remolino
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!ring(x, y) || inner(x, y)) continue;
      const n1 = inner(x - 1, y) || inner(x + 1, y) || inner(x, y + 1);
      const n2 = !n1 && (inner(x - 2, y) || inner(x + 2, y) || inner(x, y + 2));
      if (n1) p.set(x, y, '#3A2750');
      else if (n2 && U.hash(x, y, 3) < 0.5) p.set(x, y, '#2B2136');
    }
    S.portal = p.sprite();
    // remolino violáceo (8 frames)
    S.portalSwirl = [];
    const cols = ['#110A18', '#1B0F27', '#291638', '#3B1F52', '#54306F', '#7A4E9A'];
    for (let f = 0; f < 8; f++) {
      const q = new Pix(W, H), ph = (f / 8) * Math.PI * 2;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (!inner(x, y)) continue;
        const dx = x - cx, dy = (y - 38) * 0.7, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
        const v = Math.sin(a * 2 - r * 0.6 + ph) * 0.5 + 0.5;
        const k = v * 0.62 + U.clamp(r / 13, 0, 1) * 0.5 - 0.12;
        q.set(x, y, cols[U.clamp(Math.floor(k * 5), 0, 4)]);
      }
      // motas que orbitan
      for (let i = 0; i < 5; i++) {
        const a = i * 1.26 + ph, r = 4 + i * 1.6;
        const x = Math.round(cx + Math.cos(a) * r), y = Math.round(38 + (Math.sin(a) * r) / 0.7);
        if (inner(x, y)) q.set(x, y, cols[5]);
      }
      S.portalSwirl.push(q.sprite());
    }
  }

  function buildTorch() {
    const p = new Pix(16, 32), w = C.wood;
    for (let y = 13; y < 32; y++) { p.set(7, y, w[4]); p.set(8, y, w[2]); }
    // ataduras de cuerda
    p.set(7, 17, C.straw[3]); p.set(8, 17, C.straw[1]); p.set(7, 18, C.straw[2]); p.set(8, 18, C.straw[1]);
    // cazoleta de hierro
    p.rect(5, 10, 6, 1, C.iron[3]); p.set(5, 10, C.iron[4]);
    p.rect(5, 11, 6, 1, C.iron[2]); p.rect(6, 12, 4, 1, C.iron[1]);
    p.set(5, 11, C.iron[3]); p.set(10, 11, C.iron[1]);
    S.torch = p.sprite();
    S.torchFlame = flameFrames(10, 14, 8, {
      halfW: 3.6, round: 0.22,
      tongues: [[0, 1, 1.1, 0, 0.16], [-0.45, 0.62, 0.6, 2.1, 0.1], [0.45, 0.55, 0.55, 4.2, 0.12]],
      bits: [[0.15, 0.7, 0.2], [-0.2, 0.75, 0.65]],
      cols: ['#D9562C', '#F58A36', '#FFC257', '#FFEBA6'],
    });
  }

  function buildCampfire() {
    // base: piedras del fondo + troncos (detrás de la llama) y piedras delanteras (delante)
    const W = 38, H = 16, back = new Pix(W, H), front = new Pix(W, H), st = C.stone, w = C.wood;
    const rock = (p, cx, cy, rx, ry) => p.blob(cx, cy, rx, ry, (dx, dy) => (dy <= -ry + 0 ? st[5] : dy < 0 ? st[4] : dy < ry ? st[3] : st[2]));
    // piedras del fondo (asoman tras los troncos)
    [[7, 8], [13, 6], [19, 6], [25, 6], [31, 8]].forEach(([x, y]) => rock(back, x, y, 3, 2));
    // troncos en tipi
    const log = (x0, y0, x1, y1) => {
      back.line(x0, y0, x1, y1, w[2]); back.line(x0 + 1, y0, x1 + 1, y1, w[3]);
      back.set(x1, y1, '#2A2220'); back.set(x1 + 1, y1, '#3A2A22');
    };
    log(8, 14, 16, 3); log(28, 14, 20, 3); log(12, 15, 18, 2); log(24, 15, 19, 1);
    back.line(4, 14, 33, 13, w[1]); back.line(4, 15, 33, 14, w[3]);
    // brasas
    for (let x = 11; x < 28; x++) if (U.hash(x, 2, 9) < 0.7) back.set(x, 12 + (x & 1), U.hash(x, 3, 9) < 0.5 ? '#E8732C' : '#A8401F');
    // piedras delanteras
    [[3, 13], [9, 14], [15, 14], [21, 14], [27, 14], [33, 13]].forEach(([x, y], i) => rock(front, x, y, 3 - (i === 0 || i === 5 ? 1 : 0), 2));
    S.fireBack = back.sprite(); S.fireFront = front.sprite();
    S.fireFlame = flameFrames(26, 40, 8, {
      halfW: 11, round: 0.12,
      tongues: [[0, 1, 0.75, 0, 0.1], [-0.45, 0.6, 0.55, 2.1, 0.12], [0.5, 0.66, 0.5, 4.2, 0.12], [-0.18, 0.82, 0.45, 1.3, 0.14], [0.26, 0.74, 0.45, 3.3, 0.14]],
      bits: [[-0.25, 0.7, 0.1], [0.3, 0.62, 0.55], [0.05, 0.82, 0.8], [-0.4, 0.5, 0.35]],
    });
    // fogata pequeña del campamento
    const sb = new Pix(20, 9), sf = new Pix(20, 9);
    [[5, 5], [10, 4], [15, 5]].forEach(([x, y]) => sb.blob(x, y, 2, 1, (dx, dy) => (dy < 0 ? st[4] : st[3])));
    sb.line(4, 7, 11, 2, w[2]); sb.line(5, 7, 12, 2, w[3]); sb.line(15, 7, 9, 2, w[2]); sb.line(16, 7, 10, 2, w[3]);
    for (let x = 6; x < 15; x++) if (U.hash(x, 4, 9) < 0.7) sb.set(x, 6 + (x & 1), U.hash(x, 5, 9) < 0.5 ? '#E8732C' : '#A8401F');
    [[2, 7], [7, 8], [12, 8], [17, 7]].forEach(([x, y]) => sf.blob(x, y, 2, 1, (dx, dy) => (dy < 0 ? st[4] : dy === 0 ? st[3] : st[2])));
    S.campBack = sb.sprite(); S.campFront = sf.sprite();
    S.campFlame = flameFrames(14, 20, 8, {
      halfW: 5.5, round: 0.15,
      tongues: [[0, 1, 0.9, 0.5, 0.14], [-0.45, 0.6, 0.55, 2.4, 0.12], [0.45, 0.7, 0.5, 4.6, 0.12]],
      bits: [[0.1, 0.7, 0.3], [-0.25, 0.6, 0.75]],
    });
  }

  function buildTent() {
    const W = 30, H = 21, p = new Pix(W, H), c = C.cloth, cx = 14, ay = 3;
    for (let y = ay; y < H; y++) {
      const k = (y - ay) / (H - 1 - ay), hw = Math.round(1 + 13 * Math.pow(k, 0.85));
      for (let x = cx - hw; x <= cx + hw + 1; x++) {
        const left = x <= cx;
        let col = left ? c[3] : c[1];
        if (y > ay + 2) {
          if (left && U.mod(x - cx + Math.round(k * 6), 6) === 0) col = c[2];
          if (!left && U.mod(x - cx - Math.round(k * 5), 7) === 0) col = c[0];
        }
        if (y === ay || (left && x === cx - hw)) col = left ? c[4] : c[2];
        p.set(x, y, col);
      }
    }
    // entrada oscura con el borde de la solapa iluminado
    for (let y = 9; y < H; y++) {
      const hw = Math.round((y - 9) * 0.42);
      for (let x = cx - hw; x <= cx + hw + 1; x++) p.set(x, y, y < 11 ? '#2E271F' : '#211B15');
      p.set(cx - hw - 1, y, c[4]);
    }
    // remiendos con puntadas
    p.rect(4, 13, 4, 3, '#7C604A'); p.rect(4, 13, 4, 1, '#94765C');
    [[3, 13], [3, 15], [8, 14], [5, 16]].forEach(([x, y]) => p.set(x, y, c[4]));
    p.rect(20, 10, 3, 3, '#5E6848'); p.rect(20, 10, 3, 1, '#727D58');
    p.set(23, 11, c[3]); p.set(19, 12, c[3]);
    p.rect(24, 16, 3, 2, '#6A5A48');
    // palos cruzados en la cumbrera
    p.line(cx, ay + 1, cx - 3, 0, C.wood[4]); p.line(cx + 1, ay + 1, cx + 4, 0, C.wood[2]);
    // borde inferior deshilachado
    for (let x = 0; x < W; x++) if (U.hash(x, 5, 3) < 0.3) p.clr(x, H - 1);
    S.tent = p.sprite();
  }

  // Vagabundos (miran a la derecha), 2 frames de reposo cada uno.
  const VPAL = {
    h: '#352E28', H: '#4E453D', s: '#C8A286', S: '#A07E66', e: '#2B2521',
    C: '#877E6B', c: '#6A6354', d: '#4E493F', D: '#3A3630', p: '#7A5E4A', l: '#473E36', f: '#2F2923',
  };
  const VSTAND = [
    '...hhh...',
    '..hHHhh..',
    '..hHsss..',
    '..hhses..',
    '..hSsss..',
    '...dSS...',
    '..cCCcd..',
    '.cCCCccd.',
    '.cCCcccd.',
    '.cCcccdd.',
    '.cCcpcdd.',
    '.ccppcdS.',
    '.cccccds.',
    '.ccccddd.',
    '..cccddD.',
    '..c.cd.d.',
    '...l..l..',
    '...l..l..',
    '...l..l..',
    '..ff.ff..',
  ];
  const VSIT = [
    '...hhh......',
    '..hHHhh.....',
    '..hHsss.....',
    '..hhses.....',
    '..hSsss.....',
    '..cdSS......',
    '.cCCccd.....',
    '.cCCcccdSs..',
    '.cCcccdd....',
    '.ccpccllll..',
    '.cccddlllll.',
    '..cdD...l.l.',
    '........f.ff',
  ];
  function buildVagrants() {
    const stand2 = ['.........'].concat(VSTAND.slice(0, 7), VSTAND.slice(8));
    const sit2 = VSIT.slice(); sit2[6] = '.cCCccdSs...'; sit2[7] = '.cCCcccd....';
    const mk = (rows, name) => { const p = new Pix(rows[0].length, rows.length); p.rows(0, 0, rows, VPAL, name); return p.sprite(); };
    S.vagStand = [mk(VSTAND, 'vagStand'), mk(stand2, 'vagStand2')];
    S.vagSit = [mk(VSIT, 'vagSit'), mk(sit2, 'vagSit2')];
    const lg = new Pix(10, 4), w = C.wood;
    lg.rect(1, 0, 8, 1, w[4]); lg.rect(0, 1, 10, 2, w[3]); lg.rect(1, 3, 8, 1, w[2]);
    lg.set(0, 1, '#9C8466'); lg.set(0, 2, '#7E6A50'); lg.set(9, 1, w[2]);
    S.seatLog = lg.sprite();
  }

  // Arquero (mira a la derecha): solo asoma sobre el parapeto de la torre.
  const APAL = {
    g: '#56643A', G: '#6F7E48', q: '#3F4A2A', s: '#C8A286', S: '#A07E66', e: '#2B2521',
    b: '#6E4C30', B: '#8E6A44', w: '#CFC6AE',
  };
  const ARCHER = [
    '...ggg....',
    '..gGGGg...',
    '..gGsss...',
    '..gGses.B.',
    '..qgsss.wb',
    '..qgSS..wb',
    '.qgGGgSssb',
    '.qgGGGg.wb',
    '.qgGGGg.wb',
    '.qgGGgg.B.',
    '.qgggggg..',
    '.qqgggqq..',
  ];
  function buildTower(frame) {
    const W = 28, H = 62, p = new Pix(W, H), w = C.wood, top = 22;
    // patas traseras y tirantes (en sombra)
    for (let y = top; y < H; y++) { p.set(8, y, w[1]); p.set(9, y, w[2]); p.set(18, y, w[1]); p.set(19, y, w[2]); }
    const brace = (x0, y0, x1, y1) => { p.line(x0, y0, x1, y1, w[2]); p.line(x0, y0 + 1, x1, y1 + 1, w[1]); };
    brace(4, top + 4, 23, top + 18); brace(23, top + 4, 4, top + 18);
    brace(4, top + 21, 23, top + 36); brace(23, top + 21, 4, top + 36);
    // travesaños
    p.rect(3, top + 19, 22, 1, w[4]); p.rect(3, top + 20, 22, 1, w[2]);
    // patas delanteras, abiertas hacia el suelo
    for (let y = top; y < H; y++) {
      const o = Math.round(((y - top) / (H - top)) * 2);
      [[2 - o, 0], [23 + o, 1]].forEach(([x]) => { p.set(x, y, w[4]); p.set(x + 1, y, w[3]); p.set(x + 2, y, w[2]); });
    }
    // arquero detrás del parapeto
    const a = frame ? ['..........'].concat(ARCHER.slice(0, 11)) : ARCHER;
    p.rows(9, top - 17, a, APAL, 'archer');
    // parapeto de tablas con puntas
    for (let i = 0; i < 9; i++) {
      const x = 1 + i * 3, h = 8 + (i & 1);
      for (let y = top - 2 - h; y < top - 1; y++) { p.set(x, y, w[4]); p.set(x + 1, y, w[3]); p.set(x + 2, y, w[2]); }
      p.clr(x, top - 2 - h); p.clr(x + 2, top - 2 - h);
      p.set(x + 1, top - 2 - h, w[5]);
    }
    p.rect(0, top - 6, W, 1, w[2]); p.rect(0, top - 5, W, 1, w[1]);
    // plataforma de canto
    p.rect(0, top - 1, W, 1, w[5]); p.rect(0, top, W, 1, w[3]); p.rect(0, top + 1, W, 1, w[1]);
    for (let x = 3; x < W; x += 5) p.set(x, top, w[2]);
    return p.sprite();
  }

  function buildWoodWall() {
    const W = 18, H = 30, p = new Pix(W, H), w = C.wood;
    const hs = [25, 28, 26, 29, 24];
    hs.forEach((h, i) => {
      const x = 1 + i * 3;
      for (let y = H - h; y < H; y++) { p.set(x, y, w[4]); p.set(x + 1, y, w[3]); p.set(x + 2, y, w[2]); }
      p.clr(x, H - h); p.clr(x + 2, H - h); p.set(x + 1, H - h, w[5]);
      p.set(x + 2, H - h + 1, w[3]);
    });
    // dos travesaños atados
    [9, 19].forEach((y) => { p.rect(0, y, W, 1, w[5]); p.rect(0, y + 1, W, 1, w[2]); p.set(0, y + 1, w[3]); });
    // montículo de tierra
    p.rect(0, H - 2, W, 1, C.soil[3]); p.rect(0, H - 1, W, 1, C.soil[2]);
    S.woodWall = p.sprite();
  }

  // Muro defensivo de piedra (26×60, cima en y≈112): lienzo recto de 12 hiladas, cordón saliente bajo
  // tres merlones y zócalo; más alto que la corona del jinete (≈128).
  function buildStoneWall(seed) {
    const W = 26, H = 60, p = new Pix(W, H), cx = (W - 1) / 2, st = C.stone;
    const CORD = 7, PLINTH = H - 4;
    const inside = (x, y) => {
      const dx = Math.abs(x - cx);
      if (y >= PLINTH || (y >= CORD && y < CORD + 3)) return dx <= 12.5; // zócalo y cordón (26 px)
      if (dx > 11.5) return false;                                       // lienzo (24 px)
      if (y < 4) { const u = x - 1; return u % 9 < 6; }                   // merlones de 6 con troneras de 3
      return true;
    };
    stoneFill(p, inside, st, { seed, cw: 7, ch: 5, gap: 0.8, shade: (x) => x > W * 0.64 });
    // cordón y zócalo: arista iluminada arriba y sombra que arrojan sobre el lienzo
    for (let x = 0; x < W; x++) {
      const dark = x > W * 0.64 ? 1 : 0;
      if (p.get(x, CORD)) p.set(x, CORD, st[5 - dark]);
      if (p.get(x, PLINTH)) p.set(x, PLINTH, st[4 - dark]);
      if (x >= 1 && x < W - 1) p.set(x, CORD + 3, st[1]);
    }
    mossOver(p, seed + 3, 1, 0.68);
    return p.sprite();
  }

  // Tiendas: tejadillo de paja, pared trasera en sombra, mostrador y cartel con pictograma.
  // Tienda (36×57): tejado de paja de 14 filas cuyo alero queda por encima de la corona del jinete
  // (y≈128); debajo, cartel, mercancía colgada de una barra y mostrador a la altura de la cintura.
  function buildShop(kind) {
    const W = 36, H = 57, p = new Pix(W, H), w = C.wood, s = C.straw, mid = W / 2;
    const eave = 13;                  // fila del flequillo del alero
    // pared del fondo (en sombra)
    for (let y = eave + 1; y < H - 1; y++) for (let x = 5; x < W - 5; x++) p.set(x, y, (x % 5 === 0) ? w[1] : w[2]);
    // sombra del alero sobre la pared
    for (let x = 5; x < W - 5; x++) { p.set(x, eave + 1, w[0]); if (U.hash(x, 2, 6) < 0.5) p.set(x, eave + 2, w[1]); }
    // postes
    for (let y = eave - 2; y < H; y++) { p.set(2, y, w[4]); p.set(3, y, w[2]); p.set(W - 4, y, w[4]); p.set(W - 3, y, w[2]); }
    // barra de la mercancía y mercancía colgada
    const railY = eave + 12;
    p.rect(4, railY, W - 8, 1, w[3]);
    if (kind === 'hammer') {
      [8, 16, 24].forEach((x, i) => {
        const y = railY + 1 + (i === 1 ? 1 : 0);
        p.rect(x, y, 4, 2, C.iron[3]); p.rect(x, y, 4, 1, C.iron[4]); p.set(x + 3, y + 1, C.iron[2]);
        for (let k = 2; k < 8; k++) p.set(x + 1, y + k, w[5]);
      });
    } else {
      [9, 17, 25].forEach((x, i) => {
        const y = railY + 1 + (i === 1 ? 1 : 0);
        for (let k = 0; k < 11; k++) { const dx = Math.round(Math.sin((k / 10) * Math.PI) * 2); p.set(x - dx, y + k, w[4]); }
        for (let k = 0; k < 11; k++) p.set(x + 1, y + k, '#CFC6AE');
      });
    }
    // mostrador
    const cy = H - 14;
    p.rect(3, cy, W - 6, 1, w[5]); p.rect(3, cy + 1, W - 6, 1, w[3]);
    for (let y = cy + 2; y < H; y++) for (let x = 4; x < W - 4; x++) p.set(x, y, ((y - cy) % 4 === 1) ? w[2] : (x < mid ? w[4] : w[3]));
    for (let y = cy + 2; y < H; y++) p.set(4, y, w[3]);
    if (kind === 'hammer') {
      // yunque sobre el mostrador
      p.rect(9, cy - 3, 7, 1, C.iron[4]); p.rect(10, cy - 2, 5, 1, C.iron[2]); p.rect(11, cy - 1, 3, 1, C.iron[1]);
      p.set(8, cy - 3, C.iron[3]);
    } else {
      // carcaj con flechas
      p.rect(27, cy - 5, 3, 5, '#6A4A34'); p.rect(27, cy - 5, 1, 5, '#84603F');
      [27, 28, 29].forEach((x, i) => { p.set(x, cy - 6 - (i & 1), '#D8D0B8'); p.set(x, cy - 7 - (i & 1), '#B7432F'); });
    }
    // tejado de paja a dos aguas (caballete arriba, alero deshilachado abajo)
    for (let y = 0; y <= eave; y++) {
      const hw = Math.min(mid, Math.round(4 + y * 1.2));
      for (let x = mid - hw; x < mid + hw; x++) {
        const strand = U.hash(x, Math.floor(y / 3), kind === 'hammer' ? 1 : 2), left = x < mid;
        let col = left ? (strand < 0.5 ? s[3] : s[2]) : (strand < 0.5 ? s[2] : s[1]);
        if (y === eave) col = U.hash(x, 9, 4) < 0.35 ? null : s[0];
        else if (y === eave - 1) col = s[1];
        else if (left && x === mid - hw) col = s[4];
        if (y <= 1 && Math.abs(x - (mid - 0.5)) < 4) col = s[4];
        if (col) p.set(x, y, col);
      }
    }
    // cartel colgado del alero
    const bx = mid - 6, by = eave + 1;
    p.set(bx + 2, by, w[1]); p.set(bx + 9, by, w[1]);
    p.rect(bx, by + 1, 12, 8, w[4]); p.rect(bx + 1, by + 2, 10, 6, w[3]); p.rect(bx, by + 8, 12, 1, w[2]);
    const ink = '#E8DDBC';
    if (kind === 'hammer') {
      p.rect(bx + 3, by + 3, 6, 2, ink); p.rect(bx + 5, by + 5, 2, 3, ink);
    } else {
      [[4, 2], [3, 3], [3, 4], [3, 5], [4, 6]].forEach(([x, y]) => p.set(bx + x, by + y, ink));
      for (let y = 2; y < 7; y++) p.set(bx + 6, by + y, ink);
      p.rect(bx + 3, by + 4, 6, 1, ink); p.set(bx + 8, by + 3, ink); p.set(bx + 8, by + 5, ink);
    }
    return p.sprite();
  }

  // Estandarte: mástil de 60 px con travesaño y un paño vertical colgante (13×24, cola de golondrina)
  // del color de la capa, con una corona de 3 puntas centrada. 3 niveles de viento × 4 frames.
  const BANNER = { PH: 60, PC: 8, TOP: 6, BW: 13, BH: 24, LEAN: 7 };
  function buildBanner() {
    const [col, sh] = K.royal.cape, w = C.wood, { PH, PC, BW, BH, LEAN } = BANNER;
    const gold = '#EB9B36', goldL = '#F7C46A', goldD = '#B8742A';
    const pole = new Pix(PC * 2 + 1, PH);
    for (let y = 3; y < PH; y++) { pole.set(PC - 1, y, w[4]); pole.set(PC, y, w[3]); pole.set(PC + 1, y, w[2]); }
    // remate dorado
    pole.set(PC, 0, goldL);
    pole.set(PC - 1, 1, gold); pole.set(PC, 1, goldL); pole.set(PC + 1, 1, goldD);
    pole.set(PC - 1, 2, gold); pole.set(PC, 2, gold); pole.set(PC + 1, 2, goldD);
    // travesaño con pomos dorados
    for (let x = 1; x < PC * 2; x++) { pole.set(x, 4, w[5]); pole.set(x, 5, w[2]); }
    pole.set(0, 4, goldL); pole.set(0, 5, goldD); pole.set(PC * 2, 4, gold); pole.set(PC * 2, 5, goldD);
    S.bannerPole = pole.sprite();
    // Corona: más clara si el paño es anaranjado (el dorado se perdería).
    const [cr, cg] = U.rgb(col), pale = cr > 150 && cg > 100;
    const cMain = pale ? '#F4E6C0' : gold, cHi = pale ? '#FFF6DE' : goldL, cLo = pale ? '#C9B98E' : goldD;
    const lite = U.lerpColor(col, '#FFFFFF', 0.14), dark = U.shade(sh, 0.8), mid = (BW - 1) / 2;
    const CROWN = ['h.h.h', '#####', '#####', 'ddddd'];
    S.banner = [0, 1, 2].map((level) => {
      const lean = [0.3, 2.5, 5.2][level], amp = [0.6, 0.9, 1.1][level];
      const out = [];
      for (let f = 0; f < 4; f++) {
        const p = new Pix(BW + LEAN + 1, BH), ph = (f / 4) * Math.PI * 2;
        // desplazamiento de cada fila: el viento empuja la parte baja y una onda larga baja por el paño
        const off = (v) => { const k = v / (BH - 1); return lean * Math.pow(k, 1.6) + amp * k * Math.sin(ph - v * 0.2); };
        const notch = (u, v) => { const t = v - (BH - 6); return t > 0 && Math.abs(u - mid) < t * 0.8; };
        for (let v = 0; v < BH; v++) {
          const dx = Math.round(off(v));
          for (let u = 0; u < BW; u++) {
            if (notch(u, v)) continue;
            // pliegues verticales (siguen la inclinación del paño) que se desplazan despacio con el viento
            const fold = Math.sin(u * 0.9 - ph * (level ? 0.5 : 0.25) + 1.3);
            let c = fold > 0.72 ? sh : col;
            if (u === 0) c = lite;
            if (u === BW - 1) c = sh;
            if (v === 0) c = dark;                                           // doblez bajo el travesaño
            if (v === BH - 1 || notch(u - 1, v) || notch(u + 1, v)) c = c === col || c === lite ? sh : dark; // bordes de la cola
            p.set(u + dx, v, c);
          }
        }
        CROWN.forEach((r, j) => {
          const v = 5 + j, dx = Math.round(off(v));
          for (let i = 0; i < 5; i++) if (r[i] !== '.') p.set(mid - 2 + i + dx, v, r[i] === 'd' ? cLo : r[i] === 'h' ? cHi : cMain);
        });
        out.push(p.sprite());
      }
      return out;
    });
  }

  // Estatua-monumento (33×72, cima en y≈100): rey coronado de piedra que apoya las manos en la espada,
  // sobre un pedestal de tres cuerpos (cornisa, dado de sillares y zócalo escalonado).
  function buildStatue() {
    const W = 33, H = 72, p = new Pix(W, H), st = C.stone, cx = 16, PT = 53;
    const ped = (x, y) => x >= 0 && x < W && (
      (y >= 66 && y < H) || (y >= 64 && y < 66 && x >= 1 && x < W - 1) ||
      (y >= 56 && y < 64 && x >= 3 && x < W - 3) || (y >= PT && y < 56 && x >= 1 && x < W - 1));
    for (let y = PT; y < H; y++) for (let x = 0; x < W; x++) {
      if (!ped(x, y)) continue;
      let k = 3;
      if (!ped(x, y - 1)) k = 5; else if (!ped(x, y - 2)) k = 4;
      if (!ped(x, y + 1) || y === 56) k = 2;                       // aristas inferiores y sombra de la cornisa
      if (x > W * 0.66) k -= 1;
      if (y >= 57 && y < 64 && (y === 60 || U.mod(x + (y < 60 ? 0 : 4), 8) === 0)) k = 1; // juntas del dado
      if (y >= 67 && U.mod(x + 3, 9) === 0) k = 1;                                         // juntas del zócalo
      p.set(x, y, st[U.clamp(k, 1, 5)]);
    }
    // figura
    const body = (x, y) => {
      const dx = x - cx;
      if (y >= 3 && y <= 12) return (dx / 3.7) ** 2 + ((y - 7.8) / 4.8) ** 2 <= 1;   // cabeza
      if (y === 13) return Math.abs(dx) <= 2;                                          // cuello
      if (y >= 14 && y <= 17) return Math.abs(dx) <= 5.5 + (y - 14);                   // hombros
      if (y >= 18 && y < PT) return Math.abs(dx) <= 8.4 + ((y - 18) / (PT - 18)) ** 1.5 * 3.2; // manto en A
      return false;
    };
    for (let y = 0; y < PT; y++) for (let x = 0; x < W; x++) {
      if (!body(x, y)) continue;
      const dx = x - cx;
      let k = dx < -4 ? 4 : dx < 3 ? 3 : 2;
      if (!body(x, y - 1)) k += 1;
      if (y > 28 && (dx === -5 || dx === 5 || dx === -9 || dx === 9)) k -= 1;         // pliegues del manto
      p.set(x, y, st[U.clamp(k, 1, 5)]);
    }
    // corona de 3 puntas
    [-3, 0, 3].forEach((dx) => { p.set(cx + dx, 0, st[5]); p.set(cx + dx, 1, st[4]); });
    for (let dx = -3; dx <= 3; dx++) { p.set(cx + dx, 2, st[dx < 2 ? 5 : 4]); p.set(cx + dx, 3, st[dx < 2 ? 3 : 2]); }
    // cuencas de los ojos y sombra bajo la barbilla
    p.set(cx - 2, 7, st[1]); p.set(cx + 2, 7, st[1]);
    for (let dx = -2; dx <= 2; dx++) p.set(cx + dx, 13, st[1]);
    // brazos: mangas que convergen en las manos sobre la empuñadura
    p.line(cx - 8, 17, cx - 2, 25, st[4]); p.line(cx - 8, 18, cx - 2, 26, st[3]); p.line(cx - 8, 19, cx - 3, 26, st[3]);
    p.line(cx + 8, 17, cx + 2, 25, st[2]); p.line(cx + 8, 18, cx + 2, 26, st[1]); p.line(cx + 8, 19, cx + 3, 26, st[1]);
    p.rect(cx - 2, 24, 5, 3, st[4]); p.rect(cx - 2, 26, 5, 1, st[2]);
    // espada: pomo y puño sobre las manos, guarda y hoja hasta el pedestal
    p.set(cx, 20, st[5]); p.set(cx - 1, 21, st[4]); p.set(cx, 21, st[5]); p.set(cx + 1, 21, st[3]);
    p.set(cx, 22, st[3]); p.set(cx, 23, st[3]);
    p.rect(cx - 5, 28, 11, 1, st[5]); p.rect(cx - 5, 29, 11, 1, st[2]);
    for (let y = 30; y < PT; y++) { p.set(cx - 1, y, st[5]); p.set(cx, y, st[4]); p.set(cx + 1, y, st[2]); }
    p.set(cx - 1, PT - 1, st[2]); p.set(cx + 1, PT - 1, st[2]);   // punta de la hoja
    mossOver(p, 77, 1.2, 0.62);
    S.statue = p.sprite();
  }

  // Muelle: cubierta a ras de suelo con norays y cuerda; pilotes y tirantes que bajan DENTRO del agua
  // hasta su línea de flotación (WY+14) con algas, y un embarcadero bajo a nivel del agua (y≈186–191).
  // Se parte en dos sprites: lo que queda por encima de WY va en drawBack (y se refleja); lo de WY hacia
  // abajo va en drawOverlay, después del agua, teñido con K.env.mulColor, y tapa el reflejo.
  const DOCK = { FOOT: WY + 14, LOW: 24 };
  function buildDock(len) {
    const y0 = GY - 18, H = WY + DOCK.LOW - y0, p = new Pix(len, H), w = C.wood, m = C.moss;
    const Y = (y) => y - y0;   // fila de pantalla → fila del sprite
    const dk = Y(GY - 1);      // fila superior de la cubierta
    const foot = Y(DOCK.FOOT); // línea de flotación de los pilotes
    const piles = [];
    for (let x = 3; x < len - 3; x += 22) piles.push(x);
    // embarcadero bajo (detrás de los pilotes) entre los dos últimos vanos, con escalera desde la cubierta
    const lx0 = piles[piles.length - 3] + 4, lTop = Y(186);
    for (let x = lx0; x < len; x++) {
      const seam = (x - lx0) % 5 === 4;
      p.set(x, lTop, seam ? w[3] : w[5]); p.set(x, lTop + 1, seam ? w[2] : w[4]); p.set(x, lTop + 2, seam ? w[2] : w[3]);
      p.set(x, lTop + 3, w[1]); p.set(x, lTop + 4, w[0]);
      p.set(x, lTop + 5, U.hash(x, 7, 13) < 0.6 ? m[1] : m[0]);
      if (U.hash(x, 8, 13) < 0.3) p.set(x, lTop + 6, m[0]);
    }
    const ladX = lx0 + 3;
    for (let y = dk + 6; y < lTop; y++) { p.set(ladX, y, w[3]); p.set(ladX + 4, y, w[2]); if ((y - dk) % 3 === 0) for (let i = 1; i < 4; i++) p.set(ladX + i, y, w[4]); }
    // noray bajo sobre el embarcadero
    const bx = len - 8;
    for (let y = lTop - 4; y < lTop; y++) { p.set(bx, y, w[4]); p.set(bx + 1, y, w[3]); p.set(bx + 2, y, w[2]); }
    p.rect(bx, lTop - 2, 3, 1, C.straw[2]);
    // tirantes en zigzag entre pilotes (salvo en los vanos del embarcadero): del larguero al agua
    for (let i = 0; i < piles.length - 1; i++) {
      const a = piles[i] + 4, b = piles[i + 1] - 1;
      if (b > lx0) break;
      const top = Y(GY + 7), bot = Y(WY + 9), [ya, yb] = i & 1 ? [top, bot] : [bot, top];
      p.line(a, ya, b, yb, w[3]); p.line(a, ya + 1, b, yb + 1, w[1]);
    }
    // pilotes: madera mojada (un tono más oscura) cerca del agua y algas en la línea de flotación
    for (const x of piles) {
      for (let y = dk + 6; y < foot; y++) {
        const c = y >= Y(WY + 4) ? [w[2], w[1], w[1], w[0]] : [w[3], w[2], w[2], w[1]];
        for (let i = 0; i < 4; i++) p.set(x + i, y, c[i]);
      }
      for (let i = 0; i < 4; i++) {
        const len2 = 2 + Math.floor(U.hash(x + i, 3, 17) * 4);
        for (let k = 1; k <= len2; k++) p.set(x + i, foot - k, k === len2 ? m[2] : (k & 1 ? m[0] : m[1]));
      }
      for (let i = 0; i < 4; i++) p.set(x + i, dk + 7, w[0]);
    }
    // cubierta: tablones transversales vistos desde arriba
    for (let x = 0; x < len; x++) {
      const plank = Math.floor(x / 6), seam = x % 6 === 5, tone = U.hash(plank, 0, 21) < 0.5 ? 4 : 3;
      for (let y = dk; y < dk + 4; y++) p.set(x, y, seam ? w[2] : y === dk ? w[tone + 1] : y === dk + 3 ? w[tone - 1] : w[tone]);
      p.set(x, dk + 4, w[2]); p.set(x, dk + 5, w[1]);
    }
    for (let x = 4; x < len; x += 22) p.set(x + 1, dk + 4, C.iron[3]);
    // norays con cuerda y cuerda colgante entre ellos
    const posts = [1, Math.round(len / 2) - 2, len - 6];
    posts.forEach((x) => {
      for (let y = 2; y < dk + 4; y++) { p.set(x, y, w[4]); p.set(x + 1, y, w[3]); p.set(x + 2, y, w[3]); p.set(x + 3, y, w[2]); }
      p.clr(x, 2); p.clr(x + 3, 2); p.set(x + 1, 2, w[5]); p.set(x + 2, 2, w[4]);
      p.rect(x, 6, 4, 1, C.straw[3]); p.rect(x, 7, 4, 1, C.straw[1]);
    });
    for (let i = 0; i < posts.length - 1; i++) {
      const a = posts[i] + 4, b = posts[i + 1] - 1;
      for (let x = a; x <= b; x++) { const u = (x - a) / (b - a); p.set(x, 7 + Math.round(Math.sin(u * Math.PI) * 5), C.straw[2]); }
    }
    // parte alta (drawBack, se refleja) y parte sumergida (drawOverlay)
    const split = Y(WY), up = new Pix(len, split), lo = new Pix(len, H - split);
    for (let y = 0; y < H; y++) for (let x = 0; x < len; x++) {
      const c = p.d[y * len + x];
      if (!c) continue;
      if (y < split) up.d[y * len + x] = c; else lo.d[(y - split) * len + x] = c;
    }
    S.dock = up.sprite(); S.dockY0 = y0; S.dockLow = lo.canvas();
    // Sombra de la cubierta sobre la orilla (se aplica con multiply antes del muelle).
    const sc = ['#857D70', '#958E82', '#A69F94', '#B7B1A7', '#C8C3BA', '#DAD6CF'], shade = new Pix(len, sc.length);
    for (let y = 0; y < sc.length; y++) for (let x = 0; x < len; x++) shade.set(x, y, sc[y]);
    S.dockShade = shade.canvas();
    // Onda al pie de cada pilote y del embarcadero, y reflejo corto del pilote bajo su línea de flotación
    // (3 frames). Se dibujan con alfa, así que son lienzos opacos aparte.
    const fl = DOCK.FOOT - WY;
    S.dockRip = []; S.dockRefl = [];
    for (let f = 0; f < 3; f++) {
      const rp = new Pix(len, DOCK.LOW), rf = new Pix(len, DOCK.LOW), foam = '#C9CDB8';
      for (const x of piles) {
        if (f === 0) rp.rect(x - 1, fl, 6, 1, foam);
        else if (f === 1) { rp.rect(x - 2, fl, 8, 1, foam); rp.rect(x, fl + 1, 4, 1, foam); }
        else { rp.rect(x - 3, fl, 2, 1, foam); rp.rect(x + 5, fl, 2, 1, foam); rp.rect(x - 1, fl + 1, 6, 1, foam); }
        for (let y = fl + 1; y < DOCK.LOW; y++) {
          const d = (y - fl) / (DOCK.LOW - fl);
          if (U.hash(x + f * 31, y, 23) < d * 0.8) continue;
          const o = Math.round(Math.sin(y * 1.3 + f * 2.1 + x) * (0.5 + d));
          rf.rect(x + o, y, 4, 1, y === fl + 1 ? w[0] : w[1]);
        }
      }
      for (let x = lx0; x < len; x++) if (U.hash(x >> 2, f, 29) < 0.55) rp.set(x, lTop + 7 - split, foam);
      S.dockRip.push(rp.canvas()); S.dockRefl.push(rf.canvas());
    }
  }

  // Granja: surcos por campo, manojos de trigo (2 variantes × 4 inclinaciones), arroyo y cascada.
  function buildFarm() {
    S.wheat = [0, 1].map((v) => [0, 1, 2, 3].map((lean) => {
      const W = 12, H = 18, p = new Pix(W, H), rr = U.mulberry32(50 + v * 7);
      for (let i = 0; i < 5; i++) {
        const bx = 1 + i * 2, hgt = 11 + Math.floor(rr() * 6);
        for (let j = 0; j < hgt; j++) {
          const u = j / hgt, x = bx + Math.round(lean * u * u), y = H - 1 - j;
          if (j >= hgt - 4) {
            p.set(x, y, j === hgt - 1 ? '#D9C68A' : (j & 1) ? '#E2CC80' : '#C8B060');
            if (j < hgt - 1) p.set(x + 1, y, (j & 1) ? '#A08C48' : '#B89E54');
          } else p.set(x, y, j < 4 ? '#6E6A36' : '#8E8446');
        }
      }
      return p.sprite();
    }));
    // Campos labrados: solo una franja fina en la superficie (y 170–176): tierra oscura con caballones
    // de 1 px y brotes. La cara del talud queda con la tierra del mundo; como mucho, surcos cortos
    // verticales y terrones sueltos justo bajo el borde, nunca bandas horizontales continuas.
    S.fields = [];
    for (const f of FIELDS) {
      const fw = f[1] - f[0], p = new Pix(fw, 9), so = C.soil;
      const ROWS = [2, 1, 3, 1, 1, 3, 1];   // borde lejano, surco, caballón, surcos, caballón, borde cercano
      for (let y = 0; y < ROWS.length; y++) {
        const end = Math.round(U.hash(y, f[0], 5) * 1.5) + (y === 0 ? 2 : y === ROWS.length - 1 ? 1 : 0);
        for (let x = end; x < fw - end; x++) {
          let k = ROWS[y];
          if (k === 3 && U.hash(x, y, 8) < 0.18) k = 2;           // caballón irregular
          if (k === 1 && U.hash(x, y, 9) < 0.08) k = 0;           // hoyos
          p.set(x, y, so[k]);
        }
        // brotes en los caballones
        if (ROWS[y] === 3) for (let x = 2 + y; x < fw - 3; x += 4 + (x & 1)) { p.set(x, y, '#6E7A38'); if (U.hash(x, y, 2) < 0.5) p.set(x, y - 1, '#8A9046'); }
      }
      // bajo el borde: surcos cortos verticales y terrones sueltos
      for (let x = 2; x < fw - 2; x += 3 + Math.floor(U.hash(x, 1, 11) * 4)) {
        p.set(x, ROWS.length, so[0]);
        if (U.hash(x, 2, 11) < 0.45) p.set(x, ROWS.length + 1, so[0]);
        else if (U.hash(x, 3, 11) < 0.5) p.set(x + 1, ROWS.length, so[1]);
      }
      S.fields.push(p.sprite());
    }
    // arroyo con cascada al río (5 frames de corriente)
    S.stream = [];
    const W = 22, H = WY - GY + 2, cxOf = (y) => 11 + Math.round(Math.sin(y * 0.3 + 0.4) * 1.6), hwOf = (y) => 1.6 + y * 0.2;
    for (let f = 0; f < 5; f++) {
      const p = new Pix(W, H);
      for (let y = 0; y < H; y++) {
        const cx = cxOf(y), hw = hwOf(y), fall = y >= H - 6;
        for (let x = 0; x < W; x++) {
          const d = x - cx, ad = Math.abs(d);
          if (ad > hw + 1.2) continue;
          if (ad > hw) { p.set(x, y, fall ? null : (U.hash(x, y, 4) < 0.25 ? '#8C8A7A' : '#3B2B1E')); continue; }
          let c;
          if (!fall) {
            c = d < -hw + 1 ? '#4C5B54' : ad < 1 ? '#6F8379' : '#5E7069';
            if (U.mod(y - f + Math.floor(U.hash(x, 0, 6) * 5), 5) === 0 && ad < hw - 0.6) c = '#9AB0A6';
          } else {
            const v = U.mod(y - f * 2 + Math.floor(U.hash(x, 1, 6) * 5), 5);
            c = v === 0 ? '#DCE6DE' : v < 3 ? '#A9BCB2' : '#7E948A';
            if (y >= H - 2) c = U.hash(x, y + f, 3) < 0.5 ? '#E4ECE4' : '#B8C8BE';
          }
          p.set(x, y, c);
        }
      }
      // piedras en la orilla del fondo (el arroyo sale de detrás)
      p.blob(cxOf(0) - 4, 1, 2, 1, (dx, dy) => (dy < 0 ? C.stone[4] : C.stone[3]));
      p.blob(cxOf(0) + 4, 1, 2, 1, (dx, dy) => (dy < 0 ? C.stone[4] : C.stone[2]));
      S.stream.push(p.sprite());
    }
    S.streamCX = 11;
    // puentecillo de tablones por donde pasa el camino
    const b = new Pix(18, 6), w = C.wood;
    for (let x = 0; x < 18; x++) {
      const seam = x % 4 === 3;
      b.set(x, 1, seam ? w[3] : w[5]); b.set(x, 2, seam ? w[2] : w[4]); b.set(x, 3, w[2]); b.set(x, 4, w[1]);
    }
    [0, 16].forEach((x) => { b.rect(x, 0, 2, 6, w[3]); b.set(x, 0, w[5]); b.set(x + 1, 5, w[1]); });
    S.bridge = b.sprite();
  }

  // Conejos (miran a la derecha): sentado, mordisqueando, salto estirado y aterrizaje.
  const RPAL = { b: '#8A7862', B: '#A6937A', d: '#66573F', w: '#E6DECE', k: '#231C17', e: '#7C6A56', E: '#B89484', n: '#C49A8A' };
  const RABBIT = [
    [
      '......ee...',
      '......eE...',
      '......BBb..',
      '....BBBbkb.',
      '..BBbbbbbbn',
      '.wbbbbbbbb.',
      '..bbbbbbd..',
      '..ddd.dd...',
    ],
    [
      '...........',
      '.....ee....',
      '......eBb..',
      '....BBBbkb.',
      '..BBbbbbbbn',
      '.wbbbbbbbb.',
      '..bbbbbbd..',
      '..ddd.dd...',
    ],
    [
      '...........',
      '.......ee..',
      '..BBBBBeBb.',
      '.wBbbbbbbkb',
      '..bbbbbbbbn',
      '.dd...ddd..',
      'dd.........',
      '...........',
    ],
    [
      '.......e...',
      '......eE...',
      '....BBBBb..',
      '..BBbbbbkb.',
      '.wbbbbbbbbn',
      '..bbbbbbb..',
      '..ddd..dd..',
      '...........',
    ],
  ];
  function buildRabbits() {
    S.rabbit = RABBIT.map((rows, i) => { const p = new Pix(11, 8); p.rows(0, 0, rows, RPAL, 'rabbit' + i); return p.sprite(); });
  }

  // ------------------------------------------------------------------ disposición y estado
  // Campos de cultivo [x0, x1] dentro de la granja.
  const FIELDS = [[804, 872], [884, 952], [964, 1032]];
  const objs = [], lights = [], sparks = [], rabbits = [];
  const rr = U.mulberry32(9137);
  let bannerPh = 0, dockX0 = null;

  // Dibuja el sprite con su columna de anclaje ax en la x del mundo y su base (exclusiva) en la fila by.
  function put(ctx, s, wx, ax, by, dir = 1) {
    const x = K.sx(wx) - (dir < 0 ? s.w - 1 - ax : ax);
    if (x >= K.W || x + s.w <= 0) return;
    ctx.drawImage(dir < 0 ? s.l : s.r, x, by - s.h);
  }
  const frame = (fps, n, off = 0) => Math.floor(K.t * fps + off) % n;

  function layout() {
    objs.length = 0; lights.length = 0; dockX0 = null;
    const add = (x0, x1, z, draw) => objs.push({ x0, x1, z, draw });
    let towerN = 0, wallN = 0, torchN = 0;
    for (const t of K.MAP.things) {
      switch (t.type) {
        case 'portal':
          add(t.x - 24, t.x + 24, 0, (ctx) => { put(ctx, S.portalSwirl[frame(7, 8)], t.x, 23, GY + 2); put(ctx, S.portal, t.x, 23, GY + 2); });
          break;
        case 'camp': {
          const tx = t.x - 22, fx = t.x + 7, sitX = t.x - 6, standX = t.x + 21;
          lights.push({ type: 'fire', x: fx, y: GY - 8, power: 0.6 });
          add(t.x - 40, t.x + 30, 8, (ctx) => {
            put(ctx, S.tent, tx, 14, GY + 1);
            put(ctx, S.campBack, fx, 10, GY + 2);
            put(ctx, S.campFlame[frame(10, 8)], fx, 7, GY - 1);
            put(ctx, S.campFront, fx, 10, GY + 2);
            put(ctx, S.seatLog, sitX, 5, GY + 2);
            put(ctx, S.vagSit[frame(1.3, 2)], sitX, 5, GY);
            put(ctx, S.vagStand[frame(1.1, 2, 0.5)], standX, 4, GY + 1, -1);
          });
          sparkSrc.push({ x: fx, y: GY - 12, rate: 2.5, spread: 3, vy: 16 });
          break;
        }
        case 'woodWall':
          add(t.x - 9, t.x + 9, 3, (ctx) => put(ctx, S.woodWall, t.x, 9, GY + 2));
          break;
        case 'tower': {
          const dir = towerN++ === 0 ? -1 : 1, x = dir < 0 ? t.x : t.x - 2, ph = towerN * 0.37;
          add(x - 14, x + 14, 1, (ctx) => put(ctx, S.tower[frame(0.8, 2, ph)], x, 13, GY + 2, dir));
          break;
        }
        case 'farm':
          add(t.x0, t.x1, 5, (ctx) => drawFarm(ctx, t));
          break;
        case 'stoneWall': {
          // el muro derecho se aparta 5 px para no tapar la pata de la torre vecina
          const s = S.stoneWall[wallN++ % 2], x = wallN === 2 ? t.x + 5 : t.x;
          add(x - 14, x + 14, 3, (ctx) => put(ctx, s, x, 13, GY + 2));
          break;
        }
        case 'torch': {
          const x = torchN++ === 1 ? t.x - 2 : t.x, ph = torchN * 3.3;
          lights.push({ type: 'torch', x, y: GY - 26, power: 1 });
          add(x - 8, x + 8, 7, (ctx) => { put(ctx, S.torchFlame[frame(6, 8, ph)], x, 4, GY - 19); put(ctx, S.torch, x, 7, GY + 2); });
          break;
        }
        case 'shopHammer':
          add(t.x - 18, t.x + 18, 2, (ctx) => put(ctx, S.shopHammer, t.x, 18, GY + 2));
          break;
        case 'shopBow':
          add(t.x - 18, t.x + 18, 2, (ctx) => put(ctx, S.shopBow, t.x, 18, GY + 2));
          break;
        case 'campfire':
          lights.push({ type: 'fire', x: t.x, y: GY - 18, power: 1 });
          sparkSrc.push({ x: t.x, y: GY - 26, rate: 9, spread: 7, vy: 26 });
          add(t.x - 20, t.x + 20, 6, (ctx) => {
            put(ctx, S.fireBack, t.x, 18, GY + 3);
            put(ctx, S.fireFlame[frame(10, 8)], t.x, 12, GY - 1);
            put(ctx, S.fireFront, t.x, 18, GY + 3);
          });
          break;
        case 'banner':
          add(t.x - BANNER.PC - 1, t.x + BANNER.BW + BANNER.LEAN, 4, (ctx) => {
            const wind = K.env.wind, lv = wind < 0.3 ? 0 : wind < 0.6 ? 1 : 2;
            const top = GY + 2 - BANNER.PH, s = S.banner[lv][Math.floor(bannerPh) % 4];
            put(ctx, S.bannerPole, t.x, BANNER.PC, GY + 2);
            put(ctx, s, t.x, (BANNER.BW - 1) / 2, top + BANNER.TOP + s.h);
          });
          break;
        case 'statue':
          add(t.x - 17, t.x + 17, 4, (ctx) => put(ctx, S.statue, t.x, 16, GY + 2));
          break;
        case 'dock':
          dockX0 = t.x0;
          add(t.x0, t.x1, 4, (ctx) => {
            const x = K.sx(t.x0);
            ctx.globalCompositeOperation = 'multiply';
            ctx.drawImage(S.dockShade, x, GY + 5);
            ctx.globalCompositeOperation = 'source-over';
            ctx.drawImage(S.dock.r, x, S.dockY0);
          });
          break;
      }
    }
    objs.sort((a, b) => a.z - b.z);
    // conejos en cada pradera
    rabbits.length = 0;
    for (const z of K.MAP.zones) {
      if (z.type !== 'meadow') continue;
      const n = z.x1 - z.x0 > 300 ? 6 : 5;
      for (let i = 0; i < n; i++) {
        rabbits.push({
          zx0: z.x0 + 6, zx1: z.x1 - 6, x: z.x0 + 20 + ((i + rr() * 0.8) / n) * (z.x1 - z.x0 - 40),
          y: GY + 1 + Math.floor(rr() * 3), dir: rr() < 0.5 ? -1 : 1, st: 'idle', t: rr() * 3, k: 0, jy: 0,
          hx0: 0, hx1: 0, dur: 0.3, hh: 3, flee: 0, nib: 0,
        });
      }
    }
  }
  const sparkSrc = [];

  function drawFarm(ctx, t) {
    const sx = t.streamX;
    // campos labrados
    FIELDS.forEach((f, i) => { if (K.sx(f[1]) > -4 && K.sx(f[0]) < K.W + 4) ctx.drawImage(S.fields[i].r, K.sx(f[0]), GY); });
    // arroyo, cascada y puentecillo
    put(ctx, S.stream[frame(8, 5)], sx, S.streamCX, WY + 1);
    put(ctx, S.bridge, sx, 8, GY + 4);
    // trigo que se mece con el viento (ola que recorre el campo)
    const wind = U.clamp(K.env.wind, 0, 1), tt = K.t;
    for (const f of FIELDS) {
      if (K.sx(f[1]) < -12 || K.sx(f[0]) > K.W + 12) continue;
      let v = 0;
      for (let x = f[0] + 1; x < f[1] - 8; x += 5) {
        const wave = 0.5 + 0.5 * Math.sin(tt * 2.4 - x * 0.07);
        const lean = U.clamp(Math.round(wind * (0.6 + wave * 2.4)), 0, 3);
        const s = S.wheat[(v++ + (x >> 3)) & 1][lean];
        ctx.drawImage(s.r, K.sx(x), GY + 3 - s.h);
      }
    }
  }

  // ------------------------------------------------------------------ fauna
  function hop(b, dist, dur, hh) {
    let to = b.x + b.dir * dist;
    if (to < b.zx0 || to > b.zx1) { b.dir = -b.dir; to = b.x + b.dir * dist; }
    b.st = 'hop'; b.k = 0; b.hx0 = b.x; b.hx1 = U.clamp(to, b.zx0, b.zx1); b.dur = dur; b.hh = hh;
  }
  function updateRabbit(b, dt) {
    const p = K.player, dist = p ? Math.abs(p.x - b.x) : 1e9;
    if (b.st === 'hidden') {
      b.t -= dt;
      if (b.t <= 0 && dist > 120) {
        b.x = U.lerp(b.zx0 + 10, b.zx1 - 10, rr()); b.st = 'idle'; b.t = 1 + rr() * 2;
        if (p && Math.abs(p.x - b.x) < 90) b.st = 'hidden';
      }
      return;
    }
    if (b.st === 'hop') {
      b.k += dt / b.dur;
      const k = Math.min(1, b.k);
      b.x = U.lerp(b.hx0, b.hx1, k); b.jy = -Math.sin(Math.PI * k) * b.hh;
      if (k >= 1) {
        b.st = 'idle'; b.jy = 0; b.t = 0.6 + rr() * 2.8;
        if (b.flee > 0) b.t = 0.02;
      }
      return;
    }
    b.flee = Math.max(0, b.flee - dt);
    b.nib = Math.max(0, b.nib - dt);
    if (p && dist < 40) {
      // huye: si está acorralado contra el borde de la pradera, se esconde en la madriguera
      b.dir = p.x > b.x ? -1 : 1; b.flee = 1.4;
      const room = b.dir < 0 ? b.x - b.zx0 : b.zx1 - b.x;
      if (room < 10) { b.st = 'hidden'; b.t = 3 + rr() * 4; return; }
      hop(b, 11 + rr() * 5, 0.2, 4);
      return;
    }
    b.t -= dt;
    if (b.t <= 0) {
      if (b.flee > 0 && dist < 90) { hop(b, 11 + rr() * 5, 0.2, 4); return; }
      const r = rr();
      if (r < 0.5) { if (rr() < 0.4) b.dir = -b.dir; hop(b, 4 + rr() * 5, 0.26, 2); }
      else if (r < 0.8) { b.nib = 0.4 + rr() * 0.8; b.t = 0.8 + rr() * 2; }
      else b.t = 0.8 + rr() * 2.5;
    }
  }
  function drawRabbit(ctx, b) {
    if (b.st === 'hidden') return;
    let f = 0;
    if (b.st === 'hop') f = b.k < 0.55 ? 2 : 3;
    else if (b.nib > 0) f = Math.floor(K.t * 6) & 1;
    put(ctx, S.rabbit[f], b.x, 5, Math.round(b.y + b.jy), b.dir);
  }

  // ------------------------------------------------------------------ chispas de las fogatas
  function updateSparks(dt) {
    const camC = K.camX + K.W / 2;
    for (const s of sparkSrc) {
      if (Math.abs(s.x - camC) > K.W) continue;
      s.acc = (s.acc || 0) + dt * s.rate;
      while (s.acc >= 1 && sparks.length < 60) {
        s.acc -= 1;
        sparks.push({ x: s.x + (rr() - 0.5) * s.spread * 2, y: s.y + rr() * 6, vx: (rr() - 0.5) * 6, vy: -(s.vy * (0.6 + rr() * 0.8)), life: 0, max: 0.7 + rr() * 1.3, ph: rr() * 6 });
      }
      if (s.acc >= 1) s.acc = 0;
    }
    const wind = K.env.wind;
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.life += dt;
      if (s.life >= s.max) { sparks.splice(i, 1); continue; }
      s.x += (s.vx + wind * 9 + Math.sin(s.life * 7 + s.ph) * 6) * dt;
      s.y += s.vy * dt; s.vy *= 1 - dt * 0.6;
    }
  }
  function drawSparks(ctx) {
    for (const s of sparks) {
      const u = s.life / s.max, x = K.sx(s.x), y = Math.round(s.y);
      if (x < -1 || x > K.W) continue;
      ctx.globalAlpha = u < 0.7 ? 1 : (1 - u) / 0.3;
      ctx.fillStyle = u < 0.25 ? '#FFF1B8' : u < 0.55 ? '#FFB347' : '#E0602C';
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------------ vista de depuración (?view=props)
  K.views.props = (ctx) => {
    let x = 4, y = 4, rowH = 0;
    const show = (s) => {
      if (x + s.w > K.W - 4) { x = 4; y += rowH + 4; rowH = 0; }
      ctx.drawImage(s.r, x, y); x += s.w + 4; rowH = Math.max(rowH, s.h);
    };
    [S.portal, S.portalSwirl[0], S.tent, S.vagStand[0], S.vagStand[1], S.vagSit[0], S.vagSit[1], S.seatLog,
      S.woodWall, S.tower[0], S.tower[1], S.stoneWall[0], S.stoneWall[1], S.torch, S.shopHammer, S.shopBow,
      S.bannerPole, S.statue].forEach(show);
    S.torchFlame.forEach(show); S.fireFlame.forEach(show); show(S.fireBack); show(S.fireFront);
    S.campFlame.forEach(show); show(S.campBack); show(S.campFront);
    S.banner.forEach((l) => l.forEach(show));
    S.rabbit.forEach(show); S.wheat.forEach((v) => v.forEach(show)); S.stream.forEach(show); show(S.bridge);
  };

  K.register('props', {
    order: 11,
    init() {
      buildPortal(); buildTorch(); buildCampfire(); buildTent(); buildVagrants(); buildWoodWall();
      S.tower = [buildTower(0), buildTower(1)];
      S.stoneWall = [buildStoneWall(41), buildStoneWall(58)];
      S.shopHammer = buildShop('hammer'); S.shopBow = buildShop('bow');
      buildBanner(); buildStatue(); buildDock(152); buildFarm(); buildRabbits();
      sparkSrc.length = 0;
      layout();
      for (const b of rabbits) b.t = rr() * 2;
    },
    update(dt) {
      for (const L of lights) K.lights.push(L);
      bannerPh += dt * (2.5 + 7 * U.clamp(K.env.wind, 0, 1));
      updateSparks(dt);
      for (const b of rabbits) updateRabbit(b, dt);
    },
    drawBack(ctx) {
      const W = K.W;
      for (const o of objs) {
        if (K.sx(o.x1) < -4 || K.sx(o.x0) > W + 4) continue;
        o.draw(ctx);
      }
      for (const b of rabbits) { const x = K.sx(b.x); if (x > -12 && x < W + 12) drawRabbit(ctx, b); }
      drawSparks(ctx);
    },
    // Parte sumergida del muelle: va después del agua (tapa el reflejo) y, como la oscuridad ya se aplicó,
    // se multiplica por K.env.mulColor.
    drawOverlay(ctx) {
      if (dockX0 === null || !S.dockLow) return;
      const x = K.sx(dockX0);
      if (x >= K.W || x + S.dockLow.width <= 0) return;
      const m = K.env.mulColor, f = Math.floor(K.t * 5) % 3;
      ctx.globalAlpha = 0.3; ctx.drawImage(U.multiplyTint(S.dockRefl[f], m), x, WY);
      ctx.globalAlpha = 1; ctx.drawImage(U.multiplyTint(S.dockLow, m), x, WY);
      ctx.globalAlpha = 0.5; ctx.drawImage(U.multiplyTint(S.dockRip[f], m), x, WY);
      ctx.globalAlpha = 1;
    },
  });
})(window.K);
