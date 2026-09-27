// 00_nucleo.js — espacio de nombres G, utilidades, dibujo pixel, fuente 3×5, eventos y registro de módulos.
window.G = (() => {
  const G = {
    W: 480, H: 270, WY: 190, GY: 176, BEAT: 0.5,
    t: 0, dt: 1 / 60, camX: 0,
    P: new URLSearchParams(location.search),
    estado: 'titulo',
    luces: [],
  };
  G.prueba = G.P.has('shot') || G.P.has('prueba') || G.P.has('auto') || G.P.has('bench');

  // ---- Eventos
  const ev = {};
  G.on = (n, f) => (ev[n] = ev[n] || []).push(f);
  G.emit = (n, a) => { for (const f of ev[n] || []) f(a); };

  // ---- Utilidades numéricas y de color
  const U = G.u = {};
  U.hash = (x, y = 0, s = 0) => {
    let h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177); h = Math.imul(h ^ (h >>> 16), 2246822519);
    return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
  };
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.smooth = (u) => { u = U.clamp(u, 0, 1); return u * u * (3 - 2 * u); };
  U.easeOut = (u) => 1 - (1 - u) * (1 - u);
  U.rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  U.hex = (r, g, b) => '#' + [r, g, b].map((v) => Math.round(U.clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
  U.mix = (a, b, t) => { const x = U.rgb(a), y = U.rgb(b); return U.hex(U.lerp(x[0], y[0], t), U.lerp(x[1], y[1], t), U.lerp(x[2], y[2], t)); };
  U.shade = (c, f) => { const x = U.rgb(c); return U.hex(x[0] * f, x[1] * f, x[2] * f); };
  U.noise1 = (x, s = 0) => { const i = Math.floor(x), f = x - i; return U.lerp(U.hash(i, 0, s), U.hash(i + 1, 0, s), f * f * (3 - 2 * f)); };
  U.rng = (seed) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  // ---- Lienzos
  G.lienzo = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return { c, x: c.getContext('2d', { willReadFrequently: true }) }; };
  const buf = G.lienzo(G.W, G.H);
  G.buf = buf.c; G.ctx = buf.x;

  // ---- Dibujo en píxeles enteros
  const D = G.d = {};
  D.rect = (x, y, w, h, c, g = G.ctx) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  D.disco = (cx, cy, r, c, g = G.ctx) => {
    g.fillStyle = c; cx = Math.round(cx); cy = Math.round(cy);
    for (let dy = -r; dy <= r; dy++) { const hw = Math.floor(Math.sqrt(r * r - dy * dy) + 0.5); g.fillRect(cx - hw, cy + dy, hw * 2 + 1, 1); }
  };
  // Línea de Bresenham; grosor g ≥ 1 dibuja cuadrados g×g en cada punto.
  D.linea = (x0, y0, x1, y1, c, gr = 1, g = G.ctx) => {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    g.fillStyle = c;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, o = gr >> 1;
    let e = dx + dy, n = 0;
    for (;;) {
      g.fillRect(x0 - o, y0 - o, gr, gr);
      if ((x0 === x1 && y0 === y1) || ++n > 2000) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  };

  // ---- Fuente pixel 3×5 (cada fila: 3 bits)
  const F = {
    A: [2, 5, 7, 5, 5], B: [6, 5, 6, 5, 6], C: [3, 4, 4, 4, 3], D: [6, 5, 5, 5, 6], E: [7, 4, 6, 4, 7], F: [7, 4, 6, 4, 4],
    G: [3, 4, 5, 5, 3], H: [5, 5, 7, 5, 5], I: [7, 2, 2, 2, 7], J: [1, 1, 1, 5, 2], K: [5, 5, 6, 5, 5], L: [4, 4, 4, 4, 7],
    M: [5, 7, 7, 5, 5], N: [6, 5, 5, 5, 5], O: [2, 5, 5, 5, 2], P: [6, 5, 6, 4, 4], Q: [2, 5, 5, 6, 3], R: [6, 5, 6, 5, 5],
    S: [3, 4, 2, 1, 6], T: [7, 2, 2, 2, 2], U: [5, 5, 5, 5, 7], V: [5, 5, 5, 5, 2], W: [5, 5, 7, 7, 5], X: [5, 5, 2, 5, 5],
    Y: [5, 5, 2, 2, 2], Z: [7, 1, 2, 4, 7],
    0: [7, 5, 5, 5, 7], 1: [2, 6, 2, 2, 7], 2: [6, 1, 2, 4, 7], 3: [6, 1, 2, 1, 6], 4: [5, 5, 7, 1, 1], 5: [7, 4, 6, 1, 6],
    6: [3, 4, 7, 5, 7], 7: [7, 1, 2, 2, 2], 8: [7, 5, 7, 5, 7], 9: [7, 5, 7, 1, 6],
    '!': [2, 2, 2, 0, 2], '¡': [2, 0, 2, 2, 2], '?': [6, 1, 2, 0, 2], '¿': [2, 0, 2, 4, 3], '.': [0, 0, 0, 0, 2], ',': [0, 0, 0, 2, 4],
    ':': [0, 2, 0, 2, 0], '-': [0, 0, 7, 0, 0], '+': [0, 2, 7, 2, 0], '/': [1, 1, 2, 4, 4], '×': [0, 5, 2, 5, 0], '%': [5, 1, 2, 4, 5],
    "'": [2, 2, 0, 0, 0], '(': [1, 2, 2, 2, 1], ')': [4, 2, 2, 2, 4], '<': [1, 2, 4, 2, 1], '>': [4, 2, 1, 2, 4], '=': [0, 7, 0, 7, 0],
    '·': [0, 0, 2, 0, 0], ' ': [0, 0, 0, 0, 0],
  };
  const limpia = (s) => String(s).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  D.anchoTexto = (s, e = 1) => limpia(s).length * 4 * e - e;
  // alin: 'izq' | 'centro' | 'der'; sombra: color de la sombra 1 px abajo
  D.texto = (s, x, y, c = '#FFFFFF', e = 1, alin = 'izq', sombra = null, g = G.ctx) => {
    s = limpia(s);
    let px = Math.round(alin === 'centro' ? x - D.anchoTexto(s, e) / 2 : alin === 'der' ? x - D.anchoTexto(s, e) : x);
    y = Math.round(y);
    if (sombra) D.texto(s, px + (alin === 'izq' ? 0 : 0), y + e, sombra, e, 'izq', null, g);
    g.fillStyle = c;
    for (const ch of s) {
      const f = F[ch] || F[' '];
      for (let r = 0; r < 5; r++) for (let b = 0; b < 3; b++) if (f[r] & (4 >> b)) g.fillRect(px + b * e, y + r * e, e, e);
      px += 4 * e;
    }
  };

  // ---- Módulos: G.registrar(nombre, { orden, iniciar, actualizar(dt), ... })
  G.mods = [];
  G.registrar = (nombre, m) => { m.nombre = nombre; G.mods.push(m); G.mods.sort((a, b) => (a.orden || 0) - (b.orden || 0)); return m; };
  G.llamar = (fn, ...a) => { for (const m of G.mods) if (m[fn]) m[fn](...a); };

  // ---- Estados de pantalla (los define la UI)
  G.cambiarEstado = (e, datos) => { const antes = G.estado; G.estado = e; G.emit('estado', { antes, ahora: e, datos }); };

  return G;
})();
