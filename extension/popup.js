// TimeTrack Timer — popup UI.

var main = document.getElementById("main");
var tickTimer = null;

function fmtClock(sec) {
  sec = Math.max(0, Math.floor(sec));
  var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  function p(n) { return (n < 10 ? "0" : "") + n; }
  return p(h) + ":" + p(m) + ":" + p(s);
}
function fmtDur(sec) {
  var m = Math.round(sec / 60);
  if (m < 60) return m + "m";
  var h = Math.floor(m / 60), r = m % 60;
  return h + "h" + (r ? " " + r + "m" : "");
}
function startOfToday() {
  var d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime();
}
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, function (m) {
    return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[m];
  });
}
function send(msg) { return new Promise(function (res) { chrome.runtime.sendMessage(msg, res); }); }
function getAll() {
  return new Promise(function (res) {
    chrome.storage.local.get(["tt_running", "tt_tasks", "tt_today"], res);
  });
}

function todayLog(today) {
  var since = startOfToday();
  var rows = (today || []).filter(function (e) { return e.date >= since; });
  if (!rows.length) return '<div class="empty">No time tracked today yet.</div>';
  // group by taskId
  var by = {};
  rows.forEach(function (e) {
    var k = e.taskId || "?";
    if (!by[k]) by[k] = { name: e.taskName || "Task", sec: 0 };
    by[k].sec += e.durationSec;
  });
  return Object.keys(by).map(function (k) {
    return '<div class="row"><span class="n">' + esc(by[k].name) + '</span><span class="d">' + fmtDur(by[k].sec) + '</span></div>';
  }).join("");
}

function render(state) {
  if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
  var running = state.tt_running || null;
  var tasks = Array.isArray(state.tt_tasks) ? state.tt_tasks : [];
  var log = todayLog(state.tt_today);

  if (running) {
    main.innerHTML =
      '<div class="card running">' +
        '<div class="task">' + esc(running.taskName || "Task") + '</div>' +
        (running.projectName ? '<div class="proj">' + esc(running.projectName) + '</div>' : '') +
        '<div class="clock on" id="clock">' + fmtClock((Date.now() - running.startedAt) / 1000) + '</div>' +
        '<button class="btn stop" id="stop">Stop</button>' +
      '</div>' +
      '<div class="log"><h3>Today</h3>' + log + '</div>';
    var clock = document.getElementById("clock");
    tickTimer = setInterval(function () {
      clock.textContent = fmtClock((Date.now() - running.startedAt) / 1000);
    }, 1000);
    document.getElementById("stop").addEventListener("click", function () {
      send({ type: "stop" }).then(refresh);
    });
    return;
  }

  if (!tasks.length) {
    main.innerHTML =
      '<div class="card">' +
        '<div class="hint">Open the TimeTrack app once (with this extension allowed on the page) to load your tasks here.</div>' +
      '</div>' +
      '<div class="log"><h3>Today</h3>' + log + '</div>';
    return;
  }

  var opts = tasks.map(function (t) {
    var label = t.name + (t.projectName ? "  ·  " + t.projectName : "");
    return '<option value="' + esc(t.id) + '">' + esc(label) + '</option>';
  }).join("");
  main.innerHTML =
    '<div class="card">' +
      '<label>Task</label>' +
      '<select id="task">' + opts + '</select>' +
      '<button class="btn start" id="start">Start timer</button>' +
    '</div>' +
    '<div class="log"><h3>Today</h3>' + log + '</div>';

  document.getElementById("start").addEventListener("click", function () {
    var sel = document.getElementById("task");
    var id = sel.value;
    var t = tasks.filter(function (x) { return x.id === id; })[0];
    if (!t) return;
    send({ type: "start", taskId: t.id, taskName: t.name, projectName: t.projectName }).then(refresh);
  });
}

function refresh() { getAll().then(render); }

refresh();
// react to background changes while the popup is open
chrome.storage.onChanged.addListener(function (changes, area) {
  if (area === "local" && (changes.tt_running || changes.tt_today || changes.tt_tasks)) refresh();
});
