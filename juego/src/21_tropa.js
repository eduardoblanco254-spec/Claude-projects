// 21_tropa.js — la tropa del jugador: tipos, formación, personalidad, respuesta a las órdenes y armas.
(function (G) {
  const U = G.u, D = G.d, BEAT = G.BEAT;
  const NEGRO = '#15131A', METAL = '#C9CCD2', ROJO = '#B8322A', ORO = '#F2C14E', MADERA = '#5B4430';
  const VEL = 30;
  const TIPOS = {
    bandera: { hp: 60, alcance: 0, dano: 0 },
    lanza:   { hp: 40, alcance: 20, dano: 8 },
    escudo:  { hp: 75, alcance: 13, dano: 5 },
    arco:    { hp: 30, alcance: 165, dano: 6 },
  };
  // Formación (desplazamiento respecto al abanderado): escudos delante, arqueros detrás.
  const FORMACION = [['escudo', 38], ['escudo', 29], ['lanza', 20], ['lanza', 11], ['bandera', 0], ['lanza', -9], ['arco', -19], ['arco', -29]];

  const T = G.tropa = { unidades: [], ej: { x: 60, vel: 0, cargado: false } };

  function thrust(p) {           // estocada: prepara, clava, sostiene, vuelve (desplazamiento de la mano)
    if (p < 0.4) return -3 * U.easeOut(p / 0.4);
    if (p < 0.55) return -3 + 11 * U.easeOut((p - 0.4) / 0.15);
    if (p < 0.7) return 8;
    return 8 - 8 * U.smooth((p - 0.7) / 0.3);
  }
  T.thrust = thrust;

  T.reiniciar = (x = 60) => {
    T.ej = { x, vel: 0, cargado: false };
    T.unidades = FORMACION.map(([tipo, off], i) => {
      const d = TIPOS[tipo];
      return {
        i, tipo, off, x: x + off, vx: 0, hp: d.hp, max: d.hp, vivo: true, bando: 'tropa', ancho: 6,
        esq: G.esq.crear({ retraso: U.hash(i, 11) * 0.07, torso: 8 + Math.floor(U.hash(i, 12) * 3), oido: 0.4 + 0.6 * U.hash(i, 13) }),
        brio: 0.75 + 0.5 * U.hash(i, 15), vagar: U.hash(i, 14) * 100, fase: U.hash(i, 3) * 6,
        gesto: null, proxGesto: 1 + U.hash(i, 16) * 4, salto: 0, herido: 0, verVida: 0,
        objetivo: null, ultGolpe: -1, defensa: false, pAnt: 0,
      };
    });
  };
  T.vivas = () => T.unidades.filter((u) => u.vivo);
  T.frente = () => { let m = -1e9; for (const u of T.unidades) if (u.vivo) m = Math.max(m, u.x); return m; };
  T.abanderado = () => T.unidades.find((u) => u.tipo === 'bandera');

  // Multiplicador de daño recibido
  function mult(u) {
    const o = G.ritmo.ordenActiva();
    let m = 1;
    if (u.tipo === 'escudo') m *= 0.7;
    if (o && o.orden === 'defender') m *= u.tipo === 'escudo' ? 0.1 : 0.35;
    return m;
  }
  T.mult = mult;

  G.on('orden', (o) => { if (o.orden === 'cargar') T.ej.cargado = true; });
  G.on('fin_orden', (o) => { if (o.orden === 'atacar') T.ej.cargado = false; });
  G.on('golpe', (g) => { if (g.juicio === 'perfecto' || g.juicio === 'bien') for (const u of T.unidades) u.salto = 0.22; });

  function enemigoMasCercano(u, rango) {
    let mejor = null, dm = 1e9;
    for (const e of G.enem.lista) {
      if (!e.vivo) continue;
      const d = e.x - e.ancho / 2 - u.x;
      if (d > -8 && d < rango && d < dm) { dm = d; mejor = e; }
    }
    return mejor;
  }

  T.actualizar = (dt) => {
    const o = G.ritmo.ordenActiva(), ej = T.ej, niv = G.nivel;
    // ---- Movimiento del ejército
    let vel = 0;
    if (o && o.orden === 'marchar') {
      const bloqueo = G.enem.bloqueo();                     // primer enemigo/empalizada vivo delante
      const frente = ej.x + 40;
      vel = bloqueo === null || bloqueo - frente > 10 ? VEL : 0;
      if (niv && ej.x > niv.datos.largo - 70) vel = 0;
    } else if (o && o.orden === 'retroceder') {
      vel = ej.x > 40 ? -26 : 0;
    }
    ej.vel = vel; ej.x += vel * dt;

    const fiebre = G.ritmo.fiebre;
    for (const u of T.unidades) {
      if (!u.vivo) continue;
      const tl = G.t - u.esq.retraso, pa = ((tl % BEAT) + BEAT) % BEAT / BEAT;
      u.defensa = !!(o && o.orden === 'defender');
      let meta = ej.x + u.off + Math.sin(G.t * 0.7 + u.vagar) * 1.2;
      let vmax = 32, ff = vel;
      u.objetivo = null;
      if (o && o.orden === 'atacar' && u.tipo !== 'bandera') {
        const d = TIPOS[u.tipo];
        const e = enemigoMasCercano(u, u.tipo === 'arco' ? d.alcance : 130);
        if (e) {
          u.objetivo = e;
          if (u.tipo !== 'arco') { meta = e.x - e.ancho / 2 - d.alcance + 3; vmax = 60; ff = 0; }
        }
        // El golpe cae a mitad del pulso (pico de la estocada / suelta de la flecha)
        const suelta = u.tipo === 'arco' ? 0.35 : 0.5;
        const b = Math.floor(tl / BEAT);
        if (u.pAnt < suelta && pa >= suelta && b !== u.ultGolpe && G.t >= o.inicio) {
          u.ultGolpe = b;
          const pot = o.potencia * (fiebre ? 1.5 : 1) * (ej.cargado ? 2 : 1);
          if (u.tipo === 'arco') {
            if (e && (b - o.pulso0) % 2 === 0) G.combate.flecha(u.x + 6, G.GY - 22, e, 'tropa', d.dano * pot);
          } else if (e && Math.abs(e.x - e.ancho / 2 - u.x) <= d.alcance + 3) {
            G.combate.danar(e, d.dano * pot, u);
          }
        }
      }
      u.pAnt = pa;
      // Velocidad con alimentación hacia delante (sigue a la formación sin retraso)
      const err = meta - u.x;
      let vx = ff + U.clamp(err * 3, -vmax, vmax);
      if (Math.abs(err) < 0.6 && Math.abs(ff) < 0.1) vx = 0;
      // No atravesar enemigos
      const e = enemigoMasCercano(u, 12);
      if (e && vx > 0 && e.x - e.ancho / 2 - u.x < 6) vx = 0;
      u.vx = vx; u.x += vx * dt;
      u.salto = Math.max(0, u.salto - dt); u.herido = Math.max(0, u.herido - dt); u.verVida = Math.max(0, u.verVida - dt);
      // Gestos en reposo
      u.proxGesto -= dt;
      if (!u.gesto && u.proxGesto <= 0 && !o && Math.abs(vx) < 1) {
        const tipos = ['peso', 'mirar', u.tipo === 'lanza' ? 'golpear' : 'peso'];
        u.gesto = { tipo: tipos[Math.floor(U.hash(Math.floor(G.t * 10) + u.i * 31, 17) * 3)], a: 0, dur: 1.4 + U.hash(u.i, Math.floor(G.t)) * 0.8, lado: U.hash(u.i, Math.floor(G.t * 3)) < 0.5 ? -1 : 1 };
        u.proxGesto = 2.5 + U.hash(u.i, Math.floor(G.t * 7)) * 4;
      }
      if (u.gesto) { u.gesto.a += dt; if (u.gesto.a >= u.gesto.dur || o) u.gesto = null; }
    }
  };

  // ---- Dibujo
  function dibujarUnidad(u, dt) {
    const o = G.ritmo.ordenActiva(), ataca = o && o.orden === 'atacar' && u.tipo !== 'bandera';
    const defiende = u.defensa, carga = o && o.orden === 'cargar';
    const tl = G.t - u.esq.retraso, p = ((tl % BEAT) + BEAT) % BEAT / BEAT;
    const ges = u.gesto ? Math.sin(Math.PI * Math.min(1, u.gesto.a / u.gesto.dur)) : 0, gt = u.gesto ? u.gesto.tipo : '';
    const mel = G.audio.pulsoMelodia(tl), cab = mel.e * u.esq.oido * (ataca ? 0 : 1);
    const hop = u.salto > 0 ? Math.sin(Math.PI * (1 - u.salto / 0.22)) * 3 * u.brio : 0;
    const th = ataca ? thrust(p) * u.brio : 0, lunge = th / 8;
    const respira = Math.sin(G.t * (2 + u.esq.oido) + u.fase) * 0.5 + 0.5;
    const peso = gt === 'peso' ? ges * 1.5 * u.gesto.lado : 0;
    const hipW = u.x + (u.tipo === 'arco' ? 0 : lunge * 2) + peso;
    const agache = (defiende ? 2 : 0) + (carga ? 2 + Math.sin(G.t * 30) * 0.5 : 0) + (u.esq.marcha ? 0 : respira * 0.6);
    const bal = Math.sin(2 * Math.PI * (u.esq.pFase || 0));
    const vx = u.vx;
    const pose = {
      hipW, vx, hop, agache, incl: (u.esq.marcha ? 1 : 0) + lunge * 2 + (defiende ? 1 : 0) + cab * 0.6, cab, mira: gt === 'mirar' ? ges : 0,
      reposo: ataca && u.tipo !== 'arco' ? [-4, 5] : defiende ? [-4, 4] : [-2, 3], dt,
      atras: { x: -1 - (u.esq.marcha ? 3 * bal : 0) - cab * 1.5 * mel.alto, y: 8 - cab * 2 },
      frente: { x: 4, y: 5 }, color: u.herido > 0 ? '#E8E4DA' : null,
    };
    let luz = null;
    if (u.tipo === 'lanza') {
      const golpea = gt === 'golpear' ? Math.max(0, Math.sin(Math.PI * 2 * u.gesto.a / BEAT)) * 2 : 0;
      pose.frente = { x: 4 + th, y: 5 - (ataca ? 1 : 0) + golpea - (defiende ? 2 : 0) };
      const r = G.esq.dibujar(u.esq, pose);
      const ang = ataca ? 0 : defiende ? -Math.PI / 4 : -Math.PI / 2 - 0.15 * (u.esq.marcha ? 1 : 0);
      const ux = Math.cos(ang) * r.dir, uy = Math.sin(ang), m = r.mano;
      const atras = Math.min(7, G.GY - 1 - m.y);
      D.linea(m.x - ux * atras, m.y - uy * atras, m.x + ux * 17, m.y + uy * 17, r.col);
      D.linea(m.x + ux * 17, m.y + uy * 17, m.x + ux * 20, m.y + uy * 20, T.ej.cargado ? ORO : METAL);
    } else if (u.tipo === 'escudo') {
      pose.frente = { x: 4 + (ataca ? th * 0.6 : 0), y: defiende ? 1 : 4 };
      pose.atras = { x: -3 + (ataca ? th * 0.4 : 0), y: 6 };
      const r = G.esq.dibujar(u.esq, pose);
      // espada corta en la mano de atrás
      D.linea(r.manoAtras.x, r.manoAtras.y, r.manoAtras.x + r.dir * 3, r.manoAtras.y - 5, r.col);
      D.rect(r.manoAtras.x + r.dir * 3, r.manoAtras.y - 7, 1, 2, METAL);
      // escudo 4×10 delante del cuerpo
      const sx0 = Math.round(r.mano.x + (r.dir > 0 ? 0 : -3)), sy0 = Math.round(r.mano.y - 5);
      D.rect(sx0, sy0, 4, 10, r.col);
      D.rect(sx0 + (r.dir > 0 ? 3 : 0), sy0 + 1, 1, 8, '#2E2A34');
      D.rect(sx0 + 1, sy0 + 4, 2, 2, T.ej.cargado ? ORO : METAL);
    } else if (u.tipo === 'arco') {
      const tensa = ataca ? (p < 0.35 ? U.easeOut(p / 0.35) : Math.max(0, 1 - (p - 0.35) * 6)) : 0;
      pose.frente = { x: 5, y: 2 };
      pose.atras = { x: 2 - tensa * 4, y: 2 };
      const r = G.esq.dibujar(u.esq, pose);
      const m = r.mano, d = r.dir;
      // arco: curva de 13 px hacia delante
      for (let k = -6; k <= 6; k++) D.rect(m.x + d * Math.round(2.2 * (1 - (k * k) / 36)), m.y + k, 1, 1, MADERA);
      const cx = tensa > 0.05 ? r.manoAtras.x : m.x;
      D.linea(m.x, m.y - 6, cx, m.y, '#8A8F99'); D.linea(cx, m.y, m.x, m.y + 6, '#8A8F99');
      if (tensa > 0.05) D.linea(cx, m.y, m.x + d * 5, m.y, r.col);
    } else if (u.tipo === 'bandera') {
      pose.frente = { x: 4, y: 4 - cab };
      const r = G.esq.dibujar(u.esq, pose);
      const bx = Math.round(r.mano.x), top = Math.round(r.mano.y) - 22;
      D.linea(bx, Math.min(G.GY - 1, r.mano.y + 8), bx, top, r.col);
      const viento = G.escena ? G.escena.viento : 0.5;
      for (let i = 0; i < 9; i++) {
        const ond = Math.round(Math.sin(G.t * (6 + 4 * viento) - i * 0.7) * (i / 9) * 1.5);
        D.rect(bx + 1 + i, top + ond, 1, i < 7 ? 6 : 6 - (i - 6) * 2, ROJO);
      }
      D.disco(bx + 5, top + 3 + Math.round(Math.sin(G.t * 8 - 3) * 0.6), 1, ORO);
      // farol en la punta: da luz de noche
      D.rect(bx - 1, top - 4, 3, 3, '#FFD27A'); D.rect(bx, top - 5, 1, 1, r.col);
      luz = { x: bx + G.camX, y: top - 3, tipo: 'farol' };
    }
    // Barra de vida al recibir daño
    if (u.verVida > 0) {
      const x0 = Math.round(u.x - G.camX - 4), y0 = G.GY - 34;
      D.rect(x0, y0, 9, 2, '#2A0E0E'); D.rect(x0, y0, Math.max(1, Math.round(9 * u.hp / u.max)), 2, '#7FD06A');
    }
    return luz;
  }
  T.dibujar = (dt) => {
    for (const u of T.unidades) if (u.vivo) { const l = dibujarUnidad(u, dt); if (l) G.luces.push(l); }
  };
})(window.G);
