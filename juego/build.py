"""Une el agua reutilizable y los sistemas de src/ en un único index.html autónomo (sin red)."""
import pathlib

RAIZ = pathlib.Path(__file__).resolve().parent
PLANTILLA = """<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
<title>Tambores junto al río</title>
<style>
  :root { --fondo: #0d0f16; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --fondo: #0d0f16; } }
  :root[data-theme="dark"] { --fondo: #0d0f16; }
  html, body { margin: 0; height: 100%; background: var(--fondo); overflow: hidden; touch-action: none; user-select: none; }
  canvas { position: absolute; image-rendering: pixelated; image-rendering: crisp-edges; }
</style>
</head>
<body>
<canvas id="pantalla"></canvas>
%SCRIPTS%
</body>
</html>
"""

def main():
    partes = [RAIZ.parent / "agua-reutilizable" / "agua.js"] + sorted((RAIZ / "src").glob("*.js"))
    scripts = "\n".join(f"<script>\n// ---- {p.name}\n{p.read_text(encoding='utf-8')}\n</script>" for p in partes)
    salida = RAIZ / "index.html"
    salida.write_text(PLANTILLA.replace("%SCRIPTS%", scripts), encoding="utf-8")
    print(f"{salida.name}: {len(partes)} scripts, {salida.stat().st_size // 1024} KB")

if __name__ == "__main__":
    main()
