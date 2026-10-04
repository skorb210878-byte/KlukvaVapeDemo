"""
Сжимает фото товаров и делает превью для каталога.

Читает:   assets/photos/products/<id>.jpg (или .jpeg/.png) — по одному файлу на товар,
          имя файла = id товара из data/products.json.
Пишет:    assets/photos/products/optimized/<id>.jpg        — полная версия, длинная
          сторона до 900 px, качество ~82 (для карточки товара)
          assets/photos/products/optimized/<id>-thumb.jpg  — превью, длинная сторона
          400 px (для плиток каталога)

Ничего в data/products.json менять не нужно: если поле photos у товара пустое,
фронтенд сам подставит assets/photos/products/optimized/<id>-thumb.jpg и .../<id>.jpg,
а если файла нет — покажет фиолетовую заглушку.

Запуск (из корня проекта):
    pip install pillow   # один раз
    python scripts/optimize_images.py
"""

from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = ROOT / 'assets' / 'photos' / 'products'
OUT_DIR = SOURCE_DIR / 'optimized'

FULL_MAX_SIDE = 900
THUMB_MAX_SIDE = 400
JPEG_QUALITY = 82
SOURCE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp'}


def resize_to_max_side(img, max_side):
    w, h = img.size
    if max(w, h) <= max_side:
        return img.copy()
    scale = max_side / max(w, h)
    return img.resize((round(w * scale), round(h * scale)), Image.LANCZOS)


def process_one(path):
    product_id = path.stem
    img = ImageOps.exif_transpose(Image.open(path)).convert('RGB')

    full = resize_to_max_side(img, FULL_MAX_SIDE)
    full.save(OUT_DIR / f'{product_id}.jpg', 'JPEG', quality=JPEG_QUALITY, optimize=True)

    thumb = resize_to_max_side(img, THUMB_MAX_SIDE)
    thumb.save(OUT_DIR / f'{product_id}-thumb.jpg', 'JPEG', quality=JPEG_QUALITY, optimize=True)


def main():
    if not SOURCE_DIR.exists():
        raise SystemExit(f'Нет папки {SOURCE_DIR} — создайте её и положите туда фото вида <id>.jpg')

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    sources = sorted(
        p for p in SOURCE_DIR.iterdir()
        if p.is_file() and p.suffix.lower() in SOURCE_EXTENSIONS
    )
    if not sources:
        print(f'В {SOURCE_DIR} нет фото (ожидались файлы вида 1.jpg, 12.png и т.д.).')
        return

    for path in sources:
        process_one(path)
        print(f'  {path.name} -> optimized/{path.stem}.jpg + optimized/{path.stem}-thumb.jpg')

    print(f'\nГотово: обработано файлов — {len(sources)}')


if __name__ == '__main__':
    main()
