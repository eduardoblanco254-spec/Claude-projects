// 50_niveles.js — datos de los niveles y su desarrollo: inicio, puntuación, victoria y derrota.
(function (G) {
  const e = (tipo, x) => ({ tipo, x });
  const NIVELES = [
    { nombre: 'El vado', sub: 'Aprende a marchar y atacar', fase: 'dia', clima: 'despejado', largo: 1400, meta: 1340, tema: 1,
      enemigos: [e('bruto', 520), e('bruto', 565), e('empalizada', 800), e('bruto', 1010), e('lancero', 1060)], fogatas: [] },
    { nombre: 'Bosque de niebla', sub: 'Cuidado con los arqueros', fase: 'tarde', clima: 'niebla', largo: 1800, meta: 1740, tema: 2,
      enemigos: [e('arquero', 460), e('bruto', 500), e('lancero', 720), e('empalizada', 920), e('arquero', 955), e('bruto', 1160),
        e('bruto', 1200), e('lancero', 1420), e('arquero', 1470)], fogatas: [380, 1090] },
    { nombre: 'Noche en el río', sub: 'Defiende cuando apunten', fase: 'noche', clima: 'lluvia', largo: 2000, meta: 1940, tema: 3,
      enemigos: [e('bruto', 420), e('arquero', 470), e('lancero', 700), e('lancero', 745), e('empalizada', 960), e('arquero', 995),
        e('arquero', 1030), e('bruto', 1260), e('bruto', 1300), e('lancero', 1520), e('arquero', 1570), e('bruto', 1610)],
      fogatas: [150, 620, 1150, 1720] },
    { nombre: 'El gigante del río', sub: 'Salta su onda y defiende su garrote', fase: 'noche', clima: 'tormenta', largo: 900, meta: null, tema: 4, jefe: true,
      enemigos: [e('jefe', 620)], fogatas: [120, 460, 820] },
  ];

  const N = G.nivel = null;
  G.NIVELES = NIVELES;

  G.iniciarNivel = (idx) => {
    const d = NIVELES[idx];
    G.nivel = { idx, datos: d, puntos: 0, bajas: 0, tiempo: 0, fin: null, maxCombo: 0 };
    G.escena.configurar(d);
    G.tropa.reiniciar(60);
    G.enem.reiniciar(d.enemigos);
    G.combate.reiniciar();
    G.ritmo.reiniciar();
    G.audio.tema(d.tema);
    G.camX = 0;
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
    if (!ab.vivo || G.tropa.vivas().length === 0) { n.fin = 'derrota'; G.emit('fin_nivel', n); return; }
    const d = n.datos;
    const gana = d.jefe ? !G.enem.jefe().vivo : G.tropa.ej.x + 40 >= d.meta;
    if (gana) {
      n.puntos += G.tropa.vivas().length * 150 + Math.max(0, 600 - Math.floor(n.tiempo) * 3);
      n.fin = 'victoria'; G.emit('fin_nivel', n);
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
