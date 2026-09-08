/* ============================================================
   Cloudflare Worker：座位管理页
   ------------------------------------------------------------
   GET  /            管理页；未登录时显示口令页
   POST /login       表单 key=ADMIN_KEY → 写 cookie → 跳回 /
   GET  /logout      清 cookie
   GET  /config.js   仓库里的 data/taken.js（座位图布局）
   GET  /api/seats   仓库里的 data/seats.json → { taken, sha }
   PUT  /api/seats   { taken, sha } → 提交到仓库 → { taken, sha }
                     sha 过期时返回 409 { reason: "conflict", taken, sha }

   secrets：ADMIN_KEY、GITHUB_TOKEN；vars 见 wrangler.toml。
   站点本身不访问这个 worker，访客读的仍是仓库里的静态 seats.json。
   ============================================================ */

const SEAT_ID = /^\d{1,2}-\d{1,2}$/;

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}

function sameString(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function sessionToken(env) {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey("raw", enc.encode(env.ADMIN_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, enc.encode("jt-seats-session-v1"));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function authorized(request, env) {
  if (!env.ADMIN_KEY) return false;
  const m = (request.headers.get("Cookie") || "").match(/(?:^|;\s*)jt=([0-9a-f]+)/);
  return !!m && sameString(m[1], await sessionToken(env));
}

function cookie(url, value, maxAge) {
  return "jt=" + value + "; Path=/; HttpOnly; SameSite=Lax; Max-Age=" + maxAge + (url.protocol === "https:" ? "; Secure" : "");
}

function html(body, status = 200, extra = {}) {
  return new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", ...extra } });
}

function byRowCol(a, b) {
  const pa = a.split("-").map(Number), pb = b.split("-").map(Number);
  return pa[0] - pb[0] || pa[1] - pb[1];
}

function normalize(list) {
  const seen = {};
  return (Array.isArray(list) ? list : [])
    .map((s) => String(s).trim())
    .filter((s) => SEAT_ID.test(s) && !seen[s] && (seen[s] = 1))
    .sort(byRowCol);
}

function gh(env, path, init = {}) {
  const api = (env.GITHUB_API || "https://api.github.com").replace(/\/+$/, "");
  let url = `${api}/repos/${env.GITHUB_REPO}/contents/${path}`;
  if (init.method !== "PUT") url += "?ref=" + encodeURIComponent(env.GITHUB_BRANCH || "main");
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "jt-seats",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers || {})
    }
  });
}

async function readSeats(env) {
  const r = await gh(env, env.SEATS_PATH);
  if (!r.ok) throw new Error("GitHub 读取失败 " + r.status + ": " + (await r.text()).slice(0, 200));
  const d = await r.json();
  let taken = [];
  try { taken = JSON.parse(atob(d.content.replace(/\n/g, ""))).taken; } catch (e) {}
  return { taken: normalize(taken), sha: d.sha };
}

async function writeSeats(env, taken, sha) {
  const current = await readSeats(env);
  if (current.sha !== sha) return { status: 409, body: { reason: "conflict", taken: current.taken, sha: current.sha } };

  const added = taken.filter((s) => current.taken.indexOf(s) === -1);
  const removed = current.taken.filter((s) => taken.indexOf(s) === -1);
  if (!added.length && !removed.length) return { status: 200, body: current };

  const message = "seats: " + added.map((s) => "+" + s).concat(removed.map((s) => "-" + s)).join(" ");
  const content = btoa(JSON.stringify({ taken }, null, 2) + "\n");
  const r = await gh(env, env.SEATS_PATH, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, content, sha, branch: env.GITHUB_BRANCH || "main" })
  });
  if (r.status === 409) return { status: 409, body: { reason: "conflict", ...(await readSeats(env)) } };
  if (!r.ok) throw new Error("GitHub 写入失败 " + r.status + ": " + (await r.text()).slice(0, 200));
  const d = await r.json();
  return { status: 200, body: { taken, sha: d.content.sha } };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/login" && request.method === "POST") {
      let key = "";
      try { key = String((await request.formData()).get("key") || ""); } catch (e) {}
      if (env.ADMIN_KEY && sameString(key, env.ADMIN_KEY)) {
        return new Response(null, { status: 303, headers: { Location: "/", "Set-Cookie": cookie(url, await sessionToken(env), 60 * 60 * 24 * 30) } });
      }
      await new Promise((r) => setTimeout(r, 500));
      return html(LOGIN.replace("{{error}}", "口令不对，请重试"));
    }
    if (url.pathname === "/logout") {
      return new Response(null, { status: 303, headers: { Location: "/", "Set-Cookie": cookie(url, "", 0) } });
    }

    if (!(await authorized(request, env))) {
      if (url.pathname === "/") return html(LOGIN.replace("{{error}}", ""));
      return json({ reason: "unauthorized" }, 401);
    }
    if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) return json({ reason: "worker 未配置 GITHUB_TOKEN / GITHUB_REPO" }, 500);

    try {
      if (url.pathname === "/" && request.method === "GET") return html(PAGE);
      if (url.pathname === "/config.js" && request.method === "GET") {
        const r = await gh(env, env.CONFIG_PATH, { headers: { Accept: "application/vnd.github.raw+json" } });
        return new Response(await r.text(), {
          status: r.ok ? 200 : 502,
          headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "no-store" }
        });
      }
      if (url.pathname === "/api/seats" && request.method === "GET") return json(await readSeats(env));
      if (url.pathname === "/api/seats" && request.method === "PUT") {
        let body;
        try { body = await request.json(); } catch (e) { return json({ reason: "bad_request" }, 400); }
        if (!body || typeof body.sha !== "string" || !Array.isArray(body.taken)) return json({ reason: "bad_request" }, 400);
        const out = await writeSeats(env, normalize(body.taken), body.sha);
        return json(out.body, out.status);
      }
      return json({ reason: "not_found" }, 404);
    } catch (e) {
      return json({ reason: String((e && e.message) || e) }, 502);
    }
  }
};

