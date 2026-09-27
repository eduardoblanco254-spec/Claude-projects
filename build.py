"""Une dev.html y src/*.js en un único index.html autónomo."""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    page = (ROOT / "dev.html").read_text(encoding="utf-8")

    def inline(m):
        src = m.group(1)
        code = (ROOT / src).read_text(encoding="utf-8")
        if "</script" in code.lower():
            sys.exit(f"{src} contiene '</script', no se puede incrustar")
        return f"<script>\n/* {src} */\n{code}\n</script>"

    out, n = re.subn(r'<script src="([^"]+)"></script>', inline, page)
    (ROOT / "index.html").write_text(out, encoding="utf-8")
    print(f"index.html: {n} scripts incrustados, {len(out.encode('utf-8')) // 1024} KB")


if __name__ == "__main__":
    main()
