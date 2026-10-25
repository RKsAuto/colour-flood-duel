#!/usr/bin/env python3
"""Build the CrazyGames upload package.

Copies the game into dist/crazygames/, adds the CrazyGames SDK script and
turns on the fit-to-frame layout, then zips it to dist/colour-flood-duel-crazygames.zip.
Run from the repo root:  python3 tools/build-crazygames.py
"""
import pathlib, shutil, zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "dist" / "crazygames"
ZIP = ROOT / "dist" / "colour-flood-duel-crazygames.zip"
FILES = ["index.html", "style.css", "game.js", "platform.js", "main.js"]
SDK_TAG = '<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>'

shutil.rmtree(OUT, ignore_errors=True)
OUT.mkdir(parents=True)
for f in FILES:
    shutil.copy2(ROOT / f, OUT / f)
shutil.copytree(ROOT / "fonts", OUT / "fonts")

html = (OUT / "index.html").read_text()
assert "<!-- PLATFORM_SDK -->" in html and '<html lang="en">' in html
html = html.replace("<!-- PLATFORM_SDK -->", SDK_TAG)
html = html.replace('<html lang="en">', '<html lang="en" class="embed">')
(OUT / "index.html").write_text(html)

ZIP.unlink(missing_ok=True)
with zipfile.ZipFile(ZIP, "w", zipfile.ZIP_DEFLATED) as z:
    for p in sorted(OUT.rglob("*")):
        if p.is_file():
            z.write(p, p.relative_to(OUT).as_posix())

size = sum(p.stat().st_size for p in OUT.rglob("*") if p.is_file())
print(f"Built {ZIP.relative_to(ROOT)}: {len(list(OUT.rglob('*.*')))} files, {size/1024:.0f} KB unzipped")
