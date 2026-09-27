// 99_principal.js — bucle, escalado entero, orden de actualización/dibujo y modos de prueba por URL.
(function (G) {
  const U = G.u, W = G.W, H = G.H, BEAT = G.BEAT, P = G.P;
  const pantalla = document.getElementById('pantalla');
  G.pantalla = pantalla;
  // Capa de interfaz (transparente) encima del mundo; el agua WebGL se compone entre ambas.
  const capaUI = G.lienzo(W, H);
  G.bufUI = capaUI.c;
  const ctxMundo = G.ctx;
  const usarGL = !P.has('sin_gl') && G.aguaGL.iniciar(pantalla);
  const pctx = usarGL ? null : pantalla.getContext('2d');
  let escala = 1;
  function ajustar() {
    const fijo = G.prueba;                                   // en pruebas: 2× fijo (960×540)
    escala = fijo ? 2 : Math.max(1, Math.floor(Math.min(innerWidth / W, innerHeight / H)));
    if (!fijo && (innerWidth / W < 1 || innerHeight / H < 1)) escala = Math.min(innerWidth / W, innerHeight / H);
    // con WebGL el agua se dibuja a resolución real: usamos todo el alto disponible aunque no sea entero
    if (!fijo && usarGL) escala = Math.min(innerWidth / W, innerHeight / H);
    const dpr = usarGL && !fijo ? Math.min(2, window.devicePixelRatio || 1) : 1;
    pantalla.width = Math.round(W * escala * dpr); pantalla.height = Math.round(H * escala * dpr);
    pantalla.style.width = Math.round(W * escala) + 'px'; pantalla.style.height = Math.round(H * escala) + 'px';
    pantalla.style.left = Math.round((innerWidth - W * escala) / 2) + 'px';
    pantalla.style.top = Math.round((innerHeight - H * escala) / 2) + 'px';
    if (pctx) pctx.imageSmoothingEnabled = false;
  }
  addEventListener('resize', ajustar); ajustar();
  G.audio.musica(G.prog.datos.musica);

  const mundoVisible = () => ['juego', 'pausa', 'victoria', 'derrota', 'titulo', 'campamento', 'mapa', 'ajustes'].includes(G.estado);

  function actualizar(dt) {
    G.dt = dt;
    G.entrada.actualizar();
    G.audio.actualizar();
    G.ui.actualizar(dt);
    if (G.estado === 'juego' || G.estado === 'victoria' || G.estado === 'derrota') {
      G.ritmo.actualizar();
      G.escena.actualizar(dt);
      G.tropa.actualizar(dt);
      G.enem.actualizar(dt);
      G.combate.actualizar(dt);
      G.actualizarNivel(dt);
      G.actualizarCamara(dt);
    } else if (G.estado === 'titulo' || G.estado === 'campamento') {
      G.escena.actualizar(dt); G.tropa.actualizar(dt); G.combate.actualizar(dt);
    }
  }
  function dibujar(dt) {
    G.luces = [];
    G.ctx = ctxMundo;
    const dtv = G.estado === 'pausa' ? 0 : dt;
    if (mundoVisible()) {
      G.escena.dibujarFondo();
      G.enem.dibujar(dt);
      G.tropa.dibujar(dt);
      G.combate.dibujar();
      G.escena.oscuridad();
      G.escena.despues(dtv);
      if (!usarGL) G.escena.agua2D();
    } else { ctxMundo.fillStyle = '#0D0F16'; ctxMundo.fillRect(0, 0, W, H); }
    // Capa de interfaz: lluvia, textos flotantes y pantallas
    G.ctx = capaUI.x;
    capaUI.x.clearRect(0, 0, W, H);
    if (mundoVisible()) { G.escena.lluvia(dtv); G.combate.dibujarTextos(); }
    G.ui.dibujar(dt);
    G.ctx = ctxMundo;
  }
  function presentar() {
    let dx = 0, dy = 0;
    if (G.temblor > 0) { dx = (Math.random() - 0.5) * 4; dy = (Math.random() - 0.5) * 3; }
    if (usarGL) {
      const p = mundoVisible() ? G.escena.paramsAgua() : { osc: 0, viento: 0, agua: '#000000', cielo: '#000000', luces: [], ondas: [], sinAgua: true };
      p.temblor = [dx * pantalla.width / W, dy * pantalla.height / H];
      G.aguaGL.presentar(G.buf, G.bufUI, p);
    } else {
      pctx.fillStyle = '#0D0F16'; pctx.fillRect(0, 0, pantalla.width, pantalla.height);
      const e = pantalla.width / W;
      pctx.drawImage(G.buf, Math.round(dx * e), Math.round(dy * e), pantalla.width, pantalla.height);
      pctx.drawImage(G.bufUI, 0, 0, pantalla.width, pantalla.height);
    }
  }
  G.presentar = presentar;
  G.paso = (dt) => { if (G.estado !== 'pausa') G.t += dt; actualizar(dt); dibujar(dt); };

  // ---- Jugador automático (pruebas): elige la orden y toca en el pulso (bien) o con errores grandes (mal)
  function crearBot(modo, seed = 7) {
    const rnd = U.rng(seed), cola = [];
    return (t) => {
      const R = G.ritmo, b = Math.floor(t / BEAT + 0.5);
      if (!cola.length) {
        const ocupado = R.ejec && b < R.ejec.pulso0 + 3;
        if (ocupado) return;
        const inicio = R.ejec ? R.ejec.pulso0 + 4 : Math.floor(t / BEAT) + 1;
        const frente = G.tropa.frente(), j = G.enem.jefe && G.enem.jefe();
        let cerca = false;
        for (const e of G.enem.lista) if (e.vivo && e.x - frente < 125) cerca = true;
        let orden = cerca ? 'atacar' : 'marchar';
        if (j && j.vivo && j.estado === 'activo' && (j.fase === 'golpe' || j.fase === 'pisoton')) orden = 'defender';
        if (cerca && !G.tropa.ej.cargado && R.combo % 4 === 3) orden = 'cargar';
        const clave = Object.keys(R.ORDENES).find((k) => R.ORDENES[k] === orden);
        clave.split(' ').forEach((tipo, i) => {
          const err = modo === 'mal' ? (rnd() - 0.5) * 0.45 : 0;
          cola.push({ tipo, t: (inicio + i) * BEAT + err });
        });
      }
      while (cola.length && t >= cola[0].t) { const g = cola.shift(); R.golpe(g.tipo, t); }
    };
  }

  function salida(texto) { const pre = document.createElement('pre'); pre.id = 'out'; pre.textContent = texto; document.body.appendChild(pre); }

  function simularNivel(idx, modo, maxS, alPaso) {
    G.iniciarNivel(idx); G.cambiarEstado('juego', 'nuevo');
    const bot = modo ? crearBot(modo) : null;
    for (let i = 0; i < maxS * 60; i++) {
      if (bot && G.estado === 'juego' && !G.nivel.fin) bot(G.t);
      G.paso(1 / 60);
      if (alPaso) alPaso();
      if (G.nivel.fin && G.estado !== 'juego') break;
    }
    return G.nivel;
  }

  // ---- Modos de prueba
  if (P.get('prueba') === 'pies') {
    // Mide cuánto se mueve un pie apoyado entre fotogramas (debe ser 0) en los niveles 1 y 4.
    let deriva = 0, pasos = 0, peor = '';
    const prev = new Map();
    const medir = () => {
      const ents = [...G.tropa.unidades, ...G.enem.lista].filter((e) => e.vivo && e.esq && e.esq.pies);
      for (const e of ents) e.esq.pies.forEach((pie, k) => {
        const key = e.bando + e.i + ':' + k, a = prev.get(key);
        if (a && a.arr === e.esq.pies && !pie.sw && !a.sw) { const d = Math.abs(pie.x - a.x); if (d > deriva) { deriva = d; peor = key; } }
        if (pie.sw && !(a && a.sw)) pasos++;
        prev.set(key, { x: pie.x, sw: !!pie.sw, arr: e.esq.pies });
      });
    };
    simularNivel(0, 'bien', 60, medir);
    simularNivel(6, 'bien', 40, medir);
    salida(`deriva máxima de un pie apoyado: ${deriva.toFixed(4)} px (${peor || '-'}) · pasos: ${pasos}`);
    return;
  }
  if (P.get('prueba') === 'ritmo') {
    const R = G.ritmo, res = [];
    G.iniciarNivel(0); G.cambiarEstado('juego', 'nuevo');
    const casos = [[0, 'perfecto'], [0.05, 'perfecto'], [-0.05, 'perfecto'], [0.1, 'bien'], [-0.11, 'bien'], [0.16, 'fallo'], [-0.2, 'fallo']];
    let ok = 0;
    casos.forEach(([err, esperado], i) => { R.sec = []; R.ejec = null; const j = R.golpe('PATA', (40 + i * 4) * BEAT + err).juicio; res.push(`${err >= 0 ? '+' : ''}${err * 1000} ms → ${j}${j === esperado ? '' : ' (esperado ' + esperado + ')'}`); if (j === esperado) ok++; });
    // secuencia completa → orden
    R.reiniciar(); let orden = null; G.on('orden', (o) => { orden = o.orden; });
    ['PATA', 'PATA', 'PATA', 'PON'].forEach((t, i) => R.golpe(t, (100 + i) * BEAT + 0.01));
    res.push('PATA PATA PATA PON → ' + orden);
    // tocar durante la orden rompe el combo y responde "espera"
    const j = R.golpe('PON', 101.5 * BEAT + 0.5 * BEAT).juicio;
    res.push('golpe durante la orden → ' + j);
    salida(`ritmo: ${ok}/${casos.length} juicios correctos · ${orden === 'marchar' && j === 'espera' ? 'órdenes OK' : 'órdenes MAL'}\n` + res.join('\n'));
    return;
  }
  if (P.has('auto')) {
    const idx = (+P.get('nivel') || 1) - 1, modo = P.get('auto') === 'mal' ? 'mal' : 'bien';
    if (P.get('mejoras') !== 'no') G.campana.progresoEsperado(idx);
    const n = simularNivel(idx, modo, 400);
    const vivos = G.tropa.vivas().length;
    salida(`nivel ${idx + 1} (${n.datos.nombre}) · bot ${modo}: ${n.fin || 'sin terminar'} en ${n.tiempo.toFixed(1)} s · puntos ${n.puntos} · bajas enemigas ${n.bajas} · tropa viva ${vivos}/${G.tropa.unidades.length} · combo máx ${n.maxCombo}${G.enem.jefe() ? ' · vida del jefe ' + G.enem.jefe().hp : ''}`);
    return;
  }
  if (P.has('bench')) {
    const n = +P.get('bench') || 300;
    G.iniciarNivel(2); G.cambiarEstado('juego', 'nuevo');
    const bot = crearBot('bien');
    for (let i = 0; i < 600; i++) { bot(G.t); G.paso(1 / 60); }
    const t0 = performance.now();
    for (let i = 0; i < n; i++) { bot(G.t); G.paso(1 / 60); }
    salida(`BENCH ${n} frames: ${((performance.now() - t0) / n).toFixed(3)} ms/frame (nivel 3, lluvia, noche)`);
    return;
  }
  if (P.get('prueba') === 'musica') {
    G.audio.renderizar(P.get('cancion') || 'pradera', +P.get('seg') || 36, P.has('fiebre')).then((r) => {
      salida(JSON.stringify({ pico: r.pico, rms: r.rms.map((x) => +x.toFixed(3)), wav: r.wav }));
    }).catch((e) => salida('ERROR ' + e.message));
    return;
  }
  if (P.has('capa')) {                      // depuración: una capa de fondo sola
    const [b, i] = P.get('capa').split(':'); const c = G.escena._capas(b)[+i].c;
    G.ctx.fillStyle = '#FF00FF'; G.ctx.fillRect(0, 0, W, H); G.ctx.drawImage(c, -(+P.get('x') || 0), 0);
    salida(G.buf.toDataURL()); return;
  }
  if (P.has('shot')) {
    const pant = P.get('pantalla') || 'juego', sim = +P.get('sim') || 3, idx = (+P.get('nivel') || 1) - 1;
    if (pant === 'titulo') { G.cambiarEstado('titulo'); for (let i = 0; i < sim * 60; i++) G.paso(1 / 60); }
    else if (pant === 'campamento') { G.prog.datos.monedas = 230; G.cambiarEstado('campamento'); for (let i = 0; i < sim * 60; i++) G.paso(1 / 60); }
    else if (pant === 'mapa') { G.prog.datos.desbloqueado = +P.get('abiertos') || 4; G.prog.datos.records = { 1: 3120, 2: 2890, 3: 4100 }; G.cambiarEstado('campamento'); G.cambiarEstado('mapa'); for (let i = 0; i < 30; i++) G.paso(1 / 60); }
    else {
      simularNivel(idx, P.get('bot') || 'bien', sim);
      if (pant === 'pausa') G.cambiarEstado('pausa');
      if (pant === 'victoria' || pant === 'derrota') { G.nivel.fin = pant; G.cambiarEstado(pant); }
      G.paso(1 / 60);
    }
    if (P.has('tactil')) { G.entrada.tactil = true; G.paso(1 / 60); }
    presentar();
    salida(pantalla.toDataURL());
    return;
  }

  // ---- Bucle real (si la pestaña se oculta durante un nivel, se pausa para no perder el ritmo)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && G.estado === 'juego' && G.nivel && !G.nivel.fin) { G.audio.pausar(true); G.cambiarEstado('pausa'); }
  });
  G.cambiarEstado('titulo');
  let ultimo = performance.now();
  requestAnimationFrame(function cuadro(ahora) {
    let dt = Math.min(0.05, (ahora - ultimo) / 1000); ultimo = ahora;
    const r = G.audio.reloj();
    if (r !== null && G.estado !== 'pausa') { dt = U.clamp(r - G.t, 0, 0.05); G.t = r; } else if (G.estado !== 'pausa') G.t += dt;
    actualizar(dt); dibujar(dt); presentar();
    requestAnimationFrame(cuadro);
  });
})(window.G);
