"""
CitrusMail app icon, painted like an Eric Carle collage: two citrus slices cut
from hand-painted tissue paper (brush streaks, mottling, torn edges) laid on a
pale sky-blue painted sheet with a little grain. Everything is procedural and
seeded, so the output is the same on every run.

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
rng = np.random.default_rng(7)


def hexrgb(value):
    value = value.lstrip('#')
    return np.array([int(value[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float32) / 255


def noise(size, sigma, seed):
    """Smooth value noise in [-1, 1]"""
    field = np.random.default_rng(seed).standard_normal((size, size)).astype(np.float32)
    field = ndimage.gaussian_filter(field, sigma, mode='wrap')
    return field / (np.abs(field).max() + 1e-6)


def fractal(size, seed, octaves=((48, 1), (16, .5), (5, .25), (1.5, .12))):
    out = sum(weight * noise(size, sigma, seed + i) for i, (sigma, weight) in enumerate(octaves))
    return out / sum(w for _, w in octaves)


def strokes(size, angle, seed, length=60, width=1.6, curl=0.0):
    """Long thin streaks in one direction, like a wide brush dragged across paper"""
    pad = int(size * 0.45)
    big = size + 2 * pad
    field = np.random.default_rng(seed).standard_normal((big, big)).astype(np.float32)
    field = ndimage.gaussian_filter(field, (width, length))
    if curl:
        # Bend the strokes a little so they don't look ruled
        yy, xx = np.mgrid[0:big, 0:big].astype(np.float32)
        warp = noise(big, 90, seed + 99) * curl
        field = ndimage.map_coordinates(field, [yy + warp, xx], order=1, mode='wrap')
    field = ndimage.rotate(field, angle, reshape=False, order=1, mode='wrap')
    field = field[pad:pad + size, pad:pad + size]
    return field / (np.abs(field).max() + 1e-6)


def painted(size, colors, angle, seed, streak=0.55, mottle=0.5, blotch=None):
    """A sheet of hand-painted paper: two or three paints dragged in one
    direction, with drier, lighter streaks where the brush ran out"""
    a = strokes(size, angle, seed, length=80, width=3.2, curl=18)
    b = strokes(size, angle + 18, seed + 1, length=30, width=1.3, curl=8)
    c = strokes(size, angle - 12, seed + 2, length=170, width=11, curl=26)
    m = fractal(size, seed + 3)
    t = np.clip(0.5 + streak * (0.5 * a + 0.22 * b + 0.45 * c) + mottle * 0.45 * m, 0, 1)
    c0, c1, c2 = (hexrgb(c) for c in colors)
    # Blend dark → mid → light along t
    low = np.clip(t * 2, 0, 1)[..., None]
    high = np.clip(t * 2 - 1, 0, 1)[..., None]
    rgb = c0 * (1 - low) + c1 * low
    rgb = rgb * (1 - high) + c2 * high
    # Blotches of a neighbouring hue, the way Carle's papers are never one colour
    if blotch is not None:
        b = np.clip(fractal(size, seed + 9, ((70, 1), (25, .5), (8, .2))) * 1.8 - 0.25, 0, 1)[..., None] * 0.6
        rgb = rgb * (1 - b) + hexrgb(blotch) * b
    # Dry-brush: occasional pale scrapes where the paper shows
    dry = np.clip((strokes(size, angle + 4, seed + 4, length=120, width=2.2, curl=20) - 0.5) * 2.5, 0, 1)[..., None]
    rgb = rgb * (1 - 0.35 * dry) + np.array([1, 0.97, 0.9]) * 0.35 * dry
    return rgb


def torn_mask(size, sdf, seed, roughness=7.0, softness=1.2):
    """Paper cut by hand: the edge wanders a little at two scales"""
    wobble = roughness * (1.1 * noise(size, 60, seed + 2) + 0.55 * noise(size, 14, seed) + 0.35 * noise(size, 3, seed + 1))
    d = sdf + wobble
    return np.clip(0.5 - d / (2 * softness), 0, 1)


def circle_sdf(size, cx, cy, r):
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    return np.hypot(xx - cx, yy - cy) - r


def spokes_mask(size, cx, cy, r, count, rotation, seed):
    """The segments of a citrus slice, painted in a lighter tint: a rind ring
    and thin spokes, all a little uneven"""
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    k = size / 1024
    # Painted by hand: the lines wander and swell
    xx = xx + noise(size, 30 * k, seed + 5) * 9 * k
    yy = yy + noise(size, 30 * k, seed + 6) * 9 * k
    dx, dy = xx - cx, yy - cy
    dist = np.hypot(dx, dy)
    ang = np.arctan2(dy, dx) - rotation
    w = noise(size, 18 * k, seed) * 1.0
    # Spokes: thin wedges, widening slightly outward
    sector = (ang * count / (2 * np.pi)) % 1.0
    off = np.minimum(sector, 1 - sector) * (2 * np.pi / count) * dist
    spoke = np.clip(1 - (off - (5 + w * 4.5) * k) / (2.5 * k), 0, 1) * (dist < r * 0.83) * (dist > r * 0.12)
    # Rind: a ring just inside the edge
    ring_d = np.abs(dist - r * 0.87 - w * 4)
    ring = np.clip(1 - (ring_d - r * (0.035 + 0.012 * w)) / (2.5 * k), 0, 1)
    # Pith at the centre
    hub = np.clip(1 - (dist - r * (0.12 + 0.03 * w)) / (2.5 * k), 0, 1)
    return np.clip(spoke + ring + hub, 0, 1)


def shadow(mask, offset=(6, 9), blur=7, strength=0.28):
    s = ndimage.shift(mask, offset, order=1)
    return ndimage.gaussian_filter(s, blur) * strength


def fibre_rim(size, sdf, seed, s):
    """Where tissue is torn rather than cut, a pale ragged fringe shows"""
    outer = torn_mask(size, sdf - 4.5 * s, seed + 7, roughness=11 * s, softness=1.4)
    where = np.clip(noise(size, 35 * s, seed + 8) * 2.2, 0, 1)
    return outer * where


def lay(canvas, piece_rgb, mask, cast=True):
    if cast:
        canvas *= (1 - shadow(mask))[..., None]
    m = mask[..., None]
    return canvas * (1 - m) + piece_rgb * m


def superellipse_mask(size, inset, n=5.0, scale=1.0):
    """Apple-style squircle filling `size - 2*inset`"""
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    half = (size - 2 * inset) / 2
    c = (size - 1) / 2
    u = np.abs(xx - c) / half
    v = np.abs(yy - c) / half
    d = (u ** n + v ** n) ** (1 / n)
    # ~1px antialiased edge
    return np.clip((1 - d) * half / 1.0 + 0.5, 0, 1)


def artwork(size, detail=1.0):
    """The square artwork, full bleed. `detail` < 1 calms the texture for tiny sizes"""
    s = size / 1024
    # Background: pale sky tissue, painted in wide diagonal sweeps
    bg = painted(size, ['#A4D0D4', '#C6E5E3', '#E8F4EC'], angle=-24, seed=11, streak=0.55 * detail, mottle=0.55 * detail, blotch='#D9EDDC')
    canvas = bg.copy()

    # A second, torn strip of slightly deeper blue across the bottom for depth
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    strip_sdf = (yy - (0.80 * size - 0.12 * (xx - size / 2))) * -1
    strip = torn_mask(size, strip_sdf, 31, roughness=16 * s) * detail
    canvas = lay(canvas, painted(size, ['#7FBCC4', '#9ACBCD', '#B9DCD9'], angle=8, seed=21, streak=0.55, mottle=0.4), strip * 0.85, cast=False)

    # The two slices, on a rising diagonal like the mark
    r = 300 * s
    a = (0.385 * size, 0.615 * size)
    b = (0.615 * size, 0.385 * size)

    pale_sdf = circle_sdf(size, *a, r)
    bright_sdf = circle_sdf(size, *b, r)
    pale = torn_mask(size, pale_sdf, 41, roughness=10 * s)
    bright = torn_mask(size, bright_sdf, 51, roughness=10 * s)

    pale_rgb = painted(size, ['#F49A4A', '#FDBA74', '#FFE3B5'], angle=35, seed=61, streak=0.75 * detail, mottle=0.6 * detail, blotch='#FCD25E')
    bright_rgb = painted(size, ['#D9480B', '#F97316', '#FFA54A'], angle=-50, seed=71, streak=0.75 * detail, mottle=0.6 * detail, blotch='#F5A524')
    deep_rgb = painted(size, ['#8F2A08', '#C2410C', '#E0601F'], angle=70, seed=81, streak=0.7 * detail, mottle=0.55 * detail, blotch='#B8321A')

    # Segment tints painted on each paper before it is laid
    tint_pale = painted(size, ['#FFE7C2', '#FFF1DA', '#FFF8EC'], angle=10, seed=91, streak=0.4, mottle=0.3)
    tint_bright = painted(size, ['#FFB868', '#FFC985', '#FFDDA8'], angle=-10, seed=92, streak=0.4, mottle=0.3)
    sp_a = spokes_mask(size, *a, r, 9, 0.2, 101) * 0.85
    sp_b = spokes_mask(size, *b, r, 9, -0.15, 102) * 0.8
    pale_rgb = pale_rgb * (1 - sp_a[..., None]) + tint_pale * sp_a[..., None]
    bright_rgb = bright_rgb * (1 - sp_b[..., None]) + tint_bright * sp_b[..., None]

    canvas *= (1 - shadow(np.maximum(pale, bright), offset=(7 * s, 10 * s), blur=8 * s))[..., None]
    paper = hexrgb('#FFF6E8')
    canvas = lay(canvas, paper, fibre_rim(size, pale_sdf, 41, s) * 0.9)
    canvas = lay(canvas, pale_rgb, pale, cast=False)
    canvas = lay(canvas, paper, fibre_rim(size, bright_sdf, 51, s) * 0.9)
    canvas = lay(canvas, bright_rgb, bright)

    # The overlap, cut from deeper paper and laid on top with its own torn edge
    overlap_sdf = np.maximum(pale_sdf, bright_sdf) + 4 * s
    overlap = torn_mask(size, overlap_sdf, 111, roughness=6 * s)
    deep_spokes = spokes_mask(size, *b, r, 9, -0.15, 102) * 0.45
    deep_rgb = deep_rgb * (1 - deep_spokes[..., None]) + hexrgb('#EE7A35') * deep_spokes[..., None]
    canvas = lay(canvas, deep_rgb, overlap)

    # Very light paper grain over everything
    grain = np.random.default_rng(5).standard_normal((size, size)).astype(np.float32)
    grain = ndimage.gaussian_filter(grain, 0.7) * 0.022 * detail
    fiber = strokes(size, 80, 6, length=18, width=0.6) * 0.012 * detail
    canvas = canvas + (grain + fiber)[..., None]
    return np.clip(canvas, 0, 1)


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
    shadow_img = to_image(np.zeros((N, N, 3)), shadow_a)
    full = Image.alpha_composite(full, shadow_img)
    tile_rgb = np.zeros((N, N, 3), dtype=np.float32)
    tile_rgb[inset:inset + tile, inset:inset + tile] = np.asarray(art_img, dtype=np.float32) / 255
    return Image.alpha_composite(full, to_image(tile_rgb, mask))


def main():
    art = artwork(N)
    mac_icon(art).save(ROOT / 'desktop/build/icon.png')

    square = to_image(art)
    square.resize((512, 512), Image.LANCZOS).save(ROOT / 'public/icon-512.png')
    square.resize((180, 180), Image.LANCZOS).save(ROOT / 'public/apple-touch-icon.png')

    # Favicon: calmer texture so the two slices still read at 16px
    # cropped in, so the slices fill a browser tab
    small = to_image(artwork(512, detail=0.35)).crop((52, 52, 460, 460))
    sizes = [(16, 16), (32, 32), (48, 48)]
    # Rounded a little so it sits nicely in a browser tab
    fav = small.resize((256, 256), Image.LANCZOS).convert('RGBA')
    m = superellipse_mask(256, 0, n=4.0)
    fav.putalpha(Image.fromarray((m * 255).astype(np.uint8)))
    fav = fav.filter(ImageFilter.UnsharpMask(radius=1, percent=60, threshold=2))
    fav.save(ROOT / 'public/favicon.ico', sizes=sizes)


if __name__ == '__main__':
    main()
