// TimeTrack Timer — popup UI (app-consistent dark, single synced timer).

var main = document.getElementById("main");
var tickTimer = null;
var APP_URL = "https://viktoriiatyrous.github.io/timetrack/";

var IC_PLAY = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
var IC_PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1.3"/><rect x="14" y="5" width="4" height="14" rx="1.3"/></svg>';
var IC_STOP = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2.5"/></svg>';

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
// Avatar gradient — same formula as the app so monograms match.
function hueOf(s) { var h = 0; s = String(s || ""); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; }
function avStyle(s) { var h = hueOf(s); return "background:linear-gradient(135deg,oklch(0.80 0.15 " + h + "),oklch(0.66 0.18 " + ((h + 55) % 360) + "))"; }
function initials(s) { var w = String(s || "").trim().split(/\s+/); return (((w[0] || "")[0] || "") + ((w[1] || "")[0] || "")) || (s || "?")[0]; }

function send(msg) { return new Promise(function (res) { chrome.runtime.sendMessage(msg, res); }); }
function getAll() {
  return new Promise(function (res) {
    chrome.storage.local.get(["tt_running", "tt_tasks", "tt_today"], res);
  });
}
function openApp() { chrome.tabs.create({ url: APP_URL }); window.close(); }

function runningCard(t, running, todaySec) {
  var paused = !!running.pausedAt;
  // Show the CURRENT session only (from zero), matching the app's live hero clock.
  var sec = elapsed(running);
  return '<div class="tcard running' + (paused ? " paused" : "") + '">' +
    '<div class="rc-head">' +
      '<span class="rc-av" style="' + avStyle(t.name) + '">' + esc(initials(t.name)) + '</span>' +
      '<div class="rc-meta">' +
        '<div class="rc-eyebrow"><span class="dot"></span>' + (paused ? "PAUSED" : "COUNTING") + '</div>' +
        '<div class="rc-name">' + esc(t.name) + '</div>' +
        (t.projectName ? '<div class="rc-pills"><span class="pill">' + esc(t.projectName) + '</span></div>' : '') +
      '</div>' +
    '</div>' +
    '<div class="rc-timer">' +
      '<span class="rc-clock" data-clock="' + esc(t.id) + '">' + fmtClock(sec) + '</span>' +
      '<button class="rbtn" data-act="' + (paused ? "resume" : "pause") + '" title="' + (paused ? "Resume" : "Pause") + '">' + (paused ? IC_PLAY : IC_PAUSE) + '</button>' +
      '<button class="rbtn stop" data-act="stop" title="Stop">' + IC_STOP + '</button>' +
    '</div>' +
  '</div>';
}

function idleCard(t, todaySec) {
  return '<div class="tcard idle">' +
    '<span class="ti-av" style="' + avStyle(t.name) + '">' + esc(initials(t.name)) + '</span>' +
    '<div class="ti-meta"><div class="ti-name">' + esc(t.name) + '</div>' +
      (t.projectName ? '<div class="ti-sub"><span class="pill">' + esc(t.projectName) + '</span></div>' : '') +
    '</div>' +
    '<span class="ti-time">' + fmtClock(todaySec) + '</span>' +
    '<button class="pbtn" data-act="start" data-id="' + esc(t.id) + '" data-name="' + esc(t.name) + '" data-proj="' + esc(t.projectName || "") + '" title="Start">' + IC_PLAY + '</button>' +
  '</div>';
}

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

  // running task first, then the rest
  var ordered = tasks.slice().sort(function (a, b) {
    var ra = running && running.taskId === a.id ? 1 : 0;
    var rb = running && running.taskId === b.id ? 1 : 0;
    return rb - ra;
  });

  var cards = ordered.map(function (t) {
    var todaySec = totals[t.id] || 0;
    return (running && running.taskId === t.id) ? runningCard(t, running, todaySec) : idleCard(t, todaySec);
  }).join("");

  var totalSec = 0;
  Object.keys(totals).forEach(function (k) { totalSec += totals[k]; });
  if (running) totalSec += elapsed(running);

  main.innerHTML = bar + '<div class="cards">' + cards + '</div>' +
    '<div class="total"><span>Total</span><span class="tv" id="total">' + fmtClock(totalSec) + '</span></div>';

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
      for (var i = 0; i < clocks.length; i++) {
        if (clocks[i].getAttribute("data-clock") === running.taskId) clocks[i].textContent = fmtClock(elapsed(running));
      }
      var tot = document.getElementById("total"), ts = 0;
      Object.keys(totals).forEach(function (k) { ts += totals[k]; });
      if (tot) tot.textContent = fmtClock(ts + elapsed(running));
    }, 1000);
  }
}

function refresh() { getAll().then(render); }

refresh();
chrome.storage.onChanged.addListener(function (changes, area) {
  if (area === "local" && (changes.tt_running || changes.tt_today || changes.tt_tasks)) refresh();
});
