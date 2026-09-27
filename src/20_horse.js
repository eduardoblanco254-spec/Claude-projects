// 20_horse.js — caballo y monarca: estado, estamina, marcha procedural, animaciones y efectos.
(function (K) {
  const U = K.util, C = K.CONFIG, P = K.params;
  const GY = K.GROUND_Y;
  const RY = K.royal;

  // ================================================================ paletas
  // Pelajes por tabla: las matrices usan letras y cada pelaje pone sus colores.
  // L luz, B base, S sombra, D sombra profunda, N hocico, E ojo, M/m/K crin y cola, W/w calcetín, H casco.
  const COATS = {
    gray: {
      L: '#ADAEB7', B: '#8A8A94', S: '#5E5F6E', D: '#464758', N: '#61616E', E: '#16151B',
      M: '#3B3A44', m: '#57565F', K: '#27262E', W: '#D8D4CC', w: '#A7A39C', H: '#3A3433',
    },
    chestnut: {
      L: '#96665F', B: '#7B4E53', S: '#623128', D: '#47221C', N: '#52302A', E: '#170D0B',
      M: '#462823', m: '#673F30', K: '#2B1512', W: '#F0D8CE', w: '#C5A99F', H: '#382622',
    },
  };
  // Monarca: corona g/y/o, cara f/F/h/k, túnica t/T/u, pierna y bota p/P/b, capa c/C/v.
  const ROYAL = {
    g: '#EB9B36', y: '#FFD37C', o: '#A65C1E',
    f: RY.skin, F: U.shade(RY.skin, 0.8), h: '#4A2F24', k: '#231918',
    t: '#5F4FA0', T: '#433779', u: '#7C6DC2',
    p: '#EEE9D6', P: '#BDB6A0', b: '#3A2A25',
    c: RY.cape[0], C: RY.cape[1], v: U.lerpColor(RY.cape[0], '#FFFFFF', 0.2),
  };

  // ================================================================ matrices (coords locales)
  // Origen = centro del caballo sobre GROUND_Y, mirando a la derecha. ax/ay = esquina sup-izq.
  const part = (ax, ay, rows) => ({ ax, ay, rows });
  const pad = (rows) => { const w = Math.max(...rows.map((r) => r.length)); return rows.map((r) => r.padEnd(w, '.')); };

  // Tronco en barril: anca y hombro como masas redondas (luz arriba, línea de sombra delante del muslo y tras la espalda).
  const BODY = part(-15, -23, [
    '....LLLLLL',
    '..LLLLLLLLLLLLLLLLLLLLL',
    '.LLLLLLLBBBBBBBBBBSBBBBL',
    'BLLLLLBBBBSBBBBBBBSBBBLLB',
    'BBLLLBBBBSBBBBBBBBSBBBLBBB',
    'SBBBBBBBSBBBBBBBBSBBBBBBBB',
    'SBBBBBBSBBBBBBBBBSBBBBBBBS',
    'SBBBBBBSBBBBBBBBSBBBBBBBBS',
    'SBBBBBSBBBSSSSSSSBBBBBBBSS',
    '.SBBBBSSSSSSSSSSSBBBBBBSS',
    '.DSBBSSSSSSSSSSSSSBBBBSD',
    '..DSBBS.DDDDDDDDD.SBBSD',
    '...DSBS...........SBBS',
  ]);
  // Cuello grueso y arqueado; la franja clara bajo la crin marca la luz cenital.
  const NECK = part(1, -28, [
    '..........BBBS',
    '........BBBBBS',
    '......BBBBBBBS',
    '....BBBBBBLLLS',
    '..BBBBBBLLBBSS',
    '.BBBBBLLBBBBSS',
    '.BBBLLBBBBBBSS',
    '.BLLBBBBBBBBSS',
    '.LBBBBBBBBBSS',
    '.BBBBBBBBBBSS',
    '..BBBBBBBBSS',
    '...BBBBBBBSS',
    '....BBBBBSS',
    '.....BBBBSS',
    '......SSSS',
  ]);
  // Cabeza grande: frente clara, carrillo redondo, hocico oscuro, ojo de 1 px bajo el copete.
  const HEAD = part(10, -30, [
    '....L',
    '...SBL',
    '..MSBB',
    '..MBMML',
    '..BLmML',
    '.BBLBMLL',
    '.BBEBBLL',
    '.BBBBBBLL',
    '.SBBBBBBL',
    '.SSBBBBBBL',
    '..SSBBBBBLL',
    '...SSSBBBBL',
    '.....DSNNNN',
    '......DNNDN',
    '......DDNNN',
    '........DD',
  ]);
  // Pastando: cuello en arco que baja hasta el suelo y cabeza casi vertical.
  const NECK_LOW = part(1, -25, [
    '....BB',
    '..BBBBBBB',
    '.BBBBBBBBB',
    '.BBBBBBBBBB',
    '.BBBBBBBBBBB',
    '.BBBLLLLBBBB',
    '.BLLBBBBLLBBB',
    '..BBBBBBBBLLB',
    '...SBBBBBBBBLL',
    '....SBBBBBBBBB',
    '.....SSBBBBBBBL',
    '.......SSBBBBBB',
    '.........SSBBBB',
    '...........SBBB',
    '............SBB',
  ]);
  const HEAD_LOW = part(12, -14, [
    '...L',
    '..SBL',
    '.MMBBL',
    '.MmMBL',
    'BBMBBBL',
    'SBEBBBL',
    'SBBBBBL',
    '.SBBBBB',
    '.SSBBBL',
    '..SBBBB',
    '..SSBBB',
    '...DNNN',
    '...DNNN',
    '....DND',
  ]);
  const KING = part(-4, -41, [
    '..y.y.y',
    '..gygyg',
    '..ogggo',
    '..hffff',
    '..hffkf',
    '..hFffff',
    '...FFFF',
    '...Ttu',
    '..Ttuut',
    '..Tttuu',
    '..Ttttu',
    '..TttTt',
    '..TttTtt',
    '..TtttTtf',
    '..Tttt',
    '..TTtt',
    '..Tooo',
    '.TTtttt',
    '.TTTtttt',
  ]);
  // Variante inclinada al galope: cabeza y corona 1 px hacia delante.
  const KING_LEAN = part(-4, -41, KING.rows.map((r, i) => (i < 7 ? '.' + r : r)));
  const LEG = part(-1, -23, [
    '.ppp',
    '.pppp',
    '.PPPp',
    '...Pp',
    '...Pp',
    '...bb',
    '...bb',
    '...bbb',
    '...ooo',
  ]);
  const EYE = [13, -24], EYE_LOW = [14, -9];       // para el parpadeo
  const HAND = [5, -28], BIT = [16, -17], BIT_LOW = [15, -3];

  // ================================================================ rejilla y rasterizado
  function grid(w, h) {
    const a = Array.from({ length: h }, () => new Array(w).fill('.'));
    return {
      w, h,
      set(x, y, ch) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < w && y < h) a[y][x] = ch; },
      rows() { return a.map((r) => r.join('')); },
    };
  }
  // Relleno de polígono por filas (centros de píxel), sin antialiasing.
  function polyFill(g, pts, ch) {
    let y0 = Infinity, y1 = -Infinity;
    for (const q of pts) { y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      const yc = y + 0.5, xs = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) xs.push(a[0] + ((yc - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
      }
      xs.sort((m, n) => m - n);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) g.set(x, y, ch);
    }
  }

  // ---- Crin: mechones sobre la línea de la cruz; con viento se levantan y se van hacia atrás.
  const CREST = [[1, -22], [2, -23], [3, -24], [4, -24], [5, -25], [6, -25], [7, -26], [8, -26], [9, -27], [10, -27], [11, -28], [12, -28], [13, -28]];
  const CREST_LOW = [[2, -23], [3, -24], [4, -24], [5, -25], [6, -25], [7, -24], [8, -24], [9, -24], [10, -23], [11, -22], [12, -21], [13, -19], [14, -17]];
  const LOCK = [2, 1, 1, 2, 3, 1, 1, 2, 1, 0, 1, 0, 0]; // largo extra de cada mechón
  function manePart(crest, lift, ph) {
    const gx = -4, gy = -36, g = grid(22, 22);
    crest.forEach(([x, cy], i) => {
      const up = lift > 0 ? Math.max(1, Math.round(lift * (1.8 + Math.sin(x * 1.3 + ph) * 1.3))) : 0;
      const ext = lift > 0 ? (LOCK[i] >> 1) : LOCK[i];
      const top = cy - 1 - up, bot = cy + 1 + ext;
      for (let y = top; y <= bot; y++) {
        const lean = y < cy - 1 ? Math.round((cy - 1 - y) * 0.9) : 0; // al viento las puntas van hacia atrás
        const ch = y === top ? 'm' : y === bot && ext >= 2 ? 'K' : (y === top + 1 && (i & 1)) ? 'm' : 'M';
        g.set(x - lean - gx, y - gy, ch);
      }
    });
    return part(gx, gy, g.rows());
  }

  // ---- Cola: línea central que cae desde el nacimiento; ancho variable y mechones claro/oscuro.
  function tailPart(lift, swish, ph) {
    const gx = -28, gy = -28, g = grid(20, 32);
    let x = -14, y = -21;
    const th0 = U.lerp(1.5, 2.25, lift), th1 = U.lerp(0.1, 0.8, lift);
    const len = U.lerp(19, 18, lift), step = 0.3, n = Math.ceil(len / step);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const th = th1 + (th0 - th1) * Math.pow(1 - t, U.lerp(5, 1.7, lift)) + swish * Math.sin(Math.PI * t) * 0.5 + lift * Math.sin(t * 8 - ph) * 0.32 * t;
      const dx = -Math.sin(th), dy = Math.cos(th), nx = dy, ny = -dx;
      // Fino en el nacimiento, abundante abajo y con la punta abierta.
      const w = t < 0.08 ? 2 : Math.max(2, Math.round(2.2 + 3 * Math.sin(Math.PI * Math.min(1, 0.1 + t * 0.95))));
      for (let j = 0; j < w; j++) {
        const off = j - (w - 1) / 2;
        const ch = j === 0 ? 'm' : j === w - 1 ? 'K' : (j === 2 && ((i >> 2) & 1)) ? 'm' : 'M';
        g.set(x + nx * off - gx, y + ny * off - gy, ch);
      }
      x += dx * step; y += dy * step;
    }
    return part(gx, gy, g.rows());
  }
  // Variantes: [alzada, latigazo, fase]. 0 reposo, 1-2 latigazo, 3-5 paso, 6-8 galope.
  const TAIL_V = [[0, 0.15, 0], [0, 0.8, 0], [0, -0.45, 0], [0.25, -0.15, 0], [0.25, 0.1, 0], [0.25, 0.3, 0], [1, 0, 0], [1, 0, 2.1], [1, 0, 4.2]];

  // ---- Capa: polígono entre la pose en reposo (cae sobre la grupa) y al viento; pliegues radiales.
  const CAPE_REST = [[-1, -34], [-3, -34.5], [-5, -31.5], [-7.5, -28], [-10, -25.5], [-12.5, -23.5], [-14, -21], [-13.5, -18.5], [-10.5, -18], [-7.5, -18.5], [-4.5, -19], [-2.5, -23], [-1, -30]];
  const CAPE_FLY = [[-1, -34], [-3, -35], [-7, -35], [-11, -34.5], [-14.5, -33.5], [-17.5, -32.5], [-18.5, -30.5], [-15.5, -29], [-12, -27.5], [-8.5, -26.5], [-5, -25.5], [-2.5, -25], [-1, -30]];
  function capePart(a, ph) {
    const gx = -23, gy = -38, W = 24, H = 27, g = grid(W, H);
    const pts = CAPE_REST.map((q, i) => {
      const r = CAPE_FLY[i];
      let x = U.lerp(q[0], r[0], a), y = U.lerp(q[1], r[1], a);
      if (i >= 4 && i <= 10) { const s = Math.sin(ph * 2.1 + i * 1.3) * (0.3 + a * 1.1); y += s; x -= s * 0.5 * a; }
      return [x - gx, y - gy];
    });
    polyFill(g, pts, 'c');
    const rows = g.rows(), out = rows.map((r) => r.split(''));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (rows[y][x] !== 'c') continue;
      const up = y > 0 ? rows[y - 1][x] : '.', dn = y < H - 1 ? rows[y + 1][x] : '.';
      const lx = x + gx + 2, ly = y + gy + 34; // relativo al hombro
      const fold = Math.sin(Math.atan2(ly, -lx) * 10 + ph * 0.8 + Math.hypot(lx, ly) * 0.15);
      out[y][x] = up === '.' ? 'v' : dn === '.' ? 'C' : fold > 0.55 ? 'C' : 'c';
    }
    return part(gx, gy, out.map((r) => r.join('')));
  }

  // ================================================================ juegos de sprites por pelaje
  const sets = {};
  function setFor(coat) {
    coat = COATS[coat] ? coat : 'gray';
    if (sets[coat]) return sets[coat];
    const pal = Object.assign({}, COATS[coat], ROYAL);
    const mk = (pt, name) => ({ s: U.sprite(pad(pt.rows), pal, 'horse.' + name), ax: pt.ax, ay: pt.ay });
    const st = { pal, rear: [] };
    st.body = mk(BODY, 'body');
    st.neck = mk(NECK, 'neck');
    st.head = mk(HEAD, 'head');
    st.neckLow = mk(NECK_LOW, 'neckLow');
    st.headLow = mk(HEAD_LOW, 'headLow');
    st.king = mk(KING, 'king');
    st.kingLean = mk(KING_LEAN, 'kingLean');
    st.leg = mk(LEG, 'leg');
    st.mane = [mk(manePart(CREST, 0, 0), 'mane0'), mk(manePart(CREST, 1, 0), 'mane1'), mk(manePart(CREST, 1, 2.6), 'mane2')];
    st.maneLow = mk(manePart(CREST_LOW, 0, 0), 'maneLow');
    st.tail = TAIL_V.map((v, i) => mk(tailPart(v[0], v[1], v[2]), 'tail' + i));
    st.cape = [];
    [0, 0.3, 0.62, 1].forEach((a) => { for (let k = 0; k < 3; k++) st.cape.push(mk(capePart(a, k * 2.1), 'cape')); });
    // Colores de patas: [0] cercanas, [1] lejanas (más oscuras).
    st.legCol = [
      { ub: pal.S, uf: pal.B, sb: pal.w, sf: pal.W, hoof: pal.H },
      { ub: pal.D, uf: pal.S, sb: U.shade(pal.w, 0.78), sf: pal.w, hoof: pal.K },
    ];
    return (sets[coat] = st);
  }

  // ================================================================ dibujo en coords locales
  let OX = 0, OY = 0, DR = 1; // origen en pantalla y dirección del dibujo en curso
  const at = (x, y, d) => { OX = x; OY = y; DR = d; };
  function spr(ctx, pt, dx = 0, dy = 0) {
    const s = pt.s;
    ctx.drawImage(DR > 0 ? s.r : s.l, DR > 0 ? OX + pt.ax + dx : OX - pt.ax - dx - s.w, OY + pt.ay + dy);
  }
  function box(ctx, x, y, w, h, col) { ctx.fillStyle = col; ctx.fillRect(DR > 0 ? OX + x : OX - x - w, OY + y, w, h); }
  // Sprite partido en dos mitades con distinto desplazamiento vertical (cabeceo del cuerpo).
  function sprSplit(ctx, pt, splitX, dyBack, dyFront) {
    const s = pt.s, cut = splitX - pt.ax, y = OY + pt.ay;
    if (DR > 0) {
      ctx.drawImage(s.r, 0, 0, cut, s.h, OX + pt.ax, y + dyBack, cut, s.h);
      ctx.drawImage(s.r, cut, 0, s.w - cut, s.h, OX + pt.ax + cut, y + dyFront, s.w - cut, s.h);
    } else {
      ctx.drawImage(s.l, s.w - cut, 0, cut, s.h, OX - pt.ax - cut, y + dyBack, cut, s.h);
      ctx.drawImage(s.l, 0, 0, s.w - cut, s.h, OX - pt.ax - s.w, y + dyFront, s.w - cut, s.h);
    }
  }
  function line(ctx, x0, y0, x1, y1, col) {
    ctx.fillStyle = col;
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    for (let n = 0; n < 200; n++) {
      ctx.fillRect(DR > 0 ? OX + x0 : OX - x0 - 1, OY + y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
  }

  // ================================================================ patas (IK de dos segmentos)
  // rx/ry = raíz (columna izquierda de la pata de 2 px); bend +1 rodilla adelante, -1 corvejón atrás.
  const LEGS = {
    HF: { rx: -13, ry: -11, l1: 5.8, l2: 6, bend: -1, far: 1 },
    FF: { rx: 3, ry: -11, l1: 5.5, l2: 5.6, bend: 1, far: 1 },
    HN: { rx: -11, ry: -11, l1: 5.8, l2: 6, bend: -1, far: 0 },
    FN: { rx: 5, ry: -11, l1: 5.5, l2: 5.6, bend: 1, far: 0 },
  };
  function ik(rx, ry, fx, fy, l1, l2, bend) {
    const dx = fx - rx, dy = fy - ry, d = Math.hypot(dx, dy);
    if (d >= l1 + l2 - 0.01 || d < 0.01) { const k = l1 / (l1 + l2); return [rx + dx * k, ry + dy * k]; }
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    const ux = dx / d, uy = dy / d;
    return [rx + ux * a + uy * h * bend, ry + uy * a - ux * h * bend];
  }
  // Segmento de 2 px: columna trasera/delantera (o fila inferior/superior si es casi horizontal).
  // thick = píxeles iniciales con una tercera columna de músculo (delante en la mano, detrás en la pata).
  function seg(ctx, ax, ay, bx, by, cb, cf, sock, sb, sf, thick, side) {
    const dx = bx - ax, dy = by - ay, n = Math.max(1, Math.round(Math.max(Math.abs(dx), Math.abs(dy))));
    const vert = Math.abs(dy) >= Math.abs(dx);
    for (let i = 0; i <= n; i++) {
      const x = Math.round(ax + (dx * i) / n), y = Math.round(ay + (dy * i) / n);
      const s = i > n - sock, b = s ? sb : cb, f = s ? sf : cf;
      if (vert) {
        box(ctx, x, y, 1, 1, b); box(ctx, x + 1, y, 1, 1, f);
        if (i < thick) box(ctx, side > 0 ? x + 2 : x - 1, y, 1, 1, side > 0 ? f : b);
      } else { box(ctx, x, y, 1, 1, f); box(ctx, x, y + 1, 1, 1, b); }
    }
  }
  function drawLeg(ctx, st, key, pose, dyRoot) {
    const L = LEGS[key], c = st.legCol[L.far];
    const ry = L.ry + dyRoot, fx = L.rx + pose[0], fy = -pose[1];
    const [jx, jy] = ik(L.rx, ry, fx, fy, L.l1, L.l2, L.bend);
    seg(ctx, L.rx, ry, jx, jy, c.ub, c.uf, 0, 0, 0, L.bend > 0 ? 3 : 4, L.bend);
    seg(ctx, jx, jy, fx, fy, c.ub, c.uf, 4, c.sb, c.sf, 0, 0);
    const hx = Math.round(fx), hy = Math.round(fy);
    if (Math.abs(fx - jx) > Math.abs(fy - jy) * 1.3) box(ctx, hx - (fx < jx ? 1 : 0), hy, 2, 2, c.hoof); // casco doblado
    else { box(ctx, hx, hy + 1, 2, 1, c.hoof); box(ctx, hx, hy + 2, 3, 1, c.hoof); }
  }

  // ================================================================ tablas de marcha
  // [dx del casco respecto a la raíz, alzada] por frame propio de la pata (0 = apoyo recién puesto).
  // Paso: 4 frames de apoyo (4 px/frame = zancada 32) y 4 de vuelo; la mano dobla la rodilla al alzarse.
  const WALK_F = [[6, 0], [2, 0], [-2, 0], [-6, 0], [-5, 3], [-1, 4], [3, 3], [6, 1]];
  const WALK_H = [[6, 0], [2, 0], [-2, 0], [-6, 0], [-4, 2], [-1, 3], [3, 2], [5, 1]];
  const GAL_F = [[5.4, 0], [0, 0], [-5.4, 0], [-9, 2], [-7, 6], [-1, 8], [7, 5], [10, 2]];
  const GAL_H = [[5.4, 0], [0, 0], [-5.4, 0], [-9, 2], [-6, 5], [0, 6], [6, 4], [9, 1]];
  const OFF = { walk: { HN: 0, FN: 2, HF: 4, FF: 6 }, gallop: { HN: 0, HF: 1, FF: 3, FN: 4 } };
  const STRIDE_W = 32, STRIDE_G = 43;
  const WALK_DY = [0, -1, -1, 0, 0, -1, -1, 0], WALK_HEAD = [0, 0, 1, 1, 0, 0, 1, 1];
  const GAL_DR = [0, 1, 1, 0, 0, -1, -1, -1], GAL_DF = [-1, -1, 0, 0, 1, 1, 0, -1];
  const GAL_HEAD = [0, 0, 1, 1, 0, 0, -1, -1], GAL_K = [0, 1, 0, 0, 0, 1, 0, 0];
  const IDLE_LEGS = { HF: [-1, 0], FF: [-1, 0], HN: [1, 0], FN: [1, 0] };
  const GRAZE_LEGS = { HF: [-1, 0], FF: [-3, 0], HN: [1, 0], FN: [2, 0] };
  // Encabritarse: ángulo de cada frame, secuencia (10 fps) y manos recogidas.
  const REAR_ANG = [15, 25, 35, 30, 20];
  const REAR_SEQ = [0, 1, 2, 2, 2, 3, 4];
  const REAR_LEN = REAR_SEQ.length / 10;
  const REAR_FORE = [
    { FN: [-2, 6], FF: [0, 4] }, { FN: [-1, 8], FF: [-3, 6] }, { FN: [1, 8], FF: [-2, 8] },
    { FN: [-1, 7], FF: [1, 7] }, { FN: [-2, 5], FF: [-1, 6] },
  ];
  const REAR_HIND = { HN: [2, 0], HF: [0, 0] };

  // slide = px que el cuerpo ya avanzó dentro del frame: los cascos apoyados retroceden lo mismo y quedan quietos en el mundo.
  function gaitLegs(TF, TH, off, f, slide = 0) {
    const L = {};
    for (const k in LEGS) {
      const q = (k[0] === 'F' ? TF : TH)[(f - off[k] + 8) & 7];
      L[k] = q[1] === 0 && slide ? [q[0] - slide, 0] : q;
    }
    return L;
  }
  // Pose = todo lo necesario para dibujar un frame (la usan el juego y la hoja de depuración).
  function makePose(anim, f, o = {}) {
    const pz = { anim, f, dyR: 0, dyF: 0, dyN: 0, dyH: 0, dyK: 0, legs: IDLE_LEGS, tail: 0, mane: 0, cape: 0, low: false, blink: !!o.blink, pant: false, lean: false };
    if (anim === 'walk') {
      pz.dyR = pz.dyF = pz.dyK = WALK_DY[f]; pz.dyH = WALK_HEAD[f];
      pz.legs = gaitLegs(WALK_F, WALK_H, OFF.walk, f, o.slide);
      pz.tail = 3 + [1, 2, 2, 1, 1, 0, 0, 1][f]; pz.cape = o.cape ?? 3 + (f >> 1) % 3;
    } else if (anim === 'gallop') {
      pz.dyR = GAL_DR[f]; pz.dyF = GAL_DF[f]; pz.dyH = GAL_HEAD[f]; pz.dyK = GAL_DF[f] + GAL_K[f];
      pz.legs = gaitLegs(GAL_F, GAL_H, OFF.gallop, f, o.slide);
      pz.tail = 6 + (o.tph ?? f % 3); pz.mane = 1 + (o.mph ?? (f >> 1) & 1); pz.cape = o.cape ?? 9 + f % 3; pz.lean = true;
    } else if (anim === 'graze') {
      pz.low = true; pz.dyH = f; pz.legs = GRAZE_LEGS; pz.tail = o.swish ?? 0; pz.cape = o.cape ?? 0;
    } else if (anim === 'pant') {
      pz.dyN = f; pz.dyH = 1 + f; pz.pant = f === 1; pz.cape = o.cape ?? 0;
    } else if (anim === 'idle') {
      pz.tail = o.swish ?? 0; pz.cape = o.cape ?? 0; pz.dyH = o.nod ? 1 : 0; // cabeceo ocasional
    }
    return pz;
  }

  // ================================================================ composición del jinete
  function drawNeckHead(ctx, st, pz) {
    const d = pz.dyF;
    if (pz.low) {
      spr(ctx, st.neckLow, 0, d); spr(ctx, st.maneLow, 0, d); spr(ctx, st.headLow, 0, d + pz.dyH);
      if (pz.blink) box(ctx, EYE_LOW[0], EYE_LOW[1] + d + pz.dyH, 1, 1, st.pal.S);
    } else {
      spr(ctx, st.neck, 0, d + pz.dyN); spr(ctx, st.mane[pz.mane], 0, d + pz.dyN); spr(ctx, st.head, 0, d + pz.dyH);
      if (pz.blink) box(ctx, EYE[0], EYE[1] + d + pz.dyH, 1, 1, st.pal.S);
      if (pz.pant) { box(ctx, 16, -15 + d + pz.dyH, 2, 1, st.pal.E); box(ctx, 18, -14 + d + pz.dyH, 2, 1, st.pal.D); } // boca abierta
    }
  }
  function drawRider(ctx, st, pz) {
    const d = pz.dyK;
    spr(ctx, st.cape[pz.cape], 0, d);
    spr(ctx, pz.lean ? st.kingLean : st.king, 0, d);
    spr(ctx, st.leg, 0, d);
  }
  function drawReins(ctx, st, pz) {
    const b = pz.low ? BIT_LOW : BIT;
    line(ctx, HAND[0], HAND[1] + pz.dyK, b[0], b[1] + pz.dyF + pz.dyH, st.pal.h);
  }
  function drawHorse(ctx, x, y, dir, pz, st) {
    at(x, y, dir);
    if (pz.anim === 'rear') { spr(ctx, rearFrame(st, pz.f)); return; }
    const L = pz.legs;
    drawLeg(ctx, st, 'HF', L.HF, pz.dyR);
    drawLeg(ctx, st, 'FF', L.FF, pz.dyF);
    spr(ctx, st.tail[pz.tail], 0, pz.dyR);
    sprSplit(ctx, st.body, -3, pz.dyR, pz.dyF);
    if (pz.pant) box(ctx, -6, -11 + pz.dyF, 8, 1, st.pal.D); // flancos que se hinchan
    drawLeg(ctx, st, 'HN', L.HN, pz.dyR);
    drawLeg(ctx, st, 'FN', L.FN, pz.dyF);
    drawNeckHead(ctx, st, pz);
    drawRider(ctx, st, pz);
    drawReins(ctx, st, pz);
  }

  // ---- Encabritarse: frames pre-renderizados y rotados con vecino más cercano.
  function blitRot(dst, src, cx, cy, ang, tx, ty) {
    const w = src.width, h = src.height, sd = src.getContext('2d').getImageData(0, 0, w, h).data;
    const tmp = U.canvas(w, h), img = tmp.x.createImageData(w, h), d = img.data;
    const cs = Math.cos(ang), sn = Math.sin(ang);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const X = x + 0.5 - tx, Y = y + 0.5 - ty;
      const sx = Math.floor(X * cs - Y * sn + cx), sy = Math.floor(X * sn + Y * cs + cy);
      if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
      const o = (sy * w + sx) * 4;
      if (sd[o + 3] === 0) continue;
      const q = (y * w + x) * 4;
      d[q] = sd[o]; d[q + 1] = sd[o + 1]; d[q + 2] = sd[o + 2]; d[q + 3] = 255;
    }
    tmp.x.putImageData(img, 0, 0);
    dst.drawImage(tmp.c, 0, 0);
  }
  function rearFrame(st, i) {
    if (st.rear[i]) return st.rear[i];
    const ang = (REAR_ANG[i] * Math.PI) / 180, CX = 32, CY = 56, PX = -10, PYv = -11;
    const pz = makePose('idle', 0); pz.legs = Object.assign({}, REAR_HIND, REAR_FORE[i]); pz.mane = 1 + (i & 1); pz.tail = 0; pz.cape = 3 + (i % 3);
    const rot = (x, y, a) => { const cs = Math.cos(a), sn = Math.sin(a), X = x - PX, Y = y - PYv; return [PX + X * cs + Y * sn, PYv - X * sn + Y * cs]; };
    const saveO = [OX, OY, DR];
    // Bloque del caballo (sin patas traseras ni cola), rotado entero sobre la cadera.
    const A = U.canvas(64, 64);
    at(CX, CY, 1);
    drawLeg(A.x, st, 'FF', pz.legs.FF, 0);
    spr(A.x, st.body);
    drawLeg(A.x, st, 'FN', pz.legs.FN, 0);
    drawNeckHead(A.x, st, pz);
    // Jinete: gira menos para mantenerse erguido.
    const B = U.canvas(64, 64);
    drawRider(B.x, st, pz);
    const out = U.canvas(64, 64), o = out.x;
    drawLeg(o, st, 'HF', REAR_HIND.HF, 0);
    const [tx, ty] = rot(-14.5, -20.5, ang);
    spr(o, st.tail[0], Math.round(tx + 14.5), Math.round(ty + 20.5));
    blitRot(o, A.c, CX + PX, CY + PYv, ang, CX + PX, CY + PYv);
    drawLeg(o, st, 'HN', REAR_HIND.HN, 0);
    const [sx, sy] = rot(0, -22, ang), ak = ang * 0.35;
    blitRot(o, B.c, CX, CY - 22, ak, CX + sx, CY + sy);
    // Riendas: de la mano (girada con el jinete) al bocado (girado con el caballo).
    const hx = HAND[0], hy = HAND[1] + 22;
    const hand = [sx + hx * Math.cos(ak) + hy * Math.sin(ak), sy - hx * Math.sin(ak) + hy * Math.cos(ak)];
    const bit = rot(BIT[0], BIT[1], ang);
    line(o, hand[0], hand[1], bit[0], bit[1], st.pal.h);
    [OX, OY, DR] = saveO;
    return (st.rear[i] = { s: U.withFlip(out.c), ax: -CX, ay: -CY });
  }

  // ================================================================ estado del jugador
  const p = K.player = {
    x: typeof P.x === 'number' ? P.x : 1160, y: GY, dir: P.dir === -1 ? -1 : 1, vx: 0, state: 'idle',
    stamina: typeof P.stamina === 'number' ? U.clamp(P.stamina, 0, 1) : 1,
    boost: typeof P.boost === 'number' ? Math.max(0, P.boost) : 0,
  };
  const LEFT = new Set(['KeyA', 'ArrowLeft']), RIGHT = new Set(['KeyD', 'ArrowRight']);
  // Límite del mundo según la figura real (medida en todas las poses): cola a −28 px y hocico a +20 px
  // del centro mirando a la derecha (espejo al revés). Con 30 px no se corta en ningún borde ni al girar.
  const EDGE = 30;
  const S = { phase: 0, frame: -1, still: 0, grazeT: -1, rearT: -1, tapDir: 0, tapT: -9, tapGallop: 0, prevWant: false, glow: 0, trailAcc: 0, trailK: 0, pose: makePose('idle', 0) };
  const rng = U.mulberry32((K.seed | 0) + 2020);
  const parts = []; // partículas: polvo, estela y destellos (x del mundo, y de pantalla)
  const DUST = { cobble: '#A39E92', coast: '#C9BB93', farm: '#9C8561' };
  // Estela del boost: por tiempo, no por frame (480/s = 8 por frame a 60 Hz), repartida en rotación entre
  // 4 patas × 2 alturas. Se corta en TRAIL_CAP para dejar sitio al polvo de los cascos y a los destellos.
  const MAX_PARTS = 320, TRAIL_CAP = 260, TRAIL_RATE = 480, LEG_KEYS = Object.keys(LEGS);

  function spawn(q) { if (parts.length < MAX_PARTS) parts.push(q); }
  // Posición del casco en el mundo a partir de coords locales.
  const worldX = (lx) => p.x + (p.dir > 0 ? lx + 0.5 : -lx - 0.5);

  function reward() {
    p.stamina = 1; p.boost = C.boostSeconds; S.glow = 1.6;
    for (let i = 0; i < 18; i++) {
      spawn({ kind: 'spark', x: p.x + (rng() * 40 - 20), y: GY - 4 - rng() * 32, vx: (rng() - 0.5) * 6, vy: -5 - rng() * 9, life: 0.7 + rng() * 0.9, max: 1.6, seed: rng() * 10 });
    }
  }

  function gamePose(st) {
    const t = K.t, o = {}, fixed = P.frame !== undefined ? P.frame | 0 : -1;
    const wind = (K.env && K.env.wind) || 0.3, spd = Math.abs(p.vx);
    o.blink = t % 3.7 < 0.13;
    const sw = t % 6.3; o.swish = sw < 0.22 ? 1 : sw < 0.45 ? 2 : 0;
    o.nod = t % 5.3 > 4.9;
    const lvl = spd < 1 ? 0 : spd <= C.walkSpeed + 0.5 ? 1 : spd < 70 ? 2 : 3;
    o.cape = lvl * 3 + (Math.floor(t * (lvl === 0 ? 1 + wind * 3 : 3 + lvl * 3)) % 3);
    o.tph = Math.floor(t * 9) % 3; o.mph = Math.floor(t * 10) % 2;
    const fr = (n, fps) => (fixed >= 0 ? fixed % n : Math.floor(t * fps) % n);
    if (st === 'walk' || st === 'gallop') {
      if (fixed >= 0) return makePose(st, fixed & 7, o);
      const ph8 = S.phase * 8, frac = ph8 - Math.floor(ph8), step = (st === 'gallop' ? STRIDE_G : STRIDE_W) / 8;
      o.slide = p.dir * (Math.round(p.x) - Math.round(p.x - p.dir * frac * step));
      return makePose(st, Math.floor(ph8) & 7, o);
    }
    if (st === 'graze') { o.swish = (t % 2.9) < 0.3 ? 1 : 0; return makePose('graze', fr(2, 5), o); }
    if (st === 'pant') return makePose('pant', fr(2, 4), o);
    if (st === 'rear') {
      const k = fixed >= 0 ? fixed % 5 : P.state === 'rear' ? REAR_SEQ[Math.floor(t * 10) % REAR_SEQ.length] : REAR_SEQ[Math.min(REAR_SEQ.length - 1, Math.floor(S.rearT * 10))];
      return makePose('rear', k, o);
    }
    return makePose('idle', 0, o);
  }

  function update(dt) {
    const inp = K.input, F = P.state;
    // Doble toque de la misma dirección en < 0.3 s: galope mientras se mantenga.
    for (const tp of inp.taps) {
      const d = RIGHT.has(tp.code) ? 1 : LEFT.has(tp.code) ? -1 : 0;
      if (!d) continue;
      if (d === S.tapDir && tp.t - S.tapT < 0.3) { S.tapGallop = d; S.tapDir = 0; } else { S.tapDir = d; S.tapT = tp.t; }
    }
    let dirIn = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    if (S.tapGallop && dirIn !== S.tapGallop) S.tapGallop = 0;
    let want = dirIn !== 0 && (inp.gallop || S.tapGallop === dirIn);
    if (F) { dirIn = F === 'walk' || F === 'gallop' ? p.dir : 0; want = F === 'gallop'; }
    const canGallop = p.stamina > 0 || p.boost > 0 || !!F;
    // Sin estamina, pedir galope hace que se encabrite.
    if (S.rearT >= 0 && (S.rearT += dt) >= REAR_LEN) S.rearT = -1;
    if (!F && S.rearT < 0 && want && !S.prevWant && !canGallop) { S.rearT = 0; p.vx = 0; }
    S.prevWant = want;
    const rearing = F === 'rear' || S.rearT >= 0;

    // Velocidad: acelera a vmáx×4/s, frena a vmáx×5/s y solo gira cuando está detenido.
    let target = 0;
    if (!rearing && dirIn) {
      if (dirIn !== p.dir && Math.abs(p.vx) < 1) { p.dir = dirIn; p.vx = 0; }
      if (dirIn === p.dir) target = want && canGallop ? C.gallopSpeed : C.walkSpeed;
    }
    let sp = Math.abs(p.vx);
    if (target > sp) sp = Math.min(target, sp + target * C.accelMul * dt);
    else sp = Math.max(target, sp - (sp > C.walkSpeed + 0.5 ? C.gallopSpeed : C.walkSpeed) * C.decelMul * dt);
    p.vx = sp * p.dir;
    p.x += p.vx * dt;
    if (p.x < EDGE || p.x > K.WORLD_W - EDGE) {
      p.x = U.clamp(p.x, EDGE, K.WORLD_W - EDGE);
      if (F) p.dir = -p.dir; else p.vx = 0;
    }

    // Fase de la marcha según la distancia recorrida: los cascos no patinan.
    const spd = Math.abs(p.vx), galloping = spd > C.walkSpeed + 0.5;
    S.phase = (S.phase + (spd * dt) / (galloping ? STRIDE_G : STRIDE_W)) % 1;

    // Estamina: el galope la gasta (salvo con boost); a 0 se encabrita y solo camina.
    if (galloping && !F) {
      if (p.boost > 0) p.boost = Math.max(0, p.boost - dt);
      else if (p.stamina > 0) {
        p.stamina = Math.max(0, p.stamina - dt / C.staminaGallopSeconds);
        if (p.stamina === 0) { S.rearT = 0; p.vx = 0; }
      }
    }

    // Estado
    let st;
    if (rearing || S.rearT >= 0) { st = 'rear'; S.still = 0; S.grazeT = -1; }
    else if (spd > 0.5) { st = galloping ? 'gallop' : 'walk'; S.still = 0; S.grazeT = -1; }
    else {
      S.still += dt;
      if (F) st = F === 'walk' || F === 'gallop' ? 'idle' : F;
      else {
        const ter = K.terrainAt(p.x), grassy = ter === 'meadow' || ter === 'grass';
        const hungry = p.stamina < 1 || p.boost < C.boostSeconds - 0.5;
        if (S.grazeT >= 0) { if ((S.grazeT += dt) >= C.grazeSeconds) { S.grazeT = -1; reward(); } }
        else if (S.still >= C.grazeDelay && grassy && hungry) S.grazeT = 0;
        st = S.grazeT >= 0 ? 'graze' : p.stamina < C.pantThreshold ? 'pant' : 'idle';
      }
    }
    p.state = st;
    const pz = (S.pose = gamePose(st));

    // Polvo al apoyar en el galope y estela blanca con boost.
    if (pz.anim === 'gallop' && pz.f !== S.frame) {
      const ter = K.terrainAt(p.x), col = DUST[ter] || '#A89372';
      for (const k in LEGS) {
        if (((pz.f - OFF.gallop[k] + 8) & 7) !== 0) continue;
        const lx = LEGS[k].rx + pz.legs[k][0] + 1;
        for (let i = 0; i < 2; i++) spawn({ kind: 'dust', x: worldX(lx) + (rng() - 0.5) * 3, y: GY + 1 - rng() * 2, vx: -p.dir * (6 + rng() * 14), vy: -8 - rng() * 12, life: 0.3 + rng() * 0.3, max: 0.6, col, s: rng() < 0.3 ? 2 : 1 });
      }
    }
    S.frame = pz.anim === 'gallop' || pz.anim === 'walk' ? pz.f : -1;
    if (p.boost > 0 && spd > 1 && pz.legs) {
      S.trailAcc += dt * TRAIL_RATE;
      const n = S.trailAcc | 0;
      S.trailAcc -= n;
      for (let j = 0; j < n && parts.length < TRAIL_CAP; j++) {
        const slot = S.trailK++ & 7, k = LEG_KEYS[slot >> 1], i = slot & 1, lp = pz.legs[k];
        const lx = LEGS[k].rx + lp[0] + (rng() < 0.5 ? 0 : 1);
        spawn({ kind: 'trail', x: worldX(lx), y: GY - lp[1] - 1 - i * 2 - Math.floor(rng() * 3), vx: 0, vy: -3, life: 0.3 + rng() * 0.25, max: 0.55 });
      }
    } else S.trailAcc = 0;
    // Brillo suave mientras duran los destellos.
    if (S.glow > 0) { S.glow -= dt; K.lights.push({ type: 'firefly', x: p.x, y: GY - 18, power: Math.min(1, S.glow) }); }
    for (let i = parts.length - 1; i >= 0; i--) {
      const q = parts[i];
      if ((q.life -= dt) <= 0) { parts[i] = parts[parts.length - 1]; parts.pop(); continue; }
      q.x += q.vx * dt; q.y += q.vy * dt;
      if (q.kind === 'dust') q.vy += 45 * dt; else if (q.kind === 'spark') q.vx *= 0.97;
    }
  }

  function drawParticles(ctx, front) {
    for (const q of parts) {
      if ((q.kind === 'spark') !== front) continue;
      const a = q.life / q.max, sx = K.sx(q.x), sy = Math.round(q.y);
      if (sx < -4 || sx > K.W + 4) continue;
      if (q.kind === 'spark') {
        ctx.globalAlpha = Math.min(1, a * 1.8);
        ctx.fillStyle = '#FFF6CF'; ctx.fillRect(sx, sy, 1, 1);
        if (a > 0.3 && (K.t * 10 + q.seed) % 2 < 1.1) {
          ctx.fillStyle = '#FFD66E';
          ctx.fillRect(sx - 1, sy, 1, 1); ctx.fillRect(sx + 1, sy, 1, 1); ctx.fillRect(sx, sy - 1, 1, 1); ctx.fillRect(sx, sy + 1, 1, 1);
        }
      } else if (q.kind === 'trail') {
        ctx.globalAlpha = Math.min(1, a * 1.8); ctx.fillStyle = a > 0.5 ? '#FFFFFF' : '#DCE8FF'; ctx.fillRect(sx, sy, 1, 1);
      } else {
        ctx.globalAlpha = a * 0.75; ctx.fillStyle = q.col; ctx.fillRect(sx, sy, q.s, q.s);
      }
    }
    ctx.globalAlpha = 1;
  }

  K.register('horse', {
    order: 20,
    init() { const st = setFor(C.horseCoat); for (let i = 0; i < REAR_ANG.length; i++) rearFrame(st, i); },
    update,
    drawPlayer(ctx) {
      const x = K.sx(p.x);
      if (x < -48 || x > K.W + 48) return;
      drawParticles(ctx, false);
      drawHorse(ctx, x, GY, p.dir, S.pose, setFor(C.horseCoat));
      drawParticles(ctx, true);
    },
  });

  // ================================================================ hoja de depuración (?view=horse)
  K.views.horse = (ctx) => {
    const rng8 = [0, 1, 2, 3, 4, 5, 6, 7];
    ['gray', 'chestnut'].forEach((coat, ci) => {
      const st = setFor(coat);
      const rows = [
        rng8.map((f) => makePose('walk', f)).concat([makePose('idle', 0), makePose('idle', 0, { blink: true, swish: 1 })]),
        rng8.map((f) => makePose('gallop', f)).concat([makePose('graze', 0), makePose('graze', 1)]),
        [makePose('pant', 0), makePose('pant', 1)].concat([0, 1, 2, 3, 4].map((f) => makePose('rear', f)), [makePose('idle', 0, { swish: 2, cape: 2 }), makePose('graze', 0, { swish: 1, blink: true })]),
      ];
      rows.forEach((row, ri) => row.forEach((pz, k) => drawHorse(ctx, 24 + k * 48, 42 + (ci * 3 + ri) * 45, 1, pz, st)));
    });
  };
})(window.K);
