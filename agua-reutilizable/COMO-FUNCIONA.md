# Agua pixel art reutilizable

`agua.js` es el agua de la escena "Reino a caballo" separada del resto: no depende de nada y se copia tal
cual a otro juego. `demo.html` la usa en un prototipo con ritmo al estilo Patapon (tambores con A/D).

## Cómo usarla en tu juego

1. Tu juego dibuja todo en un buffer pequeño (aquí 480×270) y luego lo amplía con "vecino más cercano"
   (`image-rendering: pixelated`). El agua trabaja sobre ese buffer.
2. Crea el agua una vez:
   ```js
   const agua = crearAgua({ ancho: 480, alto: 270, yAgua: 190 });
   ```
   Opciones: `color` (del río, `#686C53`), `colorLuz` (columnas, `#FC8F53`), `reflejo` (0.3),
   `hz` (10 cambios de ola por segundo), `trozo` (16 px de ancho por tira).
3. Cada frame, **después** de dibujar cielo, fondo, suelo, personajes y la oscuridad de la noche:
   ```js
   agua.dibujar(ctx, { t, camX, viento: 0.5, oscuridad: 0..1,
                       luces: [{ x, y, tam: 'chica' | 'grande', fuerza: 1 }] });
   ```
   `x` e `y` de las luces son de pantalla (antorchas, fogatas, luna…).

## Por qué se ve así (los 4 pasos)

1. **Reflejo**: copia volteadas las filas que hay justo encima de la línea del agua (tantas como filas
   de agua) con un 30 % de opacidad sobre el color del río, que se oscurece en bandas de 4 px hacia abajo.
   Lo que dibujes cerca del borde del agua (tus personajes) se refleja solo.
2. **Ondas "a saltos"**: el agua se trocea en tiras de 16×1 px. Cada tira se copia desplazada unos
   píxeles (±6 en horizontal, ±12 en vertical con viento fuerte) según dos capas de ruido. La tabla de
   desplazamientos **solo cambia 10 veces por segundo**: ese salto discreto, sin suavizado, es el truco
   que hace que parezca pixel art y no un filtro moderno.
3. **Columnas de luz**: debajo de cada luz se dibuja una franja vertical de guiones horizontales
   (núcleo intenso, bordes escalonados, huecos que aumentan hacia abajo), con 3 variantes que se
   alternan. Como se dibuja **antes** de las ondas, las olas también la rompen.
4. **Orilla**: una línea 1 px más oscura y espuma que aparece y desaparece al ritmo de la tabla.

## Consejos para el juego tipo Patapon

- Deja al menos 60–80 filas de agua y pon a la tropa a pocos píxeles del borde: el reflejo de los
  personajes marchando es lo que más luce.
- Personajes simples (siluetas negras con un ojo blanco) se leen perfecto en el reflejo roto.
- Puedes sincronizar el agua con el ritmo: sube `viento` un instante en cada golpe de tambor bien dado,
  o haz `hz` igual al tempo (p. ej. 8 Hz a 120 ppm) para que las olas "bailen" con la música.
- Rendimiento: unos 2–3 ms por frame en 480×270; no escala con el número de personajes.

## Guerreros stickman (demo.html)

- Esqueleto: cadera, torso (9 px, 2 px de grosor), cabeza r3 con un ojo, muslo/pierna 6+6, brazo/antebrazo 5+5.
- Rodillas y codos por **cinemática inversa de 2 huesos** (ley de cosenos): solo se animan cadera, pies y
  manos; las articulaciones se calculan solas. Todo se dibuja con líneas de Bresenham de 1 px.
- **Marcha sin patinar**: un ciclo de piernas = un pulso de tambor (0.5 s). El pie apoyado retrocede
  exactamente a la velocidad del suelo (zancada = velocidad × pulso / 2 = 7.5 px) y pisa en el golpe.
- Ataque en 4 tiempos dentro del pulso: preparar, estocada rápida, sostener, volver. Las animaciones se
  mezclan con pesos suaves para no dar saltos al cambiar de orden. Acertar un golpe hace saltar a la tropa.
- `demo.html?shot=1&sim=2&orden=marchar` simula 2 s y deja la imagen en `#out` (para capturas).