const LOGIN = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>座位管理</title>
<style>
  body { margin: 0; padding: 40px 16px; background: #e9e7e3; color: #1a1a1a; font: 14px/1.6 -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; }
  form { max-width: 320px; margin: 0 auto; background: #f2f0ec; border: 1px solid #b8b4ae; padding: 18px 16px; }
  h1 { font-size: 16px; margin: 0 0 12px; }
  input { display: block; width: 100%; box-sizing: border-box; font: inherit; padding: 8px; border: 1px solid #9a968f; margin: 0 0 10px; }
  button { font: inherit; padding: 8px 20px; border: 1px solid #8b1e1e; background: #c8161d; color: #fff; cursor: pointer; }
  .err { color: #c00; margin: 0 0 10px; min-height: 1.6em; }
</style>
</head>
<body>
<form method="post" action="/login">
  <h1>座位管理</h1>
  <p class="err">{{error}}</p>
  <input type="password" name="key" placeholder="口令" autocomplete="current-password" autofocus>
  <button type="submit">登录</button>
</form>
</body>
</html>
`;

const PAGE = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>座位管理</title>
<style>
  body { margin: 0; padding: 10px; background: #e9e7e3; color: #1a1a1a; font: 14px/1.6 -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; }
  h1 { font-size: 16px; margin: 0 0 10px; }
  h1 span { font-weight: normal; font-size: 13px; color: #555; margin-left: 8px; }
  #bar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin: 0 0 8px; }
  button { font: inherit; padding: 6px 16px; border: 1px solid #8b1e1e; background: #c8161d; color: #fff; cursor: pointer; }
  button[disabled] { opacity: .45; cursor: default; }
  button.plain { background: #f2f0ec; color: #1a1a1a; border-color: #b8b4ae; }
  #msg { color: #555; }
  #msg.err { color: #c00; }
  #legend { font-size: 12px; color: #555; margin: 0 0 8px; }
  #legend span { display: inline-block; margin-right: 12px; }
  #legend i { display: inline-block; width: 12px; height: 12px; border: 1px solid #9a968f; background: #fff; vertical-align: -2px; margin-right: 4px; }
  #map { background: #f2f0ec; border: 1px solid #b8b4ae; padding: 10px 6px; overflow-x: auto; }
  .screen { max-width: 360px; margin: 0 auto 10px; padding: 2px; text-align: center; background: #d8d6d2; font-size: 12px; color: #555; letter-spacing: 6px; }
  .row { display: flex; align-items: center; gap: 2px; margin: 0 0 3px; white-space: nowrap; }
  .rowlabel { width: 26px; margin-right: 3px; font-size: 12px; color: #777; text-align: right; flex: none; }
  .gap { width: 6px; flex: none; }
  .seat { width: 20px; height: 26px; flex: none; padding: 0; border: 1px solid #9a968f; background: #fff; color: #333; font-size: 11px; line-height: 24px; text-align: center; cursor: pointer; }
  .seat.taken, #legend i.taken { background: #8b8680; border-color: #6a6660; color: #fff; }
  .seat.reserved, #legend i.reserved { background: #e0c27a; border-color: #b8964a; cursor: default; }
  .seat.dirty, #legend i.dirty { outline: 2px solid #c8161d; outline-offset: -1px; }
  #changes { font-size: 13px; color: #8b1e1e; margin: 8px 0 0; min-height: 1.6em; }
  @media (max-width: 400px) { .seat { width: 18px; font-size: 10px; } .row { gap: 1px; } .gap { width: 4px; } }
</style>
</head>
<body>
<h1>座位管理 <span id="count"></span></h1>
<div id="bar">
  <button id="save" disabled>保存</button>
  <button id="reload" class="plain">刷新</button>
  <span id="msg"></span>
</div>
<div id="legend"><span><i></i>可选</span><span><i class="taken"></i>已订</span><span><i class="reserved"></i>预留</span><span><i class="dirty"></i>未保存</span></div>
<div id="map"></div>
<p id="changes"></p>
<p><a href="/logout" style="color:#777;font-size:12px">退出</a></p>
<script src="/config.js"></script>
<script>
(function () {
  var C = window.SEAT_CONFIG;
  var $ = function (id) { return document.getElementById(id); };
  var saved = {}, taken = {}, sha = null, busy = false;

  if (!C) { msg("读不到座位布局（data/taken.js），请刷新", true); return; }

  function msg(t, err) { var m = $("msg"); m.textContent = t; m.className = err ? "err" : ""; }
  function byRowCol(a, b) {
    var pa = a.split("-").map(Number), pb = b.split("-").map(Number);
    return pa[0] - pb[0] || pa[1] - pb[1];
  }
  function label(id) { var p = id.split("-"); return p[0] + "排" + p[1] + "座"; }
  function setOf(list) { var s = {}; list.forEach(function (id) { s[id] = 1; }); return s; }
  function keys(o) { return Object.keys(o).sort(byRowCol); }
  function diff() {
    var added = keys(taken).filter(function (id) { return !saved[id]; });
    var removed = keys(saved).filter(function (id) { return !taken[id]; });
    return { added: added, removed: removed };
  }

  function apply(d) { saved = setOf(d.taken); sha = d.sha; }
  function colsIn(r) { return (C.rowCols && C.rowCols[r]) || C.cols; }
  function total() { var n = 0; for (var r = 1; r <= C.rows; r++) n += colsIn(r); return n; }

  function render() {
    var map = $("map");
    map.innerHTML = "";
    var screen = document.createElement("div"); screen.className = "screen"; screen.textContent = "银幕"; map.appendChild(screen);
    for (var r = 1; r <= C.rows; r++) {
      var row = document.createElement("div"); row.className = "row";
      var lab = document.createElement("span"); lab.className = "rowlabel"; lab.textContent = r + "排"; row.appendChild(lab);
      var cols = colsIn(r);
      for (var c = 1; c <= cols; c++) {
        var id = r + "-" + c;
        var b = document.createElement("button"); b.type = "button"; b.className = "seat"; b.textContent = c; b.title = label(id);
        b.setAttribute("data-id", id);
        if (C.RESERVED_SEATS.indexOf(id) !== -1) b.classList.add("reserved");
        else {
          if (taken[id]) b.classList.add("taken");
          if (!!taken[id] !== !!saved[id]) b.classList.add("dirty");
          b.addEventListener("click", onSeat);
        }
        row.appendChild(b);
        if (c < cols && C.aisleAfter.indexOf(c) !== -1) { var g = document.createElement("span"); g.className = "gap"; row.appendChild(g); }
      }
      map.appendChild(row);
    }
    var n = keys(taken).length, free = total() - C.RESERVED_SEATS.length - n;
    $("count").textContent = "已订 " + n + " · 剩余 " + free;
    var d = diff();
    var parts = d.added.map(function (id) { return "+ " + label(id); }).concat(d.removed.map(function (id) { return "− " + label(id); }));
    $("changes").textContent = parts.length ? "未保存：" + parts.join("，") : "";
    $("save").disabled = busy || !parts.length;
  }

  function onSeat(e) {
    if (busy) return;
    var id = e.currentTarget.getAttribute("data-id");
    if (taken[id]) delete taken[id]; else taken[id] = 1;
    render();
  }

  function load() {
    busy = true; msg("载入中…"); render();
    fetch("/api/seats", { cache: "no-store" })
      .then(function (r) { if (r.status === 401) { location.href = "/"; return new Promise(function () {}); } return r.json().then(function (d) { if (!r.ok) throw new Error(d.reason || r.status); return d; }); })
      .then(function (d) { apply(d); taken = setOf(d.taken); msg(""); })
      .catch(function (e) { msg("读取失败：" + e.message, true); })
      .then(function () { busy = false; render(); });
  }

  function save() {
    if (busy) return;
    busy = true; msg("提交中…"); render();
    fetch("/api/seats", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ taken: keys(taken), sha: sha }) })
      .then(function (r) { if (r.status === 401) { location.href = "/"; return new Promise(function () {}); } return r.json().then(function (d) { return { status: r.status, d: d }; }); })
      .then(function (x) {
        if (x.status === 409) {
          var d = diff();
          apply(x.d); taken = setOf(x.d.taken);
          d.added.forEach(function (id) { taken[id] = 1; });
          d.removed.forEach(function (id) { delete taken[id]; });
          msg("座位表刚被别处改过，已合并最新版本，请检查后再按保存", true);
          return;
        }
        if (x.status !== 200) throw new Error(x.d.reason || x.status);
        apply(x.d); taken = setOf(x.d.taken);
        msg("已保存，网站约 1 分钟后更新");
      })
      .catch(function (e) { msg("保存失败：" + e.message, true); })
      .then(function () { busy = false; render(); });
  }

  $("save").addEventListener("click", save);
  $("reload").addEventListener("click", function () { taken = {}; load(); });
  window.addEventListener("beforeunload", function (e) { if (diff().added.length || diff().removed.length) { e.preventDefault(); e.returnValue = ""; } });
  load();
})();
</script>
</body>
</html>
`;
