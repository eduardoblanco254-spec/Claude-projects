// 13_progreso.js — guardado local (niveles superados, récords, ajustes). Si el navegador no deja guardar,
// el juego sigue igual sin guardar.
(function (G) {
  const CLAVE = 'tambores-junto-al-rio-v1';
  const base = () => ({ desbloqueado: 1, records: {}, latencia: 0, musica: true, vistoTutorial: false });
  const P = G.prog = { datos: base() };
  P.cargar = () => {
    if (G.prueba) return;
    try { const s = localStorage.getItem(CLAVE); if (s) P.datos = Object.assign(base(), JSON.parse(s)); } catch (_) {}
  };
  P.guardar = () => { if (G.prueba) return; try { localStorage.setItem(CLAVE, JSON.stringify(P.datos)); } catch (_) {} };
  P.superar = (nivel, puntos) => {
    P.datos.desbloqueado = Math.max(P.datos.desbloqueado, nivel + 1);
    P.datos.records[nivel] = Math.max(P.datos.records[nivel] || 0, puntos);
    P.guardar();
  };
  P.cargar();
})(window.G);
