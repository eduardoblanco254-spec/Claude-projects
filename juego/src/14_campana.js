// 14_campana.js — campaña de 7 fases con dificultad creciente, economía de monedas, mejoras de tropa
// (nivel 1–5 por clase, con equipo visible) y reclutamiento. Los datos persisten en G.prog.
(function (G) {
  const e = (tipo, x) => ({ tipo, x });
  const FASES = [
    { nombre: 'Pradera del vado', sub: 'Marcha y ataca al ritmo', bioma: 'pradera', largo: 1400, meta: 1340, cancion: 'pradera', recompensa: 60, dif: 0,
      enemigos: [e('bruto', 520), e('bruto', 565), e('empalizada', 800), e('bruto', 1010), e('lancero', 1060)], fogatas: [] },
    { nombre: 'Colinas de abedules', sub: 'Llegan los arqueros', bioma: 'pradera', largo: 1700, meta: 1640, cancion: 'pradera', recompensa: 80, dif: 1,
      enemigos: [e('arquero', 460), e('bruto', 500), e('lancero', 720), e('empalizada', 900), e('arquero', 940), e('bruto', 1150), e('bruto', 1190), e('lancero', 1400), e('arquero', 1450)], fogatas: [] },
    { nombre: 'Bosque de otoño', sub: 'Carga para romper escudos', bioma: 'otono', largo: 1800, meta: 1740, cancion: 'bosque', recompensa: 100, dif: 2,
      enemigos: [e('escudado', 480), e('bruto', 520), e('arquero', 560), e('lancero', 800), e('escudado', 1000), e('empalizada', 1050), e('arquero', 1090), e('bruto', 1300), e('escudado', 1450), e('arquero', 1500)], fogatas: [300, 1200] },
    { nombre: 'Bosque de niebla', sub: 'El caudillo te espera', bioma: 'niebla', clima: 'niebla', largo: 1900, meta: 1840, cancion: 'bosque', recompensa: 140, dif: 3,
      enemigos: [e('arquero', 450), e('lancero', 500), e('escudado', 740), e('bruto', 780), e('empalizada', 1000), e('arquero', 1040), e('arquero', 1080), e('lancero', 1300), e('caudillo', 1560), e('bruto', 1600)], fogatas: [360, 1180] },
    { nombre: 'Pantano de luciérnagas', sub: 'Defiende cuando apunten', bioma: 'pantano', largo: 2000, meta: 1940, cancion: 'noche', recompensa: 170, dif: 4,
      enemigos: [e('bruto', 420), e('arquero', 470), e('lancero', 700), e('lancero', 745), e('empalizada', 960), e('arquero', 995), e('arquero', 1030), e('escudado', 1260), e('bruto', 1300), e('lancero', 1520), e('arquero', 1570), e('caudillo', 1700)],
      fogatas: [150, 620, 1150, 1720] },
    { nombre: 'Paso nevado', sub: 'La última muralla', bioma: 'nieve', largo: 2100, meta: 2040, cancion: 'montana', recompensa: 200, dif: 5,
      enemigos: [e('escudado', 440), e('escudado', 480), e('arquero', 520), e('empalizada', 760), e('arquero', 790), e('lancero', 1000), e('lancero', 1040), e('bruto', 1080), e('empalizada', 1300), e('caudillo', 1360),
        e('arquero', 1400), e('escudado', 1640), e('bruto', 1680), e('arquero', 1720)], fogatas: [300, 1150, 1900] },
    { nombre: 'El gigante del río', sub: 'Salta su onda y defiende su garrote', bioma: 'tormenta', largo: 900, meta: null, cancion: 'jefe', recompensa: 400, dif: 6, jefe: true,
      enemigos: [e('jefe', 620)], fogatas: [120, 460, 820] },
  ];
  const CLASES = {
    lanza:   { nombre: 'Lanceros',   rol: 'Daño cuerpo a cuerpo', recluta: 50, max: 5 },
    escudo:  { nombre: 'Escuderos',  rol: 'Aguantan en primera fila', recluta: 70, max: 4 },
    arco:    { nombre: 'Arqueros',   rol: 'Disparan desde lejos', recluta: 60, max: 4 },
    bandera: { nombre: 'Abanderado', rol: 'Moral: más daño a todos', recluta: 0, max: 1 },
  };
  const NIVEL_MAX = 5;
  const C = G.campana = { FASES, CLASES, NIVEL_MAX };

  function datos() {
    const d = G.prog.datos;
    if (!d.tropa) d.tropa = { lanza: 3, escudo: 2, arco: 2, bandera: 1 };
    if (!d.niveles) d.niveles = { lanza: 1, escudo: 1, arco: 1, bandera: 1 };
    if (d.monedas === undefined) d.monedas = 0;
    return d;
  }
  C.datos = datos;
  C.costeMejora = (clase) => { const n = datos().niveles[clase]; return n >= NIVEL_MAX ? null : Math.round(45 * Math.pow(n, 1.55) * (clase === 'bandera' ? 1.5 : 1)); };
  C.costeRecluta = (clase) => { const d = datos(); return d.tropa[clase] >= CLASES[clase].max ? null : CLASES[clase].recluta + 20 * (d.tropa[clase] - 1); };
  C.mejorar = (clase) => {
    const d = datos(), c = C.costeMejora(clase);
    if (c === null || d.monedas < c) return false;
    d.monedas -= c; d.niveles[clase]++; G.prog.guardar(); return true;
  };
  C.reclutar = (clase) => {
    const d = datos(), c = C.costeRecluta(clase);
    if (c === null || d.monedas < c) return false;
    d.monedas -= c; d.tropa[clase]++; G.prog.guardar(); return true;
  };
  // Estadísticas de una clase según su nivel (vida y daño), moral del abanderado
  C.stats = (clase) => {
    const n = datos().niveles[clase], moral = 1 + 0.06 * (datos().niveles.bandera - 1);
    return { vida: 1 + 0.25 * (n - 1), dano: (1 + 0.2 * (n - 1)) * moral, nivel: n };
  };
  C.ganar = (m) => { datos().monedas += m; G.prog.guardar(); };
  C.dificultad = (fase) => FASES[fase].jefe ? { vida: 1.6, dano: 1.25 } : { vida: 1 + 0.13 * FASES[fase].dif, dano: 1 + 0.08 * FASES[fase].dif };
  // Mejoras que un jugador puede haber pagado al llegar a cada fase (para las pruebas automáticas)
  C.progresoEsperado = (fase) => {
    const d = datos(), n = [1, 1, 2, 2, 3, 3, 4][fase];
    d.niveles = { lanza: n, escudo: n, arco: n, bandera: Math.max(1, n - 1) };
    d.tropa = { lanza: fase >= 2 ? 4 : 3, escudo: fase >= 4 ? 3 : 2, arco: fase >= 4 ? 3 : 2, bandera: 1 };
  };
})(window.G);
