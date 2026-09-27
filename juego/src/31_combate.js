// 31_combate.js — daño, proyectiles (flechas en arco, ondas del jefe), partículas y textos flotantes.
(function (G) {
  const U = G.u, D = G.d, GRAV = 150;
  const C = G.combate = { proy: [], part: [], textos: [] };
  G.temblor = 0;

  C.reiniciar = () => { C.proy = []; C.part = []; C.textos = []; G.temblor = 0; };

  C.danar = (obj, cantidad, fuente) => {
    if (!obj.vivo) return 0;
    const m = obj.bando === 'tropa' ? G.tropa.mult(obj) : 1;
    const d = Math.round(cantidad * m);
    if (d <= 0) {
      G.audio.sfx('escudo');
      C.texto('BLOQ', obj.x - G.camX, G.GY - 36, '#C9CCD2');
      return 0;
    }
    obj.hp -= d; obj.herido = 0.08; obj.verVida = 2.5;
    C.texto(String(d), obj.x - G.camX, G.GY - 38, obj.bando === 'tropa' ? '#FF8A6A' : '#FFF1C2');
    G.audio.sfx(m < 0.5 ? 'escudo' : 'golpe', 0.8);
    for (let k = 0; k < 5; k++) C.part.push({ x: obj.x, y: G.GY - 16, vx: (Math.random() - 0.5) * 60, vy: -30 - Math.random() * 40, vida: 0.4, col: '#E8E4DA' });
    if (obj.hp <= 0) morir(obj);
    return d;
  };
  function morir(obj) {
    obj.vivo = false; obj.hp = 0;
    G.audio.sfx('muerte');
    // se deshace en píxeles del color del cuerpo
    const col = obj.bando === 'tropa' ? '#15131A' : obj.tipo === 'empalizada' ? '#6A4A30' : '#3A1616';
    const alto = obj.tipo === 'jefe' ? 70 : 28, n = obj.tipo === 'jefe' ? 90 : 26;
    for (let k = 0; k < n; k++) {
      C.part.push({ x: obj.x + (Math.random() - 0.5) * (obj.tipo === 'jefe' ? 30 : 8), y: G.GY - Math.random() * alto,
        vx: (Math.random() - 0.5) * 40, vy: -20 - Math.random() * 50, vida: 0.8 + Math.random() * 0.8, col, suelo: true });
    }
    G.emit('muere', obj);
  }
  C.texto = (s, x, y, col) => C.textos.push({ s, x, y, col, vida: 0.8 });
  C.polvo = (x, n) => { for (let k = 0; k < n; k++) C.part.push({ x: x + (Math.random() - 0.5) * 40, y: G.GY - 1, vx: (Math.random() - 0.5) * 50, vy: -10 - Math.random() * 30, vida: 0.6, col: '#8A7A60' }); };

  // Flecha balística que apunta a donde estará el objetivo (tiempo de vuelo fijo 0.7 s)
  C.flecha = (x, y, obj, bando, dano) => {
    const T = 0.7, tx = obj.x + (obj.vx || 0) * T, ty = G.GY - 14;
    C.proy.push({ tipo: 'flecha', x, y, vx: (tx - x) / T, vy: (ty - y) / T - 0.5 * GRAV * T, bando, dano, vivo: true, clavada: 0 });
    G.audio.sfx('flecha');
  };
  C.onda = (x, vx, dano, bando) => C.proy.push({ tipo: 'onda', x, vx, dano, bando, vivo: true, vida: 2.2, tocados: new Set() });

  C.actualizar = (dt) => {
    G.temblor = Math.max(0, G.temblor - dt);
    for (const p of C.proy) {
      if (!p.vivo) continue;
      if (p.tipo === 'flecha') {
        if (p.clavada > 0) { p.clavada -= dt; if (p.clavada <= 0) p.vivo = false; continue; }
        p.vy += GRAV * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        const blancos = p.bando === 'tropa' ? G.enem.lista : G.tropa.unidades;
        for (const b of blancos) {
          if (!b.vivo) continue;
          const alto = b.tipo === 'jefe' ? 70 : b.tipo === 'empalizada' ? 26 : 30;
          if (Math.abs(p.x - b.x) < b.ancho / 2 + 2 && p.y > G.GY - alto && p.y < G.GY) { C.danar(b, p.dano, p); p.vivo = false; break; }
        }
        if (p.vivo && p.y >= G.GY - 1) { p.y = G.GY - 1; p.clavada = 1.2; }
      } else if (p.tipo === 'onda') {
        p.x += p.vx * dt; p.vida -= dt;
        if (p.vida <= 0) p.vivo = false;
        for (const u of G.tropa.unidades) {
          if (u.vivo && !p.tocados.has(u) && Math.abs(u.x - p.x) < 6) {
            p.tocados.add(u);
            if (u.salto > 0.05) C.texto('ESQUIVA', u.x - G.camX, G.GY - 36, '#C9CCD2');   // saltar la esquiva
            else C.danar(u, p.dano, p);
          }
        }
        if (Math.random() < 0.6) C.part.push({ x: p.x, y: G.GY - 1, vx: -p.vx * 0.1 + (Math.random() - 0.5) * 20, vy: -20 - Math.random() * 30, vida: 0.4, col: '#8A7A60' });
      }
    }
    C.proy = C.proy.filter((p) => p.vivo);
    for (const q of C.part) {
      q.vida -= dt; q.vy += GRAV * dt; q.x += q.vx * dt; q.y += q.vy * dt;
      if (q.y > G.GY - 1) { q.y = G.GY - 1; q.vx *= 0.5; q.vy = 0; }
    }
    C.part = C.part.filter((q) => q.vida > 0);
    for (const s of C.textos) { s.vida -= dt; s.y -= 16 * dt; }
    C.textos = C.textos.filter((s) => s.vida > 0);
  };

  C.dibujar = () => {
    for (const p of C.proy) {
      if (p.tipo === 'flecha') {
        const x = p.x - G.camX, ang = p.clavada > 0 ? 0.6 * Math.sign(p.vx) : Math.atan2(p.vy, p.vx);
        const ux = Math.cos(ang), uy = Math.sin(ang);
        D.linea(x - ux * 6, p.y - uy * 6, x, p.y, p.bando === 'tropa' ? '#2A2520' : '#3A1616');
        D.rect(x, p.y, 1, 1, '#C9CCD2');
      } else {
        const x = Math.round(p.x - G.camX);
        D.rect(x - 3, G.GY - 3, 7, 3, '#8A7A60'); D.rect(x - 1, G.GY - 5, 3, 2, '#A89878');
      }
    }
    for (const q of C.part) { G.ctx.globalAlpha = U.clamp(q.vida * 2, 0, 1); D.rect(q.x - G.camX, q.y, 1, 1, q.col); }
    G.ctx.globalAlpha = 1;
  };
  C.dibujarTextos = () => {
    for (const s of C.textos) { G.ctx.globalAlpha = U.clamp(s.vida * 2.5, 0, 1); D.texto(s.s, s.x, s.y, s.col, 1, 'centro', '#15131A'); }
    G.ctx.globalAlpha = 1;
  };
})(window.G);
