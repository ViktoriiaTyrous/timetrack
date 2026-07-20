// TimeTrack Timer — popup UI (task cards, single synced timer).

var main = document.getElementById("main");
var tickTimer = null;
var APP_URL = "https://viktoriiatyrous.github.io/timetrack/";

var IC_PLAY = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
var IC_PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1.3"/><rect x="14" y="5" width="4" height="14" rx="1.3"/></svg>';
var IC_STOP = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="7" y="7" width="10" height="10" rx="2"/></svg>';

function fmtClock(sec) {
  sec = Math.max(0, Math.floor(sec));
  var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  function p(n) { return (n < 10 ? "0" : "") + n; }
  return p(h) + ":" + p(m) + ":" + p(s);
}
function elapsed(r) { return ((r.pausedAt || Date.now()) - r.startedAt) / 1000; }
function startOfToday() { var d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }
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
function openApp() { chrome.tabs.create({ url: APP_URL }); window.close(); }

function render(state) {
  if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
  var tasks = Array.isArray(state.tt_tasks) ? state.tt_tasks : [];
  var running = state.tt_running || null;
  var today = Array.isArray(state.tt_today) ? state.tt_today : [];
  var since = startOfToday();
  var totals = {};
  today.forEach(function (e) { if (e.date >= since) totals[e.taskId] = (totals[e.taskId] || 0) + e.durationSec; });

  var bar = '<div class="bar"><button class="newbtn" id="newtask">+ New task</button></div>';

  if (!tasks.length) {
    main.innerHTML = bar + '<div class="hint">Open the TimeTrack app once (with this extension allowed on the page) to load your tasks here.</div>';
    document.getElementById("newtask").addEventListener("click", openApp);
    return;
  }

  function card(t) {
    var isRun = running && running.taskId === t.id;
    var paused = isRun && !!running.pausedAt;
    var sec = (totals[t.id] || 0) + (isRun ? elapsed(running) : 0);
    var act = isRun ? (paused ? "resume" : "pause") : "start";
    return '<div class="tcard' + (isRun ? (paused ? " paused" : " running") : "") + '">' +
      '<div class="tc-top"><span class="tc-name">' + esc(t.name) + '</span>' +
        (t.projectName ? '<span class="tc-proj">' + esc(t.projectName) + '</span>' : '') + '</div>' +
      '<div class="tc-row">' +
        '<button class="pbtn" data-act="' + act + '" data-id="' + esc(t.id) + '" data-name="' + esc(t.name) + '" data-proj="' + esc(t.projectName || "") + '">' + (isRun && !paused ? IC_PAUSE : IC_PLAY) + '</button>' +
        '<span class="tc-time" data-clock="' + esc(t.id) + '">' + fmtClock(sec) + '</span>' +
        (isRun ? '<button class="sbtn" data-act="stop" title="Stop">' + IC_STOP + '</button>' : '') +
      '</div></div>';
  }

  function totalSec() {
    var s = 0; Object.keys(totals).forEach(function (k) { s += totals[k]; });
    if (running) s += elapsed(running);
    return s;
  }

  main.innerHTML = bar +
    '<div class="cards">' + tasks.map(card).join("") + '</div>' +
    '<div class="total"><span>Total</span><span class="tv" id="total">' + fmtClock(totalSec()) + '</span></div>';

  document.getElementById("newtask").addEventListener("click", openApp);
  main.querySelectorAll("[data-act]").forEach(function (b) {
    b.addEventListener("click", function () {
      var act = b.dataset.act;
      if (act === "start") send({ type: "start", taskId: b.dataset.id, taskName: b.dataset.name, projectName: b.dataset.proj }).then(refresh);
      else if (act === "pause") send({ type: "pause" }).then(refresh);
      else if (act === "resume") send({ type: "resume" }).then(refresh);
      else if (act === "stop") send({ type: "stop" }).then(refresh);
    });
  });

  if (running && !running.pausedAt) {
    tickTimer = setInterval(function () {
      var clocks = main.querySelectorAll("[data-clock]");
      var i, el;
      for (i = 0; i < clocks.length; i++) {
        el = clocks[i];
        if (el.getAttribute("data-clock") === running.taskId) {
          el.textContent = fmtClock((totals[running.taskId] || 0) + elapsed(running));
        }
      }
      var tot = document.getElementById("total");
      if (tot) tot.textContent = fmtClock(totalSec());
    }, 1000);
  }
}

function refresh() { getAll().then(render); }

refresh();
chrome.storage.onChanged.addListener(function (changes, area) {
  if (area === "local" && (changes.tt_running || changes.tt_today || changes.tt_tasks)) refresh();
});
