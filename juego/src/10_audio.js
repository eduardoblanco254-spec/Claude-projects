// 10_audio.js — música y sonidos sintetizados con Web Audio (sin archivos).
// El reloj del audio es el reloj del juego: G.t = ac.currentTime - desfase. Así notas, pasos y golpes
// nunca se separan. Las notas se programan con 0.15 s de margen (planificador sin cortes).
(function (G) {
  const U = G.u, BEAT = G.BEAT, CORCHEA = BEAT / 2;
  const N = { G2: 98, A2: 110, C3: 130.8, D3: 146.8, E3: 164.8, G3: 196, A3: 220, C4: 261.6, D4: 293.7, E4: 329.6,
    G4: 392, A4: 440, C5: 523.3, D5: 587.3, E5: 659.3, G5: 784, A5: 880 };
  // Temas: melodía en corcheas (32 = 4 compases) y bajo por pulso (16). null = silencio.
  const _ = null;
  const TEMAS = [
    { mel: ['E4', _, _, 'G4', 'A4', _, _, _, 'G4', _, 'E4', _, 'D4', _, _, _, 'E4', _, _, 'G4', 'A4', _, 'C5', _, 'A4', _, _, _, _, _, _, _],
      bajo: ['A2', _, 'E3', _, 'C3', _, 'G2', _, 'A2', _, 'E3', _, 'C3', _, 'E3', _], vol: 0.05 },
    { mel: ['A4', _, 'C5', 'A4', 'G4', _, 'E4', _, 'D4', 'E4', 'G4', _, 'A4', _, _, _, 'A4', _, 'C5', 'D5', 'E5', _, 'D5', 'C5', 'A4', _, 'G4', 'E4', 'A4', _, _, _],
      bajo: ['A2', 'A2', 'E3', 'A2', 'C3', 'C3', 'G3', 'E3', 'A2', 'A2', 'E3', 'A2', 'D3', 'D3', 'E3', 'E3'], vol: 0.065 },
    { mel: ['E5', _, 'D5', _, 'C5', _, 'A4', _, 'C5', _, 'D5', 'E5', 'D5', _, _, _, 'G4', _, 'A4', _, 'C5', _, 'D5', _, 'C5', 'A4', 'G4', _, 'A4', _, _, _],
      bajo: ['A2', _, 'A2', 'E3', 'G2', _, 'G2', 'D3', 'C3', _, 'C3', 'G3', 'E3', _, 'E3', 'A2'], vol: 0.06 },
    { mel: ['A4', 'A4', _, 'C5', _, 'A4', 'G4', _, 'E4', _, 'G4', 'A4', _, _, 'E4', _, 'D4', 'D4', _, 'E4', _, 'G4', 'A4', _, 'C5', _, 'A4', _, 'E4', _, _, _],
      bajo: ['A2', 'A2', 'A2', 'G2', 'E3', 'E3', 'D3', 'C3', 'A2', 'A2', 'A2', 'G2', 'E3', 'E3', 'E3', 'E3'], vol: 0.065 },
    { mel: ['A4', _, 'A4', 'C5', 'E5', _, 'D5', 'C5', 'A4', _, 'A4', 'C5', 'D5', _, 'E5', _, 'G5', _, 'E5', 'D5', 'C5', _, 'D5', 'E5', 'A4', _, 'C5', _, 'A4', _, _, _],
      bajo: ['A2', 'E3', 'A2', 'E3', 'G2', 'D3', 'G2', 'D3', 'C3', 'G3', 'C3', 'G3', 'E3', 'E3', 'E3', 'E3'], vol: 0.07 },
  ];
  // Contramelodía de fiebre: arpegio en corcheas una octava arriba.
  const FIEBRE = ['A5', 'E5', 'C5', 'E5', 'G5', 'E5', 'D5', 'E5'];
  const CANTOS = {
    marchar: ['E5', 'E5', 'E5', 'A4'], atacar: ['A4', 'A4', 'E5', 'A4'], defender: ['C5', 'C5', 'E5', 'A4'],
    retroceder: ['A4', 'E5', 'A4', 'E5'], cargar: ['A4', 'A4', 'G5', 'G5'],
  };
  const TAMBOR = { PATA: [200, 0.13, 0.4, 'triangle'], PON: [128, 0.16, 0.45, 'triangle'], CHAKA: [0, 0.08, 0.35, 'ruido'], DON: [70, 0.3, 0.55, 'sine'] };

  let ac = null, maestro = null, ruido = null, desfase = 0, prog = 0, pausado = false;
  let musicaOn = true, tema = 0, fiebre = false, canto = null, metronomo = false;

  function crearRuido() {
    const b = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  function nota(f, cuando, dur, vol, tipo = 'triangle', caida = 1) {
    if (!ac) return;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, cuando);
    g.gain.linearRampToValueAtTime(vol, cuando + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, cuando + dur);
    g.connect(maestro);
    if (tipo === 'ruido') {
      const s = ac.createBufferSource(), fl = ac.createBiquadFilter();
      s.buffer = ruido; fl.type = 'bandpass'; fl.frequency.value = f || 3000; fl.Q.value = 0.8;
      s.connect(fl).connect(g); s.start(cuando); s.stop(cuando + dur + 0.02);
      return;
    }
    const o = ac.createOscillator();
    o.type = tipo; o.frequency.setValueAtTime(f, cuando);
    if (caida !== 1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * caida), cuando + dur);
    o.connect(g); o.start(cuando); o.stop(cuando + dur + 0.02);
  }

  const A = G.audio = {
    iniciar() {
      if (ac || G.prueba) return;
      try {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        maestro = ac.createGain(); maestro.gain.value = 0.9; maestro.connect(ac.destination);
        ruido = crearRuido();
        desfase = ac.currentTime - G.t;
        prog = Math.ceil(G.t / CORCHEA);
      } catch (_) { ac = null; }
    },
    activo: () => !!ac && ac.state === 'running' && !pausado,
    // Tiempo del juego según el audio (o null si no hay audio)
    reloj: () => (ac && !pausado ? ac.currentTime - desfase : null),
    pausar(p) {
      pausado = p;
      if (!ac) return;
      if (p) ac.suspend(); else ac.resume().then(() => { desfase = ac.currentTime - G.t; prog = Math.ceil(G.t / CORCHEA); });
    },
    musica(on) { if (on !== undefined) musicaOn = on; return musicaOn; },
    tema(n) { tema = U.clamp(n, 0, TEMAS.length - 1); },
    fiebre(b) { fiebre = b; },
    metronomo(b) { metronomo = b; },
    canto(orden, pulso0) { canto = { orden, pulso0 }; },
    tambor(tipo) {
      if (!ac) return;
      const [f, d, v, ti] = TAMBOR[tipo];
      nota(ti === 'ruido' ? 4200 : f, ac.currentTime, d, v, ti, ti === 'ruido' ? 1 : 0.5);
      if (tipo === 'DON') nota(0, ac.currentTime, 0.12, 0.2, 'ruido');
    },
    sfx(nombre, vol = 1) {
      if (!ac) return;
      const t0 = ac.currentTime;
      switch (nombre) {
        case 'golpe': nota(900, t0, 0.07, 0.18 * vol, 'ruido'); nota(160, t0, 0.1, 0.18 * vol, 'square', 0.4); break;
        case 'escudo': nota(1400, t0, 0.09, 0.08 * vol, 'square', 0.9); nota(2100, t0, 0.06, 0.05 * vol, 'square', 0.9); break;
        case 'flecha': nota(1200, t0, 0.18, 0.05 * vol, 'triangle', 0.4); break;
        case 'muerte': nota(300, t0, 0.35, 0.14 * vol, 'square', 0.25); break;
        case 'jefe': nota(55, t0, 0.6, 0.5 * vol, 'sine', 0.5); nota(400, t0, 0.4, 0.3 * vol, 'ruido'); break;
        case 'aviso': nota(880, t0, 0.08, 0.08 * vol, 'square'); nota(880, t0 + 0.12, 0.08, 0.08 * vol, 'square'); break;
        case 'menu': nota(660, t0, 0.06, 0.08 * vol, 'square'); break;
        case 'ok': nota(660, t0, 0.07, 0.08 * vol, 'square'); nota(990, t0 + 0.07, 0.1, 0.08 * vol, 'square'); break;
        case 'fallo': nota(90, t0, 0.25, 0.2 * vol, 'square', 0.8); break;
        case 'fiebre': [523, 659, 784, 1047].forEach((f, i) => nota(f, t0 + i * 0.06, 0.15, 0.07, 'square')); break;
        case 'victoria': ['A4', 'C5', 'E5', 'A5', 'E5', 'A5'].forEach((n, i) => nota(N[n], t0 + i * 0.13, i === 5 ? 0.6 : 0.16, 0.09, 'square')); break;
        case 'derrota': ['E4', 'D4', 'C4', 'A3'].forEach((n, i) => nota(N[n], t0 + i * 0.22, 0.3, 0.09, 'triangle')); break;
      }
    },
    actualizar() {
      if (!ac || pausado) return;
      const hasta = ac.currentTime - desfase + 0.15;
      const T = TEMAS[tema];
      while (prog * CORCHEA < hasta) {
        const n = prog++, cuando = n * CORCHEA + desfase;
        if (cuando < ac.currentTime - 0.01) continue;
        const enPulso = n % 2 === 0, pulso = n >> 1;
        if (musicaOn) {
          const m = T.mel[n % T.mel.length];
          if (m) nota(N[m], cuando, 0.2, T.vol, 'square');
          if (enPulso) { const b = T.bajo[pulso % T.bajo.length]; if (b) nota(N[b], cuando, 0.42, 0.14, 'triangle'); }
          nota(n % 2 ? 6000 : 8000, cuando, 0.025, n % 2 ? 0.008 : 0.014, 'ruido');
          if (fiebre) {
            nota(N[FIEBRE[n % FIEBRE.length]], cuando, 0.12, 0.03, 'square');
            if (enPulso) nota(60, cuando, 0.15, 0.28, 'sine', 0.5);                  // bombo
            if (enPulso && pulso % 2 === 1) nota(2500, cuando, 0.1, 0.07, 'ruido');   // caja
          }
        }
        if (metronomo && enPulso) nota(pulso % 4 === 0 ? 1320 : 880, cuando, 0.05, 0.1, 'square');
        if (canto && enPulso) {
          const k = pulso - canto.pulso0;
          if (k >= 0 && k < 4) {
            const f = N[CANTOS[canto.orden][k]];
            nota(f, cuando, 0.28, 0.07, 'sawtooth', 0.97); nota(f * 1.5, cuando, 0.28, 0.03, 'square', 0.97);
          }
          if (k >= 4) canto = null;
        }
      }
    },
  };
  // Envolvente de la melodía para que los personajes se muevan con la música (determinista, sin audio).
  A.pulsoMelodia = (tt) => {
    const T = TEMAS[tema], n = Math.floor(tt / CORCHEA), m = T.mel[((n % T.mel.length) + T.mel.length) % T.mel.length];
    return m ? { e: Math.exp(-(tt - n * CORCHEA) * 12), alto: (N[m] - 400) / 400 } : { e: 0, alto: 0 };
  };
})(window.G);
