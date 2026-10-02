"""Bake the original guarded ink bands once, rather than mask/blur every frame.

Run from the repository root with Python, Pillow and NumPy. Coordinates and
smoothstep masks match symbol-motion.js; the original drawing is never changed.
"""
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ART = np.asarray(Image.open(ROOT / "assets/dream-unity-portals-refined.webp").convert("RGB"))
RINGS = [(627, 627, 386, 542, 16), (354, 627, 79, 142, 6),
         (626, 604, 136, 207, 8), (899, 627, 79, 142, 6)]
HUBS = [(354, 627, 140), (626, 604, 200), (899, 627, 140)]


def smooth(a, b, value):
    t = np.clip((value - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


for i, (cx, cy, inner, outer, feather) in enumerate(RINGS):
    # Pixel centres keep the crop's rotational centre exactly at outer,outer.
    left, top = cx - outer, cy - outer
    yy, xx = np.mgrid[top:cy + outer, left:cx + outer].astype(float)
    xx += .5
    yy += .5
    radius = np.hypot(xx - cx, yy - cy)
    weight = smooth(inner, inner + feather, radius) * (1 - smooth(outer - feather, outer, radius))
    weight *= smooth(10, 24, np.abs(yy - 627))
    for hx, r0, r1 in [(354, 69, 81), (626, 130, 148), (899, 69, 81)]:
        weight *= smooth(r0, r1, np.hypot(xx - hx, yy - 627))
    for hx, hy, r in HUBS:
        if (hx, hy) != (cx, cy):
            weight *= smooth(r, r + 12, np.hypot(xx - hx, yy - hy))
    alpha = np.rint(weight * 255).astype(np.uint8)
    rgb = ART[top:cy + outer, left:cx + outer]
    Image.fromarray(np.dstack((rgb, alpha))).save(ROOT / f"assets/symbol-ring-{i}.webp", lossless=True)
    Image.fromarray(np.dstack((np.full_like(alpha, 255), alpha)), "LA").save(
        ROOT / f"assets/symbol-mask-{i}.png", optimize=True)
    print(f"Baked ring {i}: {outer * 2} x {outer * 2}")
