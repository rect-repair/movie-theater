# ARG landing site

## Seat list: `data/seats.json`

Taken seats live in `data/seats.json` and nowhere else. The site is static: every page fetches that file fresh on load (cache-busted), so the 剩余 counter and the map stay in step. On submit the booking page refetches it once more and refuses the seat if it has been taken since the map was drawn. If the fetch fails, the map simply shows every seat as free; the WeChat step is still the real check. Opening the site via `file://` blocks the fetch, so test with a local server (`python3 -m http.server`).

```json
{
  "taken": [
    "3-5",
    "3-6"
  ]
}
```

Seat ids are `row-seat`, so `3-5` is 3排5座. A visitor's own booking (in their `localStorage`) always wins over this list on their device: their seat shows as 您的座位, never 已订, and is not double-counted.

Layout, showtime, and the 调查组 reserved seats stay in `data/taken.js`. `cols` is the default row length and `rowCols` overrides it per row (from the floorplan: rows 4 to 8 have 10 seats, row 12 has 15, 143 in total).

### Editing it: the admin page (`worker/`)

Two ways to record a WeChat approval. By hand: add the seat id to the array, commit, push. Or from a phone: the Cloudflare Worker in `worker/` serves a seat map behind a password page (a plain form plus cookie, so it also works inside WeChat's browser); tap seats to toggle 已订, press 保存, and the worker commits `data/seats.json` to this repo through the GitHub API. Each save is one commit (`seats: +3-5 -4-4`), GitHub Pages republishes within a minute or two. Visitors never touch the worker, so it does not matter that `workers.dev` is unreachable from the mainland; only the admin needs to reach it.

## credits

in-game
- [my50sTV](https://50s.myretrotvs.com/#) by [joey cato](https://www.joeycato.com/)
- [Nokia N93i](https://chaz.fun/phone/n93i/) by [Chaz Zhou](https://chaz.fun/about/)

screening
Ad-vice for a Prophet -- Jon Rafman
All these open windows but no fresh air -- Benjamin Earl
Chef Cooks 'Dream Omelet' That Came To Him In A Dream -- the Onion
安全、平静的夜晚 -- viola he & annika wen
Expert Wasted Entire Life Studying Anteaters -- the Onion
Internet Story -- Adam Butcher

credits
游戏设计: 修四边形 [jo, tianqi, viola, yuemin]
游戏文案: jo, tianqi
游戏道具：yuemin, tianqi, viola
网站制作：viola, jo
现场策划&执行：tianqi, yuemin, viola
统筹：tianqi


## audience masks
`python3 tools/audience_svg.py` 把下面这段画成 `img/audience.svg`（最后一排在最上面；x 空座；� 黑菱形问号），记录页合影下面就是它。

雍ｰ譟定f譟呈弍荳鬆�怎蜃ｺ迴
  ｾ蝨ｨ蜊ｰ蛻ｷ闊�ｷ壻ｸ雁
  ｪ帝ｫ比ｸｭ逧�樟雎｡悟ｮ
  怎蟆手險手ｫ冶剱讒倶ｽ懷刀
     逧ｰ磯摩蟷ｳ蜿ｰ荳企
     幕蟋区署蜿贋ｸ莠帑ｸ
     ｦ荳榊ｭ伜惠逧�剱讒
     倶ｽ懷刀縲ょ�邂｡隧
     ｲ菴懷刀荳ｦ荳榊ｭ伜
     ｻ肴怎逋x迴ｾ逶ｸ髣
  懃噪譁�ｫ�縲∬ｲｼ譁xx   
  蜈夜ｶ莉梨閨x逧�ｺ梧xx