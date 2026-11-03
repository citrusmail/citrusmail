"""
CitrusMail app icon: the logo mark, two overlapping circles in pith, zest
and rind, on a grainy off-white sheet, like a print on uncoated paper. The
circles are the same geometry and colours as public/favicon.svg. Everything
is procedural and seeded, so the output is the same on every run.

    python3 -m venv /tmp/iconenv && /tmp/iconenv/bin/pip install pillow numpy scipy
    /tmp/iconenv/bin/python desktop/build/make-icon.py

Writes desktop/build/icon.png (macOS grid, 1024), public/icon-512.png,
public/apple-touch-icon.png (full bleed, 180) and public/favicon.ico.
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
N = 1024

PAPER = '#F3F0E9'
PITH = '#FDBA74'
ZEST = '#F97316'
RIND = '#C2410C'


def hexrgb(value):
    value = value.lstrip('#')
    return np.array([int(value[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float32) / 255


def noise(size, sigma, seed):
    """Smooth noise in about [-1, 1]"""
    field = np.random.default_rng(seed).standard_normal((size, size)).astype(np.float32)
    if sigma:
        field = ndimage.gaussian_filter(field, sigma, mode='wrap')
    return field / (np.abs(field).max() + 1e-6)


def disc(size, cx, cy, r, edge, seed):
    """A circle with a soft edge, very slightly uneven, like ink on paper"""
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    wobble = noise(size, size / 40, seed) * r * 0.006
    d = np.hypot(xx - cx, yy - cy) - r - wobble
    return np.clip(0.5 - d / edge, 0, 1)


def grain(size, seed, amount):
    """Fine paper grain plus a few larger flecks"""
    fine = noise(size, 0.6, seed) * amount
    flecks = np.clip(noise(size, 1.4, seed + 1) * 3 - 2.2, 0, 1) * amount * 1.6
    cloud = noise(size, size / 9, seed + 2) * amount * 0.6
    return fine - flecks + cloud


def artwork(size, detail=1.0, scale=0.64):
    """The square artwork: paper, then the two circles printed on it"""
    s = size / N
    # The mark is drawn on a 32 grid: pith at (12, 20), zest at (20, 12), r 8.5
    k = size * scale / 25
    to_px = lambda u: (u - 16) * k + size / 2
    r = 8.5 * k
    edge = max(1.2, 1.6 * s)

    # Off-white paper, a touch lighter at the top
    yy = np.linspace(0, 1, size, dtype=np.float32)[:, None, None]
    canvas = np.broadcast_to(hexrgb(PAPER), (size, size, 3)).copy()
    canvas = canvas * (1.018 - 0.03 * yy)

    pith = disc(size, to_px(12), to_px(20), r, edge, 11)
    zest = disc(size, to_px(20), to_px(12), r, edge, 12)
    both = pith * zest

    # Each ink sits a little unevenly, so the flat colour has some life in it
    def ink(color, seed):
        tone = 1 + noise(size, size / 22, seed) * 0.025 * detail
        return hexrgb(color) * tone[..., None]

    canvas = canvas * (1 - pith[..., None]) + ink(PITH, 21) * pith[..., None]
    canvas = canvas * (1 - zest[..., None]) + ink(ZEST, 22) * zest[..., None]
    canvas = canvas * (1 - both[..., None]) + ink(RIND, 23) * both[..., None]

    # Grain over everything, a little stronger on the paper than on the ink
    g = grain(size, 5, 0.075 * detail)
    printed = np.maximum(pith, zest)[..., None]
    canvas = canvas + g[..., None] * (1 - 0.2 * printed)
    return np.clip(canvas, 0, 1)


def superellipse_mask(size, inset, n=5.0):
    """Apple's rounded-square tile (a superellipse), anti-aliased"""
    tile = size - 2 * inset
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    u = np.abs((xx + 0.5 - size / 2) / (tile / 2))
    v = np.abs((yy + 0.5 - size / 2) / (tile / 2))
    d = (u ** n + v ** n) ** (1 / n)
    return np.clip((1 - d) * tile / 2 + 0.5, 0, 1)


def to_image(rgb, alpha=None):
    arr = (np.clip(rgb, 0, 1) * 255 + 0.5).astype(np.uint8)
    if alpha is None:
        return Image.fromarray(arr, 'RGB')
    a = (np.clip(alpha, 0, 1) * 255 + 0.5).astype(np.uint8)
    return Image.fromarray(np.dstack([arr, a]), 'RGBA')


def mac_icon(art):
    """The artwork in a squircle on Apple's 1024 grid (824 tile), with a soft shadow"""
    tile = 824
    inset = (N - tile) // 2
    art_img = to_image(art).resize((tile, tile), Image.LANCZOS)
    full = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    mask = superellipse_mask(N, inset)
    shadow_a = ndimage.gaussian_filter(ndimage.shift(mask, (12, 0), order=1), 14) * 0.32
    full = Image.alpha_composite(full, to_image(np.zeros((N, N, 3)), shadow_a))
    tile_rgb = np.zeros((N, N, 3), dtype=np.float32)
    tile_rgb[inset:inset + tile, inset:inset + tile] = np.asarray(art_img, dtype=np.float32) / 255
    return Image.alpha_composite(full, to_image(tile_rgb, mask))


def main():
    art = artwork(N)
    mac_icon(art).save(ROOT / 'desktop/build/icon.png')

    square = to_image(art)
    square.resize((512, 512), Image.LANCZOS).save(ROOT / 'public/icon-512.png')
    square.resize((180, 180), Image.LANCZOS).save(ROOT / 'public/apple-touch-icon.png')

    # Favicon: the circles larger and the grain quieter, so they read at 16px
    fav = to_image(artwork(256, detail=0.4, scale=0.86)).convert('RGBA')
    fav.putalpha(Image.fromarray((superellipse_mask(256, 0, n=4.0) * 255).astype(np.uint8)))
    fav = fav.filter(ImageFilter.UnsharpMask(radius=1, percent=60, threshold=2))
    fav.save(ROOT / 'public/favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])


if __name__ == '__main__':
    main()
