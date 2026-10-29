# Rebuilds <name>-cut.png in full colour: original photo RGB + the background-removal mask.
# (The remover writes a 256-colour PNG, which flattens the photo.)
import sys
from PIL import Image
for name in sys.argv[1:] or ["back", "front"]:
    photo = Image.open(f"public/images/{name}.webp").convert("RGB")
    mask = Image.open(f"art/{name}-mask.png").convert("RGBA").getchannel("A")
    out = photo.copy()
    out.putalpha(mask.resize(photo.size))
    out.save(f"public/images/{name}-cut.webp", quality=90, method=6)
    print(name, out.mode, out.size)
