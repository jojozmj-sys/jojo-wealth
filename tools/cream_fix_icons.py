"""把 AI 生成的图标里白色/过浅主体统一染成奶油米色，与薄荷绿侧边栏协调。
策略：将"接近中性白灰"的像素(亮度高、饱和度低、非纯黑描边、非彩色点缀)替换为奶油米 #F5E0C8。
保留深色描边与彩色点缀。处理 selfmedia/films/fragment 三个白身小狗图标。
"""
from PIL import Image

CREAM = (245, 224, 200)  # 奶油米 #F5E0C8

def is_neutral_whiteish(r, g, b):
    """判断是否接近中性白灰：亮度足够高且饱和度低(接近灰白而非彩色)"""
    mx = max(r, g, b); mn = min(r, g, b)
    if mx < 220:            # 不够亮(可能是灰暗部分) -> 不动
        return False
    sat = mx - mn
    if sat > 30:            # 彩色(偏粉/偏黄等) -> 保留
        return False
    return True

def process(src, dst):
    im = Image.open(src).convert("RGBA")
    w, h = im.size
    px = im.load()
    changed = 0
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 200:
                continue
            if is_neutral_whiteish(r, g, b):
                # 改为奶油米色，保留原 alpha
                px[x, y] = (CREAM[0], CREAM[1], CREAM[2], a)
                changed += 1
    im.save(dst)
    print(f"{src.split('/')[-1]} -> {dst.split('/')[-1]}  染色像素 {changed}")

for f in ["selfmedia", "films", "fragment"]:
    process(f"assets/icons/icon-{f}.png", f"assets/icons/icon-{f}-cream.png")
