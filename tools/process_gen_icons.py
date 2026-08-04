"""从 AI 生成图中去除浅色背景并生成最终导航图标（透明背景、居中、256px）。"""
import numpy as np
from PIL import Image
import os, sys

SRC = {
    'selfmedia': 'A_cute_kawaii_sticker_style_ca_2026-08-03T10-32-37.png',
    'films':     'A_cute_kawaii_sticker_style_ca_2026-08-03T10-33-07.png',
    'fragment':  'cute_kawaii_sticker_cartoon_ic_2026-08-03T10-34-22.png',
    'excerpt':   'cute_kawaii_sticker_cartoon_ic_2026-08-03T10-34-49.png',
}
BASE = '/Users/jojo/WorkBuddy/2026-08-01-19-02-10/assets/icons'

def remove_background(im):
    """从边缘 flood-fill 去除与背景相近的颜色，返回透明背景 RGBA 图。"""
    arr = np.array(im.convert('RGBA')).astype(np.float32)
    h, w, _ = arr.shape
    # 背景色取四角平均（接近白色）
    corners = np.array([
        arr[2, 2], arr[2, w-3], arr[h-3, 2], arr[h-3, w-3]
    ])
    bg = corners.mean(axis=0)[:3]
    # 背景相似阈值（颜色欧氏距离）
    thr = 40.0
    rgb = arr[:, :, :3]
    dist = np.sqrt(((rgb - bg) ** 2).sum(axis=2))

    # flood fill 从边缘 BFS
    from collections import deque
    visited = np.zeros((h, w), dtype=bool)
    is_bg_like = dist <= thr
    q = deque()
    for x in range(w):
        if is_bg_like[0, x]: q.append((0, x)); visited[0, x] = True
        if is_bg_like[h-1, x]: q.append((h-1, x)); visited[h-1, x] = True
    for y in range(h):
        if is_bg_like[y, 0]: q.append((y, 0)); visited[y, 0] = True
        if is_bg_like[y, w-1]: q.append((y, w-1)); visited[y, w-1] = True
    while q:
        y, x = q.popleft()
        for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
            ny, nx = y+dy, x+dx
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx] and is_bg_like[ny, nx]:
                visited[ny, nx] = True
                q.append((ny, nx))
    # 边缘羽化：对 visited 边界做轻微过渡
    alpha = np.where(visited, 0, 255).astype(np.uint8)
    # 简单羽化：对边界像素半透明
    # 主体内容保留，边缘背景去除
    out = arr.copy()
    out[:, :, 3] = alpha
    return Image.fromarray(out.astype(np.uint8), 'RGBA')

def crop_center(im):
    """按 alpha 非零区域居中裁切为正方形。"""
    a = np.array(im)[:, :, 3]
    ys, xs = np.where(a > 10)
    if len(xs) == 0:
        return im
    x0, x1 = xs.min(), xs.max()
    y0, y1 = ys.min(), ys.max()
    w, h = x1-x0, y1-y0
    side = max(w, h) + 20
    cx, cy = (x0+x1)//2, (y0+y1)//2
    left = max(0, cx - side//2)
    top = max(0, cy - side//2)
    box = im.crop((left, top, left+side, top+side))
    return box

for name, src in SRC.items():
    p = os.path.join(BASE, src)
    if not os.path.exists(p):
        print('MISSING', name, src)
        continue
    im = Image.open(p).convert('RGBA')
    im = remove_background(im)
    im = crop_center(im)
    im = im.resize((256, 256), Image.LANCZOS)
    out = os.path.join(BASE, f'icon-{name}.png')
    im.save(out)
    print(f'OK icon-{name}.png  <- {src}')
print('done')
