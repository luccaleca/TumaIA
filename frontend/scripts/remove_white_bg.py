"""Remove near-white pixels from a PNG (logo on white canvas -> transparent)."""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image


def remove_white_background(
    src: Path,
    dst: Path,
    *,
    solid_threshold: int = 248,
    feather: int = 12,
) -> None:
    im = Image.open(src).convert("RGBA")
    px = im.load()
    w, h = im.size
    low = solid_threshold - feather

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            m = min(r, g, b)

            if m >= solid_threshold:
                px[x, y] = (r, g, b, 0)
            elif m >= low:
                # Anti-aliased edge vs white: fade alpha
                factor = (m - low) / float(feather)
                factor = max(0.0, min(1.0, factor))
                new_a = int(round(a * (1.0 - factor)))
                px[x, y] = (r, g, b, new_a)

    dst.parent.mkdir(parents=True, exist_ok=True)
    im.save(dst, "PNG", optimize=True)


def main() -> None:
    if len(sys.argv) < 3:
        print("Usage: remove_white_bg.py <input.png> <output.png>", file=sys.stderr)
        sys.exit(1)
    remove_white_background(Path(sys.argv[1]), Path(sys.argv[2]))


if __name__ == "__main__":
    main()
