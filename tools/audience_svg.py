#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
观众席示意图生成器
用法: python3 tools/audience_svg.py   ->  img/audience.svg

数据来源: README.md 里 "## audience masks" 段。每行一排（从最后一排到第一排，即从银幕看过去的视角），
每个字符一个面具；x 表示空座（没人来，顺序跳过这个座位）；� 画成黑菱形问号（Shift_JIS 解不出的字节）。
座位靠右墙对齐，左边是楼梯；最后一排第一个面具（雍）不在座位上，夹在座位外的立架上。

人物画得很省：无头无手，只有面具。每个座位的衣服颜色按照片记在 DETAILS 里，键是票面座位号 (排, 座)：
从银幕看过去 1 座在最右（靠墙），往左递增；x 空座也占号。没记的默认黑衣。
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

# ---------- 衣服颜色 ----------
BLACK = "#1d1b1f"
WHITE = "#e6e3dd"
CREAM = "#ede4d2"       # 米白（偏白）
BEIGE = "#dcc6a6"       # 米黄
LIGHT_GREY = "#c6c3bd"  # 灰白
GREY = "#8a8a8a"
LIME = "#a8e04a"        # 工作人员的荧光绿 T 恤
ARMY = "#5c6b3c"        # 军绿
PALE_GREEN = "#a9c7b2"  # 很浅的墨绿
YELLOW = "#e6c94e"
MUSTARD = "#d9a83a"     # 深一点的黄
BLUE = "#4a76c9"
NAVY = "#1e2a5e"        # 深蓝
BLUE_BLACK = "#1c2140"  # 蓝黑
BROWN = "#6b4a2e"
TAN = "#b8894a"         # 棕黄
PURPLE = "#7a4a9e"
ORANGE = "#e2782a"
ORANGE_RED = "#d9502a"
RED = "#c8202a"
PINK = "#e8a0b8"

