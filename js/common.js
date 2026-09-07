(function () {
  var now = new Date();
  var ymd = now.getFullYear() + "年" + (now.getMonth() + 1) + "月" + now.getDate() + "日";
  var d = document.getElementById("today");
  if (d) d.textContent = ymd;
  var full = document.getElementById("today-full");
  if (full) full.textContent = ymd + " 星期" + "日一二三四五六".charAt(now.getDay());

  var ctr = document.getElementById("counter");
  if (ctr) {
    var days = Math.floor((now - new Date(2019, 9, 1)) / 864e5);
    var n = 40000 + days * 7 + now.getHours() * 3 + (now.getMinutes() % 7);
    ctr.textContent = ("0000000" + n).slice(-7);
  }

  var rem = document.querySelectorAll(".remaining");
  if (rem.length && window.Seats) {
    var update = function () {
      var r = window.Seats.remaining();
      rem.forEach(function (e) { e.textContent = r; });
    };
    update();
    window.Seats.sync(function (ok) { if (ok) update(); });
  }

  function homeUrl() {
    var a = document.createElement("a");
    a.href = "index.html";
    return a.href;
  }

  function setHome(ev) {
    if (ev && ev.preventDefault) ev.preventDefault();
    var url = homeUrl();
    try {
      this.style.behavior = "url(#default#homepage)";
      this.setHomePage(url);
    } catch (err) {
      try {
        netscape.security.PrivilegeManager.enablePrivilege("UniversalXPConnect");
        Components.classes["@mozilla.org/preferences-service;1"]
          .getService(Components.interfaces.nsIPrefBranch)
          .setCharPref("browser.startup.homepage", url);
      } catch (err2) {
        alert("您的浏览器不支持自动设为首页，请手动将\n" + url + "\n设为浏览器起始页。");
      }
    }
    return false;
  }

  function addFav(ev) {
    if (ev && ev.preventDefault) ev.preventDefault();
    var url = location.href;
    var title = document.title;
    try {
      if (window.sidebar && window.sidebar.addPanel) {
        window.sidebar.addPanel(title, url, "");
      } else if (window.external && ("AddFavorite" in window.external)) {
        window.external.AddFavorite(url, title);
      } else {
        throw 0;
      }
    } catch (err) {
      var ua = navigator.userAgent || "";
      var mobile = /Mobile|Android|iPhone|iPad|iPod/i.test(ua);
      if (mobile) {
        alert("请使用浏览器菜单将本页加入收藏。");
      } else {
        var mac = /Mac/i.test(navigator.platform || "") || /Mac OS X/i.test(ua);
        alert("请按 " + (mac ? "⌘+D" : "Ctrl+D") + " 将本页加入收藏。");
      }
    }
    return false;
  }

  var top = document.getElementById("toplinks");
  if (top) {
    var as = top.getElementsByTagName("a");
    for (var i = 0; i < as.length; i++) {
      var t = as[i].textContent;
      if (t === "设为首页") as[i].onclick = setHome;
      if (t === "加入收藏") as[i].onclick = addFav;
    }
  }
})();
