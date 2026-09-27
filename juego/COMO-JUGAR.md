# Tambores junto al río — cómo jugar

Abre `index.html` con doble clic (funciona sin internet) o usa el enlace publicado. Pulsa una tecla para
empezar: la música arranca con la primera tecla.

## Tambores
| Tambor | Teclado | Mando | Táctil |
|---|---|---|---|
| PATA  | A (o ←) | X | botón rojo |
| PON   | D (o →) | B | botón azul |
| CHAKA | W (o ↑) | Y | botón amarillo |
| DON   | S (o ↓) | A | botón verde |

Toca **un tambor por pulso**, siguiendo la música y el parpadeo del borde. Cuatro golpes seguidos forman
una orden; la tropa la canta y la cumple durante los 4 pulsos siguientes. **Mientras cantan, escucha**:
si tocas en ese momento pierdes el combo. Después vuelve a tocar enseguida para mantenerlo.

## Órdenes
| Orden | Tambores | Qué hace |
|---|---|---|
| Marchar | PATA PATA PATA PON | avanza (se detiene ante enemigos y empalizadas) |
| Atacar | PON PON PATA PON | lanceros y escuderos cargan, arqueros disparan |
| Defender | CHAKA CHAKA PATA PON | se cubren: reciben mucho menos daño (los escudos casi nada) |
| Retroceder | PON PATA PON PATA | se retiran unos pasos |
| Cargar | PON PON CHAKA CHAKA | el siguiente ataque hace el doble de daño |

- **Combo**: órdenes seguidas sin fallar. Con 4 seguidas entras en **¡FIEBRE!**: la música se anima y el
  daño sube un 50 %.
- **Perfecto / bien**: cuanto más exacto el golpe, más fuerte la orden.
- Cada golpe acertado hace **saltar** a la tropa: así se esquiva la onda del pisotón del gigante.
- Si el abanderado cae, pierdes. Gana llegando a la bandera blanca (o venciendo al gigante).

## Campaña y campamento
Entre batallas vuelves al **campamento**. Con las monedas que sueltan los enemigos y el premio de cada fase:
- **Mejorar** (nivel 1–5) lanceros, escuderos y arqueros: más vida y daño; su equipo cambia de hierro a
  bronce, plata y oro, y desde el nivel 3 llevan pluma. Mejorar al **abanderado** sube la moral (más daño
  para todos).
- **Reclutar** más guerreros (hasta 5 lanceros, 4 escuderos y 4 arqueros).
- **Partir** abre el mapa para elegir fase. **Ajustes**: calibrar el ritmo y la música.

| Fase | Bioma | Novedad |
|---|---|---|
| 1 Pradera del vado | pradera de día | aprende marchar y atacar (libro de órdenes en pantalla) |
| 2 Colinas de abedules | pradera | arqueros |
| 3 Bosque de otoño | atardecer con hojas | **escudados**: bloquean golpes; usa CARGAR o flechas |
| 4 Bosque de niebla | niebla | el **caudillo**, un enemigo grande con corona |
| 5 Pantano de luciérnagas | noche con aurora | muchos enemigos juntos |
| 6 Paso nevado | amanecer con nieve | la última muralla |
| 7 El gigante del río | tormenta | el jefe: **defiende** su garrote ("!" y franja roja) y sigue tocando para **saltar** su onda |

Cada fase es más dura que la anterior: conviene mejorar la tropa antes de avanzar.

## Pausa y ajustes
P o Esc pausa. En la pausa (o en el mapa con W) puedes **calibrar el ritmo** si notas que tus golpes
llegan tarde (auriculares bluetooth, televisores), activar/desactivar la música y volver al mapa.
El progreso y los récords se guardan en el navegador.

## Para desarrolladores
- `src/`: un archivo por sistema (núcleo, audio/música, ritmo, entrada, progreso, campaña, esqueleto, tropa,
  enemigos, combate, escena/biomas, agua WebGL, niveles, UI, principal). `python build.py` genera `index.html`.
- Pruebas (`python tools/probar.py dom "<parámetros>"`):
  `prueba=ritmo` (juicios y órdenes), `prueba=pies` (deriva 0 px), `auto=bien&nivel=N` / `auto=mal&nivel=N`
  (jugador automático con las mejoras esperadas para esa fase; `&mejoras=no` sin mejoras), `bench=300` (ms por
  frame). Música: `PW=<ruta de playwright> node tools/musica.js pradera [fiebre]` renderiza la canción a
  `musica_prueba/*.wav` y mide picos y volumen. `?sin_gl=1` fuerza el agua 2D de respaldo. Capturas:
  `python tools/probar.py png salida.png "shot=1&pantalla=juego&nivel=3&sim=40"` (pantallas: titulo, mapa,
  juego, pausa, victoria, derrota; `&tactil=1` muestra los botones).
