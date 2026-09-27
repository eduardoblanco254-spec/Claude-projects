"""Pruebas del juego con Chromium sin ventana.
  python tools/probar.py dom "prueba=pies"            -> imprime #out y errores de consola
  python tools/probar.py png salida.png "shot=1&pantalla=juego&nivel=1&sim=20" [--crop x,y,w,h] [--zoom 2]
"""
import base64, io, pathlib, re, subprocess, sys, tempfile, glob
RAIZ = pathlib.Path(__file__).resolve().parents[1]
CHROME = next((p for p in ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome", "/usr/bin/chromium", "/usr/bin/google-chrome",
               r"C:\Program Files\Google\Chrome\Application\chrome.exe"] if pathlib.Path(p).exists()), None) or \
         (glob.glob("/opt/pw-browsers/chromium-*/chrome-linux/chrome") or [None])[0]

def volcar(q, t=240):
    r = subprocess.run([CHROME, "--headless=new", "--no-sandbox", "--disable-gpu", "--allow-file-access-from-files",
                        "--enable-logging=stderr", "--v=0", f"--user-data-dir={tempfile.mkdtemp()}",
                        "--virtual-time-budget=60000", "--dump-dom", (RAIZ / "index.html").as_uri() + "?" + q],
                       capture_output=True, text=True, timeout=t, encoding="utf-8", errors="replace")
    m = re.search(r'<pre id="out">(.*?)</pre>', r.stdout, re.S)
    errs = [l for l in r.stderr.splitlines() if "Uncaught" in l or ("CONSOLE" in l and "rror" in l)]
    return (m.group(1) if m else None), errs

def main():
    modo, a = sys.argv[1], sys.argv[2:]
    if modo == "dom":
        out, errs = volcar(a[0])
        print(out or "(sin salida)"); [print("[err]", e) for e in errs]
        return
    dest, q = a[0], a[1]
    crop = a[a.index("--crop") + 1] if "--crop" in a else None
    zoom = int(a[a.index("--zoom") + 1]) if "--zoom" in a else 2
    out, errs = volcar(q)
    [print("[err]", e) for e in errs]
    if not out or not out.startswith("data:image"): sys.exit("sin imagen")
    from PIL import Image
    im = Image.open(io.BytesIO(base64.b64decode(out.split(",", 1)[1]))).convert("RGB")
    if crop:
        x, y, w, h = map(int, crop.split(",")); im = im.crop((x, y, x + w, y + h))
    im.resize((im.width * zoom, im.height * zoom), Image.NEAREST).save(dest); print("ok", dest)

if __name__ == "__main__":
    main()
