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

## Pendiente (de la revisión de arte y código)
Alta:
1. `11_props.js` — El muelle está sobre la arena y no sobre el agua. Prolongar pilotes y tirantes dentro
   del agua hasta WY+14/16 (algas en la línea de flotación) y un embarcadero bajo a y≈186–192; dibujar la
   parte y≥190 en `drawOverlay` de props pasada por `U.multiplyTint(canvas, K.env.mulColor)`.
2. `11_props.js` — El emblema del estandarte se lee como hoz y martillo. Sustituir por una corona de
   3 puntas centrada, o mejor un estandarte vertical colgante de ≈12×24 px con cola de golondrina.

Media:
3. `11_props.js` — Escala: muro de piedra ≈26×60 con almenas, tiendas ≈36×50 con alero por encima de la
   corona del jinete (~43 px), estatua ≈34×72 con pedestal.
4. `11_props.js` — Los campos parecen tablones apilados: el labrado debe ser una franja fina en la
   superficie (y 170–174) con caballones de 1 px y brotes; la cara del talud, tierra del mundo.
5. `40_light.js` — Los halos dibujan cúpulas de anillos en el cielo: halos como elipses achatadas
   (≈256×140 fogata, 128×72 antorchas), recortar a y≥100 y difuminar el último anillo.
6. `40_light.js` — Llamas y luna se apagan de noche: disco central con alfa 1 en los halos de fuego
   (r≈14 fogata, ≈6 antorcha), colores más cálidos (#FFB070 / #FFC48A) y redibujar luna y estrellas
   después del multiply.

Baja:
- `11_props.js` arroyo y cascada demasiado cian (usar paleta derivada del río #686C53) y sin salpicadura.
- `10_world.js` juncos de fondo sin bruma (de noche parecen postes); bosque con copas a la misma altura;
  juncos de la orilla pegados al talud; `fogOff` se calcula y no se usa (la niebla no se mueve).
- `40_light.js` Y cambia a luna de sangre de golpe de noche y de día no hace nada visible.
- `30_water.js` los peces se dibujan encima de la niebla de primer plano.
- `90_main.js` el texto del panel F se sale de su fondo; `keyTest` choca con el nuevo límite de 30 px del
  borde del mundo (ajustar la expectativa del tramo "galope +14 s").

Tras cada corrección: capturas antes/después, `keytest=1` y `bench=300` sin `[err]`, y `python build.py`.
