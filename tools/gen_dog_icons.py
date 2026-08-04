#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成「线条小狗贴纸」风格图标 SVG —— 马卡龙粉彩版。
统一模板：圆形贴纸底(马卡龙彩) + 奶油描边 + 阴影；居中线条小狗(棕色线稿) + 功能道具。
配色取自用户参考图（IMG_0284 马卡龙粉/奶油/浅蓝/浅橙；IMG_0283 奶油/浅肤）。
输出：assets/dog_icons.js 片段 + 各功能 SVG + 应用图标。
"""
import os

# 线条小狗共用线稿颜色
DOG = "#8A5A3C"   # 小狗棕色
DOG_D = "#6E4426" # 深棕
PINK = "#F5A9B8"  # 腮红
CREAM = "#FFFDF7" # 贴纸内底(白/奶油)

# 马卡龙贴纸底色（取自用户参考图主色）
MAC = {
    "pink":   ("#FFCADA", "#F48FB1"),  # 马卡龙粉 底/描边深
    "peach":  ("#FFD9C2", "#F5A97F"),  # 奶油蜜桃
    "sky":    ("#ABE4F8", "#63C1EA"),  # 浅蓝
    "cream":  ("#FFEDC2", "#E8C97A"),  # 奶油黄
    "lilac":  ("#E3D3FF", "#B79CF0"),  # 淡紫
    "sage":   ("#C9F2DD", "#7FD4A8"),  # 浅薄荷(点缀)
    "berry":  ("#FFD3E0", "#F58FB3"),  # 草莓粉
}
OUT = "#FFFFFF"   # 贴纸外白描边
# 每个功能图标的马卡龙底色
MAC_ASSIGN = {
    "plan":      "pink",
    "english":   "sky",
    "selfmedia": "peach",
    "films":     "cream",
    "hot":       "berry",
    "podcast":   "lilac",
    "fragment":  "sage",
    "notes":     "pink",
    "weekly":    "sage",
    "excerpt":   "cream",
    "manifest":  "lilac",
}

def sticker(mac):
    base, deep = MAC[mac]
    return f'''<defs>
<filter id="dogShadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="2.5" stdDeviation="3" flood-color="#5C4444" flood-opacity="0.22"/></filter>
</defs>
<circle cx="48" cy="48" r="42" fill="{base}"/>
<circle cx="48" cy="48" r="39" fill="{OUT}"/>
<circle cx="48" cy="48" r="39" fill="none" stroke="{deep}" stroke-width="2"/>
'''


def dog_head(cx=48, cy=50, s=1.0):
    """线条小狗头部（圆头 + 圆耳 + 圆眼 + 微笑 + 腮红）。几何简单确定，确保美观。"""
    r = 21*s          # 头半径
    hx, hy = cx, cy   # 头圆心
    # 双耳（圆角三角 → 用小圆+描边，位于头顶两侧偏上）
    ears = ""
    for dx in (-1, 1):
        ex = hx + dx*13*s
        ey = hy - 15*s
        ears += (f'<path d="M {ex-6*s:.1f} {ey+4*s:.1f} '
                 f'C {ex-8*s:.1f} {ey-9*s:.1f} {ex+6*s:.1f} {ey-11*s:.1f} '
                 f'{ex+6*s:.1f} {ey+5*s:.1f} Z" '
                 f'fill="none" stroke="{DOG}" stroke-width="{3*s}" stroke-linejoin="round" stroke-linecap="round"/>')
    # 脸（大圆，顶部略平以容纳耳朵）
    face = (f'<circle cx="{hx:.1f}" cy="{hy:.1f}" r="{r:.1f}" '
            f'fill="{OUT}" stroke="{DOG}" stroke-width="{3*s}"/>')
    # 眼睛
    eyes = ""
    for dx in (-1, 1):
        ex = hx + dx*8*s
        eyes += f'<circle cx="{ex:.1f}" cy="{hy-4*s:.1f}" r="{2.8*s}" fill="{DOG_D}"/>'
    # 腮红
    blush = ""
    for dx in (-1, 1):
        ex = hx + dx*14*s
        blush += f'<ellipse cx="{ex:.1f}" cy="{hy+6*s:.1f}" rx="{4.6*s}" ry="{3*s}" fill="{PINK}" opacity="0.55"/>'
    # 嘴（W形微笑）
    mouth = (f'<path d="M {hx-5*s:.1f} {hy+9*s:.1f} '
             f'C {hx-2.6*s:.1f} {hy+13*s:.1f} {hx:.1f} {hy+10*s:.1f} {hx+2.6*s:.1f} {hy+13*s:.1f} '
             f'C {hx+5*s:.1f} {hy+9*s:.1f}" '
             f'fill="none" stroke="{DOG_D}" stroke-width="{2.2*s}" stroke-linecap="round" stroke-linejoin="round"/>')
    # 鼻头（小圆点，放嘴上）
    nose = f'<ellipse cx="{hx:.1f}" cy="{hy+5*s:.1f}" rx="{2.2*s}" ry="{1.8*s}" fill="{DOG_D}"/>'
    return ears + face + eyes + nose + mouth + blush


def icon(key, label, extra="", badge=""):
    """组装完整贴纸图标。extra=附加图形,badge=道具小图标，mac=马卡龙底色键"""
    mac = MAC_ASSIGN.get(key, "pink")
    base, deep = MAC[mac]
    body = dog_head()
    if extra: body += extra
    if badge:
        body += f'<g filter="url(#dogShadow)">{badge}</g>'
    return (f'<svg class="dog-ic" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg" '
            f'aria-label="{label}">{sticker(mac)}{body}</svg>')


# ---- 道具徽标（右上角小贴纸，各功能）----
def bd_badge(d):
    return (f'<circle cx="72" cy="22" r="13" fill="#FFFFFF" stroke="#E8B93A" stroke-width="1.8"/>'
            f'<g stroke="{DOG}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none">{d}</g>')

ICONS = {
    "plan": icon("plan", "每日计划", badge=bd_badge(
        '<path d="M 66 14 l 4 4 l 8 -9"/>')),  # 对勾
    "english": icon("english", "英语学习", badge=bd_badge(
        '<path d="M 64 14 h 16 M 72 14 v 16 M 68 30 h 8"/>')),  # ABC
    "selfmedia": icon("selfmedia", "自媒体", badge=bd_badge(
        '<rect x="63" y="14" width="18" height="14" rx="2"/><path d="M 66 18 l 4 3 -4 3z M 76 15 a 3 3 0 0 1 0 0 M 70 14 v 2"/>')),
    "films": icon("films", "每日新闻", badge=bd_badge(
        '<rect x="64" y="14" width="16" height="12" rx="1.5"/><path d="M 68 15 v 10 M 76 15 v 10 M 67 15 h 2 M 67 24 h 2"/>')),
    "hot": icon("hot", "每日热点", badge=bd_badge(
        '<path d="M 72 12 c -1 4 3 4 2 9 c -0.6 3 -3 4 -3 4"/>')),
    "podcast": icon("podcast", "播客", badge=bd_badge(
        '<path d="M 66 20 a 6 6 0 0 1 12 0 M 67.5 22 a 4.5 4.5 0 0 1 9 0 M 72 26 v 3"/>')),
    "fragment": icon("fragment", "碎片阅读", badge=bd_badge(
        '<path d="M 65 15 h 9 a 4 4 0 0 1 4 4 M 65 15 v 15 h 13 v -11 M 65 22 h 13"/>')),
    "notes": icon("notes", "备忘录", badge=bd_badge(
        '<path d="M 65 15 h 8 l 6 6 v 9 h -14 z M 65 21 h 8 v 6"/>')),
    "weekly": icon("weekly", "每日觉察日记", badge=bd_badge(
        '<path d="M 72 12 v 20 M 66 17 l 12 10 M 66 27 l 12 -10"/>')),  # 叶子
    "excerpt": icon("excerpt", "摘抄笔记", badge=bd_badge(
        '<rect x="64" y="13" width="17" height="12" rx="2"/><path d="M 66 18 l 3 3 -3 3 M 73 19 h 5"/>')),
    "manifest": icon("manifest", "显化日记", badge=bd_badge(
        '<path d="M 72 10 l 1.4 3.6 3.8 0.6 -2.7 2.6 0.7 3.8 -3.2 -1.9 -3.2 1.9 0.7 -3.8 -2.7 -2.6 3.8 -0.6z"/>')),
}

# 品牌图标：线条小狗 + 金币（马卡龙粉底）
def brand_icon():
    base, deep = MAC["pink"]
    dog = dog_head(cx=40, cy=52, s=0.95)
    coin = ('<g filter="url(#dogShadow)"><circle cx="70" cy="26" r="15" fill="#FFF3B0" stroke="#E8B93A" stroke-width="3"/>'
            '<circle cx="70" cy="26" r="9.5" fill="none" stroke="#E8B93A" stroke-width="2"/>'
            '<path d="M 66 21 h 8 M 70 21 v 10" stroke="#E8B93A" stroke-width="2.4" stroke-linecap="round"/></g>')
    return f'<svg class="brand-ic" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg" aria-label="品牌">{sticker("pink")}{dog}{coin}</svg>'

# 应用图标（iOS 圆角方形 + 马卡龙粉渐变底 + 小狗 + 金币）
def app_icon():
    dog = dog_head(cx=128, cy=138, s=1.15)
    coin = ('<g filter="url(#aShadow)"><circle cx="192" cy="78" r="34" fill="#FFF3B0" stroke="#E8B93A" stroke-width="6"/>'
            '<circle cx="192" cy="78" r="21" fill="none" stroke="#E8B93A" stroke-width="4"/>'
            '<path d="M 182 66 h 20 M 192 66 v 24" stroke="#E8B93A" stroke-width="5" stroke-linecap="round"/></g>')
    return (f'<svg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg" aria-label="应用图标">'
            f'<defs><filter id="aShadow" x="-30%" y="-30%" width="160%" height="160%">'
            f'<feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#5C4444" flood-opacity="0.25"/></filter>'
            f'<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">'
            f'<stop offset="0" stop-color="#FFD9E4"/><stop offset="1" stop-color="#FFCADA"/></linearGradient></defs>'
            f'<rect x="8" y="8" width="240" height="240" rx="56" fill="url(#bg)"/>'
            f'<rect x="8" y="8" width="240" height="240" rx="56" fill="none" stroke="#FFFFFF" stroke-width="6"/>'
            f'<circle cx="128" cy="128" r="88" fill="#FFFFFF" stroke="#F48FB1" stroke-width="5"/>'
            f'{dog}{coin}</svg>')

def write_file(path, content):
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("wrote", path, len(content), "chars")

base = os.path.dirname(os.path.abspath(__file__))
outdir = os.path.join(base, "..", "assets")
outdir = os.path.normpath(outdir)

# 1) 写一个 JS 常量文件（app.js 可引用），包含所有图标 SVG
lines = ["/* 线条小狗贴纸图标集（自动生成，勿手改）马卡龙粉彩版 */",
         "const DOG_ICONS = {"]
for k, v in ICONS.items():
    esc = v.replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${")
    lines.append(f'  "{k}": `{esc}`,')
lines.append("  _brand: `" + brand_icon().replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${") + "`,")
lines.append("};")
lines.append("if (typeof window !== 'undefined') window.DOG_ICONS = DOG_ICONS;")
write_file(os.path.join(outdir, "dog_icons.js"), "\n".join(lines) + "\n")

# 2) 写各图标 SVG 文件（用于预览 / 应用图标）
for k, v in ICONS.items():
    write_file(os.path.join(outdir, f"dog_{k}.svg"), v)
write_file(os.path.join(outdir, "dog_brand.svg"), brand_icon())
write_file(os.path.join(outdir, "app-icon.svg"), app_icon())
print("done")
