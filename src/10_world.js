// 10_world.js — MUNDO: parallax de 4 capas (montañas, colinas, árboles lejanos, juncos), suelo por zonas,
// árboles del bosque, hierba alta y flores, hierba y juncos de primer plano, niebla. Todo se pre-renderiza en init().
(function (K) {
  const U = K.util, C = K.CONFIG;
  const W = K.W, GY = K.GROUND_Y;
  const TW = 960;                    // ancho de las capas de parallax: se repiten sin costuras
  const SEED = 1000 + (C.seed | 0);  // el mapa usa semilla fija (no depende de K.seed)
  const H = (x, y, s) => U.hash(x, y, SEED + s);

  // ---------------------------------------------------------------- utilidades locales
  const pk = (r, g, b, a = 255) => ((a << 24) | (b << 16) | (g << 8) | r) >>> 0; // RGBA en little-endian
  const pkc = (c) => pk(c[0], c[1], c[2]);
  const hx = (hex) => pkc(U.rgb(hex));
  const WHITE = pk(255, 255, 255);

  // Búfer de píxeles Uint32 que se vuelca a un lienzo de una vez.
  class PB {
    constructor(w, h) { this.w = w; this.h = h; this.d = new Uint32Array(w * h); }
    set(x, y, v) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = v; }
    setW(x, y, v) { y = Math.round(y); if (y >= 0 && y < this.h) this.d[y * this.w + U.mod(Math.round(x), this.w)] = v; } // con vuelta en X
    get(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.d[y * this.w + x] : 0; }
    canvas() {
      const { c, x } = U.canvas(this.w, this.h), img = x.createImageData(this.w, this.h);
      new Uint32Array(img.data.buffer).set(this.d); x.putImageData(img, 0, 0);
      return c;
    }
  }

  // Ruido periódico en X (para capas que se repiten): P = periodo en celdas.
  const sm = (f) => f * f * (3 - 2 * f);
  const pn1 = (x, P, s) => { const i = Math.floor(x), u = sm(x - i); return U.lerp(U.hash(U.mod(i, P), 0, s), U.hash(U.mod(i + 1, P), 0, s), u); };
  const pn2 = (x, y, P, s) => {
    const ix = Math.floor(x), iy = Math.floor(y), ux = sm(x - ix), uy = sm(y - iy), i0 = U.mod(ix, P), i1 = U.mod(ix + 1, P);
    return U.lerp(U.lerp(U.hash(i0, iy, s), U.hash(i1, iy, s), ux), U.lerp(U.hash(i0, iy + 1, s), U.hash(i1, iy + 1, s), ux), uy);
  };
  const pfbm2 = (x, y, P, oct, s) => {
    let sum = 0, amp = 0.5, n = 0, f = 1;
    for (let o = 0; o < oct; o++) { sum += pn2(x * f, y * f, P * f, s + o * 31) * amp; n += amp; amp *= 0.5; f *= 2; }
    return sum / n;
  };

  // Disco de borde irregular; fn(x, y, dx, dy) pinta cada píxel.
  function blob(cx, cy, r, ph, amp, fn) {
    const R = Math.ceil(r * (1 + amp * 0.5)) + 1, ox = Math.round(cx), oy = Math.round(cy);
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > R) continue;
      const a = Math.atan2(dy, dx);
      const rr = r * (1 - amp * 0.5 + amp * U.noise2(Math.cos(a) * 1.4 + ph, Math.sin(a) * 1.4 + ph, 7));
      if (d <= rr) fn(ox + dx, oy + dy, dx, dy);
    }
  }
  // Línea de 2 px (luz arriba, sombra debajo o a la derecha).
  function line(pb, x0, y0, x1, y1, c, cd) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const n = Math.max(1, Math.abs(x1 - x0), Math.abs(y1 - y0)), flat = Math.abs(x1 - x0) > Math.abs(y1 - y0);
    for (let k = 0; k <= n; k++) {
      const x = Math.round(x0 + ((x1 - x0) * k) / n), y = Math.round(y0 + ((y1 - y0) * k) / n);
      pb.set(x, y, c);
      if (flat) pb.set(x, y + 1, cd); else pb.set(x + 1, y, cd);
    }
  }

  // Ráfaga de viento que viaja hacia la derecha: 0 (quieto) … ~1 (máxima inclinación). u = coordenada de su capa.
  const gust = (u, ph = 0) => {
    const w = K.env ? K.env.wind : 0.5;
    return U.clamp(w * (0.52 + 0.36 * Math.sin(K.t * 1.7 - u * 0.03 + ph) + 0.12 * Math.sin(K.t * 3.3 - u * 0.09 + ph * 1.7)), 0, 1);
  };
  const frame3 = (u, ph) => Math.min(2, Math.floor(gust(u, ph) * 3));

  // ---------------------------------------------------------------- zonas y paletas
  const CLEAR = [[60, 140], [290, 370], [1920, 1980]]; // claros sin árboles: portal, campamento, estatua
  const inClear = (x, m) => CLEAR.some(([a, b]) => x > a - m && x < b + m);
  const zoneAt = (x) => K.terrainAt(U.clamp(x, 0, K.WORLD_W - 1));
  // Muelles (de K.MAP.things): su cubierta está a ras de suelo, así que no crece hierba sobre ni entre los tablones.
  let DOCKS = [];
  const onDock = (a, b) => DOCKS.some(([x0, x1]) => b >= x0 && a <= x1); // ¿el tramo [a, b] toca un muelle?

  // Hierba por zona: paleta [luz, base, sombra, profunda], cobertura del borde, briznas y hierba de primer plano.
  const ZG = {
    forest: { pal: ['#7E8540', '#646C31', '#4D5427', '#3B411F'], cover: 1, dens: 0.34, hmax: 3, fr: 0.5 },
    meadow: { pal: ['#ADA955', '#8A9046', '#6E7338', '#565B2B'], cover: 1, dens: 0.6, hmax: 4, fr: 0.62 },
    grass:  { pal: ['#A1A150', '#80883E', '#656D33', '#4F5629'], cover: 1, dens: 0.45, hmax: 3, fr: 0.55 },
    farm:   { pal: ['#A1A150', '#80883E', '#656D33', '#4F5629'], cover: 0.3, dens: 0.18, hmax: 2, fr: 0.22 },
    cobble: { pal: ['#A1A150', '#80883E', '#656D33', '#4F5629'], cover: 0, dens: 0, hmax: 0, fr: 0 },
    coast:  { pal: ['#B5B077', '#9A9763', '#7E7D50', '#64643F'], cover: 0.14, dens: 0.25, hmax: 3, fr: 0.12 },
  };
  for (const z of Object.values(ZG)) z.rgb = z.pal.map(U.rgb);
  const MAT = { forest: 'dirt', meadow: 'dirt', grass: 'dirt', farm: 'soil', cobble: 'stone', coast: 'sand' };

  const DIRT = ['#6A4B30', '#855F3C', '#4F3724'].map(U.rgb);
  const STONE = ['#8A8A84', '#6E6E6A', '#54524F', '#78776F', '#64635E'].map(U.rgb);
  const SAND = ['#CBB78F', '#B8A27A', '#9C8660', '#8A7553'].map(U.rgb);
  const LEAF = ['#ADA955', '#8A9046', '#6E7338', '#555A2B'];
  const BARK = ['#5B5243', '#433C31', '#2E2A23'];
  const dim = (arr, t) => arr.map((c) => U.lerpColor(c, '#3A402E', t));

  // ---------------------------------------------------------------- capas de parallax
  const LAYERS = [];
  function makeLayer(o) {
    const L = Object.assign({ frames: 1, rgb: null, masks: [], cols: [] }, o);
    for (let k = 0; k < L.frames; k++) {
      const pb = new PB(TW, L.h);
      L.paint(pb, k, L.y0);
      L.masks.push(pb.canvas());
      L.cols.push(U.canvas(TW, L.h));
    }
    LAYERS.push(L);
    return L;
  }
  // Re-colorea la silueta (source-in) solo si el color cambió de forma apreciable.
  function tintLayer(L, hz) {
    const a = L.base, t = L.haze;
    const r = Math.round(a[0] + (hz[0] - a[0]) * t), g = Math.round(a[1] + (hz[1] - a[1]) * t), b = Math.round(a[2] + (hz[2] - a[2]) * t);
    const p = L.rgb;
    if (p && Math.abs(p[0] - r) + Math.abs(p[1] - g) + Math.abs(p[2] - b) < 3) return;
    L.rgb = [r, g, b];
    const col = `rgb(${r},${g},${b})`;
    L.masks.forEach((m, k) => {
      const x = L.cols[k].x;
      x.globalCompositeOperation = 'source-over';
      x.clearRect(0, 0, TW, L.h); x.drawImage(m, 0, 0);
      x.globalCompositeOperation = 'source-in';
      x.fillStyle = col; x.fillRect(0, 0, TW, L.h);
      x.globalCompositeOperation = 'source-over';
    });
  }
  // Dibuja un lienzo de TW de ancho repetido con el factor f, recortado a la pantalla.
  function drawTiled(ctx, c, f, y, h, off = 0) {
    const s = K.sx(0, f) - Math.round(off);
    for (let x = U.mod(s, TW) - TW; x < W; x += TW) {
      const dx = Math.max(0, x), sw = Math.min(W, x + TW) - dx;
      if (sw > 0) ctx.drawImage(c, dx - x, 0, sw, h, dx, y, sw, h);
    }
  }

  // Montañas: picos en V con cresta irregular, base bajo el suelo.
  function paintMountains(pb, _f, y0) {
    const r = U.mulberry32(SEED + 1), peaks = [];
    for (let k = 0; k < 7; k++) peaks.push({ x: k * 137 + r() * 60, y: 110 + r() * 20, sl: 0.3 + r() * 0.22, sr: 0.3 + r() * 0.22 });
    for (let k = 0; k < 9; k++) peaks.push({ x: r() * TW, y: 128 + r() * 14, sl: 0.55 + r() * 0.3, sr: 0.55 + r() * 0.3 });
    for (let x = 0; x < TW; x++) {
      let top = 999;
      for (const p of peaks) {
        const d = U.mod(x - p.x + TW / 2, TW) - TW / 2;
        top = Math.min(top, p.y + Math.abs(d) * (d < 0 ? p.sl : p.sr));
      }
      top += (pn1(x / 12, 80, SEED + 2) - 0.5) * 4 + (pn1(x / 40, 24, SEED + 3) - 0.5) * 7;
      for (let y = Math.round(Math.min(top, 158)); y < y0 + pb.h; y++) pb.set(x, y - y0, WHITE);
    }
  }
  // Colinas suaves con bosquecillos redondeados en las crestas.
  function paintHills(pb, _f, y0) {
    const r = U.mulberry32(SEED + 11), top = new Float32Array(TW);
    for (let x = 0; x < TW; x++) {
      top[x] = 154 - 10 * pn1(x / 160, 6, SEED + 12) - 7 * pn1(x / 60, 16, SEED + 13) - 1.5 * pn1(x / 20, 48, SEED + 14);
      for (let y = Math.round(top[x]); y < y0 + pb.h; y++) pb.set(x, y - y0, WHITE);
    }
    for (let k = 0; k < 30; k++) {
      let x = r() * TW;
      const n = 1 + ((r() * 4) | 0);
      for (let j = 0; j < n; j++) {
        const rad = 2 + ((r() * 2.6) | 0), ty = top[U.mod(Math.round(x), TW)];
        blob(x, ty - rad * 0.4, rad, r() * 40, 0.2, (px, py) => pb.setW(px, py - y0, WHITE));
        x += rad + 1 + r() * 3;
      }
    }
  }
  // Línea de árboles lejanos: copas redondas y coníferas, troncos entre copas y sotobosque continuo.
  function paintTreeline(pb, _f, y0) {
    const r = U.mulberry32(SEED + 21), B = y0 + pb.h;
    const put = (x, y) => pb.setW(x, y - y0, WHITE);
    for (let x = 0; x < TW; x++) { const yb = Math.round(160 + (pn1(x / 8, 120, SEED + 22) - 0.5) * 5); for (let y = yb; y < B; y++) put(x, y); }
    let x = 0;
    while (x < TW) {
      if (r() < 0.3) {
        const apex = 122 + r() * 16, h = 22 + r() * 14, hw = 5 + r() * 3;
        for (let k = 0; k <= h; k++) {
          const w = Math.floor((k * hw) / h) - (k > 3 && k % 4 === 0 ? 1 : 0);
          for (let i = -w; i <= w; i++) put(x + i, apex + k);
        }
        for (let y = Math.round(apex + h); y < B; y++) put(x, y);
      } else {
        const cy = 134 + r() * 14, rad = 5 + r() * 5;
        for (let y = Math.round(cy); y < B; y++) { put(x, y); if (rad > 7) put(x + 1, y); }
        blob(x, cy, rad, r() * 40, 0.35, (px, py) => put(px, py));
        blob(x - rad * 0.7, cy + rad * 0.35, rad * 0.62, r() * 40, 0.3, (px, py) => put(px, py));
        blob(x + rad * 0.7, cy + rad * 0.3, rad * 0.6, r() * 40, 0.3, (px, py) => put(px, py));
      }
      x += 5 + r() * 8;
    }
  }
  // Juncos de fondo: 3 frames (la punta se inclina 0, 1, 2 px). Cada racimo vive dentro de su trozo de CW px,
  // así se puede dibujar cada trozo con su propio frame sin cortar tallos.
  const CW = 24;
  let reedStalks = null;
  function reedData() {
    const r = U.mulberry32(SEED + 31), st = [];
    for (let cs = 0; cs < TW; cs += CW) {
      if (r() < 0.22) continue;
      const nc = 1 + (r() < 0.5 ? 1 : 0);
      for (let c = 0; c < nc; c++) {
        const bx0 = cs + 4 + r() * (CW - 11), n = 3 + ((r() * 4) | 0);
        for (let k = 0; k < n; k++) {
          const leaf = r() < 0.3;
          st.push({
            bx: Math.round(U.clamp(bx0 + (r() - 0.5) * 5, cs + 2, cs + CW - 6)),
            h: Math.round(leaf ? 5 + r() * 6 : 8 + r() * 14),
            c: leaf ? (r() < 0.5 ? -1.2 : 1.4) : (r() - 0.4) * 1.6,
            cat: !leaf && r() < 0.28,
          });
        }
      }
    }
    return st;
  }
  function paintReeds(pb, f, y0) {
    const put = (x, y) => pb.set(x, y - y0, WHITE);
    for (let x = 0; x < TW; x++) { const yb = 167 + Math.round(pn1(x / 3, 320, SEED + 32) * 2.4); for (let y = yb; y < y0 + pb.h; y++) put(x, y); }
    for (const s of reedStalks) {
      for (let k = 0; k < s.h; k++) {
        const q = k / (s.h - 1);
        put(s.bx + Math.round(s.c * q * q + f * Math.pow(q, 1.6)), 171 - k);
      }
      if (s.cat) {
        const tx = s.bx + Math.round(s.c + f), ty = 171 - s.h;
        for (let k = 1; k <= 4; k++) { put(tx, ty + k); put(tx + 1, ty + k); }
      }
    }
  }

  // ---------------------------------------------------------------- suelo (franja de mundo pre-renderizada)
  const GX0 = -32, GW = K.WORLD_W + 64, GT = 160, GH = 44;   // x −32…2432, y 160…203
  const FT = 162, FH = 14;                                   // franja de hierba delantera: y 162…175
  let cols = null;       // datos por columna: paleta mezclada, cobertura, briznas…
  let ground = null, fringe = null;

  function buildCols() {
    cols = [];
    for (let i = 0; i < GW; i++) {
      const wx = GX0 + i, acc = new Float32Array(12);
      let ws = 0, cover = 0, dens = 0, hmax = 0, fr = 0;
      for (let k = -4; k <= 4; k++) {
        const z = ZG[zoneAt(wx + k * 6)], w = 5 - Math.abs(k);
        for (let j = 0; j < 4; j++) for (let c = 0; c < 3; c++) acc[j * 3 + c] += z.rgb[j][c] * w;
        cover += z.cover * w; dens += z.dens * w; hmax += z.hmax * w; fr += z.fr * w; ws += w;
      }
      const pal = [0, 1, 2, 3].map((j) => pk(Math.round(acc[j * 3] / ws), Math.round(acc[j * 3 + 1] / ws), Math.round(acc[j * 3 + 2] / ws)));
      cols.push({ pal, cover: cover / ws, dens: dens / ws, hmax: hmax / ws, fr: fr / ws, zone: zoneAt(wx) });
    }
  }

  // Tile de tierra 32×32: terrones claros con sombra debajo y alguna grieta. Índices: 0 base, 1 luz, 2 sombra.
  function dirtTile(r) {
    const t = new Uint8Array(32 * 32), n = 6 + ((r() * 3) | 0);
    for (let k = 0; k < n; k++) {
      const rx = 1.6 + r() * 3.4, ry = 0.9 + r() * 1.3;
      const cx = 1 + rx + r() * (29 - 2 * rx), cy = 4 + r() * 22;
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        if (x < 1 || x > 30 || y < 0 || y > 31) continue;
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) t[y * 32 + x] = 1;
      }
    }
    for (let y = 30; y >= 0; y--) for (let x = 0; x < 32; x++) if (t[y * 32 + x] === 1 && t[(y + 1) * 32 + x] === 0) t[(y + 1) * 32 + x] = 2;
    for (let k = 0; k < 3; k++) {
      const y = 5 + ((r() * 24) | 0), x0 = 1 + ((r() * 26) | 0), len = 2 + ((r() * 3) | 0);
      for (let x = x0; x < x0 + len; x++) if (t[y * 32 + x] === 0) t[y * 32 + x] = 2;
    }
    return t;
  }

  // Empedrado: hiladas de piedras de ancho variable (continuas, sin rejilla visible).
  const CX0 = 1040, CX1 = 1360;
  function cobbleLayout(r) {
    return [[170, 4], [174, 5], [179, 5], [184, 6]].map(([y, h]) => {
      const n = CX1 - CX0, start = new Int16Array(n), wid = new Uint8Array(n), tone = new Uint8Array(n);
      let x = CX0 - ((r() * 8) | 0);
      while (x < CX1) {
        const w = 6 + ((r() * 7) | 0), tn = r() < 0.22 ? 1 : r() < 0.25 ? 2 : 0;
        for (let k = 0; k < w; k++) { const j = x + k - CX0; if (j >= 0 && j < n) { start[j] = x; wid[j] = w; tone[j] = tn; } }
        x += w;
      }
      return { y, h, start, wid, tone };
    });
  }
  function stoneAt(cob, wx, y) {
    const c = cob.find((q) => y >= q.y && y < q.y + q.h);
    if (!c) return STONE[2];
    const j = U.clamp(wx - CX0, 0, CX1 - CX0 - 1), lx = wx - c.start[j], ly = y - c.y, w = c.wid[j];
    if (lx >= w - 1 || ly === c.h - 1) return STONE[2];
    if (ly === 0 && lx < w - 2 && lx > 0) return STONE[0];
    return c.tone[j] === 1 ? STONE[3] : c.tone[j] === 2 ? STONE[4] : STONE[1];
  }
  function sandAt(wx, y) {
    if (y === GY) return SAND[0];
    const wet = 184 + Math.round(U.noise1(wx * 0.08, 51) * 3);
    if (y >= wet) return y >= 188 ? SAND[3] : SAND[2];
    const k = wx + y * 3;
    if (U.mod(k, 7) < 3 && H(Math.floor(k / 7), y, 52) < 0.2) return SAND[2];
    return SAND[1];
  }
  const matAt = (wx, y) => MAT[zoneAt(wx + (U.noise2(wx * 0.09, y * 0.21, 41) - 0.5) * 20)];

  function buildGround(roots) {
    const pb = new PB(GW, GH), rt = U.mulberry32(SEED + 41);
    const tiles = [0, 1, 2, 3, 4].map(() => dirtTile(rt));
    const cob = cobbleLayout(U.mulberry32(SEED + 43));
    const shadeRow = (c, y) => (y >= 186 ? [c[0] * 0.86, c[1] * 0.86, c[2] * 0.86] : c);
    const DS = pkc(DIRT[2]);
    for (let i = 0; i < GW; i++) {
      const wx = GX0 + i, g = cols[i];
      // cuerpo: tierra / tierra de labor / piedra / arena, con fronteras irregulares
      for (let y = GY; y < GT + GH; y++) {
        const m = matAt(wx, y);
        let c;
        if (m === 'stone') c = stoneAt(cob, wx, y);
        else if (m === 'sand') c = sandAt(wx, y);
        else {
          const t = tiles[(H(Math.floor(wx / 32), 0, 44) * tiles.length) | 0];
          c = shadeRow(DIRT[t[U.mod(y - GY, 32) * 32 + U.mod(wx, 32)]], y);
          if (m === 'soil' && y === GY) c = DIRT[1];
        }
        pb.set(i, y - GT, pk(Math.round(c[0]), Math.round(c[1]), Math.round(c[2])));
      }
      // borde de hierba de 2–3 px, sombra bajo el borde, flecos y briznas que sobresalen
      if (g.cover > 0.1 + 0.8 * U.noise1(wx * 0.11, 21)) {
        const th = U.noise1(wx * 0.29, 9) > 0.55 ? 3 : 2, P = g.pal;
        pb.set(i, GY - GT, P[0]); pb.set(i, GY + 1 - GT, P[1]);
        if (th === 3) pb.set(i, GY + 2 - GT, P[2]);
        const yb = GY + th, mb = matAt(wx, yb);
        if ((mb === 'dirt' || mb === 'soil') && U.noise1(wx * 0.37, 13) > 0.3) pb.set(i, yb - GT, DS);
        if (H(wx, 3, 0) < 0.16) { pb.set(i, yb - GT, P[2]); if (H(wx, 4, 0) < 0.5) pb.set(i, yb + 1 - GT, P[3]); }
        const pr = g.dens * (0.35 + 1.3 * U.noise1(wx * 0.23, 17));
        if (H(wx, 5, 0) < pr) {
          const h = 1 + Math.floor(H(wx, 6, 0) * g.hmax), dark = H(wx, 8, 0) < 0.3;
          const lean = h >= 3 && H(wx, 9, 0) < 0.5 ? (H(wx, 7, 0) < 0.5 ? -1 : 1) : 0;
          for (let k = 1; k <= h; k++) {
            const top = k === h;
            pb.set(i + (top ? lean : 0), GY - k - GT, dark ? P[2] : top && h > 1 ? P[0] : P[1]);
          }
        }
      }
    }
    // raíces bajo los árboles del bosque
    for (const rt2 of roots) {
      const r = U.mulberry32(SEED + 900 + rt2.x);
      for (let k = 0; k < 3; k++) {
        const dir = k === 0 ? -1 : k === 1 ? 1 : r() < 0.5 ? -1 : 1, len = 3 + ((r() * 5) | 0);
        let x = rt2.x + dir * (2 + ((r() * 4) | 0)), y = GY + 3;
        for (let j = 0; j < len; j++) { pb.set(x - GX0, y - GT, DS); x += dir * (r() < 0.6 ? 1 : 0); y += r() < 0.7 ? 1 : 0; }
      }
    }
    return pb.canvas();
  }

  // Hierba corta delante de los cascos: flecos densos de 2–5 px con base en y=174.
  function buildFringe() {
    const pb = new PB(GW, FH);
    for (let i = 0; i < GW; i++) {
      const wx = GX0 + i, g = cols[i];
      if (onDock(wx - 1, wx + 1)) continue; // la punta puede inclinarse 1 px
      if (H(wx, 11, 0) >= g.fr * (0.45 + U.noise1(wx * 0.19, 23) * 0.9)) continue;
      const h = 2 + Math.floor(H(wx, 12, 0) * 3.99), P = g.pal;
      const lean = h >= 4 && H(wx, 13, 0) < 0.5 ? (H(wx, 14, 0) < 0.5 ? -1 : 1) : 0;
      for (let k = 0; k < h; k++) {
        const y = 174 - k, top = k === h - 1;
        pb.set(i + (top ? lean : 0), y - FT, top ? P[1] : k === 0 ? P[3] : P[2]);
      }
    }
    return pb.canvas();
  }

  // ---------------------------------------------------------------- árboles del plano de juego
  function treeShape(r, s) {
    const w = Math.round(120 * s), h = Math.round(164 * s);
    const bx = Math.round(w / 2 + (r() - 0.5) * 8 * s);
    const cy = Math.round(h * (0.27 + r() * 0.04));
    const cx = Math.round(w / 2 + (r() - 0.5) * 10 * s);
    const rx = (31 + r() * 7) * s, ry = (24 + r() * 5) * s;
    const clumps = [{ x: cx, y: cy - 2 * s, r: 16 * s, ph: r() * 50 }];
    const n = 10 + ((r() * 5) | 0);
    for (let k = 0; k < n; k++) {
      const a = r() * Math.PI * 2, d = 0.35 + 0.65 * Math.sqrt(r());
      const x = cx + Math.cos(a) * d * (rx - 11 * s), y = cy + Math.sin(a) * d * (ry - 9 * s);
      clumps.push({ x, y, r: (9 + r() * 5.5) * s * (y > cy + 6 * s ? 0.85 : 1), ph: r() * 50 });
    }
    clumps.sort((a, b) => a.y - b.y); // arriba primero: los racimos de abajo quedan delante
    const lower = clumps.filter((c) => c.y > cy);
    const branches = [], nb = 2 + ((r() * 3) | 0);
    for (let k = 0; k < nb; k++) {
      const c = lower[(r() * lower.length) | 0] || clumps[0];
      branches.push({ y0: cy + (14 + r() * 18) * s, x1: c.x, y1: c.y });
    }
    const streaks = [];
    for (let k = 0; k < 7; k++) streaks.push({ u: 0.3 + r() * 0.4, y: cy + r() * (h - cy - 6), len: 3 + ((r() * 6) | 0) });
    return { w, h, s, bx, cx, cy, rx, ry, clumps, branches, streaks, wb: (8.5 + r() * 2.5) * s, wt: 4.5 * s, ph: r() * 100 };
  }
  const trunkX = (T, y) => {
    const t = U.clamp((T.h - 1 - y) / (T.h - 1 - T.cy), 0, 1);
    return T.bx + (T.cx - T.bx) * Math.pow(t, 1.4) + (U.noise1(y * 0.06 + T.ph, 7) - 0.5) * 3 * T.s;
  };
  const trunkW = (T, y) => {
    const t = U.clamp((T.h - 1 - y) / (T.h - 1 - T.cy), 0, 1);
    return T.wb + (T.wt - T.wb) * t + (t < 0.09 ? Math.pow(1 - t / 0.09, 2) * 8 * T.s : 0);
  };
  function renderTree(T, pal, bark, sway) {
    const pb = new PB(T.w, T.h), P = pal.map(hx), B = bark.map(hx);
    for (let y = T.h - 1; y >= T.cy; y--) {
      const xc = trunkX(T, y), w = trunkW(T, y), xl = Math.round(xc - w / 2), xr = Math.max(xl, Math.round(xc + w / 2) - 1);
      for (let x = xl; x <= xr; x++) { const u = (x - xl) / Math.max(1, xr - xl); pb.set(x, y, u < 0.26 ? B[0] : u > 0.68 ? B[2] : B[1]); }
    }
    for (const st of T.streaks) for (let k = 0; k < st.len; k++) {
      const y = Math.round(st.y) + k, xc = trunkX(T, y), w = trunkW(T, y);
      pb.set(Math.round(xc - w / 2 + st.u * w), y, B[2]);
    }
    for (const b of T.branches) line(pb, trunkX(T, b.y0), b.y0, b.x1 + sway, b.y1, B[1], B[2]);
    for (const c of T.clumps) blob(c.x + sway, c.y, c.r, c.ph, 0.3, (x, y, dx, dy) => {
      const gy = (y - T.cy) / T.ry;
      const sh = (dy / c.r) * 0.75 + (dx / c.r) * 0.2 + gy * 0.5 + (U.noise2((x - sway) * 0.33, y * 0.33, 13 + T.ph) - 0.5) * 0.55;
      pb.set(x, y, sh < -0.42 ? P[0] : sh < 0.12 ? P[1] : sh < 0.62 ? P[2] : P[3]);
    });
    return pb.canvas();
  }
  function makeTreeVariant(r, s, pal, bark) {
    const T = treeShape(r, s);
    const f = [0, 1].map((sw) => U.withFlip(renderTree(T, pal, bark, sw)));
    return { w: T.w, h: T.h, bx: T.bx, r: f.map((q) => q.r), l: f.map((q) => q.l) };
  }

  // Arbusto del sotobosque (estático).
  function makeBush(r, pal) {
    const w = 30, h = 16, pb = new PB(w, h), P = pal.map(hx), bl = [];
    const n = 3 + ((r() * 3) | 0);
    for (let k = 0; k < n; k++) bl.push({ x: 8 + r() * 14, y: h - 4 - r() * 3, r: 3.5 + r() * 3.5, ph: r() * 50 });
    bl.sort((a, b) => a.y - b.y);
    for (const b of bl) blob(b.x, b.y, b.r, b.ph, 0.3, (x, y, dx, dy) => {
      const sh = (dy / b.r) * 0.8 + (dx / b.r) * 0.2 + (U.noise2(x * 0.4, y * 0.4, 17) - 0.5) * 0.5;
      pb.set(x, y, sh < -0.35 ? P[0] : sh < 0.2 ? P[1] : sh < 0.6 ? P[2] : P[3]);
    });
    const q = U.withFlip(pb.canvas());
    return { w, h, r: q.r, l: q.l };
  }

  // Mata de briznas con 3 frames de viento (la punta se inclina 0, 1 y 2 px a la derecha).
  // o: { w, h, n, spread, pal: [punta, medio, base], head?, cat?, flowers? }
  function makeTuft(r, o) {
    const PAD = 3, bl = [], fl = [];
    for (let k = 0; k < o.n; k++) {
      const bx = Math.round(o.w / 2 + (r() - 0.5) * o.spread);
      bl.push({ bx, h: Math.max(3, Math.round(o.h * (0.45 + r() * 0.55))), c: (bx - o.w / 2) * 0.45 + (r() - 0.5) * 1.6, head: !!o.head && r() < 0.4, cat: !!o.cat && r() < 0.45 });
    }
    bl.sort((a, b) => b.h - a.h);
    if (o.flowers) for (let k = 0; k < o.flowers.n; k++) fl.push({ bx: Math.round(o.w / 2 + (r() - 0.5) * o.spread), h: Math.round(o.h * (0.4 + r() * 0.45)), col: o.flowers.cols[(r() * o.flowers.cols.length) | 0] });
    const P = o.pal.map(hx), frames = [];
    for (let f = 0; f < 3; f++) {
      const pb = new PB(o.w + PAD * 2 + 2, o.h);
      const tip = (b, q) => PAD + b.bx + Math.round(b.c * q * q + f * q * q);
      for (const b of bl) {
        for (let k = 0; k < b.h; k++) {
          const q = k / (b.h - 1);
          pb.set(tip(b, q), o.h - 1 - k, q < 0.34 ? P[2] : q < 0.72 ? P[1] : P[0]);
        }
        const tx = tip(b, 1), ty = o.h - b.h;
        if (b.head) { const hc = hx(o.head); pb.set(tx, ty, hc); pb.set(tx, ty + 1, hc); }
        if (b.cat) { const cc = hx(o.cat); for (let k = 1; k <= 3; k++) { pb.set(tx, ty + k, cc); pb.set(tx + 1, ty + k, cc); } }
      }
      for (const fw of fl) {
        const b = { bx: fw.bx, c: 0.3 }, st = hx(o.pal[2]);
        for (let k = 0; k < fw.h; k++) pb.set(tip(b, k / (fw.h - 1)), o.h - 1 - k, st);
        const tx = tip(b, 1), ty = o.h - fw.h - 1, fc = hx(fw.col);
        pb.set(tx, ty, fc); pb.set(tx - 1, ty + 1, fc); pb.set(tx + 1, ty + 1, fc); pb.set(tx, ty + 1, hx('#E7C85A'));
      }
      frames.push(pb.canvas());
    }
    return { w: o.w + PAD * 2 + 2, h: o.h, ax: PAD + Math.round(o.w / 2), f: frames };
  }

  // ---------------------------------------------------------------- objetos colocados
  let MOUNT, HILLS, FARTREES, REEDS;
  let backTrees = [], frontTrees = [], bushes = [], tufts = [], fronts = [], shore = [];
  let fogMask = null, fogCol = null, fogRGB = null, fogA = -1, fogOff = 0;
  const FOG_Y = 140, FOG_H = 90;

  function place(r, x0, x1, s0, s1, fn) { for (let x = x0 + r() * s0; x < x1; x += s0 + r() * (s1 - s0)) fn(Math.round(x)); }

  function buildFog() {
    const pb = new PB(TW, FOG_H);
    for (let y = 0; y < FOG_H; y++) {
      const wy = FOG_Y + y;
      const band = Math.exp(-(((wy - 174) / 10) ** 2)) + 0.8 * Math.exp(-(((wy - 204) / 12) ** 2)) + 0.35 * Math.exp(-(((wy - 150) / 8) ** 2));
      for (let x = 0; x < TW; x++) {
        const n = pfbm2(x / 48, wy / 7, TW / 48, 3, SEED + 61);
        const m = Math.min(1, band) * U.smoothstep((n - 0.38) / 0.3);
        const q = Math.min(4, Math.floor(m * 5)) / 4; // alfa escalonado, como los halos
        if (q > 0) pb.d[y * TW + x] = pk(255, 255, 255, Math.round(q * 255));
      }
    }
    fogMask = pb.canvas();
    fogCol = U.canvas(TW, FOG_H);
  }

  function init() {
    const R = U.mulberry32(SEED);
    DOCKS = K.MAP.things.filter((t) => t.type === 'dock').map((t) => [t.x0 - 2, t.x1 + 2]);

    // Parallax: silueta de un color, más bruma cuanto más lejos.
    reedStalks = reedData();
    MOUNT = makeLayer({ f: 0.05, y0: 100, h: 72, base: U.rgb('#717565'), haze: 0.6, paint: paintMountains });
    HILLS = makeLayer({ f: 0.15, y0: 126, h: 46, base: U.rgb('#717565'), haze: 0.35, paint: paintHills });
    FARTREES = makeLayer({ f: 0.3, y0: 112, h: 60, base: U.rgb('#555849'), haze: 0.15, paint: paintTreeline });
    REEDS = makeLayer({ f: 0.5, y0: 144, h: 28, base: U.rgb('#B59D69'), haze: 0, frames: 3, paint: paintReeds });

    // Árboles: 5 variantes delante, 4 detrás (más oscuras y pequeñas).
    const frontV = [0, 1, 2, 3, 4].map(() => makeTreeVariant(R, 0.92 + R() * 0.13, LEAF, BARK));
    const backV = [0, 1, 2, 3].map(() => makeTreeVariant(R, 0.74 + R() * 0.1, dim(LEAF, 0.38), dim(BARK, 0.25)));
    const forests = K.MAP.zones.filter((z) => z.type === 'forest');
    for (const z of forests) {
      place(R, z.x0, z.x1, 36, 58, (x) => { if (!inClear(x, 26)) frontTrees.push({ x, v: frontV[(R() * frontV.length) | 0], flip: R() < 0.5, ph: R() * 6 }); });
      place(R, z.x0 + 14, z.x1, 30, 50, (x) => { if (!inClear(x, 14)) backTrees.push({ x, v: backV[(R() * backV.length) | 0], flip: R() < 0.5, ph: R() * 6 }); });
    }
    // Sotobosque
    const bushV = [0, 1, 2, 3].map(() => makeBush(R, ['#7C8240', '#62682F', '#4A5026', '#383D1D']));
    for (const z of forests) place(R, z.x0, z.x1, 22, 46, (x) => { if (!inClear(x, 4)) bushes.push({ x, v: bushV[(R() * bushV.length) | 0], flip: R() < 0.5 }); });

    // Hierba alta y flores en praderas (detrás del jinete)
    const FLW = { n: 2, cols: ['#ECE6D2', '#E3C35A', '#B9A3C8'] };
    const tuftV = [];
    for (let k = 0; k < 6; k++) tuftV.push(makeTuft(R, { w: 12, h: 11 + ((R() * 5) | 0), n: 7, spread: 8, pal: ['#ADA955', '#8A9046', '#6E7338'], head: '#CFC787', flowers: k >= 4 ? FLW : null }));
    const tuftS = [0, 1, 2].map(() => makeTuft(R, { w: 9, h: 7, n: 5, spread: 6, pal: ['#A1A150', '#80883E', '#656D33'] }));
    const duneV = [0, 1].map(() => makeTuft(R, { w: 10, h: 9, n: 6, spread: 7, pal: ['#B5B077', '#9A9763', '#7E7D50'] }));
    for (let x = 0; x < K.WORLD_W; x += 6 + R() * 12) {
      const z = zoneAt(x), xi = Math.round(x);
      if (z === 'meadow' && R() < 0.8) tufts.push({ x: xi, v: R() < 0.7 ? tuftV[(R() * tuftV.length) | 0] : tuftS[(R() * tuftS.length) | 0], ph: R() * 6 });
      else if (z === 'grass' && R() < 0.45) tufts.push({ x: xi, v: tuftS[(R() * tuftS.length) | 0], ph: R() * 6 });
      else if (z === 'coast' && R() < 0.18) tufts.push({ x: xi, v: duneV[(R() * duneV.length) | 0], ph: R() * 6 });
    }

    // Hierba delante de los cascos y juncos de la orilla
    const FP = {
      lush: ['#80883E', '#656D33', '#4F5629'], dark: ['#646C31', '#4D5427', '#3B411F'], dune: ['#9A9763', '#7E7D50', '#64643F'],
    };
    const frontV2 = {};
    for (const [k, pal] of Object.entries(FP)) frontV2[k] = [0, 1, 2, 3].map(() => makeTuft(R, { w: 7, h: 7 + ((R() * 3) | 0), n: 4, spread: 5, pal }));
    const PROB = { forest: ['dark', 0.8], meadow: ['lush', 0.9], grass: ['lush', 0.75], farm: ['lush', 0.3], cobble: [null, 0], coast: ['dune', 0.3] };
    for (let x = 0; x < K.WORLD_W; x += 10 + R() * 14) {
      const [kind, p] = PROB[zoneAt(x)];
      if (kind && R() < p) fronts.push({ x: Math.round(x), v: frontV2[kind][(R() * 4) | 0], ph: R() * 6 });
    }
    const reedV = [0, 1, 2].map(() => makeTuft(R, { w: 10, h: 12 + ((R() * 4) | 0), n: 6, spread: 8, pal: ['#BFA877', '#A08A58', '#7E6C44'], cat: '#5C4430' }));
    const shoreX = [520, 548, 1395, 1604, 1712, 2166, 2182, 2203, 2226, 2240];
    for (const x of shoreX) shore.push({ x: x + Math.round((R() - 0.5) * 6), v: reedV[(R() * reedV.length) | 0], ph: R() * 6 });

    // Suelo y flecos delanteros (una sola franja del ancho del mundo)
    buildCols();
    ground = buildGround(frontTrees);
    fringe = buildFringe();
    buildFog();

    // Nada de matas sobre el muelle. Se filtra al final para no alterar la secuencia de R() del resto del mapa.
    const offDock = (o) => !onDock(o.x - o.v.ax, o.x - o.v.ax + o.v.w - 1);
    tufts = tufts.filter(offDock);
    fronts = fronts.filter(offDock);

    // Orden de dibujo por x
    for (const a of [backTrees, frontTrees, bushes, tufts, fronts, shore]) a.sort((p, q) => p.x - q.x);
  }

  // Dibuja una lista ordenada por x, solo lo visible. fn(o, sx) dibuja un objeto.
  function drawList(ctx, list, margin, fn) {
    const x0 = K.camXi - margin, x1 = K.camXi + W + margin;
    for (const o of list) { if (o.x < x0) continue; if (o.x > x1) break; fn(o, K.sx(o.x)); }
  }
  const drawTree = (ctx) => (t, sx) => {
    const v = t.v, fr = gust(t.x, t.ph) > 0.55 ? 1 : 0;
    const ax = t.flip ? v.w - 1 - v.bx : v.bx;
    ctx.drawImage(t.flip ? v.l[fr] : v.r[fr], sx - ax, GY + 2 - v.h);
  };
  const drawTuft = (ctx, baseY) => (t, sx) => {
    const v = t.v;
    ctx.drawImage(v.f[frame3(t.x, t.ph)], sx - v.ax, baseY + 1 - v.h);
  };

  K.register('world', {
    order: 10,
    init,
    update(dt) {
      if (!MOUNT) return;
      const e = K.env, hz = U.rgb(e.haze);
      for (const L of LAYERS) tintLayer(L, hz);
      // Niebla: color de la bruma, más densa al amanecer y de noche.
      if (!fogRGB || Math.abs(fogRGB[0] - hz[0]) + Math.abs(fogRGB[1] - hz[1]) + Math.abs(fogRGB[2] - hz[2]) >= 3) {
        fogRGB = hz.slice();
        const x = fogCol.x;
        x.globalCompositeOperation = 'source-over';
        x.clearRect(0, 0, TW, FOG_H); x.drawImage(fogMask, 0, 0);
        x.globalCompositeOperation = 'source-in';
        x.fillStyle = e.haze; x.fillRect(0, 0, TW, FOG_H);
        x.globalCompositeOperation = 'source-over';
      }
      const tgt = 0.05 + 0.07 * e.night + (e.phase === 'dawn' ? 0.09 : 0) + (e.phase === 'dusk' ? 0.02 : 0);
      fogA = fogA < 0 ? tgt : fogA + (tgt - fogA) * Math.min(1, dt * 0.4);
      fogOff += dt * (3 + 5 * e.wind);
    },
    drawParallax(ctx) {
      if (!MOUNT) return;
      drawTiled(ctx, MOUNT.cols[0].c, MOUNT.f, MOUNT.y0, MOUNT.h);
      drawTiled(ctx, HILLS.cols[0].c, HILLS.f, HILLS.y0, HILLS.h);
      drawTiled(ctx, FARTREES.cols[0].c, FARTREES.f, FARTREES.y0, FARTREES.h);
      // Juncos: cada trozo de CW px con su frame según la ráfaga que pasa por él.
      const s = K.sx(0, REEDS.f);
      for (let x = U.mod(s, TW) - TW; x < W; x += TW) {
        for (let k = 0; k < TW; k += CW) {
          const dx = x + k;
          if (dx + CW <= 0 || dx >= W) continue;
          ctx.drawImage(REEDS.cols[frame3(dx - s, 0)].c, k, 0, CW, REEDS.h, dx, REEDS.y0, CW, REEDS.h);
        }
      }
    },
    drawGround(ctx) {
      if (!ground) return;
      ctx.drawImage(ground, K.camXi - GX0, 0, W, GH, 0, GT, W, GH);
    },
    drawBack(ctx) {
      if (!ground) return;
      drawList(ctx, backTrees, 70, drawTree(ctx));
      drawList(ctx, frontTrees, 70, drawTree(ctx));
      drawList(ctx, bushes, 20, (b, sx) => U.draw(ctx, b.v, sx - (b.v.w >> 1), GY + 2 - b.v.h, b.flip ? -1 : 1));
      drawList(ctx, tufts, 16, drawTuft(ctx, GY + 1));
    },
    drawFront(ctx) {
      if (!ground) return;
      ctx.drawImage(fringe, K.camXi - GX0, 0, W, FH, 0, FT, W, FH);
      drawList(ctx, shore, 16, drawTuft(ctx, K.WATER_Y - 1));
      drawList(ctx, fronts, 12, drawTuft(ctx, GY + 5));
    },
    drawOverlay(ctx) {
      if (!fogCol || fogA <= 0.003) return;
      ctx.globalAlpha = fogA;
      drawTiled(ctx, fogCol.c, 1.5, FOG_Y, FOG_H, fogOff);
      ctx.globalAlpha = 1;
    },
  });

  // Vista de depuración: ?view=world_sprites (variantes de árbol, matas y juncos sobre fondo liso).
  K.views.world_sprites = (ctx) => {
    if (!backTrees.length) return;
    const seen = new Set();
    let x = 4;
    for (const t of [...frontTrees, ...backTrees]) { if (seen.has(t.v)) continue; seen.add(t.v); ctx.drawImage(t.v.r[0], x, 4); x += t.v.w - 20; if (x > W - 60) break; }
    x = 4;
    const seenT = new Set();
    for (const t of [...tufts, ...fronts, ...shore]) { if (seenT.has(t.v)) continue; seenT.add(t.v); ctx.drawImage(t.v.f[0], x, 240 - t.v.h); x += t.v.w + 2; if (x > W - 20) break; }
  };
})(window.K);
