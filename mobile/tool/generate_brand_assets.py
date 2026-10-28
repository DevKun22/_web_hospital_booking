"""Generate deterministic Medcare Booking launcher and launch-screen PNGs.

The vector geometry is intentionally mirrored by the Android vector drawable
and Flutter's AppBrandMark painter. Run this script after changing the mark so
all raster platform assets stay in sync.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
PRIMARY_DARK = (7, 91, 88)
PRIMARY = (8, 122, 115)
PRIMARY_BRIGHT = (11, 163, 152)
WHITE = (255, 255, 255)


def _cubic(start, control_a, control_b, end, steps=18):
    points = []
    for index in range(steps):
        t = index / (steps - 1)
        inverse = 1 - t
        x = (
            inverse**3 * start[0]
            + 3 * inverse**2 * t * control_a[0]
            + 3 * inverse * t**2 * control_b[0]
            + t**3 * end[0]
        )
        y = (
            inverse**3 * start[1]
            + 3 * inverse**2 * t * control_a[1]
            + 3 * inverse * t**2 * control_b[1]
            + t**3 * end[1]
        )
        points.append((x, y))
    return points


def _shield_points(size: int, inset: float = 0.0):
    def point(x, y):
        scale = 1 - inset * 2
        return ((inset + x * scale) * size, (inset + y * scale) * size)

    points = [point(0.50, 0.18)]
    points += _cubic(
        point(0.50, 0.18),
        point(0.57, 0.23),
        point(0.66, 0.26),
        point(0.74, 0.28),
    )[1:]
    points.append(point(0.74, 0.50))
    points += _cubic(
        point(0.74, 0.50),
        point(0.74, 0.64),
        point(0.66, 0.75),
        point(0.50, 0.83),
    )[1:]
    points += _cubic(
        point(0.50, 0.83),
        point(0.34, 0.75),
        point(0.26, 0.64),
        point(0.26, 0.50),
    )[1:]
    points.append(point(0.26, 0.28))
    points += _cubic(
        point(0.26, 0.28),
        point(0.34, 0.26),
        point(0.43, 0.23),
        point(0.50, 0.18),
    )[1:]
    return points


def _gradient(size: int) -> Image.Image:
    image = Image.new("RGB", (size, size), PRIMARY_DARK)
    pixels = image.load()
    for y in range(size):
        for x in range(size):
            progress = (x + y) / max(1, 2 * (size - 1))
            pixels[x, y] = tuple(
                round(PRIMARY_DARK[channel] * (1 - progress) + PRIMARY_BRIGHT[channel] * progress)
                for channel in range(3)
            )
    return image


def _draw_symbol(image: Image.Image, scale: float = 1.0) -> None:
    size = image.width
    draw = ImageDraw.Draw(image)
    inset = (1 - scale) / 2
    draw.polygon(_shield_points(size, inset), fill=WHITE)

    def scaled(value: float) -> float:
        return (inset + value * scale) * size

    radius = max(1, round(size * 0.025 * scale))
    draw.rounded_rectangle(
        (scaled(0.455), scaled(0.35), scaled(0.545), scaled(0.66)),
        radius=radius,
        fill=PRIMARY,
    )
    draw.rounded_rectangle(
        (scaled(0.345), scaled(0.46), scaled(0.655), scaled(0.55)),
        radius=radius,
        fill=PRIMARY,
    )


def _launcher_icon(size: int) -> Image.Image:
    image = _gradient(size)
    _draw_symbol(image, scale=0.86)
    return image


def _transparent_mark(size: int) -> Image.Image:
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    _draw_symbol(image, scale=0.92)
    return image


def _save(image: Image.Image, path: Path, *, rgb: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    output = image.convert("RGB") if rgb else image
    output.save(path, format="PNG", optimize=True)


def main() -> None:
    master = _launcher_icon(1024)
    _save(master, ROOT / "assets/brand/medcare_app_icon.png", rgb=True)

    android_sizes = {
        "mipmap-mdpi": 48,
        "mipmap-hdpi": 72,
        "mipmap-xhdpi": 96,
        "mipmap-xxhdpi": 144,
        "mipmap-xxxhdpi": 192,
    }
    android_res = ROOT / "android/app/src/main/res"
    for directory, size in android_sizes.items():
        _save(
            master.resize((size, size), Image.Resampling.LANCZOS),
            android_res / directory / "ic_launcher.png",
            rgb=True,
        )

    ios_icon_dir = ROOT / "ios/Runner/Assets.xcassets/AppIcon.appiconset"
    ios_sizes = {
        "Icon-App-20x20@1x.png": 20,
        "Icon-App-20x20@2x.png": 40,
        "Icon-App-20x20@3x.png": 60,
        "Icon-App-29x29@1x.png": 29,
        "Icon-App-29x29@2x.png": 58,
        "Icon-App-29x29@3x.png": 87,
        "Icon-App-40x40@1x.png": 40,
        "Icon-App-40x40@2x.png": 80,
        "Icon-App-40x40@3x.png": 120,
        "Icon-App-60x60@2x.png": 120,
        "Icon-App-60x60@3x.png": 180,
        "Icon-App-76x76@1x.png": 76,
        "Icon-App-76x76@2x.png": 152,
        "Icon-App-83.5x83.5@2x.png": 167,
        "Icon-App-1024x1024@1x.png": 1024,
    }
    for filename, size in ios_sizes.items():
        _save(
            master.resize((size, size), Image.Resampling.LANCZOS),
            ios_icon_dir / filename,
            rgb=True,
        )

    launch_dir = ROOT / "ios/Runner/Assets.xcassets/LaunchImage.imageset"
    for filename, size in {
        "LaunchImage.png": 128,
        "LaunchImage@2x.png": 256,
        "LaunchImage@3x.png": 384,
    }.items():
        _save(_transparent_mark(size), launch_dir / filename)


if __name__ == "__main__":
    main()
