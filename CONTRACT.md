# Contrato técnico de "Reino a caballo"

Escena pixel art de desplazamiento lateral inspirada en *Kingdom Two Crowns* (ver `SPEC.md`, que manda en
lo visual). Arte **original** dibujado en código: nada de imágenes externas, nada de red, sin el nombre ni el
logo del juego dentro de la escena.

## Archivos y dueños

| Archivo | Dueño | Qué hace |
|---|---|---|
| `src/00_config.js` | núcleo | `K.CONFIG`, `K.MAP` (zonas y objetos con coordenadas X), constantes |
| `src/01_core.js` | núcleo | `K.util` (color, ruido, sprites, texto), `K.sx`, `K.terrainAt`, `K.register`, `K.royal` |
| `src/10_world.js` | agente **mundo** | parallax, suelo, árboles, hierba, juncos, niebla de primer plano |
| `src/11_props.js` | agente **edificios** | todo lo de `K.MAP.things`, fogatas, antorchas, conejos, vagabundos |
| `src/20_horse.js` | agente **caballo** | `K.player`, caballo, monarca, estamina, animaciones |
| `src/30_water.js` | agente **agua** | reflejo del río, ondas, columnas de luz, peces |
| `src/40_light.js` | núcleo | ciclo día/noche, cielo, sol/luna, estrellas, oscuridad con halos, luciérnagas, número del día |
| `src/90_main.js` | núcleo | bucle, escalado entero, entrada, cámara, pasadas, modos de prueba |

**Cada agente edita SOLO su archivo.** Si necesitas algo del núcleo, no lo toques: descríbelo en tu informe
final (`requests_for_core`) y resuélvelo localmente dentro de tu archivo mientras tanto. Los archivos
provisionales actuales de 10/11/20/30 se reemplazan enteros.

## Espacio de pantalla

- Buffer interno **480×270** (`K.W`, `K.H`), escalado entero con vecino más cercano. Todo se dibuja en
  coordenadas enteras (usa `Math.round`, `U.rect`, `U.draw`). Nada de antialiasing: no uses `arc()`/`stroke()`
  con coordenadas fraccionarias ni `imageSmoothingEnabled = true`.
- `K.GROUND_Y = 170`: línea donde pisan cascos y pies. La tierra con hierba se ve de 170 a 190.
- `K.WATER_Y = 190`: borde superior del agua y eje del espejo. El agua ocupa 190–270.
- El reflejo copia invertidas las 80 filas **110–189** del buffer: lo que dibujes ahí se verá reflejado.
- Mundo de 0 a 2400 px (`K.WORLD_W`). Cámara solo horizontal: `K.camX` (float) y `K.camXi` (entero).
- **Para pasar de mundo a pantalla usa siempre `K.sx(xMundo, factor)`**: `factor = 1` es el plano de juego;
  0.05, 0.15, 0.3 y 0.5 son capas de fondo; 1.5 es la niebla de primer plano. La coordenada Y no tiene
  parallax. `K.onScreen(x, w, factor)` sirve para descartar lo que no se ve.

## Módulos y pasadas

Un módulo se registra con `K.register(nombre, { order, init, update(dt), key(code), drawXxx(ctx) })`.
Todo es opcional. `order`: luz 5, mundo 10, edificios 11, caballo 20, agua 30. Cada frame:

1. `K.lights` se vacía; se llama a `update(dt)` de todos los módulos por orden. **Empuja tus luces aquí.**
2. Cámara (sigue a `K.player`).
3. Pasadas de dibujo, en este orden, cada módulo en su `order` (con `ctx.save()/restore()` alrededor):

| Pasada | Método | Quién dibuja |
|---|---|---|
| sky | `drawSky` | luz: degradado de 3 colores, estrellas, sol, luna (fijos a pantalla) |
| parallax | `drawParallax` | mundo: montañas 0.05, colinas 0.15, árboles lejanos 0.3, juncos de fondo 0.5 |
| ground | `drawGround` | mundo: tiles de tierra 32×32 y borde de hierba (170–190) |
| back | `drawBack` | mundo (árboles del plano), después edificios (estructuras, fauna) |
| player | `drawPlayer` | caballo |
| front | `drawFront` | luz (luciérnagas), mundo (hierba y juncos delante de los cascos) |
| darkness | `drawDarkness` | luz: capa `lerp(blanco, oscuridad)` con halos en `screen`, aplicada con `multiply` |
| water | `drawWater` | agua: reflejo de 110–189 en 190–270 |
| overlay | `drawOverlay` | agua (peces, salpicaduras), mundo (niebla 1.5); el núcleo añade grano |
| ui | `drawUI` | luz: número del día; núcleo: panel de depuración (F) |

Lo que se dibuja **después** de `darkness` no queda oscurecido: si lo necesitas, pásalo por
`U.multiplyTint(canvas, K.env.mulColor)` y dibuja el resultado.

## Estado compartido

- `K.env` (lo publica la luz, léelo en `update` o al dibujar): `phase` ('dawn'|'day'|'dusk'|'night'),
  `sky`, `horizon`, `haze`, `sun` (color del sol o de la luna), `darkness` (0–0.4), `darkColor`, `mulColor`
  (color con el que se multiplica la escena), `wind` (0.1–1.0), `night` (0–1), `bloodMoon`, `day`,
  `sunX/sunY/sunVis`, `moonX/moonY/moonVis`.
