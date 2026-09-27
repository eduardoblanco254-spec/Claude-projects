"""Captura la escena con Chrome sin ventana para revisar el pixel art.

La página simula `sim` segundos, dibuja un frame y exporta el buffer 480x270 como PNG;
este script lo decodifica, lo escala con vecino más cercano y opcionalmente lo recorta.

Uso:
  python tools/shot.py shots/salida.png "x=1200&phase=night" [--scale 2] [--sim 1.5]
                        [--crop x,y,w,h] [--zoom 4]
  python tools/shot.py --dom "bench=300"   -> imprime #out y #err (benchmark, errores)

Parámetros de URL útiles (ver CONTRACT.md): x, dir, cam, phase (dawn|day|dusk|night|blood),
cyc, wind, hold (right,gallop), state, view, mods, seed, coat, refl, bg, debug.
--crop se da en píxeles del buffer 480x270 (antes de escalar); --zoom amplía el recorte.
"""
import argparse
import base64
import html
import io
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
CHROMES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
]


def chrome_path():
    for c in CHROMES:
        if pathlib.Path(c).exists():
            return c
    sys.exit("No se encontró Chrome ni Edge")


def dump(query, timeout):
    udd = tempfile.mkdtemp(prefix="kshot-")
    cmd = [
        chrome_path(), "--headless=new", "--disable-gpu", "--no-first-run",
        "--no-default-browser-check", "--allow-file-access-from-files",
        f"--user-data-dir={udd}", "--virtual-time-budget=10000",
        "--enable-logging=stderr", "--v=0", "--dump-dom",
        (ROOT / "dev.html").as_uri() + "?" + query,
    ]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout,
                           encoding="utf-8", errors="replace")
    finally:
        shutil.rmtree(udd, ignore_errors=True)
    blocks = {}
    for pid in ("out", "err"):
        m = re.search(rf'<pre id="{pid}"[^>]*>(.*?)</pre>', r.stdout, re.S)
        blocks[pid] = html.unescape(m.group(1)).strip() if m else ""
    logs = [l for l in r.stderr.splitlines() if "CONSOLE" in l or "Uncaught" in l]
    return blocks, logs


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("out", nargs="?", default="")
    ap.add_argument("params", nargs="?", default="")
    ap.add_argument("--scale", type=int, default=2)
    ap.add_argument("--sim", type=float, default=1.5)
    ap.add_argument("--crop", default="")
    ap.add_argument("--zoom", type=int, default=1)
    ap.add_argument("--dom", default=None, help="parámetros; imprime #out y #err en vez de capturar")
    ap.add_argument("--timeout", type=int, default=120)
    a = ap.parse_args()

    if a.dom is not None:
        q = a.dom if "bench" in a.dom else f"shot=1&sim={a.sim}&{a.dom}"
        blocks, logs = dump(q, a.timeout)
        print(f"[out] {blocks['out'] or '(vacío)'}")
        print(f"[err] {blocks['err'] or '(vacío)'}")
        if logs:
            print("[consola]\n" + "\n".join(logs[-30:]))
        return

    if not a.out:
        sys.exit("Falta la ruta de salida .png")
    out = pathlib.Path(a.out)
    if not out.is_absolute():
        out = ROOT / out
    out.parent.mkdir(parents=True, exist_ok=True)

    q = f"shot=1&dump=1&sim={a.sim}" + (f"&{a.params}" if a.params else "")
    blocks, logs = dump(q, a.timeout)
    if blocks["err"]:
        print("[err] " + blocks["err"])
    if logs:
        print("[consola]\n" + "\n".join(logs[-30:]))
    data = blocks["out"]
    if not data.startswith("data:image/png;base64,"):
        sys.exit("La página no exportó la imagen (¿error de JS?)")

    from PIL import Image
    im = Image.open(io.BytesIO(base64.b64decode(data.split(",", 1)[1]))).convert("RGB")
    if a.crop:
        x, y, cw, ch = [int(v) for v in a.crop.split(",")]
        im = im.crop((x, y, x + cw, y + ch))
    f = a.scale * max(1, a.zoom)
    if f > 1:
        im = im.resize((im.width * f, im.height * f), Image.NEAREST)
    im.save(out)
    print(f"ok {out} ({im.width}x{im.height})")


if __name__ == "__main__":
    main()
