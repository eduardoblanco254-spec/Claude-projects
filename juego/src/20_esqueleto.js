// 20_esqueleto.js — stickman pixel art reutilizable (tropa, enemigos y jefe).
// Cadera → torso → cabeza; piernas y brazos de 2 huesos resueltos con IK (ley de cosenos).
// Pies con memoria: un pie apoyado queda clavado en su punto del MUNDO y solo cambia de sitio dando un
// paso, así nunca patina aunque la cadera acelere, frene, retroceda o dé una estocada.
(function (G) {
  const U = G.u, D = G.d, BEAT = G.BEAT;

  function ik(ax, ay, bx, by, l1, l2, dobla) {
    let dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy) || 0.001;
    const max = l1 + l2 - 0.01;
    if (d > max) { bx = ax + dx / d * max; by = ay + dy / d * max; d = max; }
    const a = Math.atan2(by - ay, bx - ax);
    const c = U.clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
    const ang = a + dobla * Math.acos(c);
    return { jx: ax + Math.cos(ang) * l1, jy: ay + Math.sin(ang) * l1, ex: bx, ey: by };
  }
  function miembro(ax, ay, bx, by, l1, l2, dobla, col, gr) {
    const r = ik(ax, ay, bx, by, l1, l2, dobla);
    D.linea(ax, ay, r.jx, r.jy, col, gr); D.linea(r.jx, r.jy, r.ex, r.ey, col, gr);
    return r;
  }

  function moverPie(pie, dest, s, lift) {
    const u = U.clamp(s, 0, 1);
    pie.x = pie.sw.desde + (dest - pie.sw.desde) * U.smooth(u);
    pie.y = G.GY - 1 - lift * Math.sin(Math.PI * u);
  }
  function actualizarPies(e, hipW, vx, reposo, dt) {
    const s = e.escala, velo = Math.abs(vx);
    if (!e.pies) e.pies = reposo.map((o) => ({ x: hipW + o, y: G.GY - 1, sw: null }));
    const marcha = velo > 2;
    const ciclo = velo > 35 ? BEAT / 2 : BEAT;
    const p = (((G.t - e.retraso) % ciclo) + ciclo) % ciclo / ciclo;
    e.pFase = p; e.marcha = marcha;
    e.pies.forEach((pie, k) => {
      if (marcha) {
        const u = (p + k * 0.5) % 1;
        if (u < 0.5) {
          if (pie.sw) { pie.x = pie.sw.dest; pie.sw = null; }
          pie.y = G.GY - 1;
        } else {
          const s2 = (u - 0.5) / 0.5;
          if (!pie.sw) pie.sw = { desde: pie.x, s: 0, dur: ciclo / 2 };
          pie.sw.s = s2;
          pie.sw.dest = hipW + vx * (1 - s2) * ciclo / 2 + Math.sign(vx) * velo * ciclo / 4;
          moverPie(pie, pie.sw.dest, s2, 3 * s);
        }
      } else {
        const dest = hipW + reposo[k];
        if (pie.sw) {
          if (pie.sw.dur === undefined || pie.sw.dur <= 0) pie.sw.dur = 0.16;
          pie.sw.s += dt / pie.sw.dur;
          pie.sw.dest = dest;
          moverPie(pie, dest, pie.sw.s, 2 * s);
          if (pie.sw.s >= 1) { pie.x = dest; pie.y = G.GY - 1; pie.sw = null; }
        } else if (Math.abs(pie.x - dest) > 1.5 * s && !e.pies[1 - k].sw) {
          pie.sw = { desde: pie.x, s: 0, dur: 0.16, dest };
        }
      }
    });
  }

  // ---- Accesorios con carisma
  // Bufanda: cadena de 5 puntos (verlet) anclada al cuello, en coordenadas de mundo; el viento y la
  // velocidad la hacen ondear hacia atrás.
  function bufanda(e, nx, ny, col, s, vx, dt) {
    const ax = nx + G.camX, n = 6, L = 2.2 * s;
    if (!e.buf) e.buf = Array.from({ length: n }, (_, i) => ({ x: ax - e.dir * i * L, y: ny + i, px: ax - e.dir * i * L, py: ny + i }));
    const viento = (G.escena ? G.escena.viento : 0.4) * 22, h = Math.min(0.05, dt);
    const b = e.buf;
    b[0].x = ax; b[0].y = ny; b[0].px = ax; b[0].py = ny;
    for (let i = 1; i < n; i++) {
      const p = b[i], vxp = (p.x - p.px) * 0.9, vyp = (p.y - p.py) * 0.9;
      p.px = p.x; p.py = p.y;
      p.x += vxp - viento * h * h * 12 + Math.sin(G.t * 7 + i) * 0.04;
      p.y += vyp + 30 * h * h * 12;
    }
    for (let it = 0; it < 3; it++) for (let i = 1; i < n; i++) {
      const a = b[i - 1], p = b[i], dx = p.x - a.x, dy = p.y - a.y, d = Math.hypot(dx, dy) || 0.001;
      p.x = a.x + dx / d * L; p.y = a.y + dy / d * L;
    }
    for (let i = 1; i < n; i++) D.linea(b[i - 1].x - G.camX, b[i - 1].y, b[i].x - G.camX, b[i].y, i === n - 1 ? U.shade(col, 0.8) : col, Math.max(1, Math.round(s * (i < 3 ? 2 : 1))));
  }
  // Tocados por clase; g = { tipo, col (metal/tela), pluma }
  function gorro(g, cx, cy, d, s, col) {
    const R = (x, y, w, h, c) => D.rect(d > 0 ? cx + x * s : cx - (x + w - 1) * s - (s - 1), cy + y * s, w * s, h * s, c);
    if (g.tipo === 'yelmo') {                       // escudero: casco redondo con nasal y cresta
      R(-3, -4, 7, 2, g.col); R(-4, -2, 9, 2, g.col); R(-4, 0, 1, 3, g.col); R(2, 0, 1, 3, g.col);
      R(-1, -5, 3, 1, g.pluma || g.col); if (g.pluma) R(-2, -6, 5, 1, g.pluma);
    } else if (g.tipo === 'punta') {                // lancero: casco cónico con pluma que se mece
      R(0, -7, 1, 2, g.col); R(-1, -5, 3, 1, g.col); R(-2, -4, 5, 1, g.col); R(-3, -3, 7, 2, g.col);
      if (g.pluma) { const m = Math.round(Math.sin(G.t * 6 + cx) * 0.8); R(-2 + m, -9, 1, 3, g.pluma); R(-3 + m, -10, 1, 2, g.pluma); }
    } else if (g.tipo === 'capucha') {              // arquero: capucha con pico hacia atrás
      R(-3, -4, 7, 2, g.col); R(-4, -2, 2, 5, g.col); R(-5, -3, 1, 3, g.col); R(-6, -1, 1, 2, g.col);
      if (g.pluma) R(2, -6, 1, 3, g.pluma);
    } else if (g.tipo === 'sombrero') {             // abanderado: sombrero de ala ancha con pluma
      R(-6, -3, 13, 1, g.col); R(-3, -6, 7, 3, g.col); R(-3, -4, 7, 1, g.cinta || '#B8322A');
      R(3, -9, 1, 4, g.pluma || '#F2C14E'); R(4, -10, 1, 2, g.pluma || '#F2C14E');
    } else if (g.tipo === 'mascara') {              // enemigos: máscara de hueso con rendijas y cuernos
      R(-1, -3, 5, 6, g.col); R(0, -1, 1, 1, '#1A0A0A'); R(2, -1, 1, 1, '#1A0A0A'); R(1, 2, 1, 1, '#1A0A0A');
      R(-3, -6, 1, 3, g.cuerno || g.col); R(-4, -8, 1, 2, g.cuerno || g.col); R(3, -6, 1, 2, g.cuerno || g.col); R(4, -8, 1, 2, g.cuerno || g.col);
      if (g.corona) { R(-3, -5, 7, 1, g.corona); R(-3, -7, 1, 2, g.corona); R(0, -8, 1, 3, g.corona); R(3, -7, 1, 2, g.corona); }
    }
  }

  const E = G.esq = {
    crear(o = {}) {
      return Object.assign({ escala: 1, color: '#15131A', torso: 9, retraso: 0, oido: 0.6, dir: 1, pies: null, pFase: 0, marcha: false }, o);
    },
    // pose: { hipW, vx, hop, agache, incl, cab, mira, reposo:[a,b] (locales), atras:{x,y}, frente:{x,y}, color, dt }
    dibujar(e, pose) {
      const s = e.escala, dir = e.dir, col = pose.color || e.color;
      const gr = Math.max(1, Math.round(s)), MU = 6 * s, PI = 6 * s, BR = 5 * s, AN = 5 * s;
      const reposo = (pose.reposo || [-2, 3]).map((v) => v * s * dir);
      actualizarPies(e, pose.hipW, pose.vx || 0, dir > 0 ? reposo : reposo.slice().reverse(), pose.dt || G.dt);
      const bob = e.marcha ? (0.5 + 0.5 * Math.cos(4 * Math.PI * e.pFase)) * s : 0;
      const hop = pose.hop || 0;
      const hxW = pose.hipW, hx = hxW - G.camX;
      const hy = G.GY - (MU + PI) + s + bob - hop + (pose.agache || 0) * s;
      // Piernas (la de atrás primero)
      for (const pie of e.pies) {
        const fy = pie.y - Math.max(0, hop - 1.5 * s);
        const r = miembro(hx, hy, pie.x - G.camX, fy, MU, PI, -dir, col, gr);
        D.linea(r.ex, r.ey, r.ex + dir * gr, r.ey, col, gr);
      }
      // Torso y cabeza
      const incl = (pose.incl || 0) * s, cab = pose.cab || 0, mira = pose.mira || 0;
      const shx = hx + dir * incl, shy = hy - e.torso * s + cab * 0.8 * s;
      D.linea(hx, hy, shx, shy, col, gr);
      D.linea(hx + dir * gr, hy - gr, shx + dir * gr, shy + gr, col, gr);
      const cx = Math.round(shx + dir * (incl * 0.3 - mira * s)), cy = Math.round(shy - 5 * s - mira * s + cab * 0.5 * s);
      // cabeza redonda de 7 px (proporción chibi: más carisma)
      [3, 5, 7, 7, 7, 5, 3].forEach((w, i) => D.rect(cx - Math.floor(w * s / 2), cy + (i - 3) * s, w * s, s, col));
      if (pose.bufanda) bufanda(e, shx, shy + s, pose.bufanda, s, pose.vx || 0, pose.dt || G.dt);
      if (pose.gorro) gorro(pose.gorro, cx, cy, dir, s, col);
      else if (e.cuernos) { D.rect(cx - 4 * s, cy - 5 * s, s, 3 * s, e.cuernos); D.rect(cx + 3 * s, cy - 5 * s, s, 3 * s, e.cuernos); }
      // Brazos: objetivos de mano en coordenadas locales respecto al hombro
      const at = pose.atras || { x: -1, y: 8 }, fr = pose.frente || { x: 4, y: 5 };
      const ra = miembro(shx, shy + s, shx + dir * at.x * s, shy + s + at.y * s, BR, AN, dir, col, gr);
      const rf = miembro(shx, shy + s, shx + dir * fr.x * s, shy + s + fr.y * s, BR, AN, dir, col, gr);
      return { hx, hy, shx, shy, cx, cy, mano: { x: rf.ex, y: rf.ey }, manoAtras: { x: ra.ex, y: ra.ey }, dir, s, col, gr };
    },
  };
})(window.G);
