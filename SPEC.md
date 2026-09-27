# Escena pixel art inspirada en *Kingdom Two Crowns*: mapa, caballo y agua

## Objetivo
Construye una escena jugable de desplazamiento lateral con el aspecto de *Kingdom Two Crowns*: un monarca a caballo recorre una isla junto a un río que lo refleja todo. Prioridades: **el mapa, el caballo y el agua**. El resto es ambiente sencillo.

## Estilo y derechos
- Pixel art moderno: sprites de baja resolución con luces en tiempo real, reflejos y niebla. Paleta corta y terrosa, sin antialiasing ni contorno negro.
- Arte original dibujado en código: recrea la silueta, las proporciones, la paleta y la animación del juego sin extraer ni calcar sus sprites. Su nombre y su logo no aparecen.
- Los números vienen sobre todo del *Kingdom* original de 2013 (github.com/noio/kingdom, licencia no comercial; su `king.png` sirve para estudiar proporciones). Son un punto de partida ajustable en `CONFIG`, no medidas de Two Crowns.

## Tecnología
- Un solo `index.html` con Canvas 2D y JavaScript puro, sin librerías, imágenes ni red.
- Buffer de **480×270** copiado al canvas visible con el mayor factor entero que quepa, centrado con bandas negras (`imageSmoothingEnabled = false`).
- Posiciones enteras (`round(xMundo) − round(camX·factor)`), lógica con `dt` y teclas por `e.code`.
- Sprites como matrices de caracteres más paleta, pre-renderizados en ambas orientaciones, igual que los halos y reflejos de luz.

