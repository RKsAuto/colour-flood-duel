#!/usr/bin/env python3
"""Build the CrazyGames upload package.

Copies the game into dist/crazygames/ as a flat folder (no subfolders, because the
CrazyGames uploader takes loose files, not archives or folders), adds the CrazyGames
SDK script and turns on the fit-to-frame layout. A zip of the same files is written to
dist/colour-flood-duel-crazygames.zip for convenience: unzip it and upload the files.
Run from the repo root:  python3 tools/build-crazygames.py
"""
import pathlib, shutil, zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "dist" / "crazygames"
ZIP = ROOT / "dist" / "colour-flood-duel-crazygames.zip"
FILES = ["index.html", "style.css", "game.js", "art.js", "platform.js", "main.js"]
SDK_TAG = '<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>'

shutil.rmtree(OUT, ignore_errors=True)
OUT.mkdir(parents=True)
for f in FILES:
    shutil.copy2(ROOT / f, OUT / f)
for f in (ROOT / "fonts").iterdir():
    shutil.copy2(f, OUT / f.name)   # fonts sit next to index.html
css = (OUT / "style.css").read_text()
assert 'url("fonts/' in css
(OUT / "style.css").write_text(css.replace('url("fonts/', 'url("'))

html = (OUT / "index.html").read_text()
assert "<!-- PLATFORM_SDK -->" in html and '<html lang="en">' in html
html = html.replace("<!-- PLATFORM_SDK -->", SDK_TAG)
html = html.replace('<html lang="en">', '<html lang="en" class="embed">')
html = html.replace('href="fonts/', 'href="')
(OUT / "index.html").write_text(html)

ZIP.unlink(missing_ok=True)
with zipfile.ZipFile(ZIP, "w", zipfile.ZIP_DEFLATED) as z:
    for p in sorted(OUT.rglob("*")):
        if p.is_file():
            z.write(p, p.relative_to(OUT).as_posix())

size = sum(p.stat().st_size for p in OUT.rglob("*") if p.is_file())
print(f"Built {ZIP.relative_to(ROOT)}: {len(list(OUT.rglob('*.*')))} files, {size/1024:.0f} KB unzipped")
