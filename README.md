# ？？影剧院 ARG landing site

## Optional: automatic seat blocking with a Cloudflare Worker

The site never depends on this. With `REMOTE` empty in `data/taken.js`, everything is local. With it set, the site fetches the live taken list on load and posts the seat after a successful questionnaire. If the request can't get out (no VPN, timeout), the visitor sees nothing different: the receipt appears as usual after at most 5 seconds and you reconcile from the WeChat screenshot. If the worker answers that the seat was just taken by someone else, the form shows a 提交失败 message and the map refreshes.

Setup, about 10 minutes, from the `worker/` folder:
```
npx wrangler login
npx wrangler kv namespace create SEATS      # paste the id into wrangler.toml
npx wrangler secret put ADMIN_KEY           # any passphrase you'll remember
npx wrangler deploy                         # prints https://jt-seats.<account>.workers.dev
```
Then put that URL in `REMOTE` in `data/taken.js` and redeploy the site. The same can be done in the Cloudflare dashboard: create a Worker, paste `worker/worker.js`, bind a KV namespace named `SEATS`, add a secret `ADMIN_KEY`.

Admin endpoints:
- `GET  <url>/admin?key=ADMIN_KEY` lists taken seats with receipt numbers and times.
- `POST <url>/admin?key=ADMIN_KEY` with body `{"remove":"3-5"}` frees a seat.

The worker stores only seat id, receipt number, and time, never names or answers. KV is eventually consistent, so two people submitting the same seat within the same second could both get through; the WeChat step catches that. `workers.dev` is often unreachable from the mainland; a custom domain routed through Cloudflare fares better, but plan for the manual path regardless.

## What is git-ignored and why

`.gitignore` keeps out `.DS_Store`, the planning doc `text.md`, the review source `reviews_raw.md` (real film titles), the reference screenshot `image.png`, and this README. Together those explain every trick on the site, so they stay local even if the repo is public. Everything the browser downloads (HTML, CSS, JS, `data/taken.js`) has been scrubbed of real titles and of comments that describe the mechanics, because view-source is fair game for ARG players. Keep it that way when you edit: no explanatory comments in shipped files, notes go here.

## How the booking works without a server

Everything runs in the visitor's browser. On submit, the booking is saved to that phone's `localStorage` and the receipt page (回执) tells them to screenshot it and send it to the WeChat admin. Revisiting `booking.html` on the same device shows the receipt again; the footer of the 已有记录 banner has 清除本机记录 for testing.

Receipt numbers look like `JT-0912-RRSS-XXXX` (row, seat, hash). They are not verified anywhere; the screenshot plus WeChat is the real registration.

## Hosting notes for mainland China

- No external fonts or CDNs are used, so nothing gets blocked.
- GitHub Pages is unreliable from the mainland. Cloudflare Pages or Netlify usually work; Tencent COS / Aliyun OSS static hosting is the safest.
- Test inside WeChat's in-app browser before launch.
