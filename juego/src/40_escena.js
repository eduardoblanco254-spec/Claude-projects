// 40_escena.js — biomas con fondos por capas pre-pintadas (perspectiva atmosférica), cielo con nubes y
// rayos de luz, suelo detallado, hogueras, meta, campamento, clima y partículas, oscuridad con halos y
// parámetros del agua (WebGL) o agua 2D de respaldo.
(function (G) {
  const U = G.u, D = G.d, W = G.W, H = G.H, WY = G.WY, GY = G.GY;
  const TW = 960;                               // ancho de las capas (se repiten sin costura)
  const C = () => G.ctx;

  // ---------------- Biomas
  const BIOMAS = {
    pradera: { cielo: ['#4E8FD0', '#8EC6EE', '#F1E6C4'], astro: 'sol', sol: [372, 44], solC: '#FFF3C8', nubes: '#FFFFFF', rayos: 0.07,
      capas: [['montanas', 0.04, 150, 70, '#9CB4CE', { nieve: '#F2F4FA' }], ['colinas', 0.1, 160, 26, '#8DB487'], ['frondosos', 0.2, 170, 0, '#6F9E68'],
        ['abedules', 0.33, 174, 0, '#5A8A50'], ['arbustos', 0.52, 178, 0, '#44703C']],
      suelo: { hierba: '#6FA046', hierba2: '#8CBC56', tierra: '#6A4A2C', tierra2: '#54391F', flores: ['#F4E27A', '#F29AB0', '#FFFFFF'] },
      agua: '#3F7A8C', osc: 0, mul: '#FFFFFF', part: null, niebla: 0 },
    otono: { cielo: ['#3D4A86', '#C9705E', '#F6C27A'], astro: 'sol', sol: [392, 112], solC: '#FFC27A', nubes: '#F4B89A', rayos: 0.1,
      capas: [['montanas', 0.04, 150, 60, '#8E6E86', { nieve: '#E8C8C8' }], ['colinas', 0.1, 162, 22, '#9C6258'], ['frondosos', 0.2, 170, 0, '#B35A30', { alt: '#D4903A' }],
        ['pinos', 0.33, 174, 0, '#5E3A38'], ['arbustos', 0.52, 178, 0, '#6E3A26', { alt: '#9A4A22' }]],
      suelo: { hierba: '#8A7A3A', hierba2: '#B8903A', tierra: '#5E3E26', tierra2: '#4A2E1A', flores: ['#D8602A', '#E8A040'] },
      agua: '#5A5068', osc: 0.35, mul: '#F6D2B4', part: 'hojas', niebla: 0 },
    niebla: { cielo: ['#7C8C9C', '#AEB8BE', '#D2D6D2'], astro: null, nubes: '#DDE2E4', rayos: 0.05,
      capas: [['pinos', 0.06, 150, 0, '#9AA6AE'], ['pinos', 0.14, 160, 0, '#7F8C94'], ['pinos', 0.24, 168, 0, '#62707A'], ['pinos', 0.38, 176, 0, '#46545E'], ['arbustos', 0.55, 178, 0, '#34423A']],
      suelo: { hierba: '#4E6A44', hierba2: '#6A8456', tierra: '#4A3A2A', tierra2: '#3A2C1E', flores: ['#C8C0A8'] },
      agua: '#4E5E62', osc: 0.15, mul: '#E4E8EC', part: null, niebla: 1 },
    pantano: { cielo: ['#070B20', '#17234A', '#34466E'], astro: 'luna', sol: [360, 52], solC: '#DDE6FF', nubes: '#2A3658', rayos: 0, estrellas: true,
      capas: [['colinas', 0.06, 158, 24, '#26365A'], ['sauces', 0.18, 170, 0, '#1E2E4A'], ['frondosos', 0.3, 174, 0, '#172440'], ['juncos', 0.5, 178, 0, '#101A2E']],
      suelo: { hierba: '#3A5A3A', hierba2: '#4E7048', tierra: '#3A2E24', tierra2: '#2C2218', flores: ['#9AE8C0'] },
      agua: '#1C3444', osc: 1, mul: '#5A6894', part: 'luciernagas', niebla: 0.4 },
    nieve: { cielo: ['#43558A', '#D892A2', '#F8D4AE'], astro: 'sol', sol: [100, 120], solC: '#FFD0A0', nubes: '#F6D6D6', rayos: 0.09,
      capas: [['montanas', 0.04, 140, 90, '#8E90BA', { nieve: '#FFFFFF', grande: true }], ['montanas', 0.1, 160, 40, '#7478A4', { nieve: '#EEF0FA' }],
        ['pinos', 0.22, 170, 0, '#4A5A7A', { nieve: '#E6ECF6' }], ['pinos', 0.36, 176, 0, '#34405A', { nieve: '#DDE4F0' }]],
      suelo: { hierba: '#E8EEF6', hierba2: '#FFFFFF', tierra: '#6A6A80', tierra2: '#54546A', flores: [] },
      agua: '#4A6488', osc: 0.18, mul: '#EAE2F2', part: 'nieve', niebla: 0.2 },
    tormenta: { cielo: ['#141824', '#262C3E', '#40465A'], astro: null, nubes: '#3A4050', rayos: 0, tormenta: true,
      capas: [['montanas', 0.05, 150, 70, '#3A4054', { nieve: '#6A7084' }], ['pinos', 0.16, 166, 0, '#2A3040'], ['pinos', 0.3, 174, 0, '#1E2430'], ['arbustos', 0.5, 178, 0, '#161C24']],
      suelo: { hierba: '#3A4A34', hierba2: '#4A5A40', tierra: '#3A3028', tierra2: '#2A221C', flores: [] },
      agua: '#18242E', osc: 0.85, mul: '#626A8C', part: 'lluvia', niebla: 0 },
    campamento: { cielo: ['#2E3A6E', '#B8686A', '#F4B070'], astro: 'sol', sol: [410, 128], solC: '#FFB070', nubes: '#E8A08A', rayos: 0.08,
      capas: [['montanas', 0.04, 150, 55, '#7A6282', { nieve: '#E0C0C8' }], ['colinas', 0.1, 164, 20, '#7E5458'], ['pinos', 0.2, 170, 0, '#5A3E48'],
        ['frondosos', 0.34, 175, 0, '#4E3A3A', { alt: '#6A4638' }]],
      suelo: { hierba: '#6A7A3A', hierba2: '#8A9A48', tierra: '#5A3E26', tierra2: '#46301D', flores: ['#F2C14E'] },
      agua: '#4A4A62', osc: 0.45, mul: '#F2C8B0', part: 'luciernagas', niebla: 0 },
  };
  const S = G.escena = { bioma: 'pradera', B: BIOMAS.pradera, clima: 'despejado', viento: 0.4, fogatas: [], props: [], meta: null, largo: 1400,
    relampago: 0, proxRayo: 6, ondas: [], BIOMAS };
  const cacheCapas = {};
  let particulas = [];

  // ---------------- Pintado de capas (una vez por bioma)
  function pnoise(x, periodo, seed) {       // ruido 1D periódico (sin costura en el borde de la capa)
    const i = Math.floor(x), f = x - i, a = U.hash(((i % periodo) + periodo) % periodo, 0, seed), b = U.hash((((i + 1) % periodo) + periodo) % periodo, 0, seed);
    return U.lerp(a, b, f * f * (3 - 2 * f));
  }
  const niebla = (col, k, B) => U.mix(col, B.cielo[2], k);
  function pintarCapa(tipo, base, alto, col, op, B, seed) {
    const { c, x } = G.lienzo(TW, WY);
    const luz = U.mix(col, B.cielo[2], 0.35), sombra = U.shade(col, 0.82);
    const envolver = (fn, px, ancho) => { fn(px); if (px < ancho) fn(px + TW); if (px > TW - ancho) fn(px - TW); };
    if (tipo === 'montanas' || tipo === 'colinas') {
      const per = tipo === 'montanas' ? 12 : 16, esc = TW / per;
      const altura = (px) => {
        const u = px / esc;
        const h = pnoise(u, per, seed) * 0.6 + pnoise(u * 3, per * 3, seed + 1) * 0.28 + pnoise(u * 9, per * 9, seed + 2) * 0.12;
        return tipo === 'montanas' ? Math.pow(h, 1.4) * (op && op.grande ? 1.25 : 1) : h;
      };
      for (let px = 0; px < TW; px++) {
        const h = altura(px), top = Math.round(base - h * alto);
        const pend = altura(px + 1) - h;           // lado iluminado según la pendiente
        x.fillStyle = pend > 0 ? luz : col; x.fillRect(px, top, 1, WY - top);
        if (tipo === 'montanas' && op && op.nieve) {
          const lim = base - alto * 0.62;
          if (top < lim) { const n = Math.round((lim - top) * 0.8 + U.hash(px, 3, seed) * 3); x.fillStyle = pend > 0 ? op.nieve : U.shade(op.nieve, 0.88); x.fillRect(px, top, 1, n); }
        }
        if (tipo === 'colinas' && U.hash(px, 9, seed) < 0.3) { x.fillStyle = luz; x.fillRect(px, top - 1, 1, 1); }
      }
      return c;
    }
    // Suelo base de la capa (para que no se vea el cielo bajo los árboles)
    x.fillStyle = col; x.fillRect(0, base - 2, TW, WY - base + 2);
    const rnd = U.rng(seed * 977 + 13);
    if (tipo === 'pinos') {
      for (let px = 0; px < TW; px += 5 + Math.floor(rnd() * 7)) {
        const h = 24 + Math.floor(rnd() * 34), w = 7 + Math.floor(h / 6), tono = rnd() < 0.3 ? sombra : col;
        envolver((X) => {
          x.fillStyle = U.shade(tono, 0.7); x.fillRect(X, base - 4, 2, 6);
          for (let y = 0; y < h; y++) {
            const k = y / h, capa = (y % 7) / 7, hw = Math.max(0, Math.round((k * 0.85 + 0.15) * w * (0.75 + capa * 0.35)));
            x.fillStyle = tono; x.fillRect(X - hw, base - h + y, hw * 2 + 1, 1);
            if (hw > 1) { x.fillStyle = luz; x.fillRect(X + hw - 1, base - h + y, 1, 1); }
            if (op && op.nieve && capa < 0.3 && hw > 1) { x.fillStyle = op.nieve; x.fillRect(X - hw + 1, base - h + y, hw * 2 - 1, 1); }
          }
        }, px, w + 2);
      }
    } else if (tipo === 'frondosos' || tipo === 'abedules' || tipo === 'arbustos') {
      const arbusto = tipo === 'arbustos';
      for (let px = 0; px < TW; px += (arbusto ? 9 : 16) + Math.floor(rnd() * (arbusto ? 10 : 18))) {
        const h = arbusto ? 3 + Math.floor(rnd() * 5) : 20 + Math.floor(rnd() * 26), r = arbusto ? 5 + Math.floor(rnd() * 5) : 7 + Math.floor(rnd() * 7);
        const tono = op && op.alt && rnd() < 0.45 ? op.alt : rnd() < 0.3 ? sombra : col;
        envolver((X) => {
          if (!arbusto) {
            if (tipo === 'abedules') { x.fillStyle = niebla('#E8E4DA', 0.3, B); x.fillRect(X, base - h, 2, h + 2); for (let y = 3; y < h; y += 4 + (y % 3)) { x.fillStyle = '#3A3A3A'; x.fillRect(X, base - h + y, 1, 1); } }
            else { x.fillStyle = U.shade(col, 0.6); x.fillRect(X, base - h, 3, h + 2); x.fillRect(X - 3, base - h * 0.5, 3, 1); }
          }
          const cy = base - h - (arbusto ? 0 : r * 0.4);
          const blobs = arbusto ? 3 : 6;
          for (let k = 0; k < blobs; k++) {
            const bx = X + Math.round((U.hash(k, X, seed) - 0.5) * r * 1.6), by = Math.round(cy + (U.hash(k, X + 7, seed) - 0.3) * r);
            D.disco(bx, by, Math.max(2, Math.round(r * (0.55 + U.hash(k, X + 3, seed) * 0.35))), tono, x);
          }
          // luz de borde arriba a la derecha y textura de hojas
          D.disco(X + Math.round(r * 0.35), Math.round(cy - r * 0.35), Math.max(2, Math.round(r * 0.45)), U.mix(tono, luz, 0.6), x);
          for (let k = 0; k < r * 3; k++) { const a = U.hash(k, X, seed + 5) * 6.28, rr = r * (0.6 + U.hash(k, X, seed + 6) * 0.5); x.fillStyle = U.hash(k, X, seed + 8) < 0.5 ? luz : sombra; x.fillRect(Math.round(X + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr * 0.8), 1, 1); }
        }, px, r * 2);
      }
    } else if (tipo === 'sauces') {
      for (let px = 0; px < TW; px += 22 + Math.floor(rnd() * 26)) {
        const h = 26 + Math.floor(rnd() * 16), r = 10 + Math.floor(rnd() * 5);
        envolver((X) => {
          x.fillStyle = U.shade(col, 0.7); x.fillRect(X, base - h, 3, h + 2);
          D.disco(X + 1, base - h, r, col, x);
          for (let k = -r; k <= r; k += 2) { const l = 8 + Math.floor(U.hash(k, X, seed) * 14); x.fillStyle = k % 4 ? col : luz; x.fillRect(X + 1 + k, base - h, 1, l + Math.round(r - Math.abs(k))); }
        }, px, r + 2);
      }
    } else if (tipo === 'juncos') {
      for (let px = 0; px < TW; px += 2 + Math.floor(rnd() * 4)) {
        const h = 6 + Math.floor(rnd() * 14);
        x.fillStyle = rnd() < 0.3 ? luz : col; x.fillRect(px, base - h, 1, h + 2);
        if (rnd() < 0.15) { x.fillStyle = U.shade(col, 0.6); x.fillRect(px, base - h - 3, 2, 4); }
      }
    }
    return c;
  }
  function capasDe(nombre) {
    if (cacheCapas[nombre]) return cacheCapas[nombre];
    const B = BIOMAS[nombre];
    const n = B.capas.length;
    cacheCapas[nombre] = B.capas.map(([tipo, f, base, alto, col, op], i) => {
      const k = 0.55 * (1 - i / Math.max(1, n - 1));        // bruma mayor en las capas lejanas
      return { f, c: pintarCapa(tipo, base, alto, niebla(col, k * 0.6, B), op, B, 101 + i * 17 + nombre.length) };
    });
    return cacheCapas[nombre];
  }
  // Nubes (sprites)
  const NUBES = Array.from({ length: 6 }, (_, i) => {
    const w = 60 + i * 12, h = 22, { c, x } = G.lienzo(w, h);
    for (let k = 0; k < 7; k++) D.disco(Math.round(10 + (w - 20) * k / 6), Math.round(h - 8 - Math.sin(k / 6 * Math.PI) * 6 - U.hash(k, i) * 3), 5 + Math.round(Math.sin(k / 6 * Math.PI) * 5), '#FFFFFF', x);
    x.fillRect(6, h - 8, w - 12, 6);
    return c;
  });

  S._capas = (n) => capasDe(n);
  S.configurar = (d) => {
    S.bioma = d.bioma || 'pradera'; S.B = BIOMAS[S.bioma];
    S.clima = d.clima || (S.B.tormenta ? 'tormenta' : 'despejado');
    S.viento = { despejado: 0.4, niebla: 0.2, lluvia: 0.8, tormenta: 1 }[S.clima] ?? 0.4;
    S.fogatas = d.fogatas || []; S.props = d.props || []; S.meta = d.meta ?? null; S.largo = d.largo || 1400;
    S.relampago = 0; S.proxRayo = 5; S.ondas = []; particulas = [];
    capasDe(S.bioma);
  };

  // ---------------- Cielo
  function cielo() {
    const B = S.B, ctx = C(), [a, b, c] = B.cielo;
    for (let y = 0; y < WY; y++) {
      const k = y / WY; ctx.fillStyle = k < 0.55 ? U.mix(a, b, Math.pow(k / 0.55, 1.2)) : U.mix(b, c, (k - 0.55) / 0.45);
      ctx.fillRect(0, y, W, 1);
    }
    if (B.estrellas) {
      for (let i = 0; i < 110; i++) { ctx.globalAlpha = (0.4 + 0.6 * Math.abs(Math.sin(G.t * 1.3 + i * 7))) * (i % 5 ? 0.6 : 1); D.rect(Math.floor(U.hash(i, 1) * W), Math.floor(U.hash(i, 2) * 120), 1, 1, i % 7 ? '#CFE0FF' : '#FFFFFF'); }
      // aurora suave
      for (let x = 0; x < W; x += 2) { const h = 10 + U.noise1(x * 0.02 + G.t * 0.1, 5) * 26; ctx.globalAlpha = 0.07; D.rect(x, 26 + U.noise1(x * 0.01 + G.t * 0.05, 6) * 20, 2, h, x % 6 ? '#5AE0A8' : '#7A9AF0'); }
      ctx.globalAlpha = 1;
    }
    if (B.astro) {
      const [sx, sy] = B.sol;
      for (let r = 34; r > 10; r -= 6) { ctx.globalAlpha = 0.06; D.disco(sx, sy, r, B.solC); }
      ctx.globalAlpha = 1; D.disco(sx, sy, B.astro === 'luna' ? 9 : 10, B.solC);
      if (B.astro === 'luna') { D.disco(sx - 3, sy - 2, 2, U.shade(B.solC, 0.85)); D.disco(sx + 3, sy + 3, 1, U.shade(B.solC, 0.85)); }
    }
    // nubes con parallax y deriva
    for (let i = 0; i < 7; i++) {
      const n = NUBES[i % NUBES.length], vel = 3 + i * 0.7;
      const x = ((i * 137 - G.camX * (0.02 + i * 0.004) - G.t * vel) % (W + 200) + W + 200) % (W + 200) - 100;
      ctx.globalAlpha = B.tormenta ? 0.55 : 0.28 + (i % 3) * 0.08;
      ctx.drawImage(n, Math.round(x), 8 + (i * 23) % 70);
      if (B.tormenta) { ctx.drawImage(n, Math.round(x + 40), (i * 17) % 40); }
    }
    ctx.globalAlpha = 1;
    if (B.tormenta) { ctx.globalAlpha = 0.35; D.rect(0, 0, W, 70, B.nubes); ctx.globalAlpha = 1; }
    if (S.relampago > 0) { ctx.globalAlpha = Math.min(1, S.relampago * 3); D.rect(0, 0, W, WY, '#E8ECFF'); ctx.globalAlpha = 1; }
  }
  // Rayos de luz: haces anchos y muy suaves que bajan del sol y se desvanecen
  function rayosDeLuz() {
    const B = S.B; if (!B.rayos || !B.astro || B.astro === 'luna') return;
    const ctx = C(), [sx, sy] = B.sol;
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = B.solC;
    for (let k = 0; k < 4; k++) {
      const ang = Math.PI / 2 + (k - 1.5) * 0.28 + Math.sin(G.t * 0.15 + k) * 0.03, base = 10 + k * 4;
      for (let d = 12; d < 170; d += 3) {
        const x = sx + Math.cos(ang) * d, y = sy + Math.sin(ang) * d;
        if (y > GY) break;
        ctx.globalAlpha = B.rayos * 0.45 * (1 - d / 170) * (0.6 + 0.4 * Math.sin(G.t * 0.4 + k * 2));
        const w = Math.round(base + d * 0.18);
        ctx.fillRect(Math.round(x - w / 2), Math.round(y), w, 3);
      }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  function capas() {
    const ctx = C();
    for (const L of capasDe(S.bioma)) {
      const off = ((G.camX * L.f) % TW + TW) % TW;
      ctx.drawImage(L.c, -Math.round(off), 0); ctx.drawImage(L.c, TW - Math.round(off), 0);
      if (S.B.niebla > 0.5) { ctx.globalAlpha = 0.18; D.rect(0, 120, W, 60, S.B.cielo[2]); ctx.globalAlpha = 1; }
    }
  }
  // ---------------- Suelo
  function suelo() {
    const B = S.B.suelo, cam = G.camX, ctx = C();
    D.rect(0, GY, W, WY - GY, B.tierra);
    const o8 = ((cam % 8) + 8) % 8;
    for (let x = -8; x < W + 8; x += 8) { const i = Math.floor((x + cam) / 8); D.rect(x - o8, GY + 5 + Math.floor(U.hash(i, 7) * 7), 3 + Math.floor(U.hash(i, 8) * 3), 2, B.tierra2); if (U.hash(i, 12) < 0.2) D.rect(x - o8 + 4, GY + 10, 2, 1, U.shade(B.tierra, 1.2)); }
    D.rect(0, GY, W, 3, B.hierba); D.rect(0, GY + 3, W, 1, U.shade(B.hierba, 0.75));
    for (let x = 0; x < W; x++) {
      const i = Math.floor(x + cam);
      if (U.hash(i, 9) < 0.45) {
        const h = 1 + Math.floor(U.hash(i, 10) * 4 * (0.7 + 0.3 * Math.sin(G.t * 2.5 * S.viento + i * 0.3)));
        D.rect(x, GY - h, 1, h + 1, U.hash(i, 11) < 0.5 ? B.hierba : B.hierba2);
      }
      if (B.flores.length && U.hash(i, 13) < 0.025) { const f = B.flores[Math.floor(U.hash(i, 14) * B.flores.length)]; D.rect(x, GY - 3 - Math.floor(U.hash(i, 15) * 2), 1, 1, f); D.rect(x, GY - 2, 1, 2, B.hierba); }
    }
    for (let k = -1; k < W / 70 + 2; k++) {
      const i = k + Math.floor(cam / 70), x = Math.round(i * 70 + U.hash(i, 4) * 40 - cam);
      if (U.hash(i, 5) < 0.3) { D.disco(x, GY - 1, 3, '#7B7D78'); D.rect(x - 1, GY - 3, 2, 1, '#A0A29C'); }
      else if (U.hash(i, 6) < 0.25 && S.bioma === 'niebla') { D.rect(x, GY - 3, 1, 3, '#E8E0D0'); D.rect(x - 1, GY - 4, 3, 1, '#C8402A'); }
    }
  }
  // ---------------- Objetos del nivel
  function fogata(xw) {
    const x = Math.round(xw - G.camX); if (x < -20 || x > W + 20) return;
    D.rect(x - 6, GY - 2, 13, 2, '#4A4A48'); D.rect(x - 5, GY - 4, 4, 2, '#5B4430'); D.rect(x + 2, GY - 4, 4, 2, '#5B4430');
    const f = Math.floor(G.t * 10 + xw) % 3;
    D.rect(x - 3, GY - 9 - f, 7, 6 + f, '#E8742A'); D.rect(x - 2, GY - 12 - (f === 1 ? 1 : 0), 5, 6, '#F2A33A'); D.rect(x - 1, GY - 9, 3, 4, '#FFE39A');
    for (let k = 0; k < 3; k++) { const a = (G.t * 1.5 + k / 3 + xw) % 1; C().globalAlpha = 1 - a; D.rect(x - 1 + Math.round(Math.sin(a * 9 + k) * 3), GY - 14 - Math.round(a * 18), 1, 1, '#FFB060'); }
    C().globalAlpha = 1;
    G.luces.push({ x: xw, y: GY - 7, tipo: 'fogata' });
  }
  function meta() {
    if (S.meta === null) return;
    const x = Math.round(S.meta - G.camX); if (x < -40 || x > W + 40) return;
    D.rect(x - 10, GY - 6, 22, 6, '#6A6C68'); D.rect(x - 8, GY - 8, 18, 2, '#8A8C86');
    D.rect(x, GY - 62, 2, 56, '#4A3A2A'); D.rect(x - 1, GY - 64, 4, 2, '#F2C14E');
    for (let i = 0; i < 18; i++) { const ond = Math.round(Math.sin(G.t * 5 - i * 0.5) * (i / 18) * 2); D.rect(x + 2 + i, GY - 60 + ond, 1, 13 - (i > 14 ? (i - 14) * 3 : 0), i % 9 < 5 ? '#F4F1E6' : '#E4DCC8'); }
    D.disco(x + 10, GY - 54 + Math.round(Math.sin(G.t * 5 - 4)), 2, '#F2C14E');
    G.luces.push({ x: S.meta + 1, y: GY - 64, tipo: 'farol' });
  }
  function prop(p) {
    const x = Math.round(p.x - G.camX); if (x < -60 || x > W + 60) return;
    if (p.tipo === 'tienda') {
      const col = p.col || '#C8A870', osc = U.shade(col, 0.7);
      for (let y = 0; y < 26; y++) { const hw = Math.round(y * 0.8) + 2; D.rect(x - hw, GY - 26 + y, hw * 2 + 1, 1, y % 5 === 0 ? osc : col); }
      D.rect(x - 3, GY - 12, 7, 12, '#2A1E16'); D.rect(x, GY - 30, 1, 5, '#4A3A2A'); D.rect(x + 1, GY - 30, 5, 3, p.bandera || '#B8322A');
    } else if (p.tipo === 'yunque') {
      D.rect(x - 6, GY - 8, 12, 3, '#3A3C44'); D.rect(x - 3, GY - 5, 6, 5, '#2A2C34'); D.rect(x - 8, GY - 8, 3, 2, '#3A3C44');
      if (Math.floor(G.t * 2) % 4 === 0) { D.rect(x - 1, GY - 11, 1, 1, '#FFD27A'); D.rect(x + 2, GY - 12, 1, 1, '#FFB060'); }
      D.rect(x + 10, GY - 14, 8, 14, '#5A3A2A'); D.rect(x + 11, GY - 12, 6, 6, '#E8742A');
      G.luces.push({ x: p.x + 14, y: GY - 9, tipo: 'farol' });
    } else if (p.tipo === 'maniqui') {
      D.rect(x, GY - 20, 2, 20, '#6A4A30'); D.rect(x - 5, GY - 16, 12, 2, '#6A4A30'); D.disco(x + 1, GY - 22, 3, '#C8A870'); D.rect(x - 3, GY - 14, 8, 8, '#C8A870');
    } else if (p.tipo === 'carro') {
      D.rect(x - 14, GY - 12, 28, 6, '#6A4A30'); D.disco(x - 9, GY - 5, 4, '#3A2A1E'); D.disco(x + 9, GY - 5, 4, '#3A2A1E'); D.rect(x - 12, GY - 18, 24, 6, '#C8B080');
    } else if (p.tipo === 'estandarte') {
      D.rect(x, GY - 44, 2, 44, '#4A3A2A');
      for (let i = 0; i < 10; i++) D.rect(x + 2, GY - 42 + i, 10, 1, i < 8 ? '#B8322A' : '#8A2420'); D.disco(x + 7, GY - 38, 2, '#F2C14E');
    }
  }

  S.dibujarFondo = () => {
    cielo();
    capas();
    suelo();
    meta();
    for (const p of S.props) prop(p);
    for (const x of S.fogatas) fogata(x);
  };

  // ---------------- Partículas del bioma
  function particulasBioma(dt, ctx) {
    const tipo = S.clima === 'lluvia' || S.clima === 'tormenta' ? null : S.B.part;
    if (!tipo) return;
    if (particulas.length < (tipo === 'nieve' ? 90 : tipo === 'hojas' ? 26 : 30)) {
      particulas.push({ x: Math.random() * (W + 40) - 20, y: tipo === 'luciernagas' ? 120 + Math.random() * 60 : -5, v: Math.random(), f: Math.random() * 6 });
    }
    for (const p of particulas) {
      p.f += dt;
      if (tipo === 'nieve') { p.y += (14 + p.v * 16) * dt; p.x += (Math.sin(p.f * 1.5) * 6 - 8 * S.viento) * dt; D.rect(p.x, p.y, p.v > 0.7 ? 2 : 1, p.v > 0.7 ? 2 : 1, '#FFFFFF', ctx); }
      else if (tipo === 'hojas') { p.y += (18 + p.v * 12) * dt; p.x += (Math.sin(p.f * 2) * 14 - 12) * dt; D.rect(p.x, p.y, 2, 1, p.v > 0.5 ? '#D8602A' : '#E8A040', ctx); D.rect(p.x + (Math.sin(p.f * 4) > 0 ? 1 : 0), p.y + 1, 1, 1, '#B8401A', ctx); }
      else { p.x += Math.sin(p.f * 0.8 + p.v * 9) * 8 * dt; p.y += Math.cos(p.f * 0.6 + p.v * 5) * 5 * dt; ctx.globalAlpha = 0.5 + 0.5 * Math.sin(p.f * 3 + p.v * 20); D.rect(p.x, p.y, 1, 1, '#B8FFA0', ctx); ctx.globalAlpha = 1; if (p.f > 12) p.y = 999; }
      if (p.y > GY + 2 || p.x < -30) p.y = 999;
    }
    particulas = particulas.filter((p) => p.y < 900);
  }

  // ---------------- Oscuridad
  const capaOsc = G.lienzo(W, H);
  function halo(w, h, col) {
    const { c, x } = G.lienzo(w, h); x.fillStyle = col;
    for (let k = 0; k < 6; k++) {
      const f = 1 - k / 6, ax = w / 2 * f - 1, ay = h / 2 * f - 1; x.globalAlpha = k ? 0.2 : 0.1;
      for (let yy = -Math.floor(ay); yy <= Math.floor(ay); yy++) { const hw = Math.floor(ax * Math.sqrt(1 - yy * yy / (ay * ay))); x.fillRect(Math.round(w / 2 - hw), Math.round(h / 2 + yy), hw * 2, 1); }
    }
    return c;
  }
  const HALOS = { fogata: { c: halo(230, 130, '#FFB070'), n: 12, nc: '#FFD8A8', ancho: 9, fuerza: 1 }, farol: { c: halo(110, 64, '#FFC48A'), n: 4, nc: '#FFE0B0', ancho: 4.5, fuerza: 0.75 } };
  S.oscuridad = () => {
    const B = S.B, osc = B.osc;
    if (osc <= 0 && S.relampago <= 0) return;
    const c = capaOsc.x, ctx = C();
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.fillStyle = B.mul; c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = 'screen';
    for (const L of G.luces) {
      const h = HALOS[L.tipo]; if (!h) continue;
      const x = L.x - G.camX, hw = h.c.width, hh = h.c.height;
      if (x + hw / 2 < 0 || x - hw / 2 > W) continue;
      c.globalAlpha = osc * (0.85 + 0.15 * Math.sin(G.t * 17 + L.x));
      const x0 = Math.round(x - hw / 2), y0 = Math.round(L.y - hh / 2), corte = Math.max(0, 100 - y0);
      if (corte < hh) c.drawImage(h.c, 0, corte, hw, hh - corte, x0, y0 + corte, hw, hh - corte);
      D.disco(x, L.y, h.n, h.nc, c);
    }
    c.globalCompositeOperation = 'source-over';
    if (B.estrellas || B.astro === 'luna') {                 // luna y estrellas no se oscurecen
      c.globalAlpha = 1; c.fillStyle = '#FFFFFF';
      if (B.astro) D.disco(B.sol[0], B.sol[1], 10, '#FFFFFF', c);
      for (let i = 0; i < 110; i++) c.fillRect(Math.floor(U.hash(i, 1) * W), Math.floor(U.hash(i, 2) * 120), 1, 1);
    }
    if (S.relampago > 0) { c.globalAlpha = Math.min(1, S.relampago * 4); c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, W, H); }
    c.globalAlpha = 1;
    ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(capaOsc.c, 0, 0); ctx.globalCompositeOperation = 'source-over';
  };
  // Después de la oscuridad (se reflejan en el agua): niebla baja y partículas brillantes
  S.despues = (dt) => {
    const ctx = C(), B = S.B;
    if (B.niebla > 0 || S.clima === 'niebla') {
      const col = B.osc > 0.5 ? '#6A7898' : U.mix(B.cielo[2], '#FFFFFF', 0.3), fuerza = Math.max(B.niebla, S.clima === 'niebla' ? 1 : 0);
      for (let k = 0; k < 3; k++) {
        ctx.globalAlpha = (0.1 + k * 0.05) * fuerza;
        const off = ((G.t * (5 + k * 4) + G.camX * (0.6 + k * 0.3)) % 64 + 64) % 64;
        for (let x = -64; x < W + 64; x += 8) {
          const i = Math.floor((x + off + k * 1000) / 8), h = 6 + Math.floor(U.noise1(i * 0.3 + G.t * 0.2, k) * 12);
          D.rect(x - off, GY - 4 - h - k * 7, 8, h + 7, col);
        }
      }
      ctx.globalAlpha = 1;
    }
    particulasBioma(dt, ctx);
  };

  // ---------------- Agua: parámetros para WebGL o agua 2D de respaldo
  const agua2D = crearAgua({ ancho: W, alto: H, yAgua: WY, color: '#4E6A70' });
  S.paramsAgua = () => {
    const B = S.B, fz = U.clamp(B.osc * 1.3, 0, 1);
    const luces = [];
    for (const L of G.luces) { const h = HALOS[L.tipo]; if (h && fz > 0.05) luces.push({ x: L.x - G.camX, y: L.y, fuerza: h.fuerza * fz, ancho: h.ancho }); }
    const sol = B.astro ? { x: B.sol[0], y: B.sol[1], vis: B.astro === 'luna' ? 0.8 : 1, col: B.solC } : null;
    return { osc: B.osc, viento: S.viento, agua: B.agua, cielo: B.cielo[1], sol, luces, ondas: S.ondas };
  };
  S.agua2D = () => {
    const B = S.B, luces = [];
    for (const L of G.luces) { const h = HALOS[L.tipo]; if (h) luces.push({ x: L.x - G.camX, y: L.y, tam: L.tipo === 'fogata' ? 'grande' : 'chica', fuerza: 1 }); }
    agua2D.dibujar(G.ctx, { t: G.t, camX: G.camX, viento: S.viento, oscuridad: B.osc, colorNoche: '#141A2E', luces });
  };

  // ---------------- Lluvia (capa de interfaz: no se refleja) y ondas en el agua
  const gotas = Array.from({ length: 150 }, (_, i) => ({ x: U.hash(i, 41) * (W + 60), y: U.hash(i, 42) * H, v: 260 + U.hash(i, 43) * 120 }));
  S.lluvia = (dt) => {
    const lluvia = S.clima === 'lluvia' || S.clima === 'tormenta', ctx = C();
    // ondas: de la lluvia y, de vez en cuando, de peces
    if (lluvia && Math.random() < (S.clima === 'tormenta' ? 0.8 : 0.5)) S.ondas.push({ x: Math.random() * W, y: WY + 3 + Math.random() * 76, edad: 0, fuerza: 0.7 + Math.random() * 0.3 });
    if (!lluvia && Math.random() < 0.012) S.ondas.push({ x: Math.random() * W, y: WY + 10 + Math.random() * 60, edad: 0, fuerza: 0.6 });
    for (const o of S.ondas) o.edad += dt;
    S.ondas = S.ondas.filter((o) => o.edad < 0.8).slice(-24);
    if (!G.aguaGL.ok) for (const o of S.ondas) { const r = 1 + Math.floor(o.edad * 12); ctx.globalAlpha = 0.5 * (1 - o.edad / 0.8); D.rect(o.x - r, o.y, 1, 1, '#C0CCD8'); D.rect(o.x + r, o.y, 1, 1, '#C0CCD8'); ctx.globalAlpha = 1; }
    if (!lluvia) return;
    const inc = S.clima === 'tormenta' ? 0.35 : 0.2;
    ctx.fillStyle = S.B.osc > 0.5 ? '#7A8BB0' : '#A8B8D0';
    ctx.globalAlpha = 0.55;
    for (const g of gotas) {
      g.y += g.v * dt; g.x -= g.v * inc * dt;
      if (g.y > H) { g.y -= H + 10; g.x = Math.random() * (W + 60); }
      if (g.x < -10) g.x += W + 60;
      const x = Math.round(g.x), y = Math.round(g.y);
      ctx.fillRect(x, y, 1, 3); ctx.fillRect(x - 1, y + 3, 1, 1);
    }
    ctx.globalAlpha = 1;
  };

  S.actualizar = (dt) => {
    S.relampago = Math.max(0, S.relampago - dt);
    if (S.clima === 'tormenta') {
      S.proxRayo -= dt;
      if (S.proxRayo <= 0) { S.relampago = 0.2; S.proxRayo = 6 + Math.random() * 7; G.audio.sfx('trueno', 0.6); }
    }
  };
})(window.G);
