#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
观众席示意图生成器
用法: python3 tools/audience_svg.py   ->  img/audience.svg

数据来源: README.md 里 "## audience masks" 段。每行一排（从最后一排到第一排，即从银幕看过去的视角），
每个字符一个面具；x 表示空座（没人来，顺序跳过这个座位）；� 画成黑菱形问号（Shift_JIS 解不出的字节）。
座位靠右墙对齐，左边是楼梯；最后一排第一个面具（雍）不在座位上，夹在座位外的立架上。

人物画得很省：黑衣、无头无手，只有面具。少数几位按照片加了细节（红 polo、鸭舌帽……），见 DETAILS。
字形从 思源宋体 Heavy（Source Han Serif SC Heavy, OFL）转成路径写进 SVG，访客不需要装字体。
"""
import os, sys, glob, random
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
README = os.path.join(ROOT, "README.md")
OUT = os.path.join(ROOT, "img", "audience.svg")

FONT_NAMES = ["SourceHanSerifSC-Heavy.otf", "SourceHanSerifSC-Bold.otf", "NotoSerifCJKsc-Black.otf",
              "NotoSerifSC-Black.otf", "NotoSerifCJKsc-Bold.otf", "SourceHanSerif-Heavy.ttc"]
FONT_DIRS = [os.path.expanduser("~/Library/Fonts"), "/Library/Fonts", "/System/Library/Fonts/Supplemental",
             "/usr/share/fonts", "/usr/local/share/fonts", os.path.join(ROOT, "tools")]

# ---------- 画面参数 ----------
W = 1400
NOMINAL_COLS = 13.3   # 第一排 13 座几乎铺满画面宽度；每排座位宽度再乘以透视缩放
ROW_STEP = 0.80       # 排间距 = 该排座位宽度 × 这个系数（面具高 0.7，留一点缝）
CEILING = 90
RIGHT_MARGIN = 24     # 第一排右边缘留白；越靠后的排右边缘越往里收（透视）
CONVERGE = 220

SEAT = "#6a4a78"
SEAT_EDGE = "#4d3458"
CUSHION = "#7f5f8f"
STEP = "#7d5f8c"
MASK = "#f7f5ef"
MASK_EDGE = "#d8d3ca"
INK = "#111111"
BLACK = "#1d1b1f"
LIME = "#a8e04a"      # 工作人员的荧光绿 T 恤

# 按照片核对过的几位：(从前数第几排, 从左数第几座) -> 细节
DETAILS = {
    (1, 1): {"plush": True},                 # 蜈：抱着一只白色玩偶
    (1, 6): {"cloth": "#dcc6a6"},            # 閨：米色风衣
    (1, 8): {"cloth": "#4a76c9"},            # 逧：蓝色背心
    (1, 9): {"cloth": "#d9a83a", "hair": "#e8c56a"},   # �：芥末黄上衣、金发
    (1, 10): {"cloth": LIME},                # ｺ：荧光绿 T 恤（工作人员）
    (2, 7): {"cloth": "#3e3fae"},            # 縲：蓝紫色印字 T 恤
    (2, 8): {"cap": BLACK},                  # ∬：黑色鸭舌帽
    (2, 9): {"hair": "#e07a2a"},             # ｲ：橘色头发
    (2, 10): {"cap": "#8a6a3a"},             # ｼ：棕色鸭舌帽
    (3, 2): {"cloth": "#e8dcc4"},            # 肴：米白外套
    (3, 8): {"cap": "#8a8a8a"},              # 逶：灰色鸭舌帽
    (3, 3): {"cloth": "#8a8a8a"},            # 怎：灰色 polo
    (3, 4): {"cloth": "#1e2a5e", "stripes": True},     # 逋：藏青运动外套、白条
    (4, 2): {"cloth": "#c8202a"},            # 菴：红色 polo
    (5, 6): {"cloth": LIME},                 # ょ：工作人员
    (5, 8): {"cloth": LIME},                 # 邂：工作人员
    (5, 10): {"cloth": LIME},                # 隧：工作人员
    (7, 5): {"cloth": LIME},                 # 蜿：工作人员
    (8, 5): {"cap": BLACK},                  # 蟷：黑色鸭舌帽
    (9, 4): {"cloth": LIME},                 # 險：工作人员
    (10, 10): {"cap": "#c8202a"},            # 雎：红色鸭舌帽
}
# 不在座位上的面具：(从前数第几排, 从左数第几个) -> 立架
STICKS = {(12, 1): "stand"}


def find_font():
    for d in FONT_DIRS:
        for n in FONT_NAMES:
            for p in glob.glob(os.path.join(d, "**", n), recursive=True):
                return p
    sys.exit("找不到 思源宋体 Heavy，请把 SourceHanSerifSC-Heavy.otf 放进 tools/ 或 ~/Library/Fonts")


def read_rows():
    s = open(README, encoding="utf-8").read()
    i = s.index("## audience masks")
    body = s[i:].split("\n")[1:]
    rows = []
    for line in body:
        if line.startswith("## "):
            break
        t = line.strip()
        if not t or " " in t or "`" in t:   # 说明文字（带空格或反引号）不是座位行
            continue
        rows.append(t)
    return rows


def scale(i, n):
    """透视：最后一排 0.7，第一排 1.0"""
    return 0.70 + 0.30 * i / max(1, n - 1)


def fmt(v):
    return ("%.1f" % v).rstrip("0").rstrip(".")


def main():
    rows = read_rows()
    n_rows = len(rows)
    font = TTFont(find_font())
    cmap = font.getBestCmap()
    gset = font.getGlyphSet()
    hmtx = font["hmtx"]
    upm = font["head"].unitsPerEm
    asc = font["OS/2"].sTypoAscender / upm
    desc = -font["OS/2"].sTypoDescender / upm
    defs = {}

    def glyph_def(ch):
        code = ord(ch)
        gid = "g%x" % code
        if gid not in defs:
            name = cmap.get(code)
            if name is None:
                return None, 0
            pen = SVGPathPen(gset, ntos=lambda v: str(int(round(v))))
            gset[name].draw(pen)
            defs[gid] = (pen.getCommands(), hmtx[name][0])
        return gid, defs[gid][1]

    def glyph_use(ch, cx, cy, fs, fill=INK):
        gid, adv = glyph_def(ch)
        if gid is None:
            return ""
        w = adv / upm * fs
        x0 = cx - w / 2
        baseline = cy + (asc - desc) / 2 * fs
        k = "%.4f" % (fs / upm)
        return ('<use href="#%s" xlink:href="#%s" transform="translate(%s %s) scale(%s -%s)"%s/>'
                % (gid, gid, fmt(x0), fmt(baseline), k, k, '' if fill == INK else ' fill="%s"' % fill))

    def mask(ch, mcx, mcy, p, tilt):
        """白色椭圆面具 + 字（或菱形问号）"""
        g = ['<g transform="rotate(%s %s %s)">' % (fmt(tilt), fmt(mcx), fmt(mcy))]
        g.append('<ellipse cx="%s" cy="%s" rx="%s" ry="%s" fill="%s" stroke="%s" stroke-width="%s"/>'
                 % (fmt(mcx), fmt(mcy), fmt(0.31 * p), fmt(0.35 * p), MASK, MASK_EDGE, fmt(max(0.5, 0.012 * p))))
        if ch == "�":
            r = 0.19 * p
            g.append('<polygon points="%s,%s %s,%s %s,%s %s,%s" fill="%s"/>'
                     % (fmt(mcx), fmt(mcy - r), fmt(mcx + r), fmt(mcy), fmt(mcx), fmt(mcy + r), fmt(mcx - r), fmt(mcy), INK))
            g.append(glyph_use("?", mcx, mcy, 0.24 * p, fill="#ffffff"))
        else:
            g.append(glyph_use(ch, mcx, mcy, 0.47 * p))
        g.append("</g>")
        return "".join(g)

    # 布局：右边缘、每排座位宽度、基线（身体底部）；第一排身体被画面下边裁掉一截，像照片那样
    rights = [W - RIGHT_MARGIN - (1 - scale(i, n_rows)) * CONVERGE for i in range(n_rows)]
    # 座位宽度基准：第一排 13 座铺满；哪一排的座位数多到会画出左边界，就整体缩小一点
    seated_n = [sum(1 for j in range(len(r)) if (n_rows - i, j + 1) not in STICKS) for i, r in enumerate(rows)]
    cols = max(NOMINAL_COLS, max(seated_n[i] * scale(i, n_rows) * W / rights[i] for i in range(n_rows)) * 1.02)
    pitches = [W / cols * scale(i, n_rows) for i in range(n_rows)]
    bases = []
    y = float(CEILING)
    for i in range(n_rows):
        y += ROW_STEP * pitches[i]
        bases.append(y)
    H = int(bases[-1] + 0.22 * pitches[-1])

    body_layers, lefts, sticks = [], [], []
    for i, row in enumerate(rows):
        p = pitches[i]
        base = bases[i]
        row_from_front = n_rows - i
        seated = [(j, ch) for j, ch in enumerate(row) if (row_from_front, j + 1) not in STICKS]
        left = rights[i] - len(seated) * p
        lefts.append(left)
        seats, people = [], []
        for k, (j, ch) in enumerate(seated):
            cx = left + (k + 0.5) * p
            rnd = random.Random(i * 1000 + j)
            seats.append('<rect x="%s" y="%s" width="%s" height="%s" rx="%s" fill="%s" stroke="%s" stroke-width="%s"/>'
                         % (fmt(cx - 0.46 * p), fmt(base - 0.70 * p), fmt(0.92 * p), fmt(0.86 * p), fmt(0.12 * p),
                            SEAT, SEAT_EDGE, fmt(max(0.6, 0.014 * p))))
            if ch == "x":
                # 空座：坐垫 + 椅背上贴的座位号纸条
                seats.append('<rect x="%s" y="%s" width="%s" height="%s" rx="%s" fill="%s"/>'
                             % (fmt(cx - 0.38 * p), fmt(base - 0.12 * p), fmt(0.76 * p), fmt(0.26 * p), fmt(0.05 * p), CUSHION))
                seats.append('<rect x="%s" y="%s" width="%s" height="%s" fill="#f2efe8"/>'
                             % (fmt(cx - 0.11 * p), fmt(base - 0.46 * p), fmt(0.22 * p), fmt(0.13 * p)))
                continue
            d = DETAILS.get((row_from_front, k + 1), {})
            cloth = d.get("cloth", BLACK)
            dx = rnd.uniform(-0.03, 0.03) * p
            dy = rnd.uniform(-0.04, 0.03) * p
            tilt = rnd.uniform(-7, 7)
            mcx, mcy = cx + dx, base - 0.68 * p + dy
            g = []
            if d.get("plush"):
                g.append('<ellipse cx="%s" cy="%s" rx="%s" ry="%s" fill="#f4f2ee"/>'
                         % (fmt(cx - 0.36 * p), fmt(base - 0.22 * p), fmt(0.22 * p), fmt(0.28 * p)))
            g.append('<rect x="%s" y="%s" width="%s" height="%s" rx="%s" fill="%s"/>'
                     % (fmt(cx - 0.48 * p), fmt(base - 0.54 * p), fmt(0.96 * p), fmt(0.72 * p), fmt(0.22 * p), cloth))
            if d.get("stripes"):
                for sx in (-1, 1):
                    for off in (0.27, 0.32):
                        g.append('<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="#f4f2ee" stroke-width="%s"/>'
                                 % (fmt(cx + sx * off * p), fmt(base - 0.51 * p), fmt(cx + sx * (off + 0.07) * p), fmt(base - 0.02 * p), fmt(0.018 * p)))
            if d.get("hair"):
                g.append('<ellipse cx="%s" cy="%s" rx="%s" ry="%s" fill="%s"/>'
                         % (fmt(mcx), fmt(mcy - 0.02 * p), fmt(0.36 * p), fmt(0.39 * p), d["hair"]))
            g.append(mask(ch, mcx, mcy, p, tilt))
            if d.get("cap"):   # 鸭舌帽：帽冠 + 帽檐
                g.append('<path d="M %s %s A %s %s 0 0 1 %s %s Z" fill="%s"/>'
                         % (fmt(mcx - 0.30 * p), fmt(mcy - 0.22 * p), fmt(0.30 * p), fmt(0.22 * p), fmt(mcx + 0.30 * p), fmt(mcy - 0.22 * p), d["cap"]))
                g.append('<rect x="%s" y="%s" width="%s" height="%s" rx="%s" fill="%s"/>'
                         % (fmt(mcx - 0.37 * p), fmt(mcy - 0.26 * p), fmt(0.74 * p), fmt(0.07 * p), fmt(0.035 * p), d["cap"]))
            people.append("".join(g))
        body_layers.append('<g class="row" data-row="%d">%s%s</g>' % (row_from_front, "".join(seats), "".join(people)))

        # 座位外的面具：立架
        for j, ch in enumerate(row):
            if STICKS.get((row_from_front, j + 1)) == "stand":
                sx, sy = left - 0.95 * p, base - 0.60 * p
                sticks.append('<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="#111" stroke-width="%s"/>'
                              % (fmt(sx), fmt(sy), fmt(sx), fmt(base + 0.9 * p), fmt(0.04 * p)))
                sticks.append('<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="#111" stroke-width="%s"/>'
                              % (fmt(sx - 0.25 * p), fmt(base + 0.9 * p), fmt(sx + 0.25 * p), fmt(base + 0.9 * p), fmt(0.04 * p)))
                sticks.append(mask(ch, sx, sy, p, -4))

    out = ['<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
           'viewBox="0 0 %d %d" width="%d" height="%d">' % (W, H, W, H),
           "<title>二楼放映厅 观众席 2026-09-12</title>",
           "<desc>" + "\n".join(rows) + "</desc>",
           "<defs>",
           '<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">'
           '<stop offset="0" stop-color="#3a2340"/><stop offset="1" stop-color="#4b2e50"/></linearGradient>',
           '<linearGradient id="ceil" x1="0" y1="0" x2="0" y2="1">'
           '<stop offset="0" stop-color="#1a1020"/><stop offset="1" stop-color="#3a2340"/></linearGradient>',
           ]
    for gid, (d, adv) in defs.items():
        out.append('<path id="%s" d="%s"/>' % (gid, d))
    out.append("</defs>")
    out.append('<rect width="%d" height="%d" fill="url(#bg)"/>' % (W, H))
    # 天花板：一排五盏灯、两只音箱
    out.append('<rect width="%d" height="%d" fill="url(#ceil)"/>' % (W, CEILING))
    for k in range(5):
        out.append('<circle cx="%d" cy="22" r="5" fill="#fff3d6" opacity=".9"/>' % (W // 2 + (k - 2) * 230))
    for x in (W // 2 - 300, W // 2 + 260):
        out.append('<rect x="%d" y="%d" width="40" height="28" rx="2" fill="#15101a"/>' % (x, CEILING - 46))
    # 左侧楼梯：沿着每一排左边缘一级一级往上
    for i in range(2, n_rows - 1):
        p = pitches[i]
        l0, l1 = lefts[i], lefts[i + 1]
        if l0 <= 0:
            continue
        x0 = max(0, l1 - 0.9 * p)
        out.append('<rect x="%s" y="%s" width="%s" height="%s" fill="%s" opacity=".55"/>'
                   % (fmt(x0), fmt(bases[i] - 0.08 * p), fmt(min(l0, l1) - x0), fmt(0.10 * p), STEP))
    out.extend(body_layers)
    out.extend(sticks)
    out.append("</svg>")
    svg = "\n".join(out)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    open(OUT, "w", encoding="utf-8").write(svg)
    print("wrote %s: %d rows, %d seats, %d glyph defs, %.0f KB"
          % (os.path.relpath(OUT, ROOT), n_rows, sum(len(r) for r in rows), len(defs), len(svg.encode()) / 1024))


if __name__ == "__main__":
    main()
