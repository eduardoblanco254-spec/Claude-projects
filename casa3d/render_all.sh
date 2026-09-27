#!/bin/sh
# Renderiza todo el recorrido (panorámicas 360° + vistas fijas) con Cycles.
cd "$(dirname "$0")"
PY=${PY:-python}
PANO_W=${PANO_W:-2560} SAMPLES=${SAMPLES:-32} $PY build_house.py --render panos
SAMPLES=${VIEW_SAMPLES:-48} $PY build_house.py --render views
