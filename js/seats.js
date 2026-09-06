(function () {
  var C = window.SEAT_CONFIG;

  function allSeatIds() {
    var ids = [];
    for (var r = 1; r <= C.rows; r++)
      for (var c = 1; c <= C.cols; c++) ids.push(r + "-" + c);
    return ids;
  }

  var remote = {};
  var syncing = null;
  var base = (C.REMOTE || "").replace(/\/+$/, "");

  function signal(ms) {
    if (typeof AbortController === "undefined") return undefined;
    var c = new AbortController();
    setTimeout(function () { c.abort(); }, ms);
    return c.signal;
  }
  function absorb(list) {
    if (!list || !list.length) return;
    list.forEach(function (id) { remote[id] = 1; });
  }

  function sync(cb) {
    if (!base || typeof fetch === "undefined") { cb && cb(false); return; }
    if (!syncing) {
      syncing = fetch(base + "/seats", { cache: "no-store", signal: signal(3500) })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          syncing = null;
          if (d && d.taken) { remote = {}; absorb(d.taken); return true; }
          return false;
        })
        .catch(function () { syncing = null; return false; });
    }
    syncing.then(function (ok) { cb && cb(ok); });
  }

  function report(booking, cb) {
    if (!base || typeof fetch === "undefined") { cb("offline"); return; }
    fetch(base + "/seats", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ seat: booking.seat, no: booking.no }),
      signal: signal(5000)
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.taken) absorb(d.taken);
        if (d && d.ok) cb("ok");
        else if (d && d.reason === "taken") cb("taken");
        else cb("offline");
      })
      .catch(function () { cb("offline"); });
  }

  function takenSet() {
    var set = {};
    C.TAKEN_SEATS.forEach(function (id) { set[id] = 1; });
    Object.keys(remote).forEach(function (id) { set[id] = 1; });
    return set;
  }

  function myBooking() {
    try {
      var raw = localStorage.getItem("jt_booking");
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function remaining() {
    var taken = takenSet();
    var n = Object.keys(taken).length;
    var mine = myBooking();
    if (mine && !taken[mine.seat]) n += 1;
    return C.rows * C.cols - C.RESERVED_SEATS.length - n;
  }

  window.Seats = {
    ids: allSeatIds,
    taken: takenSet,
    remaining: remaining,
    myBooking: myBooking,
    sync: sync,
    report: report,
    label: function (id) {
      var p = id.split("-");
      return p[0] + "排" + p[1] + "座";
    }
  };
})();
