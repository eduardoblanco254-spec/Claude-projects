// 11_ritmo.js — juicio de golpes, secuencias de 4 tambores, órdenes, combo y modo fiebre.
// Ciclo estilo Patapon: el jugador toca 4 golpes seguidos (uno por pulso); la tropa cumple la orden
// durante los 4 pulsos siguientes y la canta; después el jugador vuelve a tocar para mantener el combo.
(function (G) {
  const U = G.u, BEAT = G.BEAT;
  const ORDENES = {
    'PATA PATA PATA PON': 'marchar',
    'PON PON PATA PON': 'atacar',
    'CHAKA CHAKA PATA PON': 'defender',
    'PON PATA PON PATA': 'retroceder',
    'PON PON CHAKA CHAKA': 'cargar',
  };
  const PERFECTO = 0.06, BIEN = 0.13, FIEBRE_COMBO = 4;

  const R = G.ritmo = {
    ORDENES, sec: [], ejec: null, combo: 0, fiebre: false, ultimo: -99, pulsoActual: -1, perfectos: 0, fallos: 0,
    reiniciar() { R.sec = []; R.ejec = null; R.combo = 0; R.fiebre = false; R.ultimo = -99; R.perfectos = 0; R.fallos = 0; G.audio.fiebre(false); },
    latencia: () => (G.prog ? G.prog.datos.latencia : 0) / 1000,
    romper(motivo) {
      if (R.combo > 0 || R.fiebre) G.emit('combo_roto', motivo);
      R.combo = 0;
      if (R.fiebre) { R.fiebre = false; G.audio.fiebre(false); }
    },
    // tiempo: opcional (pruebas); por defecto el reloj del juego
    golpe(tipo, tiempo = G.t) {
      G.audio.tambor(tipo);
      const tt = tiempo - R.latencia(), b = Math.round(tt / BEAT), err = tt - b * BEAT, ae = Math.abs(err);
      const juicio = ae <= PERFECTO ? 'perfecto' : ae <= BIEN ? 'bien' : 'fallo';
      const info = { tipo, juicio, err, b };
      // Tocar mientras la tropa cumple la orden rompe el combo (hay que escuchar).
      if (R.ejec && b < R.ejec.pulso0 + 4) {
        info.juicio = 'espera'; G.emit('golpe', info); R.romper('espera'); R.fallos++; return info;
      }
      if (juicio === 'fallo') {
        R.sec = []; R.fallos++; G.emit('golpe', info); R.romper('fuera de ritmo'); G.audio.sfx('fallo', 0.6); return info;
      }
      const ult = R.sec[R.sec.length - 1];
      if (ult && b === ult.b) { R.sec = []; info.juicio = 'fallo'; R.fallos++; G.emit('golpe', info); R.romper('doble golpe'); return info; }
      if (ult && b !== ult.b + 1) R.sec = [];
      if (juicio === 'perfecto') R.perfectos++;
      R.sec.push(info); R.ultimo = b;
      G.emit('golpe', info);
      if (R.sec.length >= 4) {
        const ult4 = R.sec.slice(-4), clave = ult4.map((s) => s.tipo).join(' '), orden = ORDENES[clave];
        if (orden) {
          const potencia = ult4.reduce((a, s) => a + (s.juicio === 'perfecto' ? 1.2 : 0.9), 0) / 4;
          R.combo++;
          const pulso0 = b + 1;
          R.ejec = { orden, pulso0, inicio: pulso0 * BEAT, fin: (pulso0 + 4) * BEAT, potencia };
          R.sec = [];
          if (!R.fiebre && R.combo >= FIEBRE_COMBO) { R.fiebre = true; G.audio.fiebre(true); G.audio.sfx('fiebre'); G.emit('fiebre', true); }
          G.audio.canto(orden, pulso0);
          G.emit('orden', R.ejec);
        } else if (R.sec.length >= 4) {
          R.sec = R.sec.slice(-3);        // ventana deslizante: los últimos 3 aún pueden empezar una orden
        }
      }
      return info;
    },
    // La orden en curso (solo durante sus 4 pulsos)
    ordenActiva: () => (R.ejec && G.t >= R.ejec.inicio - 0.02 && G.t < R.ejec.fin ? R.ejec : null),
    actualizar() {
      const b = Math.floor(G.t / BEAT);
      if (b !== R.pulsoActual) { R.pulsoActual = b; G.emit('pulso', b); }
      if (R.ejec && G.t >= R.ejec.fin) { G.emit('fin_orden', R.ejec); R.ultimo = R.ejec.pulso0 + 3; R.ejec = null; }
      const ahora = G.t / BEAT;
      if (R.sec.length && ahora > R.sec[R.sec.length - 1].b + 1.6) { R.sec = []; G.emit('secuencia_perdida'); }
      if (!R.ejec && R.combo > 0 && ahora > R.ultimo + 2.6) R.romper('silencio');
    },
  };
})(window.G);
