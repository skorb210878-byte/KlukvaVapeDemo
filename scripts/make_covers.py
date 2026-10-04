"""
Делает из одной фотографии два файла для Telegram:
  - assets/app-cover.png   640x360  (для /newapp в BotFather)
  - assets/app-avatar.png  512x512  (для /setuserpic — аватарка бота)

Исходник: assets/photos/app.jpg (можно передать другой путь первым аргументом).

Обрезка — по центру. Если на превью главный объект съехал к краю, два варианта:
  1. Подрезать/подвинуть исходную фотографию перед запуском.
  2. Сдвинуть центр кадрирования флагами --focus-x / --focus-y (0.0 слева/сверху,
     1.0 справа/снизу, по умолчанию 0.5 — центр), например:
         python scripts/make_covers.py --focus-x 0.4 --focus-y 0.3

Запуск (из корня проекта):
    pip install pillow   # один раз
    python scripts/make_covers.py
"""

import argparse
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SOURCE = ROOT / 'assets' / 'photos' / 'app.jpg'
COVER_OUT = ROOT / 'assets' / 'app-cover.png'
AVATAR_OUT = ROOT / 'assets' / 'app-avatar.png'

COVER_SIZE = (640, 360)
AVATAR_SIZE = (512, 512)


def crop_to_ratio(img, target_w, target_h, focus_x=0.5, focus_y=0.5):
    """Обрезает img по центру (или по заданной точке фокуса) до соотношения target_w:target_h."""
    src_w, src_h = img.size
    target_ratio = target_w / target_h
    src_ratio = src_w / src_h

    if src_ratio > target_ratio:
        # Исходник шире, чем нужно — обрезаем по бокам.
        new_w = round(src_h * target_ratio)
        new_h = src_h
    else:
        # Исходник выше, чем нужно — обрезаем сверху/снизу.
        new_w = src_w
        new_h = round(src_w / target_ratio)

    max_x = src_w - new_w
    max_y = src_h - new_h
    left = round(max_x * focus_x)
    top = round(max_y * focus_y)
    box = (left, top, left + new_w, top + new_h)
    return img.crop(box)


def make_cover(img, focus_x, focus_y):
    cropped = crop_to_ratio(img, *COVER_SIZE, focus_x, focus_y)
    return cropped.resize(COVER_SIZE, Image.LANCZOS)


def make_avatar(img, focus_x, focus_y):
    cropped = crop_to_ratio(img, *AVATAR_SIZE, focus_x, focus_y)
    return cropped.resize(AVATAR_SIZE, Image.LANCZOS)


def main():
    parser = argparse.ArgumentParser(description='Генерация app-cover.png и app-avatar.png из одной фотографии.')
    parser.add_argument('source', nargs='?', default=str(DEFAULT_SOURCE), help='путь к исходной фотографии')
    parser.add_argument('--focus-x', type=float, default=0.5, help='точка фокуса по горизонтали, 0.0-1.0 (по умолчанию 0.5 — центр)')
    parser.add_argument('--focus-y', type=float, default=0.5, help='точка фокуса по вертикали, 0.0-1.0 (по умолчанию 0.5 — центр)')
    args = parser.parse_args()

    source_path = Path(args.source)
    if not source_path.exists():
        raise SystemExit(f'Не найден файл: {source_path}\nПоложите фото по этому пути или передайте путь первым аргументом.')

    img = Image.open(source_path).convert('RGB')

    COVER_OUT.parent.mkdir(parents=True, exist_ok=True)
    make_cover(img, args.focus_x, args.focus_y).save(COVER_OUT, 'PNG')
    make_avatar(img, args.focus_x, args.focus_y).save(AVATAR_OUT, 'PNG')

    print(f'Готово:\n  {COVER_OUT} (640x360)\n  {AVATAR_OUT} (512x512)')
    print('Посмотрите оба файла — если главный объект обрезан не так, как хотелось бы,')
    print('перезапустите с --focus-x / --focus-y или заранее подрежьте исходник.')


if __name__ == '__main__':
    main()
