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
      const cx = Math.round(shx + dir * (incl * 0.3 - mira * s)), cy = Math.round(shy - 4 * s - mira * s + cab * 0.5 * s);
      const filas = [3, 5, 5, 5, 3];
      filas.forEach((w, i) => D.rect(cx - Math.floor(w * s / 2), cy + (i - 2) * s, w * s, s, col));
      if (e.cuernos) { D.rect(cx - 3 * s, cy - 4 * s, s, 2 * s, e.cuernos); D.rect(cx + 2 * s, cy - 4 * s, s, 2 * s, e.cuernos); }
      // Brazos: objetivos de mano en coordenadas locales respecto al hombro
      const at = pose.atras || { x: -1, y: 8 }, fr = pose.frente || { x: 4, y: 5 };
      const ra = miembro(shx, shy + s, shx + dir * at.x * s, shy + s + at.y * s, BR, AN, dir, col, gr);
      const rf = miembro(shx, shy + s, shx + dir * fr.x * s, shy + s + fr.y * s, BR, AN, dir, col, gr);
      return { hx, hy, shx, shy, cx, cy, mano: { x: rf.ex, y: rf.ey }, manoAtras: { x: ra.ex, y: ra.ey }, dir, s, col, gr };
    },
  };
})(window.G);
