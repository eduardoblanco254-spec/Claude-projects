// 12_entrada.js — teclado, táctil y mando. Emite:
//   'tambor' (PATA | PON | CHAKA | DON) durante el juego, y 'tecla' (izq | der | arriba | abajo | ok | atras | pausa)
// para los menús. La UI decide qué hacer según G.estado.
(function (G) {
  const TAMBORES = { KeyA: 'PATA', KeyJ: 'PATA', ArrowLeft: 'PATA', KeyD: 'PON', KeyL: 'PON', ArrowRight: 'PON',
    KeyW: 'CHAKA', KeyI: 'CHAKA', ArrowUp: 'CHAKA', KeyS: 'DON', KeyK: 'DON', ArrowDown: 'DON' };
  const MENU = { ArrowLeft: 'izq', KeyA: 'izq', ArrowRight: 'der', KeyD: 'der', ArrowUp: 'arriba', KeyW: 'arriba',
    ArrowDown: 'abajo', KeyS: 'abajo', Enter: 'ok', Space: 'ok', KeyJ: 'ok', Escape: 'atras', Backspace: 'atras',
    KeyP: 'pausa' };
  const E = G.entrada = { tactil: false, ultima: 0 };

  function primerGesto() { G.audio.iniciar(); }
  addEventListener('keydown', (e) => {
    if (e.repeat) return;
    primerGesto();
    E.ultima = performance.now();
    if (G.estado === 'juego') {
      if (e.code === 'Escape' || e.code === 'KeyP') { G.emit('tecla', 'pausa'); e.preventDefault(); return; }
      const t = TAMBORES[e.code];
      if (t) { G.emit('tambor', t); e.preventDefault(); }
      return;
    }
    if (G.estado === 'calibrar' && TAMBORES[e.code]) { G.emit('tambor', TAMBORES[e.code]); e.preventDefault(); }
    const m = MENU[e.code];
    if (m) { G.emit('tecla', m); e.preventDefault(); }
  });

  // ---- Táctil / ratón: la UI define zonas en coordenadas del buffer (480×270)
  E.zonas = [];   // [{ x, y, w, h, tambor?, tecla?, accion? }]
  function aBuffer(ev) {
    const c = G.pantalla, r = c.getBoundingClientRect();
    return { x: (ev.clientX - r.left) / r.width * G.W, y: (ev.clientY - r.top) / r.height * G.H };
  }
  function toque(ev) {
    primerGesto();
    if (ev.pointerType === 'touch') E.tactil = true;
    const p = aBuffer(ev);
    for (const z of E.zonas) {
      if (p.x >= z.x && p.x < z.x + z.w && p.y >= z.y && p.y < z.y + z.h) {
        if (z.tambor) G.emit('tambor', z.tambor);
        else if (z.tecla) G.emit('tecla', z.tecla);
        else if (z.accion) z.accion();
        ev.preventDefault();
        return;
      }
    }
    if (G.estado !== 'juego') G.emit('tecla', 'ok');   // tocar en cualquier sitio = aceptar
  }
  addEventListener('DOMContentLoaded', () => {
    G.pantalla.addEventListener('pointerdown', toque);
    G.pantalla.addEventListener('contextmenu', (e) => e.preventDefault());
  });

  // ---- Mando: X=PATA, B=PON, Y=CHAKA, A=DON, Start=pausa; cruceta para menús
  const antes = {};
  E.actualizar = () => {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      const bot = (i) => p.buttons[i] && p.buttons[i].pressed;
      const mapa = G.estado === 'juego'
        ? { 2: ['tambor', 'PATA'], 1: ['tambor', 'PON'], 3: ['tambor', 'CHAKA'], 0: ['tambor', 'DON'], 9: ['tecla', 'pausa'] }
        : { 14: ['tecla', 'izq'], 15: ['tecla', 'der'], 12: ['tecla', 'arriba'], 13: ['tecla', 'abajo'], 0: ['tecla', 'ok'], 1: ['tecla', 'atras'], 9: ['tecla', 'ok'] };
      for (const k in mapa) {
        const id = p.index + ':' + k, on = bot(+k);
        if (on && !antes[id]) { primerGesto(); G.emit(mapa[k][0], mapa[k][1]); }
        antes[id] = on;
      }
    }
  };
})(window.G);
