// 40_light.js — ciclo día/noche, cielo, sol y luna, estrellas, oscuridad con halos,
// luciérnagas y número del día. Publica K.env para el resto de módulos.
(function (K) {
  const U = K.util, C = K.CONFIG, P = K.params;
  const W = K.W, H = K.H;
  const PH = C.phases;
  const CYCLE = PH.reduce((s, p) => s + p.len, 0);
  const START = []; { let a = 0; for (const p of PH) { START.push(a); a += p.len; } }
  const NIGHT = PH.findIndex((p) => p.name === 'night');
  const SUN_SPAN = CYCLE - PH[NIGHT].len; // amanecer + día + atardecer

  const env = K.env = {
    phase: 'day', phaseIndex: 1, phaseT: 0, cycleT: 0, day: 1,
    sky: '#98BEEC', horizon: '#C4DAF1', haze: '#F3F1E8', sun: '#FFF766',
    darkness: 0, darkColor: C.darkColor, mulColor: '#FFFFFF', wind: 1,
    night: 0, bloodMoon: !!(P.blood || P.phase === 'blood'), timeScale: 1,
    sunX: 0, sunY: 0, sunVis: 0, moonX: 0, moonY: 0, moonVis: 0,
  };

  // Tiempo absoluto del ciclo: 0 = inicio del primer amanecer.
  let cycleT = C.startCycleT;
  if (P.phase) {
    const name = P.phase === 'blood' ? 'night' : P.phase;
    const i = PH.findIndex((p) => p.name === name);
    if (i >= 0) cycleT = START[i] + PH[i].blend + (PH[i].len - PH[i].blend) * 0.5;
  }
  if (P.cyc !== undefined) cycleT = P.cyc;

  const presetOf = (i) => (PH[i].name === 'night' && env.bloodMoon ? C.presets.blood : C.presets[PH[i].name]);

  function computeEnv() {
    const t = U.mod(cycleT, CYCLE);
    let i = 0;
    for (let k = 0; k < PH.length; k++) if (t >= START[k]) i = k;
    const u = t - START[i];
    const cur = presetOf(i), prev = presetOf((i + PH.length - 1) % PH.length);
    const b = U.smoothstep(u / PH[i].blend);
    env.phase = PH[i].name; env.phaseIndex = i; env.phaseT = u; env.cycleT = t;
    env.day = 1 + Math.floor(cycleT / CYCLE);
    env.sky = U.lerpColor(prev.sky, cur.sky, b);
    env.horizon = U.lerpColor(prev.horizon, cur.horizon, b);
    env.haze = U.lerpColor(prev.haze, cur.haze, b);
    env.sun = U.lerpColor(prev.sun, cur.sun, b);
    env.darkness = U.lerp(prev.darkness, cur.darkness, b);
    env.darkColor = U.lerpColor(prev.darkColor || C.darkColor, cur.darkColor || C.darkColor, b);
    env.wind = P.wind !== undefined ? P.wind : U.lerp(prev.wind, cur.wind, b);
    env.mulColor = U.lerpColor('#FFFFFF', env.darkColor, env.darkness);
    // Cuánto "es de noche" (estrellas, luna, luciérnagas).
    env.night = i === NIGHT ? b : (i + PH.length - 1) % PH.length === NIGHT ? 1 - b : 0;

    // Sol y luna fijos a la pantalla, en arco.
    if (i !== NIGHT) {
      const s = U.mod(t - START[0], CYCLE) / SUN_SPAN;
      env.sunX = Math.round(34 + s * (W - 68));
      env.sunY = Math.round(178 - Math.sin(Math.PI * s) * 150);
      env.sunVis = 1; env.moonVis = 0;
    } else {
      const s = u / PH[NIGHT].len;
      env.moonX = Math.round(34 + s * (W - 68));
      env.moonY = Math.round(178 - Math.sin(Math.PI * s) * 140);
      env.moonVis = 1; env.sunVis = 0;
    }
  }

  // ---- Estrellas (fijas a la pantalla)
  const rs = U.mulberry32(991);
  const stars = Array.from({ length: 80 }, () => ({ x: Math.floor(rs() * W), y: Math.floor(rs() * 118) + 2, p: rs() * 6.28, big: rs() < 0.12 }));

  // ---- Luciérnagas: nacen sobre bosque y pradera
  const flies = [];
  { const rf = U.mulberry32(4242);
    for (const z of K.MAP.zones) {
      if (z.type !== 'forest' && z.type !== 'meadow') continue;
      const n = Math.round((z.x1 - z.x0) / 22);
      for (let k = 0; k < n; k++) flies.push({ x0: z.x0 + rf() * (z.x1 - z.x0), y0: 128 + rf() * 48, s: Math.floor(rf() * 1000), x: 0, y: 0, a: 0 });
    }
  }
  let flyAmount = 0;

  // ---- Halos escalonados (4–5 anillos) para la capa de oscuridad
  function makeHalo(size, color, rings = 5) {
    const { c, x } = U.canvas(size, size), r = size / 2;
    x.globalAlpha = 0.24;
    for (let k = 0; k < rings; k++) U.disc(x, r, r, Math.max(1, Math.floor(r * (1 - k / rings)) - 1), color);
    return c;
  }
  const HALO = {
    firefly: { c: makeHalo(64, '#C8FFD2', 4), power: 0.5 },
    torch:   { c: makeHalo(128, '#FFE2B8'), power: 0.95 },
    fire:    { c: makeHalo(256, '#FFD9A6'), power: 1 },
  };
  const dark = U.canvas(W, H);

  // ---- Número del día en romanos
  const ROMAN = {
    I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
    V: ['#...#', '#...#', '#...#', '.#.#.', '.#.#.', '.#.#.', '..#..'],
    X: ['#...#', '.#.#.', '.#.#.', '..#..', '.#.#.', '.#.#.', '#...#'],
    L: ['###..', '.#...', '.#...', '.#...', '.#...', '.#..#', '#####'],
    C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  };
  const toRoman = (n) => {
    const t = [[100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    let s = ''; for (const [v, r] of t) while (n >= v) { s += r; n -= v; } return s;
  };
  function drawRoman(ctx, str, cx, y, col, s) {
    const widths = [...str].map((ch) => ROMAN[ch][0].length);
    const total = widths.reduce((a, b) => a + b, 0) * s + (str.length - 1) * 2 * s;
    let x = Math.round(cx - total / 2);
    ctx.fillStyle = col;
    [...str].forEach((ch, k) => {
      ROMAN[ch].forEach((row, ry) => { for (let rx = 0; rx < row.length; rx++) if (row[rx] === '#') ctx.fillRect(x + rx * s, y + ry * s, s, s); });
      x += (widths[k] + 2) * s;
    });
  }
  let bannerDay = 1, bannerT0 = 0;

  K.register('light', {
    order: 5,
    key(code) {
      if (code === 'KeyT') {
        const t = U.mod(cycleT, CYCLE);
        let i = 0; for (let k = 0; k < PH.length; k++) if (t >= START[k]) i = k;
        const next = (i + 1) % PH.length;
        cycleT += U.mod(START[next] - t, CYCLE) || CYCLE;
      } else if (code === 'KeyY') {
        env.bloodMoon = !env.bloodMoon;
      } else if (code === 'KeyG') {
        env.timeScale = env.timeScale === 1 ? C.fastForward : 1;
      }
    },
    update(dt) {
      if (!P.freeze) cycleT += dt * env.timeScale;
      const prevDay = env.day;
      computeEnv();
      if (env.day !== prevDay) { bannerDay = env.day; bannerT0 = K.t; }

      // Luces fijas a la pantalla (sol y luna) para las columnas del agua.
      if (env.moonVis) K.lights.push({ type: 'moon', x: env.moonX, y: env.moonY, screen: true, power: 1 });
      if (env.sunVis) K.lights.push({ type: 'sun', x: env.sunX, y: env.sunY, screen: true, power: 1 });

      // Luciérnagas en noches sin viento.
      flyAmount = env.night * U.clamp((0.4 - env.wind) / 0.15, 0, 1);
      if (flyAmount > 0.02) {
        const t = K.t;
        for (const f of flies) {
          f.x = f.x0 + (U.noise1(t * 0.25 + f.s, 3) - 0.5) * 60;
          f.y = f.y0 + (U.noise1(t * 0.35 + f.s, 5) - 0.5) * 26;
          f.a = U.clamp(Math.sin(t * 1.7 + f.s) * 1.6 - 0.2, 0, 1) * flyAmount;
          if (f.a > 0.08 && K.onScreen(f.x, 1, 1, 40)) K.lights.push({ type: 'firefly', x: f.x, y: f.y, power: f.a });
        }
      }
    },
    drawSky(ctx) {
      // Degradado de 3 colores: cielo → horizonte → bruma.
      for (let y = 0; y < K.WATER_Y; y++) {
        const col = y < 112 ? U.lerpColor(env.sky, env.horizon, Math.pow(y / 112, 1.3)) : U.lerpColor(env.horizon, env.haze, U.clamp((y - 112) / 64, 0, 1));
        ctx.fillStyle = col; ctx.fillRect(0, y, W, 1);
      }
      // Estrellas
      if (env.night > 0.02) {
        for (const s of stars) {
          const tw = 0.55 + 0.45 * Math.sin(K.t * 2.2 + s.p);
          ctx.globalAlpha = env.night * tw * (s.y < 90 ? 1 : 0.5);
          ctx.fillStyle = s.big ? '#FFFFFF' : '#CFE0FF';
          ctx.fillRect(s.x, s.y, 1, 1);
          if (s.big && tw > 0.8) { ctx.fillRect(s.x - 1, s.y, 3, 1); ctx.fillRect(s.x, s.y - 1, 1, 3); }
        }
        ctx.globalAlpha = 1;
      }
      // Sol
      if (env.sunVis) {
        ctx.globalAlpha = 0.18; U.disc(ctx, env.sunX, env.sunY, 16, env.sun);
        ctx.globalAlpha = 0.3; U.disc(ctx, env.sunX, env.sunY, 12, env.sun);
        ctx.globalAlpha = 1; U.disc(ctx, env.sunX, env.sunY, 9, env.sun);
        U.disc(ctx, env.sunX - 2, env.sunY - 2, 4, U.lerpColor(env.sun, '#FFFFFF', 0.45));
      }
      // Luna
      if (env.moonVis) {
        const mc = env.sun;
        ctx.globalAlpha = 0.14 * env.night; U.disc(ctx, env.moonX, env.moonY, 14, mc);
        ctx.globalAlpha = 1; U.disc(ctx, env.moonX, env.moonY, 8, mc);
        const cr = U.shade(mc, 0.82);
        U.disc(ctx, env.moonX - 3, env.moonY - 2, 2, cr);
        U.disc(ctx, env.moonX + 3, env.moonY + 2, 1, cr);
        U.px(ctx, env.moonX + 1, env.moonY - 4, cr);
        U.px(ctx, env.moonX - 2, env.moonY + 4, cr);
      }
    },
    drawFront(ctx) {
      if (flyAmount <= 0.02) return;
      for (const f of flies) {
        if (f.a <= 0.05) continue;
        const sx = K.sx(f.x);
        if (sx < -2 || sx > W + 2) continue;
        ctx.globalAlpha = Math.min(1, f.a * 1.4);
        ctx.fillStyle = '#7AFFA0';
        ctx.fillRect(sx, Math.round(f.y), 1, 1);
      }
      ctx.globalAlpha = 1;
    },
    drawDarkness(ctx) {
      if (env.darkness < 0.003) return;
      const d = dark.x;
      d.globalCompositeOperation = 'source-over';
      d.globalAlpha = 1;
      d.fillStyle = env.mulColor; d.fillRect(0, 0, W, H);
      // Los halos (en screen) aclaran la capa de oscuridad alrededor de cada luz.
      const strength = U.clamp(env.darkness / 0.2, 0, 1);
      d.globalCompositeOperation = 'screen';
      for (const L of K.lights) {
        const h = HALO[L.type];
        if (!h) continue;
        const sx = L.screen ? L.x : K.sx(L.x);
        const half = h.c.width / 2;
        if (sx + half < 0 || sx - half > W) continue;
        const flick = (U.noise1(K.t * 7 + L.x * 0.13, 11) - 0.5) * 0.15;
        d.globalAlpha = U.clamp(h.power * (L.power ?? 1) * strength * (0.85 + flick), 0, 1);
        d.drawImage(h.c, Math.round(sx - half), Math.round(L.y - half));
      }
      d.globalCompositeOperation = 'source-over';
      d.globalAlpha = 1;
      ctx.globalCompositeOperation = 'multiply';
      ctx.drawImage(dark.c, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
    },
    drawUI(ctx) {
      // Al amanecer aparece el número del día y se desvanece. También al arrancar.
      const age = K.t - bannerT0;
      if (age > 5 || P.shot) return;
      const a = age < 0.8 ? age / 0.8 : age > 3.8 ? U.clamp((5 - age) / 1.2, 0, 1) : 1;
      const str = toRoman(bannerDay);
      ctx.globalAlpha = a * 0.55; drawRoman(ctx, str, W / 2 + 1, 43, '#1E1A1A', 2);
      ctx.globalAlpha = a; drawRoman(ctx, str, W / 2, 42, '#F4E9D0', 2);
      ctx.globalAlpha = 1;
    },
  });

  computeEnv();
  bannerDay = env.day;
})(window.K);