## El mapa (2400 px, 5 pantallas)
Los cascos pisan en y=170, la tierra con hierba se ve hasta y=190 y el agua ocupa de 190 a 270 (30 % inferior). Tiles de 32×32 (#6A4B30/#855F3C/#4F3724, empedrado gris en el centro). Disposición representativa (en el juego es procedural):

| x | Elemento |
|---|---|
| 0–450 | Bosque: portal de piedra negra (≈100) y campamento de vagabundos con tienda, fogata y 2 vagabundos (≈330) |
| 450–700 | Pradera con hierba alta y conejos |
| 720 | Muro exterior de madera y torre de arqueros |
| 760–1060 | Granja: arroyo que cae al río en cascada y 3 campos |
| 1080 y 1320 | Muros de piedra; torre junto al derecho |
| 1100–1300 | Centro: fogata grande (1200), estandarte del color de la capa, tiendas de martillos (izq.) y arcos (der.), antorchas |
| 1340–1750 | Pradera grande con conejos |
| 1750–2150 | Bosque con estatua cubierta de musgo |
| 2150–2400 | Costa con muelle de madera sobre el agua |

Árboles de ~96×160 (copas #8A9046/#ADA955/#6E7338), juncos #B59D69 mecidos por el viento, vagabundos (~20 px), conejos (~12 px) y algún pez que salta, con 2–4 frames.

**Parallax** (solo en X): cielo de 3 colores con sol y luna (0), montañas (0.05), colinas (0.15), árboles lejanos (0.3), juncos de fondo (0.5), juego (1.0) y niebla (1.5). Las siluetas lejanas son de un color (#717565, #555849) bajo una bruma del color `haze` del preset.

## El caballo y el monarca
- Celda de 64×64, figura de ~40×40 que mira a la derecha: lomo a ~22 px, orejas a ~27 y corona a ~40. Cola casi hasta el suelo; cascos hundidos ~4 px en la hierba.
- `CONFIG.horseCoat`: **gris** por defecto (la montura inicial se llama "caballo gris", pero su sprite no está verificado; colores aproximados: #8A8A94, sombras #5E5F6E, crin #3B3A44, calcetines #D8D4CC) o **castaño**, medido del original (#7B4E53, #623128, crin #462823, calcetines #F0D8CE).
- Monarca: corona #EB9B36 de 3 puntas, capa #C43433/#932827 sobre la grupa (color aleatorio que comparte el estandarte), túnica #5F4FA0, pierna #EEE9D6 y piel aleatoria. Máximo ~30 colores.
- Cuerpo, cabeza (alta y baja), cola y monarca son matrices. Las patas se generan en cada frame desde una tabla de ángulos de marcha (2 segmentos de 2 px) y el cuerpo sube 1 px por paso. No dibujes 20 matrices de 64×64 a mano.
- Animaciones: reposo (1 frame), paso (8, 10 fps), galope (8, 15 fps), comer (2, 5 fps), jadeo (2, 4 fps) y encabritarse (5, 10 fps, rotando 15–35° sobre las patas traseras). Los cascos no deben patinar.
- Paso a 40 px/s y galope a 80; acelera a vmáx×4 por segundo y frena a vmáx×5.
- Estamina: el galope la agota en ~15 s y solo se recupera pastando. Por debajo del 20 % y quieto, jadea. A 0 solo camina, y si se pide galope se encabrita. Quieto ≥1 s sobre pradera (no en bosque ni empedrado): come ~3 s, vuelve al 100 %, suelta destellos y gana 45 s de galope con estela blanca en las patas.

## El agua (a 480×270, antes de escalar)
Orden en cada frame:
1. Cielo, parallax y plano de juego en el buffer.
2. Oscuridad: capa rellena con `lerp(blanco, colorOscuridad, oscuridad)`, con halos en `screen` de 4–5 anillos escalonados (64×64 luciérnagas, 128×128 antorchas, 256×256 fogata; el alfa parpadea ±0.075). Se aplica al buffer con `multiply`.
3. Agua sin ondas, en un canvas de 480×80: rellena con `lerp(#686C53, colorOscuridad, oscuridad)` (oliva apagado, sin azul saturado) y oscurece hacia abajo hasta un 40 % de negro en bandas de 4 px. Encima, con alfa `CONFIG.reflectivity` (0.3 en el original; prueba hasta 0.45), las 80 filas del buffer justo encima del agua, volteadas: el espejo es el borde superior del agua. Al final, columnas de luz #FC8F53 (8×48 antorchas, 24×48 fogata y luna) con el borde superior en `(yAgua − yLuz)·0.3` y alfa `oscuridad·0.8·min(1, viento·10)`.
4. Ondas: rellena la franja del buffer con el color base y copia encima ese canvas en trozos de 16 px de ancho por 1 de alto. Cada trozo se desplaza (dx, dy) según una tabla de ruido suave con celdas de ~32×4 px (ondas 8:1): dx ±viento·6 px y dy ±viento·12 px, un 50 % mayor al fondo de la franja que arriba. Si tarda menos de 2 ms, también vale desplazar por píxel con `ImageData` solo en la franja.
5. La tabla se regenera **10 veces por segundo** (brillo "a saltos"), muestreada en `x + camX·1.5` con una deriva vertical lenta. El reflejo sí se redibuja en cada frame.
6. Encima: muelle, niebla de primer plano y grano al 1.5 %.

Opcional, de cosecha propia: destellos de 1–2 px de día donde el ruido supera un umbral.

## Luz y ciclo
- Presets (cielo / horizonte / bruma / sol o luna / oscuridad / viento) interpolados en 10–30 s; color de oscuridad #111114:
  - amanecer #8C8CA6 / #CF7968 / #F3F1E8 / #FF6D40 / 0.2 / 0.1
  - día #98BEEC / #C4DAF1 / #F3F1E8 / #FFF766 / 0 / 1.0
  - atardecer #FF7F51 / #FFDF54 / #FF9068 / #FF7038 / 0.1 / 0.1
  - noche #005EA5 / #002E80 / #333333 / #DDDDFF / 0.4 / 0.2
  - luna de sangre #142744 / #AD2E21 / #5C5D9E / #C73800 / 0.4 / 0.2, oscuridad #0E0B62
- Día de ~4 min: amanecer 20 s, día 125 s, atardecer 20 s, noche 75 s. Sol y luna fijos a la pantalla, en arco.
- Fogata de 32×64 (8 frames, 10 fps) con chispas, antorchas de 16×32 (8 frames, 6 fps) y luciérnagas #7AFFA0 de 1 px en noches sin viento.
- Sin HUD. Al amanecer, el número del día en romanos aparece centrado y se desvanece.

## Controles y cámara
- A/D o flechas: paso. Shift mantenido o doble toque: galope.
- Depuración: T avanza de fase, Y activa la luna de sangre, G acelera ×10 y F muestra FPS y estamina.
- Cámara solo horizontal, 48 px por delante del monarca hacia donde mira, suavizada con `1 − 0.9^(dt·60)` (máx. 1200 px/s).

## Alcance y forma de trabajo
- Fuera de alcance: enemigos, construcción, monedas y estaciones.
- Trabaja por fases: (1) mapa, parallax y cámara con un rectángulo en lugar del jinete; (2) agua; (3) caballo; (4) luz, ciclo y detalles. Al terminar cada fase, revisa una captura en el navegador si puedes y di qué comprobaste.

## Criterios de aceptación
- [ ] Abre con doble clic, sin errores en consola ni peticiones de red.
- [ ] Al redimensionar, la escala es entera y los píxeles siguen cuadrados.
- [ ] Al cabalgar se ven 7 capas a velocidades distintas y las ondas corren más que el suelo.
- [ ] El agua refleja invertidos al jinete y los edificios, con ondas a ~10 Hz: casi espejo de noche, franjas de día.
- [ ] De noche, antorchas y fogata dejan columnas cálidas ondulantes.
- [ ] Se ven las 6 animaciones. El galope se agota en ~15 s y pastar (solo en pradera) da 45 s con estela.
- [ ] Con G, el ciclo completo dura ~24 s; Y activa la luna de sangre.
- [ ] La cámara se adelanta al girar sin temblores de 1 px en el jinete, y F marca ≥58 fps a 1920×1080.
