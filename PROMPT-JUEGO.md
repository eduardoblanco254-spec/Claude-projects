# Prompt: juego completo "Tambores junto al río"

> Copia todo lo que hay debajo de la línea en una sesión nueva de Claude Code con el repositorio
> `eduardoblanco254-spec/Claude-projects` seleccionado.

---

Responde siempre en español; el usuario es Eduardo y no es programador: explícale los resultados en
lenguaje sencillo, sin comandos.

## Objetivo
Convierte el prototipo `agua-reutilizable/demo.html` en un **juego de ritmo completo y terminado** al
estilo Patapon, con los mismos gráficos pixel art (480×270 escalado entero, sin antialiasing), los
guerreros stickman sin ojos y el agua de `agua-reutilizable/agua.js`. Entrega un único `juego/index.html`
autónomo (sin red, sin archivos externos) que se abra con doble clic, publícalo como Artifact y haz
commit y push a `main`.

## Lee primero (no rehagas lo que ya funciona)
- `agua-reutilizable/COMO-FUNCIONA.md`: agua (reflejo, ondas a 10 Hz, columnas de luz), esqueleto con
  IK de 2 huesos, pies con memoria (deriva 0 px), personalidad por guerrero, música con Web Audio y
  reloj de audio como reloj del juego.
- `agua-reutilizable/demo.html` y `agua.js`: código base a reutilizar.
- `CONTRACT.md` de la escena del reino: patrón de módulos (`K.register`, pasadas de dibujo ordenadas,
  capa de oscuridad con halos) y `build.py` para generar un HTML autónomo. Sigue el mismo patrón.

## Arquitectura: sistemas independientes
Un archivo por sistema en `juego/src/`, cada uno con una API pequeña y sin tocar el estado de los
demás salvo por esa API; `juego/build.py` los une en `juego/index.html`.

| Sistema | Responsabilidad |
|---|---|
| `00_nucleo` | bucle con `dt` del reloj de audio, escalado entero, registro de módulos, eventos (`K.on/K.emit`), RNG con semilla |
| `10_audio` | planificador con margen, melodía por nivel, canto de respuesta, efectos; calibración de latencia |
| `11_ritmo` | ventana de acierto (perfecto ±60 ms, bien ±120 ms), secuencias de 4 golpes, combo y **modo fiebre** (10 aciertos seguidos: música más rica, más daño) |
| `12_entrada` | teclado (A/D/W/S para PATA/PON/CHAKA/DON), táctil (4 botones en pantalla) y mando; reasignable |
| `20_esqueleto` | IK, pies con memoria, mezcla de animaciones con pesos; datos de pose por arma |
| `21_tropa` | unidades con personalidad; tipos lanza, escudo, arco y abanderado; vida, formación |
| `22_ordenes` | marchar, atacar, defender, retroceder y cargar, ejecutadas en el pulso siguiente |
| `30_enemigos` | 3 enemigos con IA sencilla (patrulla, carga, a distancia) y un jefe por nivel con ataques telegrafiados al ritmo |
| `31_combate` | cajas de golpe, daño, proyectiles (flechas en arco), retroceso, muerte con disolución en píxeles |
| `40_escena` | parallax, suelo, agua reutilizada tal cual, día/noche, clima (lluvia que rompe el agua, niebla) |
| `41_luz` | capa de oscuridad con halos elípticos recortados, antorchas y fogatas |
| `50_niveles` | datos de 3 niveles + jefe final: longitud, enemigos, hora del día, melodía, objetivo |
| `60_ui` | pantalla de título, mapa de niveles, indicador de ritmo, vida de la tropa, pausa, victoria/derrota, créditos; texto con la fuente pixel 3×5 |
| `70_progreso` | guardado en `localStorage` (niveles superados, mejor puntuación, ajustes) con `try/catch` |
| `90_pruebas` | modos de prueba por URL (ver abajo) |

## Reglas de calidad
- Todo en coordenadas enteras; líneas de Bresenham; paleta limitada y coherente con la escena del reino.
- Los pies nunca patinan: `?prueba=pies` debe dar deriva 0 px en marcha, ataque, defensa y retroceso.
- Cada acción ocurre en el pulso: órdenes, cantos, ataques enemigos y golpes del jefe.
- El juego nunca se bloquea: si falla el audio o el guardado, sigue funcionando en silencio o sin guardar.
- Rendimiento: menos de 4 ms por frame con 12 unidades y 8 enemigos (`?bench=300`).

## Limpieza de fallos conocidos del prototipo
1. La orden empieza al instante pero el canto en el pulso siguiente: la orden debe empezar en `pulso0`.
2. La ventana de acierto no compensa la latencia del audio: añade calibración en ajustes.
3. Un golpe fuera de ritmo durante una orden reinicia el combo sin avisar: muéstralo en la UI.
4. Solo hay teclado: añade táctil.
5. El texto de ayuda tapa el juego en pantallas pequeñas: pásalo al menú de pausa.
6. El metrónomo no suena antes de la primera tecla: la pantalla de título pide "pulsa para empezar".

## Pruebas y criterios de aceptación
Adapta `tools/shot.py` (Chromium en `/opt/pw-browsers`) y verifica cada fase con capturas
antes/después revisadas con zoom:
- `?prueba=pies` → deriva 0 px.
- `?prueba=ritmo` → golpes simulados con errores de ±50/±150 ms dan perfecto/bien/fallo correctos.
- `?prueba=nivel=1&auto=1` → un bot que toca bien gana el nivel 1; uno que toca mal pierde.
- `?bench=300` → menos de 4 ms/frame y sin errores en consola.
- Capturas de día, atardecer, noche y lluvia de cada nivel, del jefe y de cada pantalla de la UI.

## Forma de trabajar (presupuesto limitado)
- Trabaja por fases y haz commit al final de cada una: 1) núcleo + ritmo + entrada, 2) tropa y órdenes,
  3) enemigos y combate, 4) niveles y UI, 5) pulido, pruebas y publicación.
- Como mucho **dos agentes** a la vez, y solo si trabajan en archivos distintos; nada de flujos grandes.
- Si algo del alcance no cabe, entrega primero un juego jugable de principio a fin con 1 nivel y el
  jefe, y deja el resto anotado en `juego/PENDIENTE.md`.
- Al terminar: actualiza `juego/COMO-JUGAR.md` (controles y órdenes), publica el Artifact y resume a
  Eduardo qué hay, cómo se juega y qué quedó pendiente.
