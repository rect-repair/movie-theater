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
})();