# 按照片核对过的座位：(排, 座) -> 细节。座位号按票面，从银幕看 1 座在最右。
#   cloth    衣服底色（默认黑）        cap      鸭舌帽颜色        hair     头发颜色
#   panel    中间一道别的颜色（开衫露出里面的衣服）
#   plaid    格子（线条颜色）          hstripes 横条纹（线条颜色）  stripes  运动外套袖侧白条
#   balloon  手里牵一只白气球          branch   手里举一根 Y 形树枝
DETAILS = {
    # 一排（13 座；1、2、7 空）
    (1, 4): {"cloth": LIME},                                        # ｺ：荧光绿 T 恤（工作人员）
    (1, 5): {"cloth": MUSTARD, "hair": "#e8c56a"},                  # �：深一点的黄上衣、金发
    (1, 6): {"cloth": GREY, "plaid": "#585858", "panel": BLUE},     # 逧：灰色格子衬衫，里面蓝底
    (1, 8): {"cloth": BEIGE},                                       # 閨：米黄色
    (1, 9): {"cloth": BLACK},
    (1, 10): {"cloth": BLACK},
    (1, 11): {"cloth": BLACK},
    (1, 12): {"cloth": BLACK},
    (1, 13): {"cloth": WHITE},                                      # 蜈：白色
    # 二排（13 座；1、2 空）
    (2, 3): {"cloth": WHITE},
    (2, 4): {"cloth": WHITE, "hstripes": GREY, "cap": "#8a6a3a"},   # ｼ：灰白横条纹、棕色鸭舌帽
    (2, 5): {"cloth": WHITE, "hair": "#e07a2a"},                    # ｲ：白衣、橘色头发
    (2, 6): {"cloth": WHITE, "cap": BLACK},                         # ∬：白衣、黑色鸭舌帽
    (2, 7): {"cloth": BLUE},                                        # 縲
    (2, 8): {"cloth": WHITE},
    (2, 9): {"cloth": BLUE_BLACK},
    (2, 10): {"cloth": WHITE},
    (2, 11): {"cloth": BROWN},
    (2, 12): {"cloth": BLACK},
    (2, 13): {"cloth": BLACK},
    # 三排（10 座；6 空）
    (3, 1): {"cloth": BLUE},
    (3, 2): {"cloth": WHITE},
    (3, 3): {"cloth": WHITE, "cap": GREY},                          # 逶：灰色鸭舌帽
    (3, 4): {"cloth": WHITE},
    (3, 5): {"cloth": WHITE},
    (3, 7): {"cloth": NAVY, "stripes": True},                       # 逋：深蓝运动外套、白条
    (3, 8): {"cloth": LIGHT_GREY},                                  # 怎
    (3, 9): {"cloth": WHITE},                                       # 肴
    (3, 10): {"branch": True},                                      # ｻ：举着一根树枝
    # 四排（10 座）
    (4, 1): {"cloth": BLACK},
    (4, 2): {"cloth": GREY},
    (4, 3): {"cloth": BEIGE},
    (4, 4): {"cloth": BLACK},
    (4, 5): {"cloth": WHITE},
    (4, 6): {"cloth": WHITE},
    (4, 7): {"cloth": BLUE, "plaid": WHITE},                        # 蓝白格子衫
    (4, 8): {"cloth": BLUE},
    (4, 9): {"cloth": ORANGE_RED},                                  # 菴
    (4, 10): {"cloth": BLACK},
    # 五排（10 座）
    (5, 1): {"cloth": LIME},                                        # 隧：工作人员
    (5, 2): {"cloth": TAN, "panel": WHITE},                         # 棕黄色加白色
    (5, 3): {"cloth": LIME},                                        # 邂：工作人员
    (5, 4): {"cloth": WHITE},
    (5, 5): {"cloth": LIME},                                        # ょ：工作人员
    (5, 6): {"cloth": GREY},
    (5, 7): {"cloth": ORANGE},
    (5, 8): {"cloth": BLACK},
    (5, 9): {"cloth": WHITE},
    (5, 10): {"cloth": BLACK},
    # 六排（10 座）
    (6, 1): {"cloth": BLACK},
    (6, 2): {"cloth": GREY},
    (6, 3): {"cloth": PALE_GREEN},                                  # 很浅的墨绿
    (6, 4): {"cloth": BLACK},
    (6, 5): {"cloth": PURPLE},
    (6, 6): {"cloth": LIGHT_GREY},
    (6, 7): {"cloth": WHITE},
    (6, 8): {"cloth": WHITE, "hstripes": BLACK},                    # 黑白相间
    (6, 9): {"cloth": WHITE},
    (6, 10): {"cloth": WHITE},
    # 七排（10 座）
    (7, 1): {"cloth": BLACK},
    (7, 2): {"cloth": WHITE},
    (7, 3): {"cloth": BLUE_BLACK},
    (7, 4): {"cloth": BLUE_BLACK},
    (7, 5): {"cloth": YELLOW},
    (7, 6): {"cloth": LIME},                                        # 蜿：工作人员
    (7, 7): {"cloth": WHITE},
    (7, 8): {"cloth": WHITE},
    (7, 9): {"cloth": ARMY},
    (7, 10): {"cloth": BEIGE},
    # 八排（10 座）
    (8, 1): {"cloth": WHITE},
    (8, 2): {"cloth": BLUE},
    (8, 3): {"cloth": BLACK},
    (8, 4): {"cloth": ARMY},
    (8, 5): {"cloth": GREY},
    (8, 6): {"cloth": BLACK, "cap": BLACK},                         # 蟷：黑色鸭舌帽
    (8, 7): {"cloth": NAVY},
    (8, 8): {"cloth": BLACK},
    (8, 9): {"cloth": BLACK},
    (8, 10): {"cloth": BLACK},
    # 九排（13 座）
    (9, 1): {"cloth": WHITE},
    (9, 2): {"cloth": BLACK},
    (9, 3): {"cloth": WHITE},
    (9, 4): {"cloth": WHITE},
    (9, 5): {"cloth": WHITE, "panel": BLUE_BLACK},                  # 白加蓝黑
    (9, 6): {"cloth": BLACK},
    (9, 7): {"cloth": WHITE},
    (9, 8): {"cloth": WHITE},
    (9, 9): {"cloth": ARMY},
    (9, 10): {"cloth": LIME},                                       # 險：工作人员
    (9, 11): {"cloth": BLACK},
    (9, 12): {"cloth": BLACK},
    (9, 13): {"cloth": WHITE},
    # 十排（13 座）
    (10, 1): {"cloth": BLACK},
    (10, 2): {"cloth": BLACK},
    (10, 3): {"cloth": BLACK},
    (10, 4): {"cloth": WHITE, "cap": RED},                          # 雎：红色鸭舌帽
    (10, 5): {"cloth": BLACK},
    (10, 6): {"cloth": WHITE},
    (10, 7): {"cloth": BLACK},
    (10, 8): {"cloth": WHITE},
    (10, 9): {"cloth": WHITE},
    (10, 10): {"cloth": BLACK},
    (10, 11): {"cloth": ARMY},
    (10, 12): {"cloth": BEIGE},
    (10, 13): {"cloth": PINK},
    # 十一排（13 座）
    (11, 1): {"cloth": BLACK},
    (11, 2): {"cloth": LIME},
    (11, 3): {"cloth": RED},
    (11, 4): {"cloth": BLACK, "panel": WHITE},                      # 黑色，中间白
    (11, 5): {"cloth": BLACK},
    (11, 6): {"cloth": WHITE},
    (11, 7): {"cloth": WHITE},
    (11, 8): {"cloth": BLACK},
    (11, 9): {"cloth": BLACK},
    (11, 10): {"cloth": CREAM},
    (11, 11): {"cloth": CREAM},
    (11, 12): {"cloth": GREY},
    (11, 13): {"cloth": BLACK},
    # 十二排（14 座 + 立架上 1 个；14 座没记录，默认黑）
    (12, 1): {"cloth": BLACK},
    (12, 2): {"cloth": BLACK},
    (12, 3): {"cloth": BLACK},
    (12, 4): {"cloth": BLACK},
    (12, 5): {"cloth": BLACK},
    (12, 6): {"cloth": CREAM},
    (12, 7): {"cloth": BLACK},
    (12, 8): {"cloth": WHITE},
    (12, 9): {"cloth": GREY},
    (12, 10): {"cloth": CREAM},
    (12, 11): {"cloth": BLACK},
    (12, 12): {"cloth": BLACK},
    (12, 13): {"cloth": BLACK},
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

    def line(x1, y1, x2, y2, color, w, extra=""):
        return ('<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="%s" stroke-width="%s"%s/>'
                % (fmt(x1), fmt(y1), fmt(x2), fmt(y2), color, fmt(w), extra))

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
            seat_no = len(seated) - k          # 票面座位号：从银幕看 1 座在最右
            d = DETAILS.get((row_from_front, seat_no), {})
            cloth = d.get("cloth", BLACK)
            dx = rnd.uniform(-0.03, 0.03) * p
            dy = rnd.uniform(-0.04, 0.03) * p
            tilt = rnd.uniform(-7, 7)
            mcx, mcy = cx + dx, base - 0.68 * p + dy
            # 身体：圆角矩形
            bx, by, bw, bh = cx - 0.48 * p, base - 0.54 * p, 0.96 * p, 0.72 * p
            body = 'x="%s" y="%s" width="%s" height="%s" rx="%s"' % (fmt(bx), fmt(by), fmt(bw), fmt(bh), fmt(0.22 * p))
            g = []
            if d.get("balloon"):
                # 白气球飘在头顶左上，一根细线牵进手里（线尾被身体盖住）
                bcx, bcy, br = cx - 0.36 * p, mcy - 0.66 * p, 0.17 * p
                g.append(line(bcx, bcy + br * 1.1, cx - 0.30 * p, base - 0.20 * p, MASK_EDGE, max(0.6, 0.012 * p)))
                g.append('<ellipse cx="%s" cy="%s" rx="%s" ry="%s" fill="#f4f2ee"/>'
                         % (fmt(bcx), fmt(bcy), fmt(br), fmt(br * 1.1)))
                g.append('<polygon points="%s,%s %s,%s %s,%s" fill="#f4f2ee"/>'
                         % (fmt(bcx - 0.03 * p), fmt(bcy + br * 1.1 + 0.03 * p), fmt(bcx + 0.03 * p),
                            fmt(bcy + br * 1.1 + 0.03 * p), fmt(bcx), fmt(bcy + br * 1.1 - 0.01 * p)))
            g.append('<rect %s fill="%s"/>' % (body, cloth))
            if d.get("plaid") or d.get("hstripes"):
                cid = "c%d_%d" % (row_from_front, seat_no)
                g.append('<clipPath id="%s"><rect %s/></clipPath>' % (cid, body))
                g.append('<g clip-path="url(#%s)">' % cid)
                if d.get("plaid"):
                    c, w = d["plaid"], 0.035 * p
                    for off in (-0.30, -0.10, 0.10, 0.30):
                        g.append(line(cx + off * p, by, cx + off * p, by + bh, c, w, ' opacity=".8"'))
                    for off in (0.12, 0.30, 0.48, 0.66):
                        g.append(line(bx, by + off * p, bx + bw, by + off * p, c, w, ' opacity=".8"'))
                if d.get("hstripes"):
                    c, w = d["hstripes"], 0.055 * p
                    for n in range(6):
                        yy = by + (0.09 + 0.13 * n) * p
                        g.append(line(bx, yy, bx + bw, yy, c, w))
                g.append("</g>")
            if d.get("panel"):   # 开衫中间露出里面的衣服
                g.append('<rect x="%s" y="%s" width="%s" height="%s" rx="%s" fill="%s"/>'
                         % (fmt(cx - 0.15 * p), fmt(by + 0.05 * p), fmt(0.30 * p), fmt(bh), fmt(0.06 * p), d["panel"]))
            if d.get("stripes"):
                for sx in (-1, 1):
                    for off in (0.27, 0.32):
                        g.append(line(cx + sx * off * p, base - 0.51 * p, cx + sx * (off + 0.07) * p, base - 0.02 * p,
                                      "#f4f2ee", 0.018 * p))
            if d.get("branch"):
                # 树枝：一根 Y 形光枝，从身侧斜举过头顶，没有叶子
                wood = "#6b4a2e"
                x0, y0 = cx - 0.24 * p, base - 0.02 * p          # 手里
                fx, fy = cx - 0.50 * p, base - 0.68 * p          # 分叉点
                g.append(line(x0, y0, fx, fy, wood, 0.038 * p, ' stroke-linecap="round"'))
                g.append(line(fx, fy, cx - 0.74 * p, base - 1.06 * p, wood, 0.028 * p, ' stroke-linecap="round"'))
                g.append(line(fx, fy, cx - 0.38 * p, base - 1.02 * p, wood, 0.028 * p, ' stroke-linecap="round"'))
            if d.get("hair"):
                g.append('<ellipse cx="%s" cy="%s" rx="%s" ry="%s" fill="%s"/>'
                         % (fmt(mcx), fmt(mcy - 0.02 * p), fmt(0.36 * p), fmt(0.39 * p), d["hair"]))
            g.append(mask(ch, mcx, mcy, p, tilt))
            if d.get("cap"):   # 鸭舌帽：帽冠 + 帽檐
                g.append('<path d="M %s %s A %s %s 0 0 1 %s %s Z" fill="%s"/>'
                         % (fmt(mcx - 0.30 * p), fmt(mcy - 0.22 * p), fmt(0.30 * p), fmt(0.22 * p), fmt(mcx + 0.30 * p), fmt(mcy - 0.22 * p), d["cap"]))
                g.append('<rect x="%s" y="%s" width="%s" height="%s" rx="%s" fill="%s"/>'
                         % (fmt(mcx - 0.37 * p), fmt(mcy - 0.26 * p), fmt(0.74 * p), fmt(0.07 * p), fmt(0.035 * p), d["cap"]))
            people.append('<g class="p" data-seat="%d-%d">%s</g>' % (row_from_front, seat_no, "".join(g)))
        body_layers.append('<g class="row" data-row="%d">%s%s</g>' % (row_from_front, "".join(seats), "".join(people)))

        # 座位外的面具：立架
        for j, ch in enumerate(row):
            if STICKS.get((row_from_front, j + 1)) == "stand":
                sx, sy = left - 0.95 * p, base - 0.60 * p
                sticks.append(line(sx, sy, sx, base + 0.9 * p, "#111", 0.04 * p))
                sticks.append(line(sx - 0.25 * p, base + 0.9 * p, sx + 0.25 * p, base + 0.9 * p, "#111", 0.04 * p))
                sticks.append(mask(ch, sx, sy, p, -4))

    # 没画到的座位号（拼错排数/座号时提醒一下）
    drawn = set()
    for i, row in enumerate(rows):
        n = seated_n[i]
        for k in range(n):
            drawn.add((n_rows - i, n - k))
    unused = sorted(set(DETAILS) - drawn)
    if unused:
        print("注意：DETAILS 里这些座位号不存在，被忽略了:", ", ".join("%d-%d" % s for s in unused))

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
