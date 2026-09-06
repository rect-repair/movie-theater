(function () {
  var data = window.REVIEWS || [];
  var list = document.getElementById("reviews");
  var pager = document.getElementById("pager");
  var LABEL = { 1: "很差", 2: "较差", 3: "还行", 4: "推荐", 5: "力荐" };
  var PER_PAGE = 20;
  var sortKey = "new", page = 1;

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function blocks(name) {
    var n = typeof name === "number" ? name : parseInt(name, 10);
    if (isNaN(n)) n = String(name).replace(/[\s·:：]/g, "").length;
    n = Math.max(2, Math.min(10, n));
    var s = "";
    for (var i = 0; i < n; i++) s += "█";
    return "<span class=\"redact\">" + s + "</span>";
  }

  function redact(text) {
    return esc(text).replace(/\{\{(.+?)\}\}/g, function (_, name) {
      return "《" + blocks(name) + "》";
    });
  }

  function stars(n) {
    var s = "";
    for (var i = 1; i <= 5; i++) s += i <= n ? "★" : "☆";
    return s;
  }

  function avatarChar(user) {
    if (user === "已注销") return "×";
    return user.charAt(0).toUpperCase();
  }

  function render(items) {
    list.innerHTML = "";
    items.forEach(function (r) {
      var div = document.createElement("div");
      div.className = "review" + (r.pinned ? " pinned" : "");
      div.innerHTML =
        '<div class="avatar">' + esc(avatarChar(r.user)) + '</div>' +
        '<div class="body">' +
          '<div class="meta"><span class="user">' + esc(r.user) + '</span>' +
            '<span class="stars">' + stars(r.stars) + '</span><span class="rating">' + LABEL[r.stars] + '</span>' +
            '<span class="gray">看过</span> ' + (r.film ? "《" + blocks(r.film) + "》" : "") +
            '<span class="date">' + esc(r.date) + '</span></div>' +
          '<div class="text">' + redact(r.text) + '</div>' +
          '<div class="foot"><a href="#">' + (r.useful || 0) + ' 有用</a><a href="#">回应</a><a href="#" class="gray">举报</a></div>' +
        '</div>';
      list.appendChild(div);
    });
  }

  var SORT = {
    new:   function (a, b) { return b.date.localeCompare(a.date); },
    hot:   function (a, b) { return (b.useful || 0) - (a.useful || 0); },
    worst: function (a, b) { return a.stars - b.stars || (b.useful || 0) - (a.useful || 0); },
    best:  function (a, b) { return b.stars - a.stars || (b.useful || 0) - (a.useful || 0); }
  };

  function ordered() {
    var pinned = data.filter(function (r) { return r.pinned; });
    var rest = data.filter(function (r) { return !r.pinned; }).sort(SORT[sortKey]);
    return pinned.concat(rest);
  }

  function show() {
    var all = ordered();
    var pages = Math.max(1, Math.ceil(all.length / PER_PAGE));
    if (page > pages) page = pages;
    render(all.slice((page - 1) * PER_PAGE, page * PER_PAGE));
    renderPager(pages);
    document.getElementById("review-count").textContent = all.length;
  }

  function renderPager(pages) {
    if (!pager) return;
    var html = "";
    if (page > 1) html += '<a href="#" data-p="' + (page - 1) + '">&laquo; 上一页</a>';
    for (var i = 1; i <= pages; i++) {
      html += i === page ? '<span class="cur">' + i + '</span>' : '<a href="#" data-p="' + i + '">' + i + '</a>';
    }
    if (page < pages) html += '<a href="#" data-p="' + (page + 1) + '">下一页 &raquo;</a>';
    pager.innerHTML = html;
  }

  if (pager) pager.addEventListener("click", function (e) {
    var a = e.target.closest("a[data-p]");
    if (!a) return;
    e.preventDefault();
    page = parseInt(a.dataset.p, 10);
    show();
    list.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  document.querySelectorAll(".tabs a").forEach(function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
      document.querySelectorAll(".tabs a").forEach(function (x) { x.classList.remove("on"); });
      a.classList.add("on");
      sortKey = a.dataset.sort;
      page = 1;
      show();
    });
  });

  var counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  data.forEach(function (r) { counts[r.stars] = (counts[r.stars] || 0) + 1; });
  var max = Math.max.apply(null, Object.keys(counts).map(function (k) { return counts[k]; })) || 1;
  document.querySelectorAll("#dist .bar").forEach(function (bar) {
    var n = counts[bar.dataset.n] || 0;
    bar.style.cssText = "display:inline-block;height:10px;background:#f7a51b;vertical-align:middle;width:" + Math.round(n / max * 60) + "px";
    bar.insertAdjacentHTML("afterend", ' <span class="gray small">' + n + '</span>');
  });

  show();
})();
