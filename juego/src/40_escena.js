// 40_escena.js — cielo, parallax, suelo, hogueras, meta, clima, oscuridad con halos y el agua reutilizada.
(function (G) {
  const U = G.u, D = G.d, W = G.W, H = G.H, WY = G.WY, GY = G.GY, ctx = G.ctx;
  const FASES = {
    dia:   { cielo: '#6FA3C9', hor: '#E8D7A8', mont: '#8FA7B8', arb: '#5D7A6A', mat: '#4E6B45', astro: '#FFF1C2', osc: 0, mul: '#FFFFFF' },
    tarde: { cielo: '#4F5E92', hor: '#F2A462', mont: '#8A6A7A', arb: '#5E4A52', mat: '#4C3E3A', astro: '#FFC27A', osc: 0.55, mul: '#F6D2B4' },
    noche: { cielo: '#23335E', hor: '#50608E', mont: '#2A3656', arb: '#1F2A38', mat: '#1A241E', astro: '#EEF2FF', osc: 1, mul: '#5A6894' },
  };
  const VIENTO = { despejado: 0.4, niebla: 0.2, lluvia: 0.8, tormenta: 1 };
  const S = G.escena = { fase: 'dia', clima: 'despejado', viento: 0.4, fogatas: [], meta: null, largo: 1400, relampago: 0, proxRayo: 8 };
  const agua = crearAgua({ ancho: W, alto: H, yAgua: WY });
  const capa = G.lienzo(W, H);
  const gotas = Array.from({ length: 140 }, (_, i) => ({ x: U.hash(i, 41) * (W + 60), y: U.hash(i, 42) * H, v: 260 + U.hash(i, 43) * 120 }));
  let ondas = [];

  function halo(w, h, col) {
    const { c, x } = G.lienzo(w, h); x.fillStyle = col;
    for (let k = 0; k < 5; k++) {
      const f = 1 - k / 5, ax = w / 2 * f - 1, ay = h / 2 * f - 1; x.globalAlpha = k ? 0.24 : 0.12;
      for (let yy = -Math.floor(ay); yy <= Math.floor(ay); yy++) { const hw = Math.floor(ax * Math.sqrt(1 - yy * yy / (ay * ay))); x.fillRect(Math.round(w / 2 - hw), Math.round(h / 2 + yy), hw * 2, 1); }
    }
    return c;
  }
  const HALOS = { fogata: { c: halo(220, 120, '#FFB070'), n: 12, nc: '#FFD8A8', tam: 'grande' }, farol: { c: halo(110, 62, '#FFC48A'), n: 4, nc: '#FFE0B0', tam: 'chica' } };

  S.configurar = (d) => {
    S.fase = d.fase || 'dia'; S.clima = d.clima || 'despejado'; S.viento = VIENTO[S.clima];
    S.fogatas = d.fogatas || []; S.meta = d.meta || null; S.largo = d.largo || 1400; S.relampago = 0; S.proxRayo = 5;
  };
  const F = () => FASES[S.fase];

  // ---- Fondo
  function cielo() {
    const f = F();
    for (let y = 0; y < WY; y++) { ctx.fillStyle = U.mix(f.cielo, f.hor, Math.pow(y / WY, 1.4)); ctx.fillRect(0, y, W, 1); }
    if (S.fase === 'noche') for (let i = 0; i < 70; i++) { ctx.globalAlpha = 0.5 + 0.5 * Math.sin(G.t * 2 + i); D.rect(Math.floor(U.hash(i, 1) * W), Math.floor(U.hash(i, 2) * 110), 1, 1, '#E8EEFF'); }
    ctx.globalAlpha = 1;
    if (S.clima === 'despejado' || S.clima === 'niebla') {
      const ax = S.fase === 'tarde' ? 390 : 380, ay = S.fase === 'tarde' ? 118 : 46;
      ctx.globalAlpha = 0.25; D.disco(ax, ay, 13, f.astro); ctx.globalAlpha = 1; D.disco(ax, ay, 9, f.astro);
    } else {
      // nubes bajas de tormenta
      for (let k = 0; k < 7; k++) { const x = ((k * 90 - G.camX * 0.05 - G.t * 4) % 560 + 560) % 560 - 60; ctx.globalAlpha = 0.5; D.disco(x, 30 + (k % 3) * 12, 22 + (k % 2) * 8, U.shade(f.cielo, 0.8)); }
      ctx.globalAlpha = 1;
    }
    if (S.relampago > 0) { ctx.globalAlpha = S.relampago * 2.5; D.rect(0, 0, W, WY, '#E8ECFF'); ctx.globalAlpha = 1; }
  }
  function sierra(f, y0, alto, paso, col, seed) {
    ctx.fillStyle = col;
    const cam = G.camX * f, off = ((cam % paso) + paso) % paso, base = Math.floor(cam / paso);
    for (let x = 0; x < W; x++) {
      const wx = x + off, i = Math.floor(wx / paso), u = (wx % paso) / paso;
      const h = Math.round(U.lerp(U.hash(i + base, seed), U.hash(i + base + 1, seed), u * u * (3 - 2 * u)) * alto);
      ctx.fillRect(x, y0 - h, 1, WY - (y0 - h));
    }
  }
  function arboles(f, y0, col, seed, sep) {
    const cam = G.camX * f;
    for (let k = -1; k < W / sep + 2; k++) {
      const i = k + Math.floor(cam / sep), x = Math.round(i * sep - cam + U.hash(i, seed) * sep * 0.6);
      const h = 26 + Math.floor(U.hash(i, seed + 1) * 22);
      D.rect(x, y0 - h, 3, h, col);
      D.disco(x + 1, y0 - h, 8 + Math.floor(U.hash(i, seed + 2) * 5), col);
    }
  }
  function suelo() {
    const cam = G.camX;
    D.rect(0, GY, W, WY - GY, '#5A3E26');
    const o8 = ((cam % 8) + 8) % 8;
    for (let x = -8; x < W + 8; x += 8) { const i = Math.floor((x + cam) / 8); D.rect(x - o8, GY + 5 + Math.floor(U.hash(i, 7) * 7), 4, 2, '#46301D'); }
    D.rect(0, GY, W, 2, '#6E8A3C');
    for (let x = 0; x < W; x++) {
      const i = Math.floor(x + cam);
      if (U.hash(i, 9) < 0.35) {
        const h = 1 + Math.floor(U.hash(i, 10) * 3 * (0.6 + 0.4 * Math.sin(G.t * 3 * S.viento + i * 0.3)));
        D.rect(x, GY - h, 1, h + 1, '#6E8A3C');
      }
    }
    // piedras y postes
    for (let k = -1; k < W / 90 + 2; k++) {
      const i = k + Math.floor(cam / 90), x = Math.round(i * 90 + U.hash(i, 4) * 50 - cam);
      if (U.hash(i, 5) < 0.5) D.disco(x, GY - 2, 3, '#7B7D78'); else if (U.hash(i, 6) < 0.4) D.rect(x, GY - 14, 2, 14, '#5B4430');
    }
  }
  function fogata(xw) {
    const x = Math.round(xw - G.camX);
    if (x < -20 || x > W + 20) return;
    D.rect(x - 5, GY - 3, 11, 3, '#3A2A1E'); D.rect(x - 4, GY - 4, 2, 1, '#5B4430'); D.rect(x + 2, GY - 4, 2, 1, '#5B4430');
    const f = Math.floor(G.t * 10 + xw) % 3;
    D.rect(x - 3, GY - 9 - f, 7, 6 + f, '#E8742A'); D.rect(x - 2, GY - 11 - (f === 1 ? 1 : 0), 5, 5, '#F2A33A'); D.rect(x - 1, GY - 9, 3, 4, '#FFE39A');
    if (U.hash(Math.floor(G.t * 12), xw) < 0.5) D.rect(x - 2 + Math.floor(U.hash(Math.floor(G.t * 12), xw + 1) * 5), GY - 14 - Math.floor((G.t * 20) % 6), 1, 1, '#FFB060');
    G.luces.push({ x: xw, y: GY - 7, tipo: 'fogata' });
  }
  function meta() {
    if (S.meta === null) return;
    const x = Math.round(S.meta - G.camX);
    if (x < -40 || x > W + 40) return;
    D.rect(x, GY - 58, 2, 58, '#4A3A2A'); D.rect(x - 1, GY - 60, 4, 2, '#F2C14E');
    for (let i = 0; i < 16; i++) { const ond = Math.round(Math.sin(G.t * 5 - i * 0.5) * (i / 16) * 2); D.rect(x + 2 + i, GY - 56 + ond, 1, 12, i % 8 < 4 ? '#F4F1E6' : '#E4DCC8'); }
    D.disco(x + 10, GY - 50 + Math.round(Math.sin(G.t * 5 - 4) * 1), 2, '#F2C14E');
    D.rect(x - 8, GY - 4, 18, 4, '#7B7D78');
    G.luces.push({ x: S.meta + 1, y: GY - 60, tipo: 'farol' });
  }

  S.dibujarFondo = () => {
    const f = F();
    cielo();
    sierra(0.1, 130, 40, 60, f.mont, 1);
    arboles(0.3, 168, f.arb, 20, 26);
    sierra(0.5, 172, 10, 30, f.mat, 2);
    suelo();
    meta();
    for (const x of S.fogatas) fogata(x);
  };

  // ---- Oscuridad (multiply) con halos; luna y estrellas perforadas para que no se apaguen
  S.oscuridad = () => {
    const f = F();
    if (f.osc <= 0 && S.clima !== 'tormenta') return;
    const c = capa.x, mul = S.clima === 'tormenta' && S.fase !== 'noche' ? '#9AA2B8' : f.mul;
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.fillStyle = mul; c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = 'screen';
    for (const L of G.luces) {
      const h = HALOS[L.tipo]; if (!h) continue;
      const x = L.x - G.camX, hw = h.c.width, hh = h.c.height;
      if (x + hw / 2 < 0 || x - hw / 2 > W) continue;
      c.globalAlpha = f.osc * (0.85 + 0.15 * Math.sin(G.t * 17 + L.x));
      const x0 = Math.round(x - hw / 2), y0 = Math.round(L.y - hh / 2), corte = Math.max(0, 100 - y0);
      if (corte < hh) c.drawImage(h.c, 0, corte, hw, hh - corte, x0, y0 + corte, hw, hh - corte);
      D.disco(x, L.y, h.n, h.nc, c);
    }
    if (S.fase === 'noche' && S.clima !== 'tormenta' && S.clima !== 'lluvia') {
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
      D.disco(380, 46, 9, '#FFFFFF', c);
      c.fillStyle = '#FFFFFF';
      for (let i = 0; i < 70; i++) c.fillRect(Math.floor(U.hash(i, 1) * W), Math.floor(U.hash(i, 2) * 110), 1, 1);
    }
    if (S.relampago > 0) { c.globalCompositeOperation = 'source-over'; c.globalAlpha = Math.min(1, S.relampago * 4); c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, W, H); }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(capa.c, 0, 0); ctx.globalCompositeOperation = 'source-over';
  };

  // ---- Niebla baja (antes del agua, así también se refleja)
  S.niebla = () => {
    if (S.clima !== 'niebla') return;
    const col = S.fase === 'noche' ? '#8A94B0' : '#D8D4C8';
    for (let k = 0; k < 3; k++) {
      ctx.globalAlpha = 0.16 + k * 0.05;
      const off = ((G.t * (6 + k * 4) + G.camX * (0.6 + k * 0.3)) % 64 + 64) % 64;
      for (let x = -64; x < W + 64; x += 8) {
        const i = Math.floor((x + off + k * 1000) / 8), h = 6 + Math.floor(U.noise1(i * 0.3 + G.t * 0.2, k) * 10);
        D.rect(x - off, GY - 4 - h - k * 6, 8, h + 6, col);
      }
    }
    ctx.globalAlpha = 1;
  };

  S.agua = () => {
    const f = F();
    const luces = [];
    for (const L of G.luces) { const h = HALOS[L.tipo]; if (h) luces.push({ x: L.x - G.camX, y: L.y, tam: h.tam, fuerza: 1 }); }
    agua.dibujar(ctx, { t: G.t, camX: G.camX, viento: S.viento, oscuridad: f.osc, colorNoche: '#141A2E', luces });
  };

  // ---- Lluvia (después del agua: gotas en el aire y ondas en la superficie)
  S.lluvia = (dt) => {
    if (S.clima !== 'lluvia' && S.clima !== 'tormenta') return;
    const inc = S.clima === 'tormenta' ? 0.35 : 0.2;
    ctx.fillStyle = S.fase === 'noche' ? '#6E7FA0' : '#A8B8D0';
    ctx.globalAlpha = 0.55;
    for (const g of gotas) {
      g.y += g.v * dt; g.x -= g.v * inc * dt;
      if (g.y > H) { g.y -= H + 10; g.x = Math.random() * (W + 60); }
      if (g.x < -10) g.x += W + 60;
      const x = Math.round(g.x), y = Math.round(g.y);
      ctx.fillRect(x, y, 1, 3); ctx.fillRect(x - 1, y + 3, 1, 1);
      if (y > WY + 2 && Math.random() < 0.02) ondas.push({ x, y, v: 0 });
    }
    if (Math.random() < (S.clima === 'tormenta' ? 0.9 : 0.5)) ondas.push({ x: Math.random() * W, y: WY + 3 + Math.random() * 74, v: 0 });
    ctx.globalAlpha = 0.5;
    for (const o of ondas) { o.v += dt; const r = 1 + Math.floor(o.v * 10); ctx.fillRect(Math.round(o.x - r), Math.round(o.y), 1, 1); ctx.fillRect(Math.round(o.x + r), Math.round(o.y), 1, 1); }
    ondas = ondas.filter((o) => o.v < 0.35);
    ctx.globalAlpha = 1;
  };

  S.actualizar = (dt) => {
    S.relampago = Math.max(0, S.relampago - dt);
    if (S.clima === 'tormenta') {
      S.proxRayo -= dt;
      if (S.proxRayo <= 0) { S.relampago = 0.18; S.proxRayo = 6 + Math.random() * 7; G.audio.sfx('jefe', 0.5); }
    }
  };
})(window.G);
