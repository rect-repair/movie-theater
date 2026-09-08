(function () {
  var C = window.SEAT_CONFIG, S = window.Seats;
  var $ = function (id) { return document.getElementById(id); };

  var picked = null;
  var taken = S.taken();
  var mine = S.myBooking();

  var QUESTIONS = [
    ["name", "您的姓名是？"],
    ["first_film", "您记忆中观看的第一部电影是？"],
    ["earliest", "您能够回忆起的人生中最早的画面是什么？"],
    ["asleep_film", "您上一次在观影途中入睡时，放映的是哪部影片？"],
    ["meds", "您近期是否正在服用可能影响注意力、意识状态或记忆的药物？"],
    ["suggest", "您是否认为自己的意志容易受到影像、声音或他人描述的影响？"],
    ["review", "您是否习惯在观影后留下评分、短评或其他文字记录？"],
    ["agree", "您是否愿意严格遵守《观影须知》？"]
  ];

  function renderSeats() {
    var map = $("seatmap");
    map.innerHTML = "";
    var rows = document.createElement("div");
    rows.className = "rows";
    map.appendChild(rows);
    var widest = 0;
    for (var i = 1; i <= C.rows; i++) widest = Math.max(widest, S.cols(i));
    map.style.setProperty("--cols", widest);
    for (var r = 1; r <= C.rows; r++) {
      var row = document.createElement("div");
      row.className = "row";
      var lab = document.createElement("span");
      lab.className = "rowlabel";
      lab.textContent = r + "排";
      row.appendChild(lab);
      var cols = S.cols(r);
      for (var c = 1; c <= cols; c++) {
        var id = r + "-" + c;
        var b = document.createElement("button");
        b.type = "button";
        b.className = "seat";
        b.dataset.id = id;
        b.textContent = c;
        b.title = S.label(id);
        if (C.RESERVED_SEATS.indexOf(id) !== -1) { b.classList.add("reserved"); b.title += "（预留）"; }
        else if (mine && mine.seat === id) { b.classList.add("mine"); b.title += "（您的座位）"; }
        else if (taken[id]) { b.classList.add("taken"); b.title += "（已订）"; }
        else if (picked === id) { b.classList.add("selected"); }
        b.addEventListener("click", onSeat);
        row.appendChild(b);
        if (c < cols && C.aisleAfter.indexOf(c) !== -1) {
          var g = document.createElement("span"); g.className = "gap"; row.appendChild(g);
        }
      }
      rows.appendChild(row);
    }
  }

  function refreshSeats() {
    taken = S.taken();
    if (picked && taken[picked]) {
      picked = null;
      $("picked").textContent = "—";
      $("seat-msg").textContent = "您刚才选择的座位已被他人预订，请重新选择。";
      $("form-box").hidden = true;
    }
    renderSeats();
  }

  function onSeat(e) {
    var b = e.currentTarget, id = b.dataset.id;
    var msg = $("seat-msg");
    if (b.classList.contains("reserved")) { msg.textContent = "该座位为调查组预留。"; return; }
    if (b.classList.contains("taken") || b.classList.contains("mine")) { msg.textContent = "该座位已被预订，请选择其他座位。"; return; }
    if (mine) { msg.textContent = "本机已有订票记录，如需更换请先清除记录。"; return; }
    var prev = document.querySelector(".seat.selected");
    if (prev) prev.classList.remove("selected");
    b.classList.add("selected");
    picked = id;
    $("picked").textContent = S.label(id);
    msg.textContent = "已为您暂时保留，请在下方完成问卷。";
    $("form-box").hidden = false;
    setTimeout(function () { $("form-box").scrollIntoView({ behavior: "smooth", block: "start" }); }, 50);
  }

  function showErr(text) {
    var m = $("form-msg");
    m.textContent = text;
    m.hidden = false;
    m.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function val(form, name) {
    var el = form.elements[name];
    if (!el) return "";
    if (el.length && el[0] && el[0].type === "radio") {
      for (var i = 0; i < el.length; i++) if (el[i].checked) return el[i].value;
      return "";
    }
    return (el.value || "").trim();
  }

  $("qform").addEventListener("submit", function (e) {
    e.preventDefault();
    var f = e.target;
    $("form-msg").hidden = true;
    if (!picked) { showErr("请先选择座位。"); return; }

    var answers = {};
    for (var i = 0; i < QUESTIONS.length; i++) {
      var k = QUESTIONS[i][0];
      answers[k] = val(f, k);
      if (!answers[k]) { showErr("提交失败，请完整填写问卷（第 " + displayNum(k) + " 题）。"); return; }
    }
    var name2 = val(f, "name2");
    if (!name2) { showErr("提交失败，请再次填写您的姓名。"); return; }

    if (answers.agree === "否") { showErr("提交失败，请遵守《观影须知》"); return; }
    if (name2 !== answers.name) { showErr("提交失败，请确认观影人信息"); return; }

    var booking = {
      seat: picked,
      name: answers.name,
      answers: answers,
      time: Date.now(),
      no: receiptNo(answers.name, picked)
    };

    var btn = f.querySelector("button[type=submit]");
    btn.disabled = true;
    btn.textContent = "正在提交…";
    S.sync(function () {
      btn.disabled = false;
      btn.textContent = "确认";
      if (S.taken()[picked]) {
        refreshSeats();
        showErr("提交失败，您选择的座位刚刚已被他人预订，请重新选择座位。");
        return;
      }
      try { localStorage.setItem("jt_booking", JSON.stringify(booking)); } catch (err) { }
      mine = booking;
      $("mask").hidden = false;
      $("dialog").hidden = false;
    });
  });

  function displayNum(key) {
    var order = ["name", "first_film", "earliest", "asleep_film", null, "meds", "suggest", "review", "agree", "name2"];
    return order.indexOf(key) + 1;
  }

  function receiptNo(name, seat) {
    var s = name + "|" + seat + "|" + Date.now(), h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    var p = seat.split("-");
    return "JT-0912-" + pad(p[0], 2) + pad(p[1], 2) + "-" + pad(h % 10000, 4);
  }
  function pad(n, w) { n = String(n); while (n.length < w) n = "0" + n; return n; }

  $("dialog-ok").addEventListener("click", function () {
    $("mask").hidden = true;
    $("dialog").hidden = true;
    showReceipt();
  });

  $("rules-link").addEventListener("click", function (e) {
    e.preventDefault();
    $("mask").hidden = false;
    $("rules-dialog").hidden = false;
  });
  $("rules-ok").addEventListener("click", function () {
    $("mask").hidden = true;
    $("rules-dialog").hidden = true;
  });

  function showReceipt() {
    if (!mine) return;
    $("flow").hidden = true;
    $("already").hidden = true;
    var w = $("receipt-wrap");
    w.hidden = false;
    $("r-no").textContent = mine.no;
    $("r-seat").textContent = S.label(mine.seat);
    $("r-name").textContent = mine.name;
    $("r-time").textContent = fmt(mine.time);
    var t = $("r-answers");
    t.innerHTML = "";
    QUESTIONS.forEach(function (q) {
      var tr = document.createElement("tr");
      var th = document.createElement("th"); th.textContent = q[1];
      var td = document.createElement("td"); td.textContent = mine.answers[q[0]] || "—";
      tr.appendChild(th); tr.appendChild(td); t.appendChild(tr);
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function fmt(ts) {
    var d = new Date(ts);
    return d.getFullYear() + "-" + pad(d.getMonth() + 1, 2) + "-" + pad(d.getDate(), 2) + " " +
      pad(d.getHours(), 2) + ":" + pad(d.getMinutes(), 2);
  }

  if (mine) {
    $("already").hidden = false;
    $("already-seat").textContent = S.label(mine.seat) + "（" + mine.name + "）";
  }
  $("show-receipt").addEventListener("click", function (e) { e.preventDefault(); showReceipt(); });
  $("clear-booking").addEventListener("click", function (e) {
    e.preventDefault();
    try { localStorage.removeItem("jt_booking"); } catch (err) { }
    location.reload();
  });

  renderSeats();
  S.sync(function (ok) { if (ok) refreshSeats(); });
})();
