// 00_config.js — constantes, configuración ajustable y disposición del mapa.
window.K = window.K || {};
(function (K) {
  K.W = 480;            // buffer interno
  K.H = 270;
  K.GROUND_Y = 170;     // donde pisan cascos y pies
  K.GRASS_BOTTOM = 190; // la tierra con hierba se ve hasta aquí
  K.WATER_Y = 190;      // borde superior del agua = eje del espejo
  K.WORLD_W = 2400;

  K.CONFIG = {
    seed: 7,
    reflectivity: 0.3,        // 0.3 en el original; prueba hasta 0.45
    horseCoat: 'gray',        // 'gray' | 'chestnut'

    walkSpeed: 40,            // px/s
    gallopSpeed: 80,
    accelMul: 4,              // acelera a vmáx × 4 por segundo
    decelMul: 5,              // frena a vmáx × 5 por segundo
    staminaGallopSeconds: 15, // el galope la agota en ~15 s
    grazeDelay: 1,            // quieto ≥1 s sobre pradera → pasta
    grazeSeconds: 3,
    boostSeconds: 45,
    pantThreshold: 0.2,

    camLead: 48,
    camMaxSpeed: 1200,

    // Día de ~4 min. blend = segundos que tarda en llegar al preset de la fase.
    phases: [
      { name: 'dawn',  len: 20,  blend: 10 },
      { name: 'day',   len: 125, blend: 15 },
      { name: 'dusk',  len: 20,  blend: 12 },
      { name: 'night', len: 75,  blend: 20 },
    ],
    startCycleT: 22,          // arranca justo después del amanecer
    fastForward: 10,          // tecla G
    grain: 0.022,
    darkColor: '#111114',
    presets: {
      dawn:  { sky: '#8C8CA6', horizon: '#CF7968', haze: '#F3F1E8', sun: '#FF6D40', darkness: 0.2, wind: 0.1 },
      day:   { sky: '#98BEEC', horizon: '#C4DAF1', haze: '#F3F1E8', sun: '#FFF766', darkness: 0.0, wind: 1.0 },
      dusk:  { sky: '#FF7F51', horizon: '#FFDF54', haze: '#FF9068', sun: '#FF7038', darkness: 0.1, wind: 0.1 },
      night: { sky: '#005EA5', horizon: '#002E80', haze: '#333333', sun: '#DDDDFF', darkness: 0.4, wind: 0.2 },
      blood: { sky: '#142744', horizon: '#AD2E21', haze: '#5C5D9E', sun: '#C73800', darkness: 0.4, wind: 0.2, darkColor: '#0E0B62' },
    },

    // La capa del monarca y el estandarte comparten color.
    capeColors: [
      ['#C43433', '#932827'],
      ['#3F6FB5', '#2B4C80'],
      ['#4E8A3E', '#35602A'],
      ['#D08A2E', '#9A6220'],
      ['#7B4AA0', '#553372'],
    ],
    skinTones: ['#F2C9A0', '#DDA77F', '#B97C55', '#85573A'],
  };

  // Disposición representativa de izquierda a derecha (en el juego es procedural).
  K.MAP = {
    zones: [
      { x0: 0,    x1: 450,  type: 'forest' },
      { x0: 450,  x1: 715,  type: 'meadow' },
      { x0: 715,  x1: 760,  type: 'grass' },
      { x0: 760,  x1: 1060, type: 'farm' },
      { x0: 1060, x1: 1100, type: 'grass' },
      { x0: 1100, x1: 1300, type: 'cobble' },
      { x0: 1300, x1: 1340, type: 'grass' },
      { x0: 1340, x1: 1750, type: 'meadow' },
      { x0: 1750, x1: 2150, type: 'forest' },
      { x0: 2150, x1: 2400, type: 'coast' },
    ],
    // x = centro del objeto salvo que se indique x0/x1. Se pueden ajustar ±15 px para evitar solapes.
    things: [
      { type: 'portal',     x: 100 },
      { type: 'camp',       x: 330 },
      { type: 'woodWall',   x: 720 },
      { type: 'tower',      x: 745 },
      { type: 'farm',       x0: 760, x1: 1060, streamX: 790 },
      { type: 'stoneWall',  x: 1080 },
      { type: 'torch',      x: 1108 },
      { type: 'shopHammer', x: 1142 },
      { type: 'campfire',   x: 1200 },
      { type: 'banner',     x: 1226 },
      { type: 'shopBow',    x: 1256 },
      { type: 'torch',      x: 1284 },
      { type: 'tower',      x: 1302 },
      { type: 'stoneWall',  x: 1320 },
      { type: 'statue',     x: 1950 },
      { type: 'dock',       x0: 2250, x1: 2400 },
    ],
  };
})(window.K);
