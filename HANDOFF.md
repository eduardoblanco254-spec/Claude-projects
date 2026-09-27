# Estado del proyecto y trabajo pendiente (2026-09-27)

Escena pixel art "Reino a caballo" inspirada en *Kingdom Two Crowns*. Lee primero `CONTRACT.md`
(arquitectura, pasadas de dibujo, cómo probar) y `SPEC.md` (especificación visual y criterios).

## Qué está hecho y verificado
- Todos los módulos: `src/10_world.js` (parallax, suelo, árboles, niebla), `src/11_props.js` (portal,
  campamento, muros, torres, granja, centro, estatua, muelle, conejos), `src/20_horse.js` (caballo y
  monarca, 6 animaciones, marcha procedural sin patinar, estamina y boost), `src/30_water.js` (reflejo,
  ondas a 10 Hz, columnas de luz, peces), `src/40_light.js` (ciclo día/noche, sol/luna, halos,
  luciérnagas, número del día) y `src/90_main.js` (bucle, escalado entero, entrada, cámara, pruebas).
- `python build.py` genera `index.html` autónomo (sin red). Última comprobación: sin errores,
  `keytest=1` correcto (paso 40 px/s, galope 80, estamina ~15 s, jadeo, encabritarse, pastar → 100 % +45 s,
  G = ciclo de 24 s, T, Y, F) y 1.5 ms por frame en `bench=300`.

## Cómo probar
```
node --check src/11_props.js
python tools/shot.py shots/x.png "x=1200&phase=night" --crop 150,100,180,100 --zoom 3
python tools/shot.py --dom "keytest=1"
python tools/shot.py --dom "bench=300"
python build.py
```
`tools/shot.py` usa Chrome sin ventana. En Linux cambia la ruta en `CHROMES` (p. ej. `chromium` o
`google-chrome`) y usa `/` en las rutas.

## Pendiente

Revisado el 2026-09-27 con capturas: ya estaban resueltos en el código el muelle sobre el agua, el
estandarte vertical con corona, la escala de muros, tiendas y estatua y los campos como franja fina.
En esta sesión se resolvieron:
- `40_light.js`: halos en elipses achatadas (256×140 fogata, 128×72 antorcha), recortados a y≥100, anillo
  exterior más tenue, colores cálidos (#FFB070 / #FFC48A), núcleo opaco (r 14 / 6) y luna y estrellas
  sin oscurecer de noche.
- `10_world.js`: la niebla de primer plano deriva con el viento (`fogOff` ya se usa).
- `30_water.js`: los peces se dibujan en la pasada de agua, por debajo de la niebla.
- `90_main.js`: el fondo del panel F se ajusta al texto; `keyTest` galopa desde x=700 para no chocar con
  el borde del mundo.
- `tools/shot.py`: rutas de Chromium para Linux y `--no-sandbox`.

Queda (baja):
- `11_props.js` arroyo y cascada demasiado cian (usar paleta derivada del río #686C53) y sin salpicadura.
- `10_world.js` juncos de fondo sin bruma (de noche parecen postes); bosque con copas a la misma altura;
  juncos de la orilla pegados al talud.
- `40_light.js` Y cambia a luna de sangre de golpe de noche y de día no hace nada visible.

Tras cada corrección: capturas antes/después, `keytest=1` y `bench=300` sin `[err]`, y `python build.py`.
