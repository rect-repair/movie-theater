(function () {
  var d = document.getElementById("today");
  if (d) {
    var now = new Date();
    d.textContent = now.getFullYear() + "年" + (now.getMonth() + 1) + "月" + now.getDate() + "日";
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
