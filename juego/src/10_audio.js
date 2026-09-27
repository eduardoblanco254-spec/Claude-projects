// 10_audio.js — motor musical sintetizado (sin archivos) y efectos de sonido.
// Instrumentos: melodía (sierras desafinadas con filtro, flauta o cuadrada), pad de acordes, arpegio,
// bajo con sub-grave y batería (bombo, caja, charles, toms). Bus de efectos con reverberación y eco,
// y compresor en la salida. Canciones compuestas en grados de la escala con acordes por compás.
// El reloj del audio es el reloj del juego: G.t = ac.currentTime - desfase (120 ppm, pulso 0.5 s).
(function (G) {
  const U = G.u, BEAT = G.BEAT, SEMI = BEAT / 4, COMPAS = 16;   // semicorcheas; 16 por compás (2 s)
  const ESCALAS = { eolio: [0, 2, 3, 5, 7, 8, 10], jonico: [0, 2, 4, 5, 7, 9, 11], dorico: [0, 2, 3, 5, 7, 9, 10],
    mixo: [0, 2, 4, 5, 7, 9, 10], armonica: [0, 2, 3, 5, 7, 8, 11] };
  const BATERIAS = {
    suave:   { k: 'x.......x.......', s: '................', h: '..x...x...x...x.', t: '................' },
    marcha:  { k: 'x...x...x...x...', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', t: '................' },
    bosque:  { k: 'x.....x...x.....', s: '....x.......x...', h: '..x...x...x...x.', t: 'x.x.x.x.x.x.x.x.' },
    noche:   { k: 'x.........x.....', s: '........x.......', h: 'x..x..x..x..x..x', t: '................' },
    heroico: { k: 'x...x...x...x.x.', s: '....x.......x..x', h: 'xxxxxxxxxxxxxxxx', t: '................' },
    jefe:    { k: 'x..xx...x..xx...', s: '....x.......x.x.', h: 'xxxxxxxxxxxxxxxx', t: '..............xx' },
  };
  // Melodías: 8 compases por sección, 8 corcheas por compás. Grado 1–7, ' = octava arriba, , = abajo,
  // . = silencio, - = mantener la nota anterior.
  const CANCIONES = {
    titulo: { raiz: 69, escala: 'eolio', lead: 'flauta', bajo: 'lento', bat: 'suave', vol: 0.8,
      acA: [1, 6, 3, 7, 1, 6, 3, 7], acB: [4, 5, 1, 1, 4, 5, 6, 7],
      A: ['5 - - 3 1 - 2 3', '4 - 3 - 1 - - .', '3 - 5 - 1\' - 7 5', '7 - 5 - 2 - . .', '5 - - 3 1 - 2 3', '4 - 6 - 5 - 4 3', '3 - 2 - 3 5 - .', '2 - 1 - 1 - - .'],
      B: ['1\' - 7 - 6 - 5 -', '6 - 5 - 4 - 3 -', '3 - 1 - 3 5 1\' -', '7 - - 5 3 - - .', '1\' - 7 - 6 - 1\' -', '2\' - 1\' 7 5 - - .', '6 - - 5 4 3 2 3', '1 - - - . . . .'] },
    campamento: { raiz: 60, escala: 'jonico', lead: 'flauta', bajo: 'pulso', bat: 'suave', vol: 0.85,
      acA: [1, 6, 4, 5, 1, 6, 2, 5], acB: [4, 5, 3, 6, 4, 5, 1, 1],
      A: ['3 - 5 - 1\' - 7 6', '6 - 5 - 3 - . .', '4 - 6 - 1\' - 6 4', '5 - - - 2 3 4 -', '3 - 5 - 1\' - 2\' 1\'', '6 - 1\' - 3\' - 2\' 1\'', '2\' - 1\' - 6 - 4 -', '5 - - - . . . .'],
      B: ['4 - 6 - 1\' 6 4 -', '5 - 7 - 2\' - 7 -', '3 - 5 - 7 - 5 3', '6 - - - 1\' - 6 -', '4 - 6 - 1\' - 2\' -', '3\' - 2\' - 1\' - 7 -', '1\' - 5 - 3 - 5 -', '1 - - - . . . .'] },
    pradera: { raiz: 62, escala: 'dorico', lead: 'sierra', bajo: 'ocho', bat: 'marcha', vol: 0.8,
      acA: [1, 4, 1, 7, 1, 4, 3, 5], acB: [4, 5, 1, 1, 4, 5, 3, 5],
      A: ['1\' . 1\' 7 1\' - 5 -', '4 . 6 - 5 4 2 -', '1 . 3 5 1\' - 7 1\'', '7 - 5 - 3 - . .', '1\' . 1\' 7 1\' - 5 -', '6 . 5 4 6 - 1\' -', '3\' - 2\' 1\' 7 - 5 -', '5 - - - . . 5 7'],
      B: ['2\' - 1\' - 6 - 4 -', '3\' - 2\' - 1\' - 5 -', '1\' - 5 - 3 - 1 -', '2 3 4 5 6 7 1\' -', '2\' - 1\' - 6 - 4 6', '1\' - 3\' - 2\' 1\' 7 -', '6 - 5 - 3 - 1 -', '5 - 3 - 1 - - .'] },
    bosque: { raiz: 64, escala: 'eolio', lead: 'cuadrada', bajo: 'pulso', bat: 'bosque', vol: 0.8,
      acA: [1, 6, 3, 7, 1, 6, 4, 5], acB: [4, 5, 1, 1, 6, 7, 1, 1],
      A: ['5 - 3 - 5 - 1\' 7', '6 - 5 - 3 - . .', '5 - 7 - 1\' - 2\' -', '2\' - 1\' 7 5 - . .', '5 - 3 - 5 - 1\' 7', '6 - 1\' - 3\' - 2\' 1\'', '1\' - 7 6 4 - 6 -', '7 - - - . . . .'],
      B: ['4 - 6 - 1\' - 6 -', '5 - 7 - 2\' - 7 -', '1\' - 7 - 5 - 3 -', '5 - - 3 1 - . .', '6 - 1\' - 3\' - 1\' -', '7 - 2\' - 4\' - 2\' -', '3\' - 2\' - 1\' - 7 -', '1\' - - - . . . .'] },
    noche: { raiz: 66, escala: 'eolio', lead: 'flauta', bajo: 'lento', bat: 'noche', vol: 0.8,
      acA: [1, 6, 3, 7, 1, 6, 3, 7], acB: [4, 4, 1, 1, 6, 7, 5, 5],
      A: ['1\' - - 7 5 - - .', '6 - - 5 3 - - .', '5 - 3 - 1 - 3 5', '7 - - - . . . .', '1\' - - 7 5 - - 3\'', '2\' - - 1\' 6 - - .', '5 - 6 - 7 - 1\' -', '7 - - - 5 - - .'],
      B: ['4\' - - 3\' 1\' - - .', '6 - 1\' - 4\' - 3\' -', '3\' - - 2\' 1\' - - .', '5 - - - . . . .', '3\' - 1\' - 6 - 1\' -', '2\' - 7 - 5 - 7 -', '5 - 7 - 2\' - 1\' 7', '5 - - - . . . .'] },
    montana: { raiz: 67, escala: 'mixo', lead: 'sierra', bajo: 'galope', bat: 'heroico', vol: 0.8,
      acA: [1, 7, 4, 1, 1, 7, 4, 5], acB: [4, 5, 1, 1, 4, 7, 1, 1],
      A: ['1\' - - 5 1\' - 2\' -', '3\' - 2\' - 1\' - 7 -', '6 - - 4 6 - 1\' -', '5 - - - . . 5 5', '1\' - - 5 1\' - 2\' -', '3\' - 4\' - 5\' - 3\' -', '4\' - 3\' - 1\' - 6 -', '5 - - - 2\' - 5 -'],
      B: ['6 - 1\' - 4\' - 3\' -', '2\' - 5 - 7 - 2\' -', '3\' - - 2\' 1\' - 5 -', '1\' - - - . . . .', '4\' - 3\' - 1\' - 6 -', '7 - 1\' - 2\' - 4\' -', '5\' - 3\' - 1\' - 2\' -', '1\' - - - . . . .'] },
    jefe: { raiz: 69, escala: 'armonica', lead: 'sierra', bajo: 'galope', bat: 'jefe', vol: 0.85,
      acA: [1, 1, 4, 5, 1, 6, 4, 5], acB: [6, 6, 4, 4, 2, 2, 5, 5],
      A: ['1\' 7 1\' 3\' 5\' - 3\' 1\'', '7 - 5 - 3 - 5 -', '6 5 6 1\' 4\' - 1\' 6', '7 - 2\' - 5\' - 4\' 3\'', '1\' 7 1\' 3\' 5\' - 6\' 5\'', '4\' - 3\' - 1\' - 3\' -', '2\' - 1\' - 6 - 4 -', '7 - - - 7\' - - .'],
      B: ['1\' - 3\' - 1\' - 6 -', '3\' - 1\' - 6 - 3 -', '4 - 6 - 1\' - 4\' -', '3\' - 2\' - 1\' - 6 -', '2\' - 4\' - 6\' - 4\' -', '2\' - 1\' - 7 - 6 -', '7 - 2\' - 4\' - 7\' -', '5\' - - - 3\' - 7 -'] },
  };
  // Pre-procesa cada melodía en 16 compases × 8 corcheas: { grado, oct, dur } o null
  function parsear(c) {
    const notas = [];
    let ultima = null;
    for (const l of [...c.A, ...c.B]) {
      for (const t of l.trim().split(/\s+/)) {
        if (t === '.') { notas.push(null); ultima = null; }
        else if (t === '-') { notas.push(null); if (ultima) ultima.dur++; }
        else { ultima = { g: +t[0], oct: (t.match(/'/g) || []).length - (t.match(/,/g) || []).length, dur: 1 }; notas.push(ultima); }
      }
    }
    c.mel = notas; c.acordes = [...c.acA, ...c.acB];
  }
  for (const k in CANCIONES) parsear(CANCIONES[k]);
  const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function grado(c, g, oct = 0) {
    const e = ESCALAS[c.escala], i = g - 1;
    return c.raiz + e[((i % 7) + 7) % 7] + 12 * Math.floor(i / 7) + 12 * oct;
  }
  const triada = (c, gr, oct = 0) => [grado(c, gr, oct), grado(c, gr + 2, oct), grado(c, gr + 4, oct)];

  const TAMBOR = { PATA: [196, 0.14, 0.45], PON: [131, 0.18, 0.5], CHAKA: [0, 0.09, 0.35], DON: [73, 0.32, 0.6] };
  const CANTOS = { marchar: [5, 5, 5, 1], atacar: [1, 1, 5, 1], defender: [3, 3, 5, 1], retroceder: [1, 5, 1, 5], cargar: [1, 1, 7, 7] };

  let ac = null, salida = null, rev = null, eco = null, ruido = null, desfase = 0, prog = 0, pausado = false;
  let musicaOn = true, cancion = CANCIONES.titulo, nombreCancion = 'titulo', inicioCancion = 0, fiebre = false, canto = null, metronomo = false;

  function crearRuido() {
    const b = ac.createBuffer(1, ac.sampleRate, ac.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  function crearReverb(seg = 2.2) {
    const n = ac.sampleRate * seg, b = ac.createBuffer(2, n, ac.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6); }
    const cv = ac.createConvolver(); cv.buffer = b; return cv;
  }
  // Envolvente ADSR simple sobre un GainNode
  function env(g, t0, a, d, s, r, dur, pico) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(pico, t0 + a);
    g.gain.linearRampToValueAtTime(pico * s, t0 + a + d);
    g.gain.setValueAtTime(pico * s, t0 + Math.max(a + d, dur));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(a + d, dur) + r);
    return t0 + Math.max(a + d, dur) + r + 0.05;
  }
  function destino(g, envRev = 0, envEco = 0) {
    g.connect(salida);
    if (envRev) { const s = ac.createGain(); s.gain.value = envRev; g.connect(s); s.connect(rev); }
    if (envEco) { const s = ac.createGain(); s.gain.value = envEco; g.connect(s); s.connect(eco.entrada); }
  }
  // ---- Instrumentos
  const INST = {
    sierra(f, t0, dur, v) {
      const g = ac.createGain(), fl = ac.createBiquadFilter();
      fl.type = 'lowpass'; fl.Q.value = 3;
      fl.frequency.setValueAtTime(f * 1.5, t0); fl.frequency.linearRampToValueAtTime(f * 7, t0 + 0.03); fl.frequency.exponentialRampToValueAtTime(f * 2.5, t0 + 0.4);
      const fin = env(g, t0, 0.01, 0.12, 0.7, 0.18, dur, v);
      for (const det of [-7, 7]) {
        const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
        const vib = ac.createOscillator(), vg = ac.createGain(); vib.frequency.value = 5.5; vg.gain.setValueAtTime(0, t0); vg.gain.linearRampToValueAtTime(f * 0.006, t0 + 0.35);
        vib.connect(vg).connect(o.frequency); vib.start(t0); vib.stop(fin);
        o.connect(fl); o.start(t0); o.stop(fin);
      }
      fl.connect(g); destino(g, 0.28, 0.2);
    },
    flauta(f, t0, dur, v) {
      const g = ac.createGain(), fin = env(g, t0, 0.04, 0.1, 0.8, 0.25, dur, v * 1.2);
      const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
      const o2 = ac.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2; const g2 = ac.createGain(); g2.gain.value = 0.18;
      const vib = ac.createOscillator(), vg = ac.createGain(); vib.frequency.value = 5; vg.gain.setValueAtTime(0, t0); vg.gain.linearRampToValueAtTime(f * 0.008, t0 + 0.3);
      vib.connect(vg); vg.connect(o.frequency); vg.connect(o2.frequency);
      const aire = ac.createBufferSource(), fa = ac.createBiquadFilter(), ga = ac.createGain();
      aire.buffer = ruido; fa.type = 'bandpass'; fa.frequency.value = f * 2; fa.Q.value = 4; ga.gain.value = 0.05;
      aire.connect(fa).connect(ga).connect(g);
      o.connect(g); o2.connect(g2).connect(g);
      [o, o2, vib, aire].forEach((n) => { n.start(t0); n.stop(fin); });
      destino(g, 0.35, 0.22);
    },
    cuadrada(f, t0, dur, v) {
      const g = ac.createGain(), fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = f * 5;
      const fin = env(g, t0, 0.005, 0.08, 0.55, 0.15, dur, v * 0.8);
      for (const det of [-5, 5]) { const o = ac.createOscillator(); o.type = 'square'; o.frequency.value = f; o.detune.value = det; o.connect(fl); o.start(t0); o.stop(fin); }
      fl.connect(g); destino(g, 0.25, 0.25);
    },
    pad(fs, t0, dur, v) {
      const g = ac.createGain(), fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 1400; fl.Q.value = 0.7;
      const fin = env(g, t0, 0.35, 0.3, 0.8, 0.6, dur, v);
      for (const f of fs) for (const det of [-9, 0, 9]) { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; o.connect(fl); o.start(t0); o.stop(fin); }
      fl.connect(g); destino(g, 0.5);
    },
    pluck(f, t0, v) {
      const g = ac.createGain(), fl = ac.createBiquadFilter(); fl.type = 'lowpass';
      fl.frequency.setValueAtTime(f * 8, t0); fl.frequency.exponentialRampToValueAtTime(f * 1.2, t0 + 0.2);
      g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(v, t0 + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);
      const o = ac.createOscillator(); o.type = 'square'; o.frequency.value = f; o.connect(fl).connect(g); o.start(t0); o.stop(t0 + 0.3);
      destino(g, 0.3, 0.3);
    },
    bajo(f, t0, dur, v) {
      const g = ac.createGain(), fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = 5;
      fl.frequency.setValueAtTime(f * 6, t0); fl.frequency.exponentialRampToValueAtTime(f * 2, t0 + 0.15);
      const fin = env(g, t0, 0.005, 0.1, 0.75, 0.08, dur, v);
      const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(fl);
      const s = ac.createOscillator(); s.type = 'sine'; s.frequency.value = f / 2; const gs = ac.createGain(); gs.gain.value = 0.9; s.connect(gs).connect(g);
      fl.connect(g); o.start(t0); s.start(t0); o.stop(fin); s.stop(fin); destino(g, 0.05);
    },
    bombo(t0, v) {
      const g = ac.createGain(), o = ac.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(150, t0); o.frequency.exponentialRampToValueAtTime(42, t0 + 0.12);
      g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
      o.connect(g); o.start(t0); o.stop(t0 + 0.4); destino(g, 0.05);
    },
    caja(t0, v) {
      const g = ac.createGain(), n = ac.createBufferSource(), fl = ac.createBiquadFilter();
      n.buffer = ruido; fl.type = 'highpass'; fl.frequency.value = 1500;
      g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
      n.connect(fl).connect(g); n.start(t0, Math.random() * 0.5); n.stop(t0 + 0.2);
      const o = ac.createOscillator(), go = ac.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(220, t0); o.frequency.exponentialRampToValueAtTime(140, t0 + 0.08);
      go.gain.setValueAtTime(v * 0.7, t0); go.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.1); o.connect(go); go.connect(salida); o.start(t0); o.stop(t0 + 0.12);
      destino(g, 0.3);
    },
    charles(t0, v, abierto) {
      const g = ac.createGain(), n = ac.createBufferSource(), fl = ac.createBiquadFilter();
      n.buffer = ruido; fl.type = 'highpass'; fl.frequency.value = 7000;
      g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + (abierto ? 0.2 : 0.045));
      n.connect(fl).connect(g); n.start(t0, Math.random() * 0.5); n.stop(t0 + 0.22); destino(g, 0.1);
    },
    tom(t0, v, f = 110) {
      const g = ac.createGain(), o = ac.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(f * 1.6, t0); o.frequency.exponentialRampToValueAtTime(f, t0 + 0.1);
      g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
      o.connect(g); o.start(t0); o.stop(t0 + 0.32); destino(g, 0.2);
    },
  };
  // Nota simple para efectos
  function nota(f, t0, dur, vol, tipo = 'triangle', caida = 1) {
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    if (tipo === 'ruido') {
      const s = ac.createBufferSource(), fl = ac.createBiquadFilter(); s.buffer = ruido; fl.type = 'bandpass'; fl.frequency.value = f || 3000; fl.Q.value = 0.8;
      s.connect(fl).connect(g); s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.02);
    } else {
      const o = ac.createOscillator(); o.type = tipo; o.frequency.setValueAtTime(f, t0);
      if (caida !== 1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * caida), t0 + dur);
      o.connect(g); o.start(t0); o.stop(t0 + dur + 0.02);
    }
    destino(g, 0.15);
  }

  // ---- Programación de un paso (semicorchea n)
  function programarPaso(n, t0) {
    const c = cancion, rel = n - inicioCancion;
    if (rel < 0) return;
    const compas = Math.floor(rel / COMPAS), paso = rel % COMPAS, cIdx = compas % 16;
    const intro = compas < 2;              // los 2 primeros compases: solo pad y arpegio
    const ac1 = c.acordes[cIdx], acordes = triada(c, ac1, -1), raiz = grado(c, ac1, -2);
    const vol = c.vol, fv = fiebre ? 1 : 0;
    if (!musicaOn) return;
    // pad: un acorde por compás
    if (paso === 0) INST.pad(acordes.map(midiHz), t0, COMPAS * SEMI - 0.2, 0.022 * vol);
    // arpegio en semicorcheas (sube y baja), más presente en fiebre
    if (paso % (fiebre ? 1 : 2) === 0) {
      const orden = [0, 1, 2, 3, 2, 1], k = Math.floor(paso / (fiebre ? 1 : 2)) % orden.length;
      const m = orden[k] === 3 ? acordes[0] + 12 : acordes[orden[k]];
      INST.pluck(midiHz(m + 12), t0, (0.022 + 0.01 * fv) * vol);
    }
    if (intro) return;
    // bajo
    const b = c.bajo, fB = midiHz(raiz);
    if (b === 'lento' && paso % 8 === 0) INST.bajo(fB, t0, 0.9, 0.2 * vol);
    if (b === 'pulso' && paso % 4 === 0) INST.bajo(paso % 8 === 4 ? midiHz(raiz + 7) : fB, t0, 0.4, 0.2 * vol);
    if (b === 'ocho' && paso % 2 === 0) INST.bajo(paso % 8 === 6 ? fB * 2 : fB, t0, 0.2, 0.18 * vol);
    if (b === 'galope' && [0, 3, 4, 8, 11, 12].includes(paso)) INST.bajo(paso === 12 ? midiHz(raiz + 7) : fB, t0, 0.14, 0.2 * vol);
    // batería
    const bt = BATERIAS[c.bat];
    if (bt.k[paso] === 'x') INST.bombo(t0, 0.55 * vol);
    if (bt.s[paso] === 'x') INST.caja(t0, 0.22 * vol);
    if (bt.h[paso] === 'x') INST.charles(t0, (paso % 4 === 2 ? 0.06 : 0.035) * vol, paso === 14 && c.bat === 'marcha');
    if (bt.t[paso] === 'x') INST.tom(t0, 0.12 * vol, c.bat === 'jefe' ? 90 : 160);
    if (fiebre) { if (paso % 2 === 1) INST.charles(t0, 0.03, false); if (paso === 4 || paso === 12) INST.caja(t0, 0.08); }
    if (compas % 8 === 7 && paso >= 12) INST.tom(t0, 0.14 * vol, 200 - (paso - 12) * 30);    // redoble de paso de sección
    // melodía (corcheas)
    if (paso % 2 === 0) {
      const idx = cIdx * 8 + paso / 2, m = c.mel[idx];
      if (m) {
        const f = midiHz(grado(c, m.g, m.oct));
        INST[c.lead](f, t0, m.dur * 2 * SEMI - 0.03, 0.05 * vol);
        if (fiebre) INST.cuadrada(midiHz(grado(c, m.g + 2, m.oct + 1)), t0, m.dur * 2 * SEMI - 0.05, 0.018);
      }
    }
  }

  const A = G.audio = {
    iniciar(externo) {
      if (ac || (G.prueba && !externo)) return;
      try {
        ac = externo || new (window.AudioContext || window.webkitAudioContext)();
        const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.2;
        const maestro = ac.createGain(); maestro.gain.value = 0.85; comp.connect(maestro).connect(ac.destination);
        salida = ac.createGain(); salida.gain.value = 1; salida.connect(comp);
        ruido = crearRuido();
        rev = crearReverb(); const rg = ac.createGain(); rg.gain.value = 0.7; rev.connect(rg).connect(comp);
        const d = ac.createDelay(1); d.delayTime.value = BEAT * 0.75; const fb = ac.createGain(); fb.gain.value = 0.32;
        const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 2500;
        d.connect(fl).connect(fb).connect(d); const eg = ac.createGain(); eg.gain.value = 0.6; fl.connect(eg).connect(comp);
        eco = { entrada: d };
        desfase = ac.currentTime - G.t;
        prog = Math.ceil(G.t / SEMI);
        inicioCancion = Math.ceil(prog / COMPAS) * COMPAS;
      } catch (_) { ac = null; }
    },
    activo: () => !!ac && ac.state === 'running' && !pausado,
    reloj: () => (ac && !pausado ? ac.currentTime - desfase : null),
    pausar(p) {
      pausado = p;
      if (!ac) return;
      if (p) ac.suspend(); else ac.resume().then(() => { desfase = ac.currentTime - G.t; prog = Math.ceil(G.t / SEMI); });
    },
    musica(on) { if (on !== undefined) musicaOn = on; return musicaOn; },
    // Cambia de canción en el siguiente compás
    tema(nombre) {
      if (typeof nombre === 'number') nombre = ['titulo', 'pradera', 'bosque', 'noche', 'jefe'][nombre] || 'titulo';
      if (!CANCIONES[nombre] || nombre === nombreCancion) return;
      nombreCancion = nombre; cancion = CANCIONES[nombre];
      const ahora = Math.ceil(G.t / SEMI) + 2;
      inicioCancion = Math.ceil(ahora / COMPAS) * COMPAS;
    },
    cancion: () => nombreCancion,
    fiebre(b) { fiebre = b; },
    metronomo(b) { metronomo = b; },
    canto(orden, pulso0) { canto = { orden, pulso0 }; },
    tambor(tipo) {
      if (!ac) return;
      const [f, d, v] = TAMBOR[tipo], t0 = ac.currentTime;
      if (tipo === 'CHAKA') { INST.charles(t0, 0.25, true); nota(3500, t0, 0.08, 0.2, 'ruido'); return; }
      INST.tom(t0, v, f);
      if (tipo === 'DON') INST.bombo(t0, 0.5);
    },
    sfx(nombre, vol = 1) {
      if (!ac) return;
      const t0 = ac.currentTime;
      switch (nombre) {
        case 'golpe': nota(900, t0, 0.07, 0.16 * vol, 'ruido'); nota(160, t0, 0.1, 0.16 * vol, 'square', 0.4); break;
        case 'escudo': nota(1400, t0, 0.09, 0.07 * vol, 'square', 0.9); nota(2100, t0, 0.06, 0.05 * vol, 'square', 0.9); break;
        case 'flecha': nota(1200, t0, 0.18, 0.04 * vol, 'triangle', 0.4); break;
        case 'muerte': nota(300, t0, 0.35, 0.12 * vol, 'square', 0.25); break;
        case 'moneda': nota(1318, t0, 0.06, 0.06 * vol, 'square'); nota(1760, t0 + 0.06, 0.12, 0.06 * vol, 'square'); break;
        case 'jefe': INST.bombo(t0, 0.9 * vol); nota(400, t0, 0.4, 0.25 * vol, 'ruido'); break;
        case 'trueno': nota(120, t0, 1.6, 0.3 * vol, 'ruido'); INST.bombo(t0, 0.4 * vol); break;
        case 'aviso': nota(880, t0, 0.08, 0.08 * vol, 'square'); nota(880, t0 + 0.12, 0.08, 0.08 * vol, 'square'); break;
        case 'menu': nota(660, t0, 0.05, 0.06 * vol, 'square'); break;
        case 'ok': nota(660, t0, 0.07, 0.07 * vol, 'square'); nota(990, t0 + 0.07, 0.1, 0.07 * vol, 'square'); break;
        case 'mejora': [523, 659, 784, 1047, 1319].forEach((f, i) => INST.pluck(f, t0 + i * 0.05, 0.08)); break;
        case 'fallo': nota(90, t0, 0.25, 0.18 * vol, 'square', 0.8); break;
        case 'fiebre': [523, 659, 784, 1047].forEach((f, i) => INST.pluck(f, t0 + i * 0.06, 0.08)); break;
        case 'victoria': [69, 72, 76, 81, 76, 81].forEach((m, i) => INST.sierra(midiHz(m), t0 + i * 0.13, i === 5 ? 0.6 : 0.14, 0.07)); break;
        case 'derrota': [64, 62, 60, 57].forEach((m, i) => INST.flauta(midiHz(m), t0 + i * 0.22, 0.3, 0.07)); break;
      }
    },
    actualizar() {
      if (!ac || pausado) return;
      const hasta = ac.currentTime - desfase + 0.15;
      while (prog * SEMI < hasta) {
        const n = prog++, t0 = n * SEMI + desfase;
        if (t0 < ac.currentTime - 0.01) continue;
        programarPaso(n, t0);
        if (n % 4 === 0) {
          const pulso = n / 4;
          if (metronomo) nota(pulso % 4 === 0 ? 1320 : 880, t0, 0.05, 0.1, 'square');
          if (canto) {
            const k = pulso - canto.pulso0;
            if (k >= 0 && k < 4) {
              const m = grado(cancion, CANTOS[canto.orden][k], 0);
              INST.sierra(midiHz(m), t0, 0.28, 0.05); INST.sierra(midiHz(m + 7), t0, 0.28, 0.025);   // coro a dos voces
            }
            if (k >= 4) canto = null;
          }
        }
      }
    },
  };
  // Prueba: renderiza una canción sin tiempo real y devuelve { pico, rms por segundo, wav base64 }
  A.renderizar = async (nombre, seg, fiebreOn = false) => {
    const off = new OfflineAudioContext(1, Math.round(22050 * seg), 22050);
    ac = null; A.iniciar(off);
    desfase = 0; prog = 0; cancion = CANCIONES[nombre]; nombreCancion = nombre; inicioCancion = 0; fiebre = fiebreOn; musicaOn = true;
    for (let n = 0; n * SEMI < seg - 0.5; n++) programarPaso(n, n * SEMI);
    const buf = await off.startRendering(), d = buf.getChannelData(0);
    let pico = 0; const rms = [];
    for (let s0 = 0; s0 < d.length; s0 += 22050) { let q = 0; for (let i = s0; i < Math.min(d.length, s0 + 22050); i++) { q += d[i] * d[i]; pico = Math.max(pico, Math.abs(d[i])); } rms.push(Math.sqrt(q / 22050)); }
    const bytes = new Uint8Array(44 + d.length * 2), v = new DataView(bytes.buffer);
    const str = (o, t) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
    str(0, 'RIFF'); v.setUint32(4, 36 + d.length * 2, true); str(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 22050, true); v.setUint32(28, 44100, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, d.length * 2, true);
    for (let i = 0; i < d.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, d[i])) * 32767, true);
    let bin = ''; for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    ac = null;
    return { pico, rms, wav: btoa(bin) };
  };
  // Envolvente de la melodía en el instante tt (para que los personajes se muevan con la música)
  A.pulsoMelodia = (tt) => {
    const c = cancion, n = Math.floor(tt / (2 * SEMI)), rel = n - inicioCancion / 2;
    if (rel < 0) return { e: 0, alto: 0 };
    const idx = ((rel % 128) + 128) % 128, m = c.mel[idx];
    return m ? { e: Math.exp(-(tt - n * 2 * SEMI) * 10), alto: (m.g + 7 * m.oct - 4) / 7 } : { e: 0, alto: 0 };
  };
})(window.G);
