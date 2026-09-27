// 60_ui.js — pantallas (título, mapa, juego, pausa, calibración, victoria, derrota, créditos) y marcador.
(function (G) {
  const U = G.u, D = G.d, W = G.W, H = G.H, ctx = G.ctx, BEAT = G.BEAT;
  const COL = { PATA: '#E0503A', PON: '#4A8FE0', CHAKA: '#F2C14E', DON: '#6ACB6A' };
  const NOMBRE_ORDEN = { marchar: '¡MARCHAR!', atacar: '¡ATACAR!', defender: '¡DEFENDER!', retroceder: '¡RETROCEDER!', cargar: '¡CARGAR!' };
  const UI = G.ui = { sel: 0, menu: 0, juicios: [], avisoCombo: 0, finT: 0, calib: null, volverA: 'mapa', creditosY: 0, tInicio: 0 };

  // ---- Utilidades de dibujo de interfaz
  function panel(x, y, w, h, a = 0.7) { ctx.globalAlpha = a; D.rect(x, y, w, h, '#0D0F16'); ctx.globalAlpha = 1; D.rect(x, y, w, 1, '#3A4058'); D.rect(x, y + h - 1, w, 1, '#3A4058'); }
  function parpadeo(v = 2) { return Math.floor(performance.now() / 1000 * v) % 2 === 0; }
  function icono(tipo, x, y, a = 1) {
    ctx.globalAlpha = a; const c = COL[tipo];
    if (tipo === 'PATA') D.disco(x, y, 4, c);
    else if (tipo === 'PON') { D.disco(x, y, 4, c); D.disco(x, y, 2, '#0D0F16'); }
    else if (tipo === 'CHAKA') { for (let i = 0; i < 5; i++) D.rect(x - i, y - 3 + i * 2, i * 2 + 1, 2, c); }
    else D.rect(x - 4, y - 4, 9, 9, c);
    ctx.globalAlpha = 1;
  }
  function libroOrdenes(x, y) {
    panel(x, y, 150, 50, 0.6);
    let yy = y + 4;
    for (const [clave, orden] of Object.entries(G.ritmo.ORDENES)) {
      D.texto(orden, x + 4, yy, '#F4F1E6');
      clave.split(' ').forEach((t, i) => D.texto(t === 'CHAKA' ? 'CHK' : t, x + 58 + i * 23, yy, COL[t]));
      yy += 9;
    }
  }
  function menuLista(opciones, x, y, sel) {
    opciones.forEach((o, i) => {
      const on = i === sel;
      D.texto((on ? '> ' : '  ') + o, x, y + i * 12, on ? '#FFF1C2' : '#9AA0B4', 1, 'izq', '#0D0F16');
    });
  }

  // ---- Eventos
  G.on('golpe', (g) => {
    const t = { perfecto: ['PERFECTO', '#FFF1C2'], bien: ['BIEN', '#C8D0E0'], fallo: ['FALLO', '#E0503A'], espera: ['¡ESCUCHA!', '#9AA0B4'] }[g.juicio];
    UI.juicios.push({ s: t[0], col: t[1], tipo: g.tipo, v: 0 });
  });
  G.on('combo_roto', (m) => { UI.avisoCombo = 1.2; UI.motivo = m; });
  G.on('fin_nivel', (n) => { UI.finT = 1.6; G.audio.sfx(n.fin === 'victoria' ? 'victoria' : 'derrota'); if (n.fin === 'victoria') G.prog.superar(n.idx + 1, n.puntos); });

  // ---- Fondo de título: la tropa descansando junto al río al atardecer
  function prepararTitulo() {
    G.escena.configurar({ fase: 'tarde', clima: 'despejado', largo: 3000, fogatas: [330], meta: null });
    G.tropa.reiniciar(250); G.enem.reiniciar([]); G.combate.reiniciar(); G.ritmo.reiniciar();
    G.camX = 90; G.audio.tema(0); G.nivel = null;
  }
  UI.prepararTitulo = prepararTitulo;

  G.on('estado', ({ ahora, datos }) => {
    if (ahora === 'titulo' || ahora === 'mapa') { if (!G.nivel || ahora === 'titulo' || datos === 'reset') prepararTitulo(); G.audio.tema(0); G.audio.fiebre(false); G.audio.metronomo(false); }
    if (ahora === 'mapa') UI.sel = Math.min(G.prog.datos.desbloqueado, G.NIVELES.length) - 1;
    if (ahora === 'juego' && datos === 'nuevo') UI.tInicio = G.t;
    UI.menu = 0;
  });

  G.on('tecla', (k) => {
    const est = G.estado;
    if (est === 'titulo') { if (k === 'ok' || k === 'pausa') { G.audio.sfx('ok'); G.cambiarEstado('mapa'); } return; }
    if (est === 'mapa') {
      const max = Math.min(G.prog.datos.desbloqueado, G.NIVELES.length) - 1;
      if (k === 'izq') { UI.sel = Math.max(0, UI.sel - 1); G.audio.sfx('menu'); }
      if (k === 'der') { UI.sel = Math.min(max, UI.sel + 1); G.audio.sfx('menu'); }
      if (k === 'ok') { G.audio.sfx('ok'); G.iniciarNivel(UI.sel); G.cambiarEstado('juego', 'nuevo'); }
      if (k === 'arriba' || k === 'abajo') { UI.volverA = 'mapa'; G.cambiarEstado('ajustes'); }
      if (k === 'atras') G.cambiarEstado('titulo');
      return;
    }
    if (est === 'juego') { if (k === 'pausa' && !G.nivel.fin) { G.audio.pausar(true); G.cambiarEstado('pausa'); } return; }
    if (est === 'pausa' || est === 'ajustes') {
      const ops = est === 'pausa' ? ['continuar', 'calibrar', 'musica', 'mapa'] : ['calibrar', 'musica', 'volver'];
      if (k === 'arriba') { UI.menu = (UI.menu + ops.length - 1) % ops.length; G.audio.sfx('menu'); }
      if (k === 'abajo') { UI.menu = (UI.menu + 1) % ops.length; G.audio.sfx('menu'); }
      const volver = () => { if (est === 'pausa') { G.audio.pausar(false); G.cambiarEstado('juego'); } else G.cambiarEstado('mapa'); };
      if (k === 'atras' || k === 'pausa') volver();
      if (k === 'ok') {
        const o = ops[UI.menu];
        if (o === 'continuar' || o === 'volver') volver();
        if (o === 'musica') { G.prog.datos.musica = !G.prog.datos.musica; G.audio.musica(G.prog.datos.musica); G.prog.guardar(); }
        if (o === 'calibrar') {
          UI.volverA = est; if (est === 'pausa') G.audio.pausar(false);
          UI.calib = { errores: [], ult: -1 }; G.audio.metronomo(true); G.audio.musica(false); G.cambiarEstado('calibrar');
        }
        if (o === 'mapa') { G.audio.pausar(false); G.cambiarEstado('mapa', 'reset'); }
      }
      return;
    }
    if (est === 'calibrar') {
      if (k === 'atras' || (k === 'ok' && UI.calib.errores.length >= 8)) terminarCalibracion();
      return;
    }
    if (est === 'victoria') {
      if (k === 'ok') { if (G.nivel.idx === G.NIVELES.length - 1) { UI.creditosY = H; G.cambiarEstado('creditos'); } else G.cambiarEstado('mapa', 'reset'); }
      return;
    }
    if (est === 'derrota') {
      if (k === 'arriba' || k === 'abajo' || k === 'izq' || k === 'der') { UI.menu = 1 - UI.menu; G.audio.sfx('menu'); }
      if (k === 'ok') { if (UI.menu === 0) { G.iniciarNivel(G.nivel.idx); G.cambiarEstado('juego', 'nuevo'); } else G.cambiarEstado('mapa', 'reset'); }
      return;
    }
    if (est === 'creditos' && (k === 'ok' || k === 'atras')) G.cambiarEstado('mapa', 'reset');
  });
  G.on('tambor', (t) => {
    if (G.estado === 'juego' && G.nivel && !G.nivel.fin) G.ritmo.golpe(t);
    else if (G.estado === 'calibrar') {
      G.audio.tambor(t);
      const c = UI.calib, b = Math.round(G.t / BEAT);
      if (b === c.ult) return;
      c.ult = b; c.errores.push(G.t - b * BEAT);
      if (c.errores.length >= 8) {
        const s = c.errores.slice().sort((a, b2) => a - b2);
        c.resultado = Math.round(s[4] * 1000);
      }
    }
  });
  function terminarCalibracion() {
    const c = UI.calib;
    if (c && c.resultado !== undefined) { G.prog.datos.latencia = U.clamp(c.resultado, -150, 250); G.prog.guardar(); }
    G.audio.metronomo(false); G.audio.musica(G.prog.datos.musica);
    if (UI.volverA === 'pausa') { G.audio.pausar(true); G.cambiarEstado('pausa'); } else G.cambiarEstado('ajustes');
  }

  // ---- Marcador durante el juego
  function hud(dt) {
    const R = G.ritmo, n = G.nivel;
    const p = ((G.t - R.latencia()) % BEAT + BEAT) % BEAT / BEAT, pulso = Math.max(0, 1 - p * 3);
    // marco del ritmo
    ctx.globalAlpha = 0.35 * pulso * (R.fiebre ? 1.6 : 1);
    const cMarco = R.fiebre ? ['#FF6A4A', '#FFD04A', '#6ADA6A', '#4AB0FF'][Math.floor(G.t / BEAT) % 4] : '#FFFFFF';
    D.rect(0, 0, W, 2, cMarco); D.rect(0, H - 2, W, 2, cMarco); D.rect(0, 0, 2, H, cMarco); D.rect(W - 2, 0, 2, H, cMarco);
    ctx.globalAlpha = 1;
    // 4 casillas de golpes
    const x0 = W / 2 - 50;
    for (let i = 0; i < 4; i++) {
      const x = x0 + i * 26;
      panel(x, 5, 22, 16, 0.5);
      const s = R.sec[i];
      if (s) icono(s.tipo, x + 11, 13);
    }
    // orden en curso
    const o = R.ordenActiva();
    if (o) {
      const k = Math.floor((G.t - o.inicio) / BEAT);
      D.texto(NOMBRE_ORDEN[o.orden], W / 2, 28, R.fiebre ? cMarco : '#FFF1C2', 2, 'centro', '#15131A');
      for (let i = 0; i < 4; i++) D.rect(W / 2 - 14 + i * 8, 42, 5, 2, i <= k ? '#FFF1C2' : '#4A4F66');
    }
    // juicios
    for (const j of UI.juicios) {
      j.v += dt; ctx.globalAlpha = U.clamp(1.5 - j.v * 2.5, 0, 1);
      D.texto(j.s, W / 2 + 56, 10 - Math.round(j.v * 6), j.col, 1, 'izq', '#15131A');
    }
    ctx.globalAlpha = 1;
    UI.juicios = UI.juicios.filter((j) => j.v < 0.6).slice(-1);
    // combo / fiebre
    if (R.combo > 0) D.texto('COMBO ' + R.combo, 8, 8, '#FFF1C2', 1, 'izq', '#15131A');
    if (R.fiebre) D.texto('¡FIEBRE!', 8, 16, cMarco, 2, 'izq', '#15131A');
    if (UI.avisoCombo > 0) { UI.avisoCombo -= dt; if (parpadeo(6)) D.texto('COMBO PERDIDO: ' + UI.motivo, 8, R.fiebre ? 30 : 18, '#E0503A', 1, 'izq', '#15131A'); }
    // puntos y abanderado
    D.texto(String(n.puntos).padStart(6, '0'), W - 8, 8, '#FFF1C2', 1, 'der', '#15131A');
    const ab = G.tropa.abanderado();
    D.texto('BANDERA', W - 8, 15, '#C8D0E0', 1, 'der', '#15131A');
    D.rect(W - 48, 23, 40, 3, '#2A0E0E'); D.rect(W - 48, 23, Math.round(40 * ab.hp / ab.max), 3, '#7FD06A');
    // jefe
    const j = G.enem.jefe && G.enem.jefe();
    if (j && j.estado === 'activo' && j.vivo) {
      D.texto('EL GIGANTE DEL RIO', W / 2, 52, '#E0503A', 1, 'centro', '#15131A');
      D.rect(W / 2 - 80, 59, 160, 4, '#2A0E0E'); D.rect(W / 2 - 80, 59, Math.round(160 * j.hp / j.max), 4, '#E0503A');
    }
    // presentación del nivel y ayuda del primer nivel
    const edad = G.t - UI.tInicio;
    if (edad < 3.5) {
      ctx.globalAlpha = U.clamp(3.5 - edad, 0, 1);
      D.texto(n.datos.nombre, W / 2, 80, '#FFF1C2', 3, 'centro', '#15131A');
      D.texto(n.datos.sub, W / 2, 102, '#C8D0E0', 1, 'centro', '#15131A');
      ctx.globalAlpha = 1;
    }
    if (n.idx === 0 && !n.fin) libroOrdenes(6, 44);
    if (!G.entrada.tactil) D.texto('P: PAUSA', W - 6, H - 9, '#6A7088', 1, 'der');
    // botones táctiles
    G.entrada.zonas = [];
    if (G.entrada.tactil) {
      ['PATA', 'CHAKA', 'DON', 'PON'].forEach((t, i) => {
        const x = 6 + i * 118, y = H - 30;
        ctx.globalAlpha = 0.35; D.rect(x, y, 110, 26, '#0D0F16'); ctx.globalAlpha = 0.9;
        icono(t, x + 16, y + 13); D.texto(t, x + 30, y + 10, COL[t]); ctx.globalAlpha = 1;
        G.entrada.zonas.push({ x, y, w: 110, h: 26, tambor: t });
      });
      G.entrada.zonas.push({ x: W - 40, y: 0, w: 40, h: 30, tecla: 'pausa' });
      D.texto('II', W - 14, 34, '#9AA0B4', 1, 'der');
    }
  }

  // ---- Pantallas
  function titulo() {
    ctx.globalAlpha = 0.45; D.rect(0, 30, W, 64, '#0D0F16'); ctx.globalAlpha = 1;
    D.texto('TAMBORES', W / 2, 38, '#FFF1C2', 4, 'centro', '#2A1A12');
    D.texto('JUNTO AL RIO', W / 2, 64, '#F2C14E', 3, 'centro', '#2A1A12');
    if (parpadeo(1.5)) D.texto(G.entrada.tactil ? 'TOCA PARA EMPEZAR' : 'PULSA UNA TECLA', W / 2, 108, '#FFFFFF', 1, 'centro', '#15131A');
    D.texto('A PATA   D PON   W CHAKA   S DON', W / 2, 122, '#C8D0E0', 1, 'centro', '#15131A');
  }
  function mapa() {
    for (let y = 0; y < H; y++) { ctx.fillStyle = U.mix('#1B2238', '#2C2A38', y / H); ctx.fillRect(0, y, W, 1); }
    D.texto('ELIGE TU CAMINO', W / 2, 14, '#FFF1C2', 2, 'centro', '#0D0F16');
    const pts = [[70, 150], [180, 110], [300, 150], [410, 100]];
    // río serpenteante
    for (let x = 0; x < W; x++) { const y = 175 + Math.round(Math.sin(x * 0.03) * 10 + Math.sin(x * 0.011 + 1) * 8); D.rect(x, y, 1, 6, '#3E5A7A'); if ((x + Math.floor(G.t * 20)) % 23 === 0) D.rect(x, y + 2, 3, 1, '#7FA0C0'); }
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
      for (let k = 0; k <= 20; k += 2) D.rect(U.lerp(ax, bx, k / 20), U.lerp(ay, by, k / 20), 2, 2, i + 1 < G.prog.datos.desbloqueado ? '#C8B080' : '#4A4F66');
    }
    pts.forEach(([x, y], i) => {
      const abierto = i < G.prog.datos.desbloqueado, hecho = G.prog.datos.records[i + 1] !== undefined, sel = i === UI.sel;
      D.disco(x, y, 9, abierto ? '#C8B080' : '#3A3F55');
      D.disco(x, y, 7, abierto ? (i === 3 ? '#6A2020' : '#2E4A30') : '#23263A');
      D.texto(i === 3 ? '!' : String(i + 1), x + 1, y - 2, abierto ? '#FFF1C2' : '#5A5F75', 1, 'centro');
      if (hecho) { D.rect(x + 7, y - 20, 1, 12, '#15131A'); D.rect(x + 8, y - 20, 6, 4, '#B8322A'); }
      if (sel && parpadeo(3)) { D.rect(x - 12, y + 12, 24, 1, '#FFF1C2'); D.rect(x - 1, y + 13, 3, 2, '#FFF1C2'); }
    });
    const d = G.NIVELES[UI.sel];
    panel(40, 206, 400, 50, 0.7);
    D.texto(d.nombre, 52, 214, '#FFF1C2', 2, 'izq');
    D.texto(d.sub, 52, 230, '#C8D0E0');
    const rec = G.prog.datos.records[UI.sel + 1];
    D.texto(rec !== undefined ? 'RECORD ' + rec : 'SIN SUPERAR', 428, 214, '#F2C14E', 1, 'der');
    D.texto(G.entrada.tactil ? 'TOCA PARA JUGAR' : 'A/D ELEGIR · ENTER JUGAR · W AJUSTES', 52, 244, '#9AA0B4');
    G.entrada.zonas = [];
    pts.forEach(([x, y], i) => { if (i < G.prog.datos.desbloqueado) G.entrada.zonas.push({ x: x - 14, y: y - 14, w: 28, h: 28, accion: () => { if (UI.sel === i) { G.iniciarNivel(i); G.cambiarEstado('juego', 'nuevo'); } else UI.sel = i; } }); });
    G.entrada.zonas.push({ x: 0, y: 0, w: 80, h: 30, accion: () => { UI.volverA = 'mapa'; G.cambiarEstado('ajustes'); } });
    D.texto('AJUSTES', 8, 8, '#9AA0B4');
  }
  function pausa(titulo, ops) {
    ctx.globalAlpha = 0.6; D.rect(0, 0, W, H, '#0D0F16'); ctx.globalAlpha = 1;
    D.texto(titulo, W / 2, 30, '#FFF1C2', 3, 'centro');
    menuLista(ops, 170, 70, UI.menu);
    libroOrdenes(W / 2 - 75, 140);
    D.texto('LATENCIA: ' + G.prog.datos.latencia + ' MS', W / 2, 200, '#9AA0B4', 1, 'centro');
    G.entrada.zonas = ops.map((_, i) => ({ x: 160, y: 66 + i * 12, w: 160, h: 12, accion: () => { UI.menu = i; G.emit('tecla', 'ok'); } }));
  }
  function calibrar() {
    for (let y = 0; y < H; y++) { ctx.fillStyle = U.mix('#1B2238', '#0D0F16', y / H); ctx.fillRect(0, y, W, 1); }
    const c = UI.calib, p = (G.t % BEAT) / BEAT;
    D.texto('CALIBRAR RITMO', W / 2, 30, '#FFF1C2', 2, 'centro');
    D.texto('TOCA CUALQUIER TAMBOR JUSTO CON CADA CLIC', W / 2, 60, '#C8D0E0', 1, 'centro');
    D.disco(W / 2, 110, Math.round(10 + 10 * Math.max(0, 1 - p * 4)), '#F2C14E');
    D.texto(c.errores.length + ' / 8', W / 2, 140, '#FFF1C2', 2, 'centro');
    if (c.resultado !== undefined) {
      D.texto('RESULTADO: ' + c.resultado + ' MS', W / 2, 170, '#6ACB6A', 1, 'centro');
      D.texto('ENTER PARA GUARDAR', W / 2, 184, '#9AA0B4', 1, 'centro');
    } else D.texto('ESC PARA SALIR', W / 2, 184, '#9AA0B4', 1, 'centro');
    G.entrada.zonas = [{ x: 0, y: 0, w: W, h: H - 40, tambor: 'DON' }, { x: 0, y: H - 40, w: W, h: 40, tecla: c.resultado !== undefined ? 'ok' : 'atras' }];
  }
  function fin(victoria) {
    const n = G.nivel;
    ctx.globalAlpha = 0.72; D.rect(0, 40, W, 150, '#0D0F16'); ctx.globalAlpha = 1;
    D.texto(victoria ? '¡VICTORIA!' : 'DERROTA', W / 2, 54, victoria ? '#F2C14E' : '#E0503A', 4, 'centro', '#15131A');
    const filas = [['PUNTOS', n.puntos], ['ENEMIGOS VENCIDOS', n.bajas], ['COMBO MAXIMO', n.maxCombo], ['GOLPES PERFECTOS', G.ritmo.perfectos], ['TIEMPO', Math.floor(n.tiempo) + ' S']];
    filas.forEach(([k, v], i) => { D.texto(k, W / 2 - 90, 92 + i * 11, '#C8D0E0'); D.texto(String(v), W / 2 + 90, 92 + i * 11, '#FFF1C2', 1, 'der'); });
    if (victoria) { if (parpadeo(1.5)) D.texto('PULSA PARA CONTINUAR', W / 2, 160, '#FFFFFF', 1, 'centro'); G.entrada.zonas = []; }
    else {
      menuLista(['REINTENTAR', 'VOLVER AL MAPA'], 180, 152, UI.menu);
      G.entrada.zonas = [0, 1].map((i) => ({ x: 170, y: 148 + i * 12, w: 160, h: 12, accion: () => { UI.menu = i; G.emit('tecla', 'ok'); } }));
    }
  }
  function creditos(dt) {
    ctx.globalAlpha = 0.7; D.rect(0, 0, W, H, '#0D0F16'); ctx.globalAlpha = 1;
    UI.creditosY -= 18 * dt;
    const lineas = ['¡EL GIGANTE HA CAIDO!', '', 'EL RIO VUELVE A ESTAR EN PAZ', '', '', 'TAMBORES JUNTO AL RIO', '', 'IDEA Y DIRECCION', 'EDUARDO', '', 'PROGRAMACION Y ARTE', 'CLAUDE', '', 'AGUA PIXEL ART', 'INSPIRADA EN KINGDOM TWO CROWNS', '', 'RITMO', 'INSPIRADO EN PATAPON', '', '', 'GRACIAS POR JUGAR'];
    lineas.forEach((l, i) => { const y = UI.creditosY + i * 14; if (y > -10 && y < H) D.texto(l, W / 2, y, i === 0 || i === 5 ? '#F2C14E' : '#F4F1E6', i === 0 || i === 5 ? 2 : 1, 'centro'); });
    if (UI.creditosY < -lineas.length * 14) UI.creditosY = H;
  }

  UI.dibujar = (dt) => {
    const e = G.estado;
    if (e === 'titulo') { titulo(); G.entrada.zonas = []; }
    else if (e === 'mapa') mapa();
    else if (e === 'juego') hud(dt);
    else if (e === 'pausa') pausa('PAUSA', ['CONTINUAR', 'CALIBRAR RITMO', 'MUSICA: ' + (G.prog.datos.musica ? 'SI' : 'NO'), 'SALIR AL MAPA']);
    else if (e === 'ajustes') { mapa(); pausa('AJUSTES', ['CALIBRAR RITMO', 'MUSICA: ' + (G.prog.datos.musica ? 'SI' : 'NO'), 'VOLVER']); }
    else if (e === 'calibrar') calibrar();
    else if (e === 'victoria') fin(true);
    else if (e === 'derrota') fin(false);
    else if (e === 'creditos') creditos(dt);
  };
  // Tras la victoria/derrota se espera un poco antes de mostrar la pantalla final
  UI.actualizar = (dt) => {
    if (G.estado === 'juego' && G.nivel && G.nivel.fin) {
      UI.finT -= dt;
      if (UI.finT <= 0) { UI.menu = 0; G.cambiarEstado(G.nivel.fin); }
    }
  };
})(window.G);
