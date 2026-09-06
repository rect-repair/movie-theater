/* ============================================================
   Cloudflare Worker：座位状态同步（可选，站点没有它也能正常运行）
   ------------------------------------------------------------
   GET  /seats                 → { taken: ["3-5", ...] }
   POST /seats  {seat, no}     → { ok: true, taken: [...] }
                               → { ok: false, reason: "taken", taken: [...] }  座位刚被别人订走
   GET  /admin?key=ADMIN_KEY   → { taken: [...], bookings: [{seat, no, time}, ...] }
   POST /admin?key=ADMIN_KEY {remove: "3-5"} → 释放一个座位（未取票的可以放回去）

   绑定：KV namespace 叫 SEATS；secret 叫 ADMIN_KEY（见 wrangler.toml 与 README）
   只存座位号、回执编号和时间，不存问卷答案和姓名。
   ============================================================ */
export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };
    const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
      status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
    });
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    const readList = async () => (await env.SEATS.get("taken", "json")) || [];
    const readBody = async () => { try { return JSON.parse(await request.text()); } catch (e) { return null; } };

    if (url.pathname === "/seats") {
      if (request.method === "GET") return json({ taken: await readList() });
      if (request.method === "POST") {
        const body = await readBody();
        if (!body) return json({ ok: false, reason: "bad_request" }, 400);
        const seat = String(body.seat || "");
        // 12 排 × 13 座；改座位图时同步改这里
        if (!/^([1-9]|1[0-2])-([1-9]|1[0-3])$/.test(seat)) return json({ ok: false, reason: "bad_seat" }, 400);
        const list = await readList();
        if (list.includes(seat)) return json({ ok: false, reason: "taken", taken: list });
        list.push(seat);
        await env.SEATS.put("taken", JSON.stringify(list));
        await env.SEATS.put("booking:" + seat, JSON.stringify({
          seat, no: String(body.no || "").slice(0, 32), time: new Date().toISOString()
        }));
        return json({ ok: true, taken: list });
      }
    }

    if (url.pathname === "/admin") {
      if (!env.ADMIN_KEY || url.searchParams.get("key") !== env.ADMIN_KEY) return json({ ok: false, reason: "forbidden" }, 403);
      if (request.method === "GET") {
        const keys = await env.SEATS.list({ prefix: "booking:" });
        const bookings = [];
        for (const k of keys.keys) bookings.push(await env.SEATS.get(k.name, "json"));
        bookings.sort((a, b) => (a.time > b.time ? 1 : -1));
        return json({ taken: await readList(), bookings });
      }
      if (request.method === "POST") {
        const body = (await readBody()) || {};
        const seat = String(body.remove || "");
        const list = (await readList()).filter((s) => s !== seat);
        await env.SEATS.put("taken", JSON.stringify(list));
        await env.SEATS.delete("booking:" + seat);
        return json({ ok: true, taken: list });
      }
    }

    return json({ ok: false, reason: "not_found" }, 404);
  }
};
