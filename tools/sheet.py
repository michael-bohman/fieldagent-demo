"""Contact sheet of a frame sequence: python3 sheet.py build/frames/<demo> [cols] [scale] [crop x,y,w,h] → <dir>/sheet.png"""
import sys, pathlib
from PIL import Image, ImageDraw
d = pathlib.Path(sys.argv[1]); cols = int(sys.argv[2]) if len(sys.argv) > 2 else 4; scale = float(sys.argv[3]) if len(sys.argv) > 3 else 0.5
crop = tuple(int(v) for v in sys.argv[4].split(',')) if len(sys.argv) > 4 else None
files = sorted(p for p in d.glob('*.png') if p.name != 'sheet.png')
ims = []
for p in files:
    im = Image.open(p).convert('RGB')
    if crop: im = im.crop((crop[0], crop[1], crop[0] + crop[2], crop[1] + crop[3]))
    im = im.resize((int(im.width * scale), int(im.height * scale)), Image.LANCZOS)
    ImageDraw.Draw(im).text((6, 4), p.stem.split('_')[-1] + ' ms', fill=(255, 255, 0))
    ims.append(im)
w, h = ims[0].size; rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (cols * (w + 4), rows * (h + 4)), (40, 40, 40))
for k, im in enumerate(ims): sheet.paste(im, ((k % cols) * (w + 4), (k // cols) * (h + 4)))
sheet.save(d / 'sheet.png'); print(d / 'sheet.png', sheet.size, len(ims), 'frames')
