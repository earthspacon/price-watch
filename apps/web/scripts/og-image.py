from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

SIZE = (1200, 630)
TOP = (30, 27, 75)
BOTTOM = (79, 70, 229)
SUN = (251, 191, 36)
WHITE = (255, 255, 255)
MUTED = (224, 231, 255)
CARD = (17, 24, 39)
FONT_DIR = Path("/usr/share/fonts/truetype/dejavu")
OUT = Path(__file__).resolve().parent.parent / "public" / "og.png"


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT_DIR / name), size)


def gradient(width: int, height: int) -> Image.Image:
    image = Image.new("RGB", (width, height))
    draw = ImageDraw.Draw(image)
    for y in range(height):
        ratio = y / (height - 1)
        color = tuple(round(TOP[i] + (BOTTOM[i] - TOP[i]) * ratio) for i in range(3))
        draw.line([(0, y), (width, y)], fill=color)
    return image


def main() -> None:
    image = gradient(*SIZE)
    draw = ImageDraw.Draw(image)

    draw.ellipse((880, 300, 1180, 600), fill=SUN)
    draw.rectangle((820, 470, 1230, 640), fill=TOP)

    draw.text((90, 120), "PriceDawn", font=font("DejaVuSans-Bold.ttf", 104), fill=WHITE)
    draw.text((90, 250), "Competitor price changes,", font=font("DejaVuSans.ttf", 54), fill=MUTED)
    draw.text((90, 315), "every morning at 7:00.", font=font("DejaVuSans.ttf", 54), fill=MUTED)

    draw.rounded_rectangle((90, 420, 720, 560), radius=18, fill=CARD)
    draw.text((120, 450), "rival.example", font=font("DejaVuSansMono.ttf", 30), fill=MUTED)
    draw.text(
        (120, 500),
        "Linen Shirt - Blue / M: 24.99 -> 19.99",
        font=font("DejaVuSansMono.ttf", 28),
        fill=WHITE,
    )

    draw.text((90, 585), "pricedawn.com", font=font("DejaVuSans-Bold.ttf", 30), fill=WHITE)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    image.save(OUT, format="PNG", optimize=True)


if __name__ == "__main__":
    main()