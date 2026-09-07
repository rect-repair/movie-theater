# ？？影剧院 ARG landing site

## Seat list: `data/seats.json`

Taken seats live in `data/seats.json` and nowhere else. When a booking is approved over WeChat, add its seat id to the `taken` array, commit, push, and the site picks it up on the next page load (GitHub Pages can take a minute or two to publish).

```json
{
  "taken": [
    "3-5",
    "3-6"
  ]
}
```

Seat ids are `row-seat`, so `3-5` is 3排5座. Every page fetches the file fresh on load (cache-busted), so the 剩余 counter and the map stay in step. On submit the booking page refetches it once more and refuses the seat if it has been taken since the map was drawn. If the fetch fails, the map simply shows every seat as free; the WeChat step is still the real check. Opening the site via `file://` blocks the fetch, so test with a local server (`python3 -m http.server`).

Layout, showtime, and the 调查组 reserved seats stay in `data/taken.js`.

The `worker/` folder is an abandoned Cloudflare Worker experiment and is no longer referenced by the site.

## What is git-ignored and why

`.gitignore` keeps out `.DS_Store`, the planning doc `text.md`, the review source `reviews_raw.md` (real film titles), the reference screenshot `image.png`, and this README. Together those explain every trick on the site, so they stay local even if the repo is public. Everything the browser downloads (HTML, CSS, JS, `data/taken.js`) has been scrubbed of real titles and of comments that describe the mechanics, because view-source is fair game for ARG players. Keep it that way when you edit: no explanatory comments in shipped files, notes go here.

## How the booking works without a server

Everything runs in the visitor's browser. On submit, the booking is saved to that phone's `localStorage` and the receipt page (回执) tells them to screenshot it and send it to the WeChat admin. Revisiting `booking.html` on the same device shows the receipt again; the footer of the 已有记录 banner has 清除本机记录 for testing.

Receipt numbers look like `JT-0912-RRSS-XXXX` (row, seat, hash). They are not verified anywhere; the screenshot plus WeChat is the real registration.

## Hosting notes for mainland China

- No external fonts or CDNs are used, so nothing gets blocked.
- GitHub Pages is unreliable from the mainland. Cloudflare Pages or Netlify usually work; Tencent COS / Aliyun OSS static hosting is the safest.
- Test inside WeChat's in-app browser before launch.
