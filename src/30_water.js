// 30_water.js — el río: reflejo invertido de las filas 110–189, ondas "a saltos" a 10 Hz,
// columnas de luz cálida, orilla, destellos de día y peces que saltan.
(function (K) {
  const U = K.util, C = K.CONFIG, P = K.params;
  const W = K.W, WY = K.WATER_Y, WH = K.H - K.WATER_Y; // 80 filas de agua
  const SRC_Y = WY - WH;                                // 110: primera fila que se refleja
  const CW = 16, NCX = W / CW;                          // trozos de 16×1 px, 30 por fila
  const BASE = '#686C53', LIGHT = '#FC8F53';

  // Multiplica un color por otro (lo dibujado tras la oscuridad no queda oscurecido).
  const mul = (hex, m) => { const a = U.rgb(hex), b = U.rgb(m); return U.hex(a[0] * b[0] / 255, a[1] * b[1] / 255, a[2] * b[2] / 255); };

  // ---- Lienzos de trabajo
  const still = U.canvas(W, WH);                  // agua compuesta sin ondas
  const out = still.x.createImageData(W, WH);     // franja final con ondas
  const out32 = new Uint32Array(out.data.buffer);

  // Oscurecimiento hacia abajo: hasta 40 % de negro en bandas de 4 px.
  const bands = U.canvas(W, WH);
  { const nb = WH / 4;
    for (let i = 0; i < nb; i++) { bands.x.fillStyle = `rgba(0,0,0,${(0.4 * i / (nb - 1)).toFixed(3)})`; bands.x.fillRect(0, i * 4, W, 4); } }

  // ---- Columnas de luz: destello vertical hecho de guiones horizontales (uno por fila),
  // núcleo intenso en el centro, bordes escalonados y huecos que crecen hacia abajo.
  function makeColumn(w, h, seed, col) {
    const { c, x } = U.canvas(w, h);
    const img = x.createImageData(w, h), d = img.data, [r, g, b] = U.rgb(col);
    const half = w / 2;
    for (let y = 0; y < h; y++) {
      const v = y / (h - 1);
      const iv = Math.min(1, (y + 2) / 6) * Math.pow(1 - v, 0.75);
      const gap = U.hash(y, 1, seed) < 0.1 + 0.4 * v;      // fila partida por una ola
      const L = half * (1 - 0.5 * v) * (0.5 + 0.5 * U.hash(y, 2, seed)); // media longitud del guion
      const off = w > 8 ? Math.round((U.hash(y, 3, seed) - 0.5) * 2) : 0;
      for (let i = 0; i < w; i++) {
        const e = Math.abs(i + 0.5 - half - off) / Math.max(1, L);
        if (e >= 1) continue;
        let a = iv * (e < 0.34 ? 1 : e < 0.7 ? 0.55 : 0.28);
        if (gap) a *= e < 0.34 ? 0.45 : 0;
        a = Math.round(a * 4) / 4; // 4 escalones de alfa
        if (a <= 0) continue;
        const o = (y * w + i) * 4;
        d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = Math.round(a * 255);
      }
    }
    x.putImageData(img, 0, 0);
    return c;
  }
  // 3 variantes de cada columna que se alternan a 10 Hz (brillo "a saltos" aun sin viento).
  const variants = (w, s, col) => [0, 1, 2].map((v) => makeColumn(w, 48, s + v * 101, col));
  const COL_S = variants(8, 11, LIGHT), COL_L = variants(24, 23, LIGHT);
  // Sin columna para las luciérnagas: son de 1 px y ya se ven en el reflejo (filas 110–189);
  // una franja de 8×48 las haría parecer pilares fantasma.
  const COLUMN = { torch: [COL_S, 1], fire: [COL_L, 1], moon: [COL_L, 1], sun: [COL_L, 1] };

  // ---- Tabla de ondas: (dx, dy) por trozo de 16×1, ruido suave con celdas de ~32×4 px.
  const NT = NCX * WH;
  const TX = new Int8Array(NT), TY = new Int8Array(NT), TN = new Float32Array(NT);
  const sparks = []; // destellos de día { x, y, w }
  let tick = -1;
  function buildTable(tk) {
    const env = K.env, t = tk / 10, wind = env.wind, ox = K.camX * 1.5;
    const day = U.clamp(1 - env.darkness / 0.12, 0, 1) * U.clamp((wind - 0.25) / 0.35, 0, 1);
    const sunX = env.sunVis ? env.sunX : -9999;
    sparks.length = 0;
    for (let y = 0; y < WH; y++) {
      const amp = 0.8 + 0.4 * y / (WH - 1); // 50 % mayor al fondo que arriba
      const ax = wind * 6 * amp, ay = wind * 12 * amp;
      const Y1 = (y - t * 5) / 4, Y2 = (y - t * 9) / 3; // deriva vertical lenta
      for (let c = 0; c < NCX; c++) {
        const X = (c * CW + 8 + ox) / 32;
        const n = U.noise2(X + t * 0.04, Y1, 301) * 0.62 + U.noise2(X * 1.3 - t * 0.07, Y2, 302) * 0.38;
        const m = U.noise2(X * 0.9 + 17, Y1 + 5, 303) * 0.62 + U.noise2(X * 1.4 + 9, Y2 - 3, 304) * 0.38;
        const k = y * NCX + c;
        TX[k] = Math.round(U.clamp((n - 0.5) * 3, -1, 1) * ax);
        TY[k] = Math.round(U.clamp((m - 0.5) * 3, -1, 1) * ay);
        TN[k] = n;
        // Destellos de día donde el ruido supera un umbral; se agrupan bajo el sol.
        if (day > 0 && y > 3) {
          const cx = c * CW + 8, q = (cx - sunX) / 56, near = Math.exp(-q * q);
          if (n > 0.75 - 0.13 * near && U.hash(c, y, tk) < 0.04 + 0.26 * near) {
            const h = U.hash(c, y, tk + 7);
            sparks.push({ x: c * CW + Math.floor(h * 13), y, w: 2 + (h > 0.6 ? 1 : 0) });
          }
        }
      }
    }
  }

  // ---- Peces: sprites pequeños (arriba, plano, abajo), salpicaduras y ondas.
  const FP = { d: '#3F4C47', b: '#7E8C81', l: '#C4CABB', t: '#5B6961', e: '#9FAB9F', k: '#262D2A' };
  const UP = ['........be', '......dkbl', '....ddbbl.', '...dbbl...', 't.dbl.....', '.tt.......'];
  const FISH = {
    up: U.sprite(UP, FP, 'pez arriba'),
    flat: U.sprite(['...dd.....', 't.ddddddd.', '.tbbbbbkbe', 't..lllll..'], FP, 'pez plano'),
    down: U.sprite(UP.slice().reverse(), Object.assign({}, FP, { d: FP.l, l: FP.d }), 'pez abajo'),
  };
  const SP = { w: '#E2E7DC', s: '#A9B8AE' };
  const SPLASH = [
    ['...........', '.....w.....', '....wsw....', '...ws.sw...', '..sss.sss..'],
    ['...w...w...', '...........', '..w.....w..', '.ws.....sw.', 'ss.......ss'],
    ['...........', '.w.......w.', '...........', 'w.........w', 's.........s'],
  ].map((rows, i) => U.sprite(rows, SP, 'salpicadura ' + i));
  // Ondas en la superficie: elipses planas 1 px que se abren.
  const RIPPLE = [3, 5, 7, 9, 11].map((rx) => U.paint(rx * 2 + 1, 3, (x, w) => {
    x.fillStyle = '#C9D0C4';
    x.fillRect(2, 0, w - 4, 1); x.fillRect(0, 1, 2, 1); x.fillRect(w - 2, 1, 2, 1); x.fillRect(2, 2, w - 4, 1);
  }));
  const FXW = 64, FXH = 44, OX = 32, OY = 26; // lienzo del pez; (OX, OY) = punto de la superficie
  const fx = U.canvas(FXW, FXH);
  const fishes = [];
  const rnd = U.mulberry32((K.seed ^ 0x51f15e) >>> 0);
  let nextFish = 2 + rnd() * 4;
  let forced = P.fish !== undefined ? { t: (P.sim ?? 1.5) - P.fish } : null; // ?fish=edad en s (capturas)

  // El salto nunca sube por encima de la orilla (y - h ≥ WY + 4).
  function spawnFish(x, y, age) {
    const h = Math.min(7 + Math.floor(rnd() * 6), y - WY - 4);
    fishes.push({ x, y, age, dir: rnd() < 0.5 ? -1 : 1, h, run: 10 + Math.floor(rnd() * 6), dur: 0.6 + rnd() * 0.2 });
  }
  function drawSplash(g, x, y, a) {
    if (a < 0 || a >= 0.3) return;
    const s = SPLASH[Math.floor(a / 0.1)];
    g.drawImage(s.r, x - (s.w >> 1), y - s.h + 1);
  }
  function drawRipple(g, x, y, a) {
    if (a < 0 || a >= 0.9) return;
    const r = RIPPLE[Math.min(4, Math.floor(a / 0.18))];
    g.globalAlpha = 0.55 * (1 - a / 0.9);
    g.drawImage(r.r, x - (r.w >> 1), y - 1);
    g.globalAlpha = 1;
  }
  function drawFish(ctx, f) {
    const sx = K.sx(f.x);
    if (sx < -FXW || sx > W + FXW) return;
    const g = fx.x;
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1;
    g.clearRect(0, 0, FXW, FXH);
    const x1 = OX + f.dir * f.run;
    drawRipple(g, OX, OY, f.age - 0.05);
    drawRipple(g, x1, OY, f.age - f.dur - 0.05);
    const p = f.age / f.dur;
    if (p >= 0 && p <= 1) {
      const spr = p < 0.36 ? FISH.up : p > 0.64 ? FISH.down : FISH.flat;
      const px = Math.round(OX + f.dir * f.run * p - spr.w / 2);
      const py = Math.round(OY - 4 * f.h * p * (1 - p) - spr.h / 2);
      // Reflejo tenue bajo la superficie
      g.save(); g.beginPath(); g.rect(0, OY + 1, FXW, FXH - OY - 1); g.clip();
      g.globalAlpha = 0.3; g.setTransform(1, 0, 0, -1, 0, 2 * OY + 1);
      U.draw(g, spr, px, py, f.dir);
      g.restore();
      // El pez, recortado por la superficie
      g.save(); g.beginPath(); g.rect(0, 0, FXW, OY); g.clip();
      U.draw(g, spr, px, py, f.dir);
      g.restore();
    }
    drawSplash(g, OX, OY, f.age);
    drawSplash(g, x1, OY, f.age - f.dur + 0.03);
    ctx.drawImage(U.multiplyTint(fx.c, K.env.mulColor), sx - OX, f.y - OY);
  }

  K.register('water', {
    order: 30,
    update(dt) {
      for (const f of fishes) f.age += dt;
      for (let i = fishes.length - 1; i >= 0; i--) if (fishes[i].age > fishes[i].dur + 1.1) fishes.splice(i, 1);
      if (forced) {
        if (K.t >= forced.t) {
          const px = P.fishx ?? (K.player ? K.player.x + 70 : K.camX + 300);
          spawnFish(px, WY + (P.fishy ?? 22), K.t - forced.t);
          forced = null;
        }
        return;
      }
      if (P.fish !== undefined) return;
      nextFish -= dt;
      if (nextFish <= 0) {
        nextFish = 3 + rnd() * 6;
        spawnFish(K.camX + 40 + rnd() * (W - 80), WY + 14 + Math.floor(rnd() * 42), 0);
      }
    },
    drawWater(ctx) {
      const env = K.env;
      const base = U.lerpColor(BASE, env.darkColor, env.darkness);
      // 1. Agua sin ondas: color base, bandas, reflejo volteado y columnas de luz.
      const s = still.x;
      s.setTransform(1, 0, 0, 1, 0, 0);
      s.globalCompositeOperation = 'source-over'; s.globalAlpha = 1;
      s.fillStyle = base; s.fillRect(0, 0, W, WH);
      s.drawImage(bands.c, 0, 0);
      s.globalAlpha = C.reflectivity;
      s.setTransform(1, 0, 0, -1, 0, WH); // la fila 189 queda pegada a la 190
      s.drawImage(K.buf, 0, SRC_Y, W, WH, 0, 0, W, WH);
      s.setTransform(1, 0, 0, 1, 0, 0);
      const k = env.darkness * 0.8 * Math.min(1, env.wind * 10);
      const tk = Math.floor(K.t * 10);
      if (k > 0.003) {
        s.globalCompositeOperation = 'lighter';
        for (const L of K.lights) {
          const def = COLUMN[L.type];
          if (!def) continue;
          const spr = def[0][(tk + Math.floor(U.hash(Math.round(L.x), 5) * 3)) % 3];
          const x0 = (L.screen ? Math.round(L.x) : K.sx(L.x)) - (spr.width >> 1);
          const top = Math.round((WY - L.y) * 0.3);
          if (x0 + spr.width < -8 || x0 > W + 8 || top >= WH) continue;
          // Parpadeo igual al del halo de la capa de oscuridad.
          const flick = L.screen ? 0 : (U.noise1(K.t * 7 + L.x * 0.13, 11) - 0.5) * 0.3;
          s.globalAlpha = U.clamp(k * def[1] * (L.power ?? 1) * (1 + flick), 0, 1);
          s.drawImage(spr, x0, top);
        }
        s.globalCompositeOperation = 'source-over';
      }
      s.globalAlpha = 1;

      // 2–3. Ondas: tabla regenerada a 10 Hz; cada trozo 16×1 se copia desplazado.
      if (tk !== tick) { tick = tk; buildTable(tk); }
      const src = new Uint32Array(s.getImageData(0, 0, W, WH).data.buffer);
      for (let y = 0, k2 = 0; y < WH; y++) {
        const row = y * W;
        for (let c = 0; c < NCX; c++, k2++) {
          let sy = y + TY[k2];
          sy = sy < 0 ? 0 : sy >= WH ? WH - 1 : sy;
          const srow = sy * W, x0 = c * CW, dx = TX[k2];
          for (let i = 0; i < CW; i++) {
            let sx = x0 + i - dx;
            sx = sx < 0 ? 0 : sx >= W ? W - 1 : sx;
            out32[row + x0 + i] = src[srow + sx];
          }
        }
      }
      ctx.putImageData(out, 0, WY);

      // 4. Orilla: línea húmeda 1 px más oscura y espuma mínima que late con la tabla.
      U.rect(ctx, 0, WY, W, 1, U.shade(base, 0.72));
      ctx.fillStyle = U.lerpColor(base, mul('#C9CDB8', env.mulColor), 0.4);
      ctx.globalAlpha = 0.35 + 0.45 * Math.min(1, env.wind);
      for (let c = 0; c < NCX; c++) {
        if (TN[c] < 0.6) continue;
        const h = U.hash(c, tick, 9);
        ctx.fillRect(c * CW + Math.floor(h * 9), WY + 1, 2 + Math.floor(U.hash(c, tick, 10) * 5), 1);
      }
      ctx.globalAlpha = 1;

      // Destellos de día (invención propia).
      const day = U.clamp(1 - env.darkness / 0.12, 0, 1) * U.clamp((env.wind - 0.25) / 0.35, 0, 1);
      if (day > 0.02 && sparks.length) {
        ctx.globalAlpha = 0.7 * day;
        ctx.fillStyle = U.lerpColor(env.haze, '#FFFFFF', 0.5);
        for (const p of sparks) ctx.fillRect(p.x, WY + p.y, p.w, 1);
        ctx.globalAlpha = 1;
      }
      // Peces aquí (no en overlay) para que la niebla de primer plano pase por delante.
      for (const f of fishes) drawFish(ctx, f);
    },
  });

  // Vista de depuración: ?view=water (columnas, peces y salpicaduras a escala 1).
  K.views.water = (ctx) => {
    COL_S.forEach((c, i) => ctx.drawImage(c, 4 + i * 10, 10));
    COL_L.forEach((c, i) => ctx.drawImage(c, 4 + i * 28, 62));
    let x = 60;
    for (const s of [FISH.up, FISH.flat, FISH.down]) { U.draw(ctx, s, x, 12, 1); U.draw(ctx, s, x, 24, -1); x += 14; }
    x = 60;
    for (const s of SPLASH) { U.draw(ctx, s, x, 40, 1); x += 14; }
    x = 60;
    for (const r of RIPPLE) { U.draw(ctx, r, x, 52, 1); x += r.w + 3; }
  };
})(window.K);
