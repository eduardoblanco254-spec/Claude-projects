// 30_enemigos.js — enemigos con IA sencilla que actúan al pulso, empalizadas y el jefe gigante.
(function (G) {
  const U = G.u, D = G.d, BEAT = G.BEAT;
  const PIEL = '#3A1616', HUESO = '#D8CBB0', METAL = '#B7B9BE', MADERA = '#6A4A30', MADERA2 = '#4A3220';
  const TIPOS = {
    bruto:      { hp: 36, dano: 7, alcance: 14, vel: 18, aggro: 190, ancho: 6, puntos: 100, monedas: 5 },
    lancero:    { hp: 26, dano: 9, alcance: 20, vel: 22, aggro: 200, ancho: 6, puntos: 120, monedas: 6 },
    arquero:    { hp: 20, dano: 5, alcance: 150, vel: 14, aggro: 210, ancho: 6, puntos: 120, monedas: 6 },
    escudado:   { hp: 44, dano: 7, alcance: 14, vel: 15, aggro: 190, ancho: 8, puntos: 150, monedas: 8 },
    caudillo:   { hp: 190, dano: 14, alcance: 20, vel: 14, aggro: 230, ancho: 11, puntos: 600, monedas: 40 },
    empalizada: { hp: 70, dano: 0, alcance: 0, vel: 0, aggro: 0, ancho: 14, puntos: 80, monedas: 4 },
    jefe:       { hp: 450, dano: 18, alcance: 75, vel: 14, aggro: 400, ancho: 22, puntos: 2000, monedas: 0 },
  };
  const E = G.enem = { lista: [], TIPOS };

  E.reiniciar = (defs, dif = { vida: 1, dano: 1 }) => {
    E.lista = defs.map((d, i) => {
      const t = TIPOS[d.tipo], hp = Math.round(t.hp * dif.vida);
      const e = { i, tipo: d.tipo, x: d.x, x0: d.x, vx: 0, hp, max: hp, danoM: dif.dano, vivo: true, bando: 'enem', ancho: t.ancho,
        estado: 'espera', herido: 0, verVida: 0, ataque: null, cooldown: 0, anim: 0 };
      if (d.tipo !== 'empalizada') {
        e.esq = G.esq.crear({ dir: -1, color: PIEL, cuernos: HUESO, retraso: U.hash(i, 21) * 0.08, torso: 9 + Math.floor(U.hash(i, 22) * 2),
          escala: d.tipo === 'jefe' ? 2.4 : d.tipo === 'caudillo' ? 1.6 : 1, oido: 0.3 });
        e.gorro = { tipo: 'mascara', col: '#E8DCC0', cuerno: '#C9B79A', corona: d.tipo === 'caudillo' || d.tipo === 'jefe' ? '#F2C14E' : null };
      }
      if (d.tipo === 'jefe') { e.patron = 0; e.pulsosEnFase = 0; }
      return e;
    });
  };
  // Posición del primer obstáculo vivo delante del ejército (para que la marcha se detenga)
  E.bloqueo = () => {
    let m = null;
    for (const e of E.lista) if (e.vivo && (m === null || e.x - e.ancho / 2 < m)) m = e.x - e.ancho / 2;
    return m;
  };
  E.jefe = () => E.lista.find((e) => e.tipo === 'jefe');
  E.mult = (e) => 1;

  function objetivo(e) {
    let mejor = null, dm = 1e9;
    for (const u of G.tropa.unidades) {
      if (!u.vivo) continue;
      const d = e.x - e.ancho / 2 - u.x;
      if (d > -10 && d < dm) { dm = d; mejor = u; }
    }
    return mejor ? { u: mejor, d: dm } : null;
  }

  // ---- IA por pulso: cada enemigo decide en el golpe de tambor
  G.on('pulso', (b) => {
    if (G.estado !== 'juego') return;
    for (const e of E.lista) {
      if (!e.vivo || e.tipo === 'empalizada') continue;
      const t = TIPOS[e.tipo], ob = objetivo(e);
      if (e.tipo === 'jefe') { pulsoJefe(e, b, ob); continue; }
      if (!ob) { e.estado = 'espera'; continue; }
      const aggro = t.aggro + (G.nivel ? G.nivel.tiempo * 2.5 : 0);          // con el tiempo salen a buscarte
      if (e.estado === 'espera' && ob.d < aggro) e.estado = 'avanza';
      if (e.estado === 'avanza' && ob.d <= t.alcance + 2) e.estado = 'ataca';
      if (e.estado === 'ataca' && ob.d > t.alcance + 8) e.estado = 'avanza';
      if (e.estado === 'ataca') {
        // Ataque en 2 pulsos: preparar (b) y golpear (b+1)
        if (!e.ataque && e.cooldown <= 0) { e.ataque = { b0: b, obj: ob.u }; }
        else if (e.ataque && b === e.ataque.b0 + 1) {
          if (e.tipo === 'arquero') G.combate.flecha(e.x - 6, G.GY - 22, e.ataque.obj, 'enem', t.dano * e.danoM);
          else if (Math.abs(e.x - e.ancho / 2 - e.ataque.obj.x) <= t.alcance + 4) { G.combate.danar(e.ataque.obj, t.dano * e.danoM, e); if (e.tipo === 'caudillo') { G.temblor = 0.15; G.combate.polvo(e.x - 16, 6); } }
          e.ataque = null; e.cooldown = e.tipo === 'arquero' ? 2 : 1;
        }
      }
      if (e.cooldown > 0 && !e.ataque) e.cooldown--;
      // Lancero: embestida si está a media distancia
      if (e.tipo === 'lancero' && e.estado === 'avanza' && ob.d < 110 && ob.d > 30 && !e.carga) e.carga = 2;
      else if (e.carga) e.carga--;
    }
  });

  function pulsoJefe(e, b, ob) {
    if (!ob) return;
    if (e.estado === 'espera' && ob.d < TIPOS.jefe.aggro) { e.estado = 'activo'; G.emit('jefe_despierta'); }
    if (e.estado !== 'activo') return;
    const furia = e.hp < e.max * 0.5;
    const PATRON = furia ? ['camina', 'golpe', 'pisoton', 'golpe', 'camina', 'pisoton'] : ['camina', 'golpe', 'camina', 'pisoton'];
    const DUR = { camina: furia ? 2 : 3, golpe: 3, pisoton: 2 };
    if (!e.fase) { e.fase = PATRON[e.patron % PATRON.length]; e.pulsosEnFase = 0; }
    e.pulsosEnFase++;
    if (e.fase === 'golpe') {
      if (e.pulsosEnFase === 1) G.audio.sfx('aviso');
      if (e.pulsosEnFase === DUR.golpe) {        // cae el garrote en el tercer pulso
        G.audio.sfx('jefe'); G.temblor = 0.35;
        for (const u of G.tropa.unidades) if (u.vivo && e.x - u.x < TIPOS.jefe.alcance && e.x - u.x > -20) G.combate.danar(u, TIPOS.jefe.dano * e.danoM, e);
        G.combate.polvo(e.x - 55, 14);
      }
    } else if (e.fase === 'pisoton') {
      if (e.pulsosEnFase === 1) G.audio.sfx('aviso');
      if (e.pulsosEnFase === DUR.pisoton) { G.audio.sfx('jefe', 0.6); G.temblor = 0.2; G.combate.onda(e.x - 18, -110, 9 * e.danoM, 'enem'); }
    }
    if (e.pulsosEnFase >= DUR[e.fase]) { e.patron++; e.fase = null; }
  }

  E.actualizar = (dt) => {
    for (const e of E.lista) {
      e.herido = Math.max(0, e.herido - dt); e.verVida = Math.max(0, e.verVida - dt);
      if (!e.vivo || e.tipo === 'empalizada') continue;
      const t = TIPOS[e.tipo], ob = objetivo(e);
      let vx = 0;
      if (ob && e.tipo !== 'jefe' && e.estado === 'avanza') vx = -(e.carga ? 55 : t.vel);
      if (e.tipo === 'jefe' && e.estado === 'activo' && e.fase === 'camina' && ob && ob.d > 45) vx = -t.vel * (e.hp < e.max * 0.5 ? 1.5 : 1);
      // No atravesar a la tropa ni a otros enemigos
      if (ob && vx < 0 && ob.d + vx * dt < (e.tipo === 'jefe' ? 30 : 7)) vx = 0;
      for (const o of E.lista) if (o !== e && o.vivo && o.x < e.x && e.x - o.x < (e.ancho + o.ancho) / 2 + 5 && vx < 0) vx = 0;
      e.vx = vx; e.x += vx * dt;
    }
  };

  // ---- Dibujo
  function dibujarEmpalizada(e) {
    const x = Math.round(e.x - G.camX), col = e.herido > 0 ? '#E8E4DA' : MADERA;
    const alto = [22, 26, 20, 25, 21];
    alto.forEach((h, k) => {
      const hh = Math.round(h * (0.4 + 0.6 * e.hp / e.max));
      D.rect(x - 7 + k * 3, G.GY - hh, 2, hh, col);
      D.rect(x - 7 + k * 3, G.GY - hh - 1, 1, 1, col);
      D.rect(x - 6 + k * 3, G.GY - hh + 2, 1, hh - 2, MADERA2);
    });
    D.rect(x - 8, G.GY - 15, 16, 2, MADERA2); D.rect(x - 8, G.GY - 7, 16, 2, MADERA2);
  }
  function dibujarEnemigo(e, dt) {
    const t = TIPOS[e.tipo], jefe = e.tipo === 'jefe';
    const p = ((G.t % BEAT) + BEAT) % BEAT / BEAT;
    let prep = 0, golpe = 0;
    if (e.ataque) prep = U.smooth(p);                                    // levanta el arma en el pulso de preparación
    else if (e.cooldown > 0 && e.estado === 'ataca') golpe = Math.max(0, 1 - p * 3);
    let alza = 0;
    if (jefe && e.fase === 'golpe') alza = e.pulsosEnFase < 3 ? U.smooth((e.pulsosEnFase - 1 + p) / 2) : 0;
    if (jefe && e.fase === 'pisoton' && e.pulsosEnFase < 2) alza = -U.smooth(p);
    const pose = {
      hipW: e.x, vx: e.vx, dt, hop: jefe && e.fase === 'pisoton' && e.pulsosEnFase < 2 ? U.smooth(p) * 3 : 0,
      incl: 1 + golpe * 2 - prep, cab: 0, agache: 0, reposo: [-2, 3],
      atras: { x: -1, y: 8 }, frente: { x: 4 + golpe * 6 - prep * 3, y: 5 - prep * 8 },
      color: e.herido > 0 ? '#E8E4DA' : null, gorro: e.gorro,
    };
    if (jefe) { pose.frente = { x: 3 - alza * 6, y: 4 - alza * 13 }; pose.atras = { x: -2 - alza * 3, y: 6 - alza * 10 }; }
    const r = G.esq.dibujar(e.esq, pose);
    const m = r.mano, d = r.dir;
    if (e.tipo === 'bruto') {
      const ang = -Math.PI / 2 + (golpe * 1.6 - prep * 0.8) * 1;
      const ex = m.x + Math.cos(ang) * d * 9, ey = m.y + Math.sin(ang) * 9;
      D.linea(m.x, m.y, ex, ey, MADERA); D.disco(ex, ey, 2, MADERA2);
    } else if (e.tipo === 'escudado' || e.tipo === 'caudillo') {
      const gr = e.tipo === 'caudillo' ? 2 : 1, L = e.tipo === 'caudillo' ? 16 : 8;
      const ang = -Math.PI / 2 + (golpe * 1.7 - prep * 0.9);
      const ex = m.x + Math.cos(ang) * d * L, ey = m.y + Math.sin(ang) * L;
      D.linea(m.x, m.y, ex, ey, MADERA, gr);
      D.rect(ex - (d > 0 ? 0 : 3 * gr), ey - 2 * gr, 3 * gr, 4 * gr, METAL);     // hacha
      if (e.tipo === 'escudado') {                                             // escudo grande delante
        const sx0 = Math.round(r.shx + d * 5 - (d > 0 ? 0 : 5)), sy0 = Math.round(r.shy - 2);
        D.rect(sx0, sy0, 5, 13, '#5A3A2A'); D.rect(sx0 + (d > 0 ? 4 : 0), sy0, 1, 13, '#3A2418'); D.rect(sx0 + 1, sy0 + 5, 3, 3, METAL);
      }
    } else if (e.tipo === 'lancero') {
      const ang = golpe > 0 ? 0 : -Math.PI / 2 + (e.carga ? Math.PI / 2 : 0.2);
      const ux = Math.cos(ang) * d, uy = Math.sin(ang);
      D.linea(m.x - ux * 6, m.y - uy * 6, m.x + ux * 15, m.y + uy * 15, r.col);
      D.linea(m.x + ux * 15, m.y + uy * 15, m.x + ux * 18, m.y + uy * 18, METAL);
    } else if (e.tipo === 'arquero') {
      for (let k = -6; k <= 6; k++) D.rect(m.x + d * Math.round(2.2 * (1 - (k * k) / 36)), m.y + k, 1, 1, MADERA);
      D.linea(m.x, m.y - 6, m.x - d * prep * 4, m.y, '#8A8F99'); D.linea(m.x - d * prep * 4, m.y, m.x, m.y + 6, '#8A8F99');
    } else if (jefe) {
      // garrote enorme
      const ang = -Math.PI / 2 - alza * 0.9 * -1 + (e.fase === 'golpe' && e.pulsosEnFase >= 3 ? 1.5 : 0);
      const L = 30, ex = m.x + Math.cos(ang) * d * L, ey = m.y + Math.sin(ang) * L;
      D.linea(m.x, m.y, ex, ey, MADERA, 3); D.disco(ex, ey, 5, MADERA2);
      D.rect(ex - 1, ey - 6, 2, 2, HUESO); D.rect(ex + 3, ey - 2, 2, 2, HUESO);
      // aviso "!" sobre la cabeza durante la preparación
      if ((e.fase === 'golpe' && e.pulsosEnFase < 3) || (e.fase === 'pisoton' && e.pulsosEnFase < 2)) {
        if (Math.floor(G.t * 8) % 2 === 0) D.texto('!', r.cx, r.cy - 22, '#FF5A3A', 3, 'centro', '#2A0E0E');
      }
      // zona de impacto del garrote
      if (e.fase === 'golpe' && e.pulsosEnFase === 2) {
        G.ctx.globalAlpha = 0.25 + 0.2 * Math.sin(G.t * 20);
        D.rect(e.x - TIPOS.jefe.alcance - G.camX, G.GY - 1, TIPOS.jefe.alcance - 10, 2, '#FF5A3A');
        G.ctx.globalAlpha = 1;
      }
    }
    if (!jefe && e.verVida > 0) {
      const x0 = Math.round(e.x - G.camX - 4), y0 = G.GY - 34;
      D.rect(x0, y0, 9, 2, '#1A0A0A'); D.rect(x0, y0, Math.max(1, Math.round(9 * e.hp / e.max)), 2, '#E0503A');
    }
  }
  E.dibujar = (dt) => {
    for (const e of E.lista) {
      if (!e.vivo) continue;
      if (e.x - G.camX < -60 || e.x - G.camX > G.W + 60) { if (e.esq) e.esq.pies = null; continue; }
      if (e.tipo === 'empalizada') dibujarEmpalizada(e); else dibujarEnemigo(e, dt);
    }
  };
})(window.G);
