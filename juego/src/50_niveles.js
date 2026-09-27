// 50_niveles.js — desarrollo de cada fase de la campaña (inicio, puntos, monedas, victoria, derrota),
// el campamento y la cámara.
(function (G) {
  G.NIVELES = G.campana.FASES;

  G.iniciarNivel = (idx) => {
    const d = G.campana.FASES[idx];
    G.nivel = { idx, datos: d, puntos: 0, bajas: 0, tiempo: 0, fin: null, maxCombo: 0, monedas: 0, premio: 0 };
    G.escena.configurar(d);
    G.tropa.reiniciar(60);
    G.enem.reiniciar(d.enemigos, G.campana.dificultad(idx));
    G.combate.reiniciar();
    G.ritmo.reiniciar();
    G.audio.tema(d.cancion);
    G.camX = 0;
  };

  // Campamento: tiendas, herrería, maniquí, carro y la tropa descansando junto al fuego
  G.iniciarCampamento = () => {
    G.escena.configurar({ bioma: 'campamento', largo: 1000, fogatas: [300], meta: null,
      props: [{ tipo: 'tienda', x: 170, col: '#C8A870' }, { tipo: 'tienda', x: 214, col: '#A88A5A', bandera: '#F2C14E' }, { tipo: 'estandarte', x: 250 },
        { tipo: 'yunque', x: 372 }, { tipo: 'maniqui', x: 420 }, { tipo: 'carro', x: 470 }, { tipo: 'tienda', x: 520, col: '#B89868' }] });
    G.tropa.reiniciar(330);
    G.enem.reiniciar([]); G.combate.reiniciar(); G.ritmo.reiniciar();
    G.camX = 150; G.nivel = null;
    G.audio.tema('campamento'); G.audio.fiebre(false);
  };

  G.on('muere', (o) => {
    const n = G.nivel; if (!n || n.fin) return;
    if (o.bando === 'enem') { n.puntos += G.enem.TIPOS[o.tipo].puntos; n.bajas++; }
  });
  G.on('golpe', (g) => { const n = G.nivel; if (n && !n.fin && g.juicio === 'perfecto') n.puntos += 10; });
  G.on('orden', () => { const n = G.nivel; if (n && !n.fin) { n.puntos += 20 * G.ritmo.combo; n.maxCombo = Math.max(n.maxCombo, G.ritmo.combo); } });

  G.actualizarNivel = (dt) => {
    const n = G.nivel; if (!n || n.fin) return;
    n.tiempo += dt;
    const ab = G.tropa.abanderado();
    if (!ab.vivo || G.tropa.vivas().length === 0) {
      n.fin = 'derrota'; G.campana.ganar(n.monedas); G.emit('fin_nivel', n); return;
    }
    const d = n.datos;
    const gana = d.jefe ? !G.enem.jefe().vivo : G.tropa.ej.x + G.tropa.frenteOff >= d.meta;
    if (gana) {
      n.puntos += G.tropa.vivas().length * 150 + Math.max(0, 600 - Math.floor(n.tiempo) * 3);
      n.premio = d.recompensa;
      n.fin = 'victoria'; G.campana.ganar(n.monedas + n.premio); G.emit('fin_nivel', n);
    }
  };

  // Cámara: sigue al ejército con el abanderado a un tercio de la pantalla
  G.actualizarCamara = (dt) => {
    const n = G.nivel; if (!n) return;
    let objetivo = G.tropa.ej.x - 150;
    const j = n.datos.jefe && G.enem.jefe();
    if (j && j.vivo && j.estado === 'activo') objetivo = Math.min(objetivo + 60, j.x - 380);
    objetivo = G.u.clamp(objetivo, 0, n.datos.largo - G.W);
    G.camX += (objetivo - G.camX) * Math.min(1, dt * 4);
  };
})(window.G);
