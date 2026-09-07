// 管理小工具：node admin.js list   列出已订座位
//            node admin.js free 3-5   释放一个座位
// 需要 .dev.vars（或环境变量）里的 SEATS_URL 和 ADMIN_KEY
const fs = require("fs");
const path = require("path");

const vars = {};
try {
  for (const line of fs.readFileSync(path.join(__dirname, ".dev.vars"), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?([^"\r]*)"?\s*$/);
    if (m) vars[m[1]] = m[2];
  }
} catch (e) {}

const url = (process.env.SEATS_URL || vars.SEATS_URL || "").replace(/\/+$/, "");
const key = process.env.ADMIN_KEY || vars.ADMIN_KEY || "";
const [cmd, seat] = process.argv.slice(2);

if (!url || !key || !["list", "free"].includes(cmd) || (cmd === "free" && !seat)) {
  console.error("usage: node admin.js list | node admin.js free <排>-<座>  (e.g. free 3-5)");
  console.error("needs SEATS_URL and ADMIN_KEY in worker/.dev.vars or the environment");
  process.exit(1);
}

const beijing = (iso) => new Date(iso).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });

(async () => {
  const opts = cmd === "free" ? { method: "POST", body: JSON.stringify({ remove: seat }) } : {};
  const r = await fetch(url + "/admin?key=" + encodeURIComponent(key), opts);
  const d = await r.json();
  if (!r.ok) { console.error("error:", d.reason || r.status); process.exit(1); }
  if (cmd === "list") {
    const rows = d.bookings || [];
    console.log(rows.length + " taken");
    for (const b of rows) console.log(b.seat.padEnd(6), (b.no || "").padEnd(18), beijing(b.time));
  } else {
    console.log(d.ok ? "freed " + seat + ", now " + d.taken.length + " taken" : JSON.stringify(d));
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
