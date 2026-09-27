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

## Niveles
1. **El vado** (día): brutos, una empalizada y un lancero. El libro de órdenes se ve en pantalla.
2. **Bosque de niebla** (atardecer): aparecen los arqueros.
3. **Noche en el río** (noche con lluvia): más enemigos y más juntos.
4. **El gigante del río** (tormenta): anuncia su garrote con "!" y una franja roja → **defiende**.
   Antes del pisotón levanta el pie → sigue tocando para que la tropa salte la onda.

## Pausa y ajustes
P o Esc pausa. En la pausa (o en el mapa con W) puedes **calibrar el ritmo** si notas que tus golpes
llegan tarde (auriculares bluetooth, televisores), activar/desactivar la música y volver al mapa.
El progreso y los récords se guardan en el navegador.

## Para desarrolladores
- `src/`: un archivo por sistema (núcleo, audio, ritmo, entrada, progreso, esqueleto, tropa, enemigos,
  combate, escena, niveles, UI, principal). `python build.py` genera `index.html`.
- Pruebas (`python tools/probar.py dom "<parámetros>"`):
  `prueba=ritmo` (juicios y órdenes), `prueba=pies` (deriva 0 px), `auto=bien&nivel=N` / `auto=mal&nivel=N`
  (jugador automático), `bench=300` (ms por frame). Capturas:
  `python tools/probar.py png salida.png "shot=1&pantalla=juego&nivel=3&sim=40"` (pantallas: titulo, mapa,
  juego, pausa, victoria, derrota; `&tactil=1` muestra los botones).
