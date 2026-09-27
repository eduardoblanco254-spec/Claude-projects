// 01_core.js — estado compartido, utilidades de color, ruido, sprites y texto.
(function (K) {
  const U = K.util = {};

  // ---- Parámetros de URL (?x=1200&phase=night ...). Los numéricos se convierten.
  const P = K.params = {};
  for (const [k, v] of new URLSearchParams(location.search)) P[k] = v !== '' && !isNaN(v) ? +v : v;

  // ---- Estado compartido
  K.mods = {};      // módulos registrados con K.register
  K.views = {};     // vistas de depuración (?view=nombre)
  K.lights = [];    // se vacía en cada frame; los módulos empujan luces en update()
  K.t = 0; K.dt = 1 / 60; K.frame = 0;
  K.camX = 0;       // x del mundo en el borde izquierdo (float)
  K.camXi = 0;      // desplazamiento entero de la cámara para el plano de juego
  K.input = { left: false, right: false, gallop: false, taps: [] };
  K.debug = !!P.debug;

  // ---- Matemática
  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.invLerp = (a, b, v) => (v - a) / (b - a);
  U.smoothstep = (t) => { t = U.clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  U.mod = (a, n) => ((a % n) + n) % n;

  // ---- Color
  const rgbCache = new Map();
  U.rgb = (hex) => {
    let c = rgbCache.get(hex);
    if (!c) {
      let h = hex.replace('#', '');
      if (h.length === 3) h = h.split('').map((x) => x + x).join('');
      const n = parseInt(h, 16);
      c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      rgbCache.set(hex, c);
    }
    return c;
  };
  U.hex = (r, g, b) => '#' + ((1 << 24) | (U.clamp(Math.round(r), 0, 255) << 16) | (U.clamp(Math.round(g), 0, 255) << 8) | U.clamp(Math.round(b), 0, 255)).toString(16).slice(1);
  U.lerpColor = (a, b, t) => {
    const A = U.rgb(a), B = U.rgb(b);
    return U.hex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
  };
  U.shade = (hex, f) => { const c = U.rgb(hex); return U.hex(c[0] * f, c[1] * f, c[2] * f); };

  // ---- Aleatoriedad y ruido (deterministas)
  U.mulberry32 = (seed) => () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  U.hash = (x, y = 0, s = 0) => {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  U.noise1 = (x, s = 0) => {
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    return U.lerp(U.hash(i, 0, s), U.hash(i + 1, 0, s), u);
  };
  U.noise2 = (x, y, s = 0) => {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const a = U.hash(ix, iy, s), b = U.hash(ix + 1, iy, s), c = U.hash(ix, iy + 1, s), d = U.hash(ix + 1, iy + 1, s);
    return U.lerp(U.lerp(a, b, ux), U.lerp(c, d, ux), uy);
  };
  U.fbm2 = (x, y, oct = 4, s = 0) => {
    let sum = 0, amp = 0.5, norm = 0, f = 1;
    for (let o = 0; o < oct; o++) { sum += U.noise2(x * f, y * f, s + o * 17) * amp; norm += amp; amp *= 0.5; f *= 2; }
    return sum / norm;
  };

  // ---- Lienzos y sprites
  U.canvas = (w, h) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.imageSmoothingEnabled = false;
    return { c, x };
  };
  U.withFlip = (c) => {
    const f = U.canvas(c.width, c.height);
    f.x.translate(c.width, 0); f.x.scale(-1, 1); f.x.drawImage(c, 0, 0);
    return { r: c, l: f.c, w: c.width, h: c.height };
  };
  // rows: array de strings del mismo largo; pal: { carácter: '#hex' }. '.' y ' ' son transparentes.
  // Devuelve { r, l, w, h }: r mira a la derecha, l es el espejo horizontal.
  U.sprite = (rows, pal, name = 'sprite') => {
    const h = rows.length, w = rows.reduce((m, r) => Math.max(m, r.length), 0);
    rows.forEach((r, i) => { if (r.length !== w) throw new Error(`${name}: la fila ${i} mide ${r.length}, se esperaba ${w}`); });
    const { c, x } = U.canvas(w, h);
    const img = x.createImageData(w, h), d = img.data;
    for (let y = 0; y < h; y++) {
      for (let i = 0; i < w; i++) {
        const ch = rows[y][i];
        if (ch === '.' || ch === ' ') continue;
        const col = pal[ch];
        if (!col) throw new Error(`${name}: el carácter '${ch}' no tiene color en la paleta`);
        const [r, g, b] = U.rgb(col), o = (y * w + i) * 4;
        d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
      }
    }
    x.putImageData(img, 0, 0);
    return U.withFlip(c);
  };
  // Crea un sprite dibujándolo con código: fn(ctx, w, h).
  U.paint = (w, h, fn) => { const { c, x } = U.canvas(w, h); fn(x, w, h); return U.withFlip(c); };
  U.draw = (ctx, s, x, y, dir = 1) => ctx.drawImage(dir < 0 ? s.l : s.r, Math.round(x), Math.round(y));
  U.rect = (ctx, x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
  U.px = (ctx, x, y, col) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); };
  // Círculo relleno sin antialiasing, por filas.
  U.disc = (ctx, cx, cy, r, col) => {
    ctx.fillStyle = col;
    cx = Math.round(cx); cy = Math.round(cy);
    for (let dy = -r; dy <= r; dy++) {
      const hw = Math.floor(Math.sqrt(r * r - dy * dy) + 0.5);
      ctx.fillRect(cx - hw, cy + dy, hw * 2 + 1, 1);
    }
  };
  // Devuelve un lienzo temporal compartido con src multiplicado por color (conserva el alfa).
  // Úsalo para objetos dibujados DESPUÉS de la pasada de oscuridad: U.multiplyTint(spr, K.env.mulColor).
  const tintPool = new Map();
  U.multiplyTint = (src, color) => {
    const key = src.width + 'x' + src.height;
    let t = tintPool.get(key);
    if (!t) { t = U.canvas(src.width, src.height); tintPool.set(key, t); }
    const x = t.x;
    x.globalCompositeOperation = 'source-over';
    x.clearRect(0, 0, src.width, src.height);
    x.drawImage(src, 0, 0);
    x.globalCompositeOperation = 'multiply';
    x.fillStyle = color; x.fillRect(0, 0, src.width, src.height);
    x.globalCompositeOperation = 'destination-in';
    x.drawImage(src, 0, 0);
    x.globalCompositeOperation = 'source-over';
    return t.c;
  };

  // ---- Fuente de 3×5 para depuración
  const G = {
    0: [7, 5, 5, 5, 7], 1: [2, 6, 2, 2, 7], 2: [7, 1, 7, 4, 7], 3: [7, 1, 7, 1, 7], 4: [5, 5, 7, 1, 1],
    5: [7, 4, 7, 1, 7], 6: [7, 4, 7, 5, 7], 7: [7, 1, 1, 2, 2], 8: [7, 5, 7, 5, 7], 9: [7, 5, 7, 1, 7],
    A: [2, 5, 7, 5, 5], B: [6, 5, 6, 5, 6], C: [3, 4, 4, 4, 3], D: [6, 5, 5, 5, 6], E: [7, 4, 6, 4, 7],
    F: [7, 4, 6, 4, 4], G: [3, 4, 5, 5, 3], H: [5, 5, 7, 5, 5], I: [7, 2, 2, 2, 7], J: [1, 1, 1, 5, 2],
    K: [5, 5, 6, 5, 5], L: [4, 4, 4, 4, 7], M: [5, 7, 7, 5, 5], N: [6, 5, 5, 5, 5], O: [2, 5, 5, 5, 2],
    P: [6, 5, 6, 4, 4], Q: [2, 5, 5, 6, 3], R: [6, 5, 6, 5, 5], S: [3, 4, 2, 1, 6], T: [7, 2, 2, 2, 2],
    U: [5, 5, 5, 5, 7], V: [5, 5, 5, 5, 2], W: [5, 5, 7, 7, 5], X: [5, 5, 2, 5, 5], Y: [5, 5, 2, 2, 2],
    Z: [7, 1, 2, 4, 7], ' ': [0, 0, 0, 0, 0], '.': [0, 0, 0, 0, 2], ':': [0, 2, 0, 2, 0], '-': [0, 0, 7, 0, 0],
    '%': [5, 1, 2, 4, 5], '/': [1, 1, 2, 4, 4], '=': [0, 7, 0, 7, 0], '(': [1, 2, 2, 2, 1], ')': [4, 2, 2, 2, 4],
    ',': [0, 0, 0, 2, 4], '+': [0, 2, 7, 2, 0], '×': [0, 5, 2, 5, 0],
  };
  U.text = (ctx, str, x, y, col = '#fff', s = 1) => {
    ctx.fillStyle = col;
    let cx = Math.round(x);
    for (const chRaw of String(str)) {
      const g = G[chRaw.toUpperCase()] || G[' '];
      for (let r = 0; r < 5; r++) for (let b = 0; b < 3; b++) if (g[r] & (4 >> b)) ctx.fillRect(cx + b * s, Math.round(y) + r * s, s, s);
      cx += 4 * s;
    }
  };
  U.textWidth = (str, s = 1) => String(str).length * 4 * s - s;

  // ---- Coordenadas de pantalla
  // f = factor de parallax (1 = plano de juego). Siempre usa K.sx para dibujar algo del mundo.
  K.sx = (x, f = 1) => (f === 1 ? Math.round(x) - K.camXi : Math.round(x) - Math.round(K.camX * f));
  K.onScreen = (x, w, f = 1, m = 8) => { const s = K.sx(x, f); return s + w > -m && s < K.W + m; };
  K.terrainAt = (x) => { for (const z of K.MAP.zones) if (x >= z.x0 && x < z.x1) return z.type; return 'grass'; };
  K.register = (name, mod) => { mod.name = name; K.mods[name] = mod; return mod; };

  // ---- Semilla y rasgos del monarca (capa compartida con el estandarte)
  const C = K.CONFIG;
  K.seed = P.seed !== undefined ? P.seed : (P.shot || P.bench ? C.seed : (Math.random() * 1e9) | 0);
  K.rand = U.mulberry32(K.seed);
  const capeIdx = P.cape !== undefined ? P.cape : (P.shot || P.bench ? 0 : Math.floor(K.rand() * C.capeColors.length));
  K.royal = {
    cape: C.capeColors[U.mod(capeIdx, C.capeColors.length)],
    skin: C.skinTones[P.skin !== undefined ? U.mod(P.skin, C.skinTones.length) : (P.shot || P.bench ? 0 : Math.floor(K.rand() * C.skinTones.length))],
  };
  if (P.coat) C.horseCoat = P.coat;
  if (P.refl !== undefined) C.reflectivity = P.refl;
})(window.K);
