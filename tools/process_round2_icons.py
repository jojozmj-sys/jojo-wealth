"""把用户新提供的 15 张收藏图(白底)抠图成透明 PNG，居中裁切缩放到 256px。"""
import numpy as np
from PIL import Image
import glob, os

SRC_DIR = '/Users/jojo/.workbuddy/clipboard-images/clipboard-2026-08-03T11-07-18-*.jpg'
OUT_DIR = '/Users/jojo/WorkBuddy/2026-08-01-19-02-10/user-icons/round2'
os.makedirs(OUT_DIR, exist_ok=True)

def remove_background(im):
    arr = np.array(im.convert('RGBA')).astype(np.float32)
    h, w, _ = arr.shape
    corners = np.array([arr[2,2], arr[2,w-3], arr[h-3,2], arr[h-3,w-3]])
    bg = corners.mean(axis=0)[:3]
    thr = 45.0
    rgb = arr[:,:,:3]
    dist = np.sqrt(((rgb-bg)**2).sum(axis=2))
    from collections import deque
    visited = np.zeros((h,w), dtype=bool)
    is_bg = dist <= thr
    q = deque()
    for x in range(w):
        if is_bg[0,x]: q.append((0,x)); visited[0,x]=True
        if is_bg[h-1,x]: q.append((h-1,x)); visited[h-1,x]=True
    for y in range(h):
        if is_bg[y,0]: q.append((y,0)); visited[y,0]=True
        if is_bg[y,w-1]: q.append((y,w-1)); visited[y,w-1]=True
    while q:
        y,x = q.popleft()
        for dy,dx in ((1,0),(-1,0),(0,1),(0,-1)):
            ny,nx = y+dy,x+dx
            if 0<=ny<h and 0<=nx<w and not visited[ny,nx] and is_bg[ny,nx]:
                visited[ny,nx]=True; q.append((ny,nx))
    # 羽化：背景边界像素半透明过渡
    alpha = np.where(visited,0,255).astype(np.uint8)
    out = arr.copy(); out[:,:,3]=alpha
    return Image.fromarray(out.astype(np.uint8),'RGBA')

def crop_center(im):
    a = np.array(im)[:,:,3]
    ys,xs = np.where(a>10)
    if len(xs)==0: return im
    x0,x1 = xs.min(),xs.max(); y0,y1 = ys.min(),ys.max()
    w,h = x1-x0,y1-y0
    side = max(w,h)+24
    cx,cy = (x0+x1)//2,(y0+y1)//2
    left = max(0,cx-side//2); top = max(0,cy-side//2)
    return im.crop((left,top,left+side,top+side))

files = sorted(glob.glob(SRC_DIR))
print(f'共 {len(files)} 张图待抠图')
for i,f in enumerate(files,1):
    im = Image.open(f).convert('RGBA')
    im = remove_background(im)
    im = crop_center(im)
    im = im.resize((256,256), Image.LANCZOS)
    # 输出带序号的文件名
    out = os.path.join(OUT_DIR, f'round2-{i:02d}.png')
    im.save(out)
    # 统计不透明占比
    a = np.array(im)[:,:,3]
    opaque = (a>200).sum()/a.size*100
    print(f'  {i:2d} -> round2-{i:02d}.png  不透明占比{opaque:.0f}%')
print('done')
