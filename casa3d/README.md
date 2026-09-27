# Casa en 3D (Blender)

Modelo de la casa hecho con las medidas del plano *Distribución de planta general*
(ejes A–D: 4,05 + 3,05 + 4,30 m; filas 5–1: 3,65 + 1,60 + 3,25 m) y los detalles de las fotos.

| Archivo | Qué es |
|---|---|
| `casa.blend` | Escena de Blender lista para abrir y recorrer |
| `build_house.py` | Script que construye la escena desde cero |
| `tour.html` | Visor del recorrido 360° (usa `panos/` y `vistas/`) |
| `panos/*.jpg` | Panorámicas 360° renderizadas con Cycles |
| `vistas/*.jpg` | Vistas fijas (aérea sin techo, comedor, patio, garaje) |

## Abrir en tu computadora

1. Instala Blender (gratis): https://www.blender.org/download/
2. Abre `casa.blend`.
3. Para caminar adentro: pasa el mouse sobre la vista 3D y presiona `Shift + ~`
   (modo *Walk*). Muévete con `W A S D`, mira con el mouse, `E`/`Q` suben y bajan.
4. Para ver con luz real: arriba a la derecha de la vista 3D, elige el modo *Rendered*.

## Volver a generar

```sh
python build_house.py                  # solo construye casa.blend (necesita `pip install bpy`)
./render_all.sh                        # renderiza panorámicas y vistas
```
