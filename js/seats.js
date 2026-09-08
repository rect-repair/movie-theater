(function () {
  var C = window.SEAT_CONFIG;
  var SRC = "data/seats.json";

  function colsIn(r) {
    return (C.rowCols && C.rowCols[r]) || C.cols;
  }

  function total() {
    var n = 0;
    for (var r = 1; r <= C.rows; r++) n += colsIn(r);
    return n;
  }

  function allSeatIds() {
    var ids = [];
    for (var r = 1; r <= C.rows; r++)
      for (var c = 1; c <= colsIn(r); c++) ids.push(r + "-" + c);
    return ids;
  }

  var taken = {};
  var loading = null;

  function timed(p, ms) {
    return new Promise(function (resolve, reject) {
      var t = setTimeout(function () { reject(new Error("timeout")); }, ms);
      p.then(function (v) { clearTimeout(t); resolve(v); }, function (e) { clearTimeout(t); reject(e); });
    });
  }

  function sync(cb) {
    if (typeof fetch === "undefined") { cb && cb(false); return; }
    if (!loading) {
      loading = timed(fetch(SRC + "?t=" + Date.now(), { cache: "no-store" })
        .then(function (r) { return r.ok ? r.json() : null; }), 5000)
        .then(function (d) {
          loading = null;
          if (!d || !d.taken) return false;
          taken = {};
          d.taken.forEach(function (id) { taken[String(id)] = 1; });
          return true;
        })
        .catch(function () { loading = null; return false; });
    }
    loading.then(function (ok) { cb && cb(ok); });
  }

  function takenSet() {
    var set = {};
    Object.keys(taken).forEach(function (id) { set[id] = 1; });
    return set;
  }

  function myBooking() {
    try {
      var raw = localStorage.getItem("jt_booking");
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function remaining() {
    var t = takenSet();
    var n = Object.keys(t).length;
    var mine = myBooking();
    if (mine && !t[mine.seat]) n += 1;
    return total() - C.RESERVED_SEATS.length - n;
  }

  window.Seats = {
    ids: allSeatIds,
    cols: colsIn,
    total: total,
    taken: takenSet,
    remaining: remaining,
    myBooking: myBooking,
    sync: sync,
    label: function (id) {
      var p = id.split("-");
      return p[0] + "排" + p[1] + "座";
    }
  };
})();
