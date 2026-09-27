// agua.js — agua pixel art reutilizable (reflejo invertido, ondas "a saltos" a 10 Hz,
// columnas de luz y espuma en la orilla). Sin dependencias: copia este archivo a tu juego.
//
// Uso mínimo (ver demo.html):
//   const agua = crearAgua({ ancho: 480, alto: 270, yAgua: 190 });
//   // ...dibuja cielo, fondo y personajes en tu buffer (canvas de 480×270)...
//   agua.dibujar(ctxBuffer, { t: segundos, camX, viento: 0.5, oscuridad: 0, luces: [...] });
//
// Idea: las filas justo encima de la línea del agua se copian volteadas debajo de ella; luego se
// trocean en tiras de 16×1 px y cada tira se desplaza unos píxeles según una tabla de ruido que solo
// cambia 10 veces por segundo. Ese "salto" discreto es lo que da el aspecto pixel art.
(function (global) {
  // ---- Utilidades (ruido determinista y color)
  function hash(x, y = 0, s = 0) {
    let h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  function noise2(x, y, s = 0) {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const a = hash(ix, iy, s), b = hash(ix + 1, iy, s), c = hash(ix, iy + 1, s), d = hash(ix + 1, iy + 1, s);
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  }
  const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const hex = (r, g, b) => '#' + [r, g, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
  const mezcla = (c1, c2, t) => { const a = rgb(c1), b = rgb(c2); return hex(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)); };
  const oscurece = (c, f) => { const a = rgb(c); return hex(a[0] * f, a[1] * f, a[2] * f); };
  function lienzo(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return { c, x: c.getContext('2d') }; }

  function crearAgua(op = {}) {
    const W = op.ancho ?? 480, H = op.alto ?? 270, WY = op.yAgua ?? 190;
    const WH = H - WY;                 // filas de agua
    const SRC_Y = Math.max(0, WY - WH); // primera fila que se refleja
    const CW = op.trozo ?? 16, NCX = Math.ceil(W / CW);
    const BASE = op.color ?? '#686C53';          // color del río
    const LUZ = op.colorLuz ?? '#FC8F53';        // columnas de luz
    const REFLEJO = op.reflejo ?? 0.3;           // 30 % de reflectividad
    const HZ = op.hz ?? 10;                      // frecuencia de las ondas

    const quieta = lienzo(W, WH);
    const salida = quieta.x.createImageData(W, WH);
    const out32 = new Uint32Array(salida.data.buffer);

    // Oscurecimiento hacia el fondo: hasta 40 % de negro en bandas de 4 px.
    const bandas = lienzo(W, WH);
    { const nb = Math.ceil(WH / 4);
      for (let i = 0; i < nb; i++) { bandas.x.fillStyle = `rgba(0,0,0,${(0.4 * i / Math.max(1, nb - 1)).toFixed(3)})`; bandas.x.fillRect(0, i * 4, W, 4); } }

    // Columna de luz: guiones horizontales, núcleo intenso, huecos que crecen hacia abajo.
    function columna(w, h, seed) {
      const { c, x } = lienzo(w, h), img = x.createImageData(w, h), d = img.data, [r, g, b] = rgb(LUZ), half = w / 2;
      for (let y = 0; y < h; y++) {
        const v = y / (h - 1), iv = Math.min(1, (y + 2) / 6) * Math.pow(1 - v, 0.75);
        const hueco = hash(y, 1, seed) < 0.1 + 0.4 * v;
        const L = half * (1 - 0.5 * v) * (0.5 + 0.5 * hash(y, 2, seed));
        const off = w > 8 ? Math.round((hash(y, 3, seed) - 0.5) * 2) : 0;
        for (let i = 0; i < w; i++) {
          const e = Math.abs(i + 0.5 - half - off) / Math.max(1, L);
          if (e >= 1) continue;
          let a = iv * (e < 0.34 ? 1 : e < 0.7 ? 0.55 : 0.28);
          if (hueco) a *= e < 0.34 ? 0.45 : 0;
          a = Math.round(a * 4) / 4;
          if (a <= 0) continue;
          const o = (y * w + i) * 4; d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = Math.round(a * 255);
        }
      }
      x.putImageData(img, 0, 0);
      return c;
    }
    const variantes = (w, s) => [0, 1, 2].map((k) => columna(w, 48, s + k * 101));
    const COL = { chica: variantes(8, 11), grande: variantes(24, 23) };

    // Tabla de ondas: desplazamiento (dx, dy) por trozo de CW×1 px.
    const NT = NCX * WH, TX = new Int8Array(NT), TY = new Int8Array(NT), TN = new Float32Array(NT);
    let tick = -1;
    function tabla(tk, camX, viento) {
      const t = tk / HZ, ox = camX * 1.5;
      for (let y = 0; y < WH; y++) {
        const amp = 0.8 + 0.4 * y / Math.max(1, WH - 1); // más amplitud al fondo
        const ax = viento * 6 * amp, ay = viento * 12 * amp;
        const Y1 = (y - t * 5) / 4, Y2 = (y - t * 9) / 3;
        for (let c = 0; c < NCX; c++) {
          const X = (c * CW + 8 + ox) / 32;
          const n = noise2(X + t * 0.04, Y1, 301) * 0.62 + noise2(X * 1.3 - t * 0.07, Y2, 302) * 0.38;
          const m = noise2(X * 0.9 + 17, Y1 + 5, 303) * 0.62 + noise2(X * 1.4 + 9, Y2 - 3, 304) * 0.38;
          const k = y * NCX + c;
          TX[k] = Math.round(clamp((n - 0.5) * 3, -1, 1) * ax);
          TY[k] = Math.round(clamp((m - 0.5) * 3, -1, 1) * ay);
          TN[k] = n;
        }
      }
    }

    // ctx: el buffer donde ya dibujaste la escena (se lee de él para el reflejo y se escribe el agua).
    // e: { t, camX, viento (0–1), oscuridad (0–1), colorNoche, luces: [{ x, y, tam: 'chica'|'grande', fuerza }] }
    //    x de las luces en coordenadas de pantalla.
    function dibujar(ctx, e = {}) {
      const t = e.t ?? 0, camX = e.camX ?? 0, viento = e.viento ?? 0.5, osc = e.oscuridad ?? 0;
      const base = mezcla(BASE, e.colorNoche ?? '#141A2E', osc * 0.8);
      const s = quieta.x;
      // 1. Agua quieta: color, bandas, reflejo volteado, columnas de luz.
      s.setTransform(1, 0, 0, 1, 0, 0); s.globalCompositeOperation = 'source-over'; s.globalAlpha = 1;
      s.fillStyle = base; s.fillRect(0, 0, W, WH);
      s.drawImage(bandas.c, 0, 0);
      s.globalAlpha = REFLEJO;
      s.setTransform(1, 0, 0, -1, 0, WH); // la fila justo encima del agua queda pegada a ella
      s.drawImage(ctx.canvas, 0, SRC_Y, W, WY - SRC_Y, 0, WH - (WY - SRC_Y), W, WY - SRC_Y);
      s.setTransform(1, 0, 0, 1, 0, 0);
      const tk = Math.floor(t * HZ);
      const k = osc * 0.8 * Math.min(1, viento * 10);
      if (k > 0.003 && e.luces) {
        s.globalCompositeOperation = 'lighter';
        for (const L of e.luces) {
          const set = COL[L.tam ?? 'chica'];
          const spr = set[(tk + Math.floor(hash(Math.round(L.x * 7), 5) * 3)) % 3];
          const x0 = Math.round(L.x) - (spr.width >> 1), top = Math.round((WY - L.y) * 0.3);
          if (x0 + spr.width < 0 || x0 > W || top >= WH) continue;
          s.globalAlpha = clamp(k * (L.fuerza ?? 1), 0, 1);
          s.drawImage(spr, x0, top);
        }
        s.globalCompositeOperation = 'source-over'; s.globalAlpha = 1;
      }
      s.globalAlpha = 1;

      // 2. Ondas: la tabla cambia a HZ; cada trozo se copia desplazado (vecino más cercano, sin mezcla).
      if (tk !== tick) { tick = tk; tabla(tk, camX, viento); }
      const src = new Uint32Array(s.getImageData(0, 0, W, WH).data.buffer);
      for (let y = 0, k2 = 0; y < WH; y++) {
        const row = y * W;
        for (let c = 0; c < NCX; c++, k2++) {
          let sy = y + TY[k2]; sy = sy < 0 ? 0 : sy >= WH ? WH - 1 : sy;
          const srow = sy * W, x0 = c * CW, dx = TX[k2];
          for (let i = 0; i < CW && x0 + i < W; i++) {
            let sx = x0 + i - dx; sx = sx < 0 ? 0 : sx >= W ? W - 1 : sx;
            out32[row + x0 + i] = src[srow + sx];
          }
        }
      }
      ctx.putImageData(salida, 0, WY);

      // 3. Orilla: línea húmeda y espuma que late con la tabla.
      ctx.fillStyle = oscurece(base, 0.72); ctx.fillRect(0, WY, W, 1);
      ctx.fillStyle = mezcla(base, '#C9CDB8', 0.4 * (1 - osc * 0.6));
      ctx.globalAlpha = 0.35 + 0.45 * Math.min(1, viento);
      for (let c = 0; c < NCX; c++) {
        if (TN[c] < 0.6) continue;
        ctx.fillRect(c * CW + Math.floor(hash(c, tick, 9) * 9), WY + 1, 2 + Math.floor(hash(c, tick, 10) * 5), 1);
      }
      ctx.globalAlpha = 1;
    }

    return { dibujar, yAgua: WY };
  }

  global.crearAgua = crearAgua;
})(window);
