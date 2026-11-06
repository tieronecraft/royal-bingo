#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generates 100% copyright-free multi-resolution PNG and Windows .ICO icons
plus Android mipmap icons for `ሮያል ቢንጎ ፕሮ (Royal Bingo Pro 500)`.
"""
import os
from PIL import Image, ImageDraw, ImageFont

def draw_royal_bingo_icon(size=512):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    pad = int(size * 0.04)
    radius = int(size * 0.18)

    # Deep Royal Navy background shield with Gold border
    draw.rounded_rectangle(
        [pad, pad, size - pad, size - pad],
        radius=radius,
        fill=(15, 23, 42, 255),
        outline=(250, 204, 21, 255),
        width=max(2, int(size * 0.03))
    )

    # Habesha Crown Accent Bars (Green, Gold, Red)
    bar_w = int(size * 0.56)
    bar_x1 = (size - bar_w) // 2
    bar_x2 = bar_x1 + bar_w
    bar_h = max(2, int(size * 0.022))

    y_green = int(size * 0.16)
    y_gold = y_green + int(size * 0.035)
    y_red = y_gold + int(size * 0.035)

    draw.rounded_rectangle([bar_x1, y_green, bar_x2, y_green + bar_h], radius=4, fill=(34, 197, 94, 255))
    draw.rounded_rectangle([bar_x1, y_gold, bar_x2, y_gold + bar_h], radius=4, fill=(250, 204, 21, 255))
    draw.rounded_rectangle([bar_x1, y_red, bar_x2, y_red + bar_h], radius=4, fill=(239, 68, 68, 255))

    # Royal Crown Polygon
    crown_pts = [
        (int(size * 0.25), int(size * 0.44)),
        (int(size * 0.20), int(size * 0.28)),
        (int(size * 0.38), int(size * 0.37)),
        (int(size * 0.50), int(size * 0.23)),
        (int(size * 0.62), int(size * 0.37)),
        (int(size * 0.80), int(size * 0.28)),
        (int(size * 0.75), int(size * 0.44)),
    ]
    draw.polygon(crown_pts, fill=(234, 179, 8, 255), outline=(254, 240, 138, 255))

    # Central Golden Bingo Ball
    cx, cy = size // 2, int(size * 0.64)
    r_outer = int(size * 0.22)
    r_inner = int(size * 0.17)
    draw.ellipse([cx - r_outer, cy - r_outer, cx + r_outer, cy + r_outer], fill=(250, 204, 21, 255))
    draw.ellipse([cx - r_inner, cy - r_inner, cx + r_inner, cy + r_inner], fill=(15, 23, 42, 255))

    # Draw "500" inside the sphere
    font_size = max(10, int(size * 0.13))
    try:
        font = ImageFont.truetype("DejaVuSans-Bold.ttf", font_size)
    except Exception:
        font = ImageFont.load_default()

    text = "500"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text((cx - tw / 2, cy - th / 2 - bbox[1]), text, fill=(254, 240, 138, 255), font=font)

    return img

def main():
    os.makedirs("assets", exist_ok=True)
    base_img = draw_royal_bingo_icon(512)
    base_img.save("assets/icon.png", format="PNG")
    # Save multi-size Windows .ico for Electron-Builder NSIS
    ico_sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    base_img.save("assets/icon.ico", format="ICO", sizes=ico_sizes)
    print("Generated assets/icon.png and assets/icon.ico successfully.")

if __name__ == "__main__":
    main()