- `K.lights`: `{ type, x, y, power, screen? }`. Tipos con halo: `'fire'` (256 px), `'torch'` (128 px),
  `'firefly'` (64 px). `'sun'` y `'moon'` son fijos a pantalla (`screen: true`) y solo los usa el agua.
  `x` es del mundo salvo `screen: true`; `y` es de pantalla (no hay scroll vertical).
- `K.player` (lo crea el módulo caballo al cargar; la cámara lo lee): `x` (centro, mundo), `y` (= GROUND_Y),
  `dir` (1 derecha, -1 izquierda), `vx`, `state` ('idle'|'walk'|'gallop'|'graze'|'pant'|'rear'),
  `stamina` (0–1), `boost` (segundos de galope extra restantes).
- `K.input`: `left`, `right`, `gallop` (Shift mantenido) y `taps` (teclas pulsadas este frame, `{code, t}`),
  por `e.code`. Los módulos pueden implementar `key(code)`.
- `K.terrainAt(x)` → 'forest'|'meadow'|'grass'|'farm'|'cobble'|'coast'. Se pasta en 'meadow' y 'grass'.
- `K.royal.cape` = `[color, sombra]` de la capa (el estandarte usa el mismo), `K.royal.skin`.
- `K.MAP.zones` y `K.MAP.things` (ver `00_config.js`).
- `K.rand()` aleatorio con semilla; `U.hash`, `U.noise1`, `U.noise2`, `U.fbm2` son deterministas.
- `K.params`: parámetros de la URL ya convertidos a número cuando procede.

## Utilidades (`const U = K.util`)

`clamp, lerp, invLerp, smoothstep, mod, rgb(hex), hex(r,g,b), lerpColor(a,b,t), shade(hex,f),
mulberry32(seed), hash(x,y,s), noise1(x,s), noise2(x,y,s), fbm2(x,y,oct,s), canvas(w,h)→{c,x},
sprite(rows, pal, name)→{r,l,w,h}, paint(w,h,fn)→{r,l,w,h}, withFlip(canvas), draw(ctx,spr,x,y,dir),
rect(ctx,x,y,w,h,col), px(ctx,x,y,col), disc(ctx,cx,cy,r,col), multiplyTint(canvas,col),
text(ctx,str,x,y,col,s), textWidth(str,s)`.

`U.sprite` recibe filas de texto del mismo largo y una paleta `{ 'a': '#RRGGBB' }`; `.` y espacio son
transparentes. Lanza un error claro si una fila no mide lo mismo o falta un color. **Pre-renderiza todos los
sprites en `init()` o al cargar el archivo, nunca en cada frame.**

## Cómo probar (Windows, PowerShell, desde la carpeta `kingdom`)

```
node --check src/20_horse.js
python tools/shot.py shots/horse_walk.png "x=1200&state=walk&mods=light,world,horse" --scale 2
python tools/shot.py shots/horse_zoom.png "x=1200&state=gallop" --crop 180,120,120,60 --zoom 4
python tools/shot.py --dom "bench=300"
```

- `shot.py` simula `--sim` segundos (1.5 por defecto) a 60 Hz, dibuja un frame y guarda el PNG escalado.
  Mira el PNG con la herramienta Read. `--crop x,y,w,h` va en píxeles del buffer 480×270.
- Si la página lanza errores se imprimen como `[err]`. Arréglalos antes de seguir.
- `--dom "bench=300"` imprime los ms por pasada. Presupuesto en este benchmark (Chrome sin GPU):
  mundo ≤ 1.5 ms, edificios ≤ 1 ms, caballo ≤ 0.5 ms, agua ≤ 2 ms por frame.
- Parámetros de URL: `x` (posición inicial del jinete), `dir`, `cam` (fija la cámara), `phase`
  (dawn|day|dusk|night|blood), `cyc` (segundo exacto del ciclo), `wind`, `hold` (p. ej. `right,gallop`
  simula teclas mantenidas), `state` (fuerza el estado del caballo), `stamina`, `boost`, `view` (vista de
  depuración registrada en `K.views[nombre] = (ctx, t) => {}`; fondo `bg=RRGGBB`), `mods` (lista de módulos
  activos, p. ej. `mods=light,horse`), `seed`, `coat` (gray|chestnut), `refl`, `debug=1` (panel F), `freeze=1`
  (congela el ciclo).
- Otros agentes están editando sus archivos a la vez que tú. Si sus módulos rompen tu captura, aíslate con
  `mods=...`. Guarda tus capturas como `shots/<modulo>_*.png`.

## Guía de estilo pixel art

- Paleta corta, terrosa y apagada, como en SPEC.md. 3–5 tonos por material (luz, base, sombra, sombra
  profunda). Luz desde arriba; sin contorno negro: los bordes se leen por contraste de tonos.
- Siluetas limpias y legibles a escala 1: nada de píxeles sueltos de ruido ni "almohadillado" (sombra
  alrededor del borde). Las formas grandes se construyen con masas de color, no con líneas.
- El fondo pierde contraste y se tiñe con la bruma (`K.env.haze`) según la distancia; el primer plano es
  más oscuro y saturado.
- Animación sobria: pocas frames, movimientos de 1 px, balanceo con el viento (`K.env.wind`).
- Revisa siempre a escala 2 completa **y** con zoom 4 sobre los detalles. Itera hasta que se vea bien;
  compara día, atardecer y noche.
