// 90_main.js — bucle principal, escalado entero, entrada, cámara, pasadas de dibujo y modos de prueba.
(function (K) {
  const U = K.util, C = K.CONFIG, P = K.params;
  const W = K.W, H = K.H;

  // Orden de pasadas. Cada módulo implementa las que necesite (todas opcionales).
  const PASSES = [
    ['sky', 'drawSky'],           // cielo, estrellas, sol y luna (fijos a pantalla)
    ['parallax', 'drawParallax'], // montañas 0.05, colinas 0.15, árboles lejanos 0.3, juncos 0.5
    ['ground', 'drawGround'],     // franja de tierra y hierba (170–190)
    ['back', 'drawBack'],         // árboles del plano, edificios, fauna
    ['player', 'drawPlayer'],     // caballo y monarca
    ['front', 'drawFront'],       // hierba y juncos delante de los cascos, luciérnagas
    ['darkness', 'drawDarkness'], // oscuridad × halos (multiply)
    ['water', 'drawWater'],       // reflejo del río (190–270)
    ['overlay', 'drawOverlay'],   // peces, niebla de primer plano (1.5)
    ['ui', 'drawUI'],             // número del día
  ];

  const errEl = document.getElementById('err');
  const outEl = document.getElementById('out');
  const errors = new Set();
  function report(where, e) {
    const msg = `${where}: ${e && e.message ? e.message : e}`;
    if (errors.has(msg)) return;
    errors.add(msg);
    console.error(msg, e && e.stack ? e.stack : '');
    errEl.style.display = 'block';
    errEl.textContent = [...errors].join('\n');
  }
  window.addEventListener('error', (e) => report(`${(e.filename || '').split('/').pop()}:${e.lineno}`, e.error || e.message));

  // ?mods=light,horse limita los módulos activos (útil para probar uno solo).
  const only = P.mods ? String(P.mods).split(',') : null;
  const mods = () => Object.values(K.mods).filter((m) => !only || only.includes(m.name)).sort((a, b) => (a.order ?? 50) - (b.order ?? 50));
  let list = [];

  // ---- Lienzos
  const view = document.getElementById('view');
  const vctx = view.getContext('2d');
  K.buf = document.createElement('canvas');
  K.buf.width = W; K.buf.height = H;
  K.bctx = K.buf.getContext('2d', { willReadFrequently: true });
  K.bctx.imageSmoothingEnabled = false;

  let scale = 1;
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const fit = Math.min((innerWidth * dpr) / W, (innerHeight * dpr) / H);
    scale = P.scale ? P.scale : Math.max(1, Math.floor(fit));
    const dprUsed = P.scale ? 1 : dpr;
    view.width = W * scale; view.height = H * scale;
    let cssW = view.width / dprUsed, cssH = view.height / dprUsed;
    // Ventana más pequeña que 480×270: se reduce para que quepa entera (los píxeles dejan de ser exactos).
    if (!P.scale && fit < 1) { cssW = (W * fit) / dpr; cssH = (H * fit) / dpr; }
    view.style.width = cssW + 'px'; view.style.height = cssH + 'px';
    view.style.left = Math.floor((innerWidth - cssW) / 2) + 'px';
    view.style.top = Math.floor((innerHeight - cssH) / 2) + 'px';
    vctx.imageSmoothingEnabled = false;
  }
  window.addEventListener('resize', resize);

  // ---- Entrada (por e.code, así Shift no cambia la tecla)
  const held = new Set();
  const GAME_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyA', 'KeyD', 'ShiftLeft', 'ShiftRight']);
  window.addEventListener('keydown', (e) => {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (e.repeat) return;
    held.add(e.code);
    K.input.taps.push({ code: e.code, t: K.t });
    if (e.code === 'KeyF') K.debug = !K.debug;
    for (const m of list) if (m.key) { try { m.key(e.code); } catch (err) { report(m.name + '.key', err); } }
  });
  window.addEventListener('keyup', (e) => held.delete(e.code));
  window.addEventListener('blur', () => held.clear());
  function readInput() {
    K.input.left = held.has('KeyA') || held.has('ArrowLeft');
    K.input.right = held.has('KeyD') || held.has('ArrowRight');
    K.input.gallop = held.has('ShiftLeft') || held.has('ShiftRight');
  }
  // Entrada simulada para capturas: ?hold=right,gallop
  const simHold = P.hold ? String(P.hold).split(',') : [];

  // ---- Cámara: horizontal, adelantada hacia donde mira el monarca, suavizada e independiente de los Hz.
  function updateCamera(dt, snap) {
    const p = K.player;
    if (P.cam !== undefined) { K.camX = U.clamp(P.cam, 0, K.WORLD_W - W); }
    else if (p) {
      const target = U.clamp(p.x + C.camLead * (p.dir || 1) - W / 2, 0, K.WORLD_W - W);
      if (snap) K.camX = target;
      else {
        const k = 1 - Math.pow(0.9, dt * 60), maxd = C.camMaxSpeed * dt;
        K.camX += U.clamp((target - K.camX) * k, -maxd, maxd);
      }
    }
    // Se redondea el desfase jinete-cámara, no cada posición por separado: así el jinete no tiembla 1 px.
    const px = p ? p.x : K.camX;
    K.camXi = Math.round(px) - Math.round(px - K.camX);
  }

  // ---- Paso de simulación
  function step(dt) {
    K.dt = dt; K.t += dt; K.frame++;
    readInput();
    for (const h of simHold) { if (h === 'left') K.input.left = true; if (h === 'right') K.input.right = true; if (h === 'gallop') K.input.gallop = true; }
    K.lights.length = 0;
    for (const m of list) if (m.update) { try { m.update(dt); } catch (e) { report(m.name + '.update', e); } }
    updateCamera(dt, K.frame === 1);
    K.input.taps.length = 0;
  }

  // ---- Grano de película
  const grain = [];
  { const rg = U.mulberry32(77);
    for (let k = 0; k < 4; k++) {
      const { c, x } = U.canvas(W, H), img = x.createImageData(W, H), d = img.data;
      for (let i = 0; i < d.length; i += 4) { const v = rg() < 0.5 ? 0 : 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = Math.floor(rg() * 255); }
      x.putImageData(img, 0, 0); grain.push(c);
    }
  }

  // ---- Dibujo
  const perf = {}; let timing = false;
  function render() {
    const ctx = K.bctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);

    const view = P.view && K.views[P.view];
    if (view) {
      ctx.fillStyle = P.bg ? '#' + P.bg : '#5C6B5A'; ctx.fillRect(0, 0, W, H);
      try { view(ctx, K.t); } catch (e) { report('view ' + P.view, e); }
    } else {
      for (const [pass, fn] of PASSES) {
        const t0 = timing ? performance.now() : 0;
        for (const m of list) {
          if (!m[fn]) continue;
          ctx.save();
          try { m[fn](ctx); } catch (e) { report(`${m.name}.${fn}`, e); }
          ctx.restore();
        }
        if (pass === 'overlay' && C.grain > 0) {
          ctx.globalAlpha = C.grain; ctx.drawImage(grain[Math.floor(K.t * 12) % grain.length], 0, 0); ctx.globalAlpha = 1;
        }
        if (pass === 'ui' && K.debug) drawDebug(ctx);
        if (timing) perf[pass] = (perf[pass] || 0) + performance.now() - t0;
      }
    }
    vctx.drawImage(K.buf, 0, 0, W * scale, H * scale);
  }

  let fps = 60;
  function drawDebug(ctx) {
    const p = K.player || {}, e = K.env || {};
    const lines = [
      `FPS ${Math.round(fps)}`,
      `ESTAMINA ${p.stamina !== undefined ? Math.round(p.stamina * 100) + '%' : '-'}${p.boost > 0 ? ' +' + Math.ceil(p.boost) : ''}`,
      `X ${Math.round(p.x || 0)} ${p.state || ''}`,
      `${e.phase || ''} DIA ${e.day || ''} VIENTO ${(e.wind ?? 0).toFixed(2)}${e.timeScale > 1 ? ' ×' + e.timeScale : ''}${e.bloodMoon ? ' SANGRE' : ''}`,
    ];
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(2, 2, 118, lines.length * 7 + 3);
    lines.forEach((l, i) => U.text(ctx, l, 4, 4 + i * 7, '#FFFFFF'));
  }

  // ---- ?keytest=1: envía eventos de teclado reales y avanza la simulación a 60 Hz; resultado en #out.
  function keyTest() {
    const log = [];
    const key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }));
    const run = (s) => { for (let i = 0, n = Math.round(s * 60); i < n; i++) step(1 / 60); };
    const p = () => K.player, e = () => K.env;
    const snap = (tag) => log.push(`${tag.padEnd(26)} x=${p().x.toFixed(1)} vx=${p().vx.toFixed(1)} ${p().state} est=${(p().stamina * 100).toFixed(0)}% boost=${(p().boost || 0).toFixed(1)} dir=${p().dir} cam=${K.camX.toFixed(1)} fase=${e().phase}`);
    run(0.5); snap('inicio');
    key('KeyD', true); run(2); snap('D 2 s (paso)');
    key('ShiftLeft', true); run(3); snap('D+Shift 3 s (galope)');
    key('ShiftLeft', false); key('KeyD', false); run(1.5); snap('suelta 1.5 s');
    key('KeyA', true); run(1.5); snap('A 1.5 s (gira)');
    key('KeyA', false); run(1); snap('suelta A');
    key('KeyD', true); run(0.1); key('KeyD', false); run(0.1); key('KeyD', true); run(1.5); snap('doble toque D 1.5 s');
    key('ShiftLeft', true); run(8); snap('galope +8 s');
    run(6); snap('galope +14 s');
    run(3); snap('galope +17 s (agotado)');
    key('ShiftLeft', false); key('KeyD', false); run(0.5);
    key('ShiftLeft', true); key('KeyD', true); run(0.3); snap('pide galope sin estamina');
    run(1); key('ShiftLeft', false); key('KeyD', false); run(1.5); snap('suelta');
    run(3); snap(`quieto 3 s en ${K.terrainAt(p().x)}`);
    p().x = 1500; run(5); snap(`quieto 5 s en ${K.terrainAt(p().x)} (x=1500)`);
    key('ShiftLeft', true); key('KeyD', true); run(3); snap('galope con boost 3 s');
    key('ShiftLeft', false); key('KeyD', false); run(1.5);
    const c0 = e().cycleT; key('KeyG', true); key('KeyG', false); run(2.4);
    log.push(`G: 2.4 s reales avanzan ${(e().cycleT - c0).toFixed(1)} s de ciclo (esperado 24)`);
    key('KeyG', true); key('KeyG', false);
    const f0 = e().phase; key('KeyT', true); key('KeyT', false); run(0.1); log.push(`T: ${f0} -> ${e().phase}`);
    key('KeyY', true); key('KeyY', false); run(0.1); log.push(`Y: sangre=${e().bloodMoon}`);
    const d0 = K.debug; key('KeyF', true); key('KeyF', false); log.push(`F: debug ${d0} -> ${K.debug}`);
    outEl.style.display = 'block';
    outEl.textContent = log.join('\n');
    document.title = 'READY';
  }

  // ---- Arranque
  function init() {
    list = mods();
    for (const m of list) if (m.init) { try { m.init(); } catch (e) { report(m.name + '.init', e); } }
    resize();
  }

  // main.js es el último script del body: todos los módulos ya están registrados.
  (function start() {
    init();
    if (P.bench) {
      // ?bench=1: simula y dibuja N frames seguidos y muestra el tiempo por pasada.
      const N = P.bench > 1 ? P.bench : 300;
      for (let i = 0; i < 30; i++) step(1 / 60);
      timing = true;
      const t0 = performance.now();
      for (let i = 0; i < N; i++) { step(1 / 60); render(); }
      const total = (performance.now() - t0) / N;
      timing = false;
      const rows = Object.entries(perf).map(([k, v]) => `${k.padEnd(9)} ${(v / N).toFixed(3)} ms`);
      outEl.style.display = 'block';
      outEl.textContent = `BENCH ${N} frames: ${total.toFixed(3)} ms/frame (update+render)\n` + rows.join('\n');
      document.title = 'READY';
      return;
    }
    if (P.keytest) { keyTest(); return; }
    if (P.shot) {
      // ?shot=1: simula `sim` segundos a 60 Hz y dibuja un único frame para la captura.
      const steps = Math.max(1, Math.round((P.sim ?? 1.5) * 60));
      for (let i = 0; i < steps; i++) step(1 / 60);
      render();
      document.title = 'READY';
      // ?dump=1: exporta el buffer 480×270 como PNG en #out (lo lee tools/shot.py).
      if (P.dump) { outEl.textContent = K.buf.toDataURL('image/png'); }
      return;
    }
    let last = performance.now();
    function frame(now) {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      if (dt > 0) fps = U.lerp(fps, 1 / dt, 0.05);
      step(dt);
      render();
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  })();
})(window.K);
