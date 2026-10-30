# Bakes the relief map the 3D figure uses: depth grown past the outline, then softened,
# so edge triangles stay flat. Runs once here instead of on every visitor's phone.
# Usage: python3 scripts/relief.py   -> public/images/<name>-relief.png
import sys
from PIL import Image, ImageFilter
for name in sys.argv[1:] or ["back", "front"]:
    d = Image.open(f"public/images/{name}-depth.png").convert("L")
    w = 512
    d = d.resize((w, round(d.height * w / d.width)), Image.LANCZOS)
    d = d.filter(ImageFilter.MaxFilter(11)).filter(ImageFilter.GaussianBlur(5))
    d.save(f"public/images/{name}-relief.png", optimize=True)
    print(name, d.size)
