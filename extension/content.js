// TimeTrack Timer — content script.
// Runs only on the TimeTrack app page (detected via the <meta name="timetrack-app">
// marker). While the app tab is open it makes the app and the extension share ONE
// timer: it mirrors the app's running state into the extension, relays the popup's
// start/stop/pause commands to the app, and flushes any offline-recorded entries.

(function () {
  var marker = document.querySelector('meta[name="timetrack-app"]');
  if (!marker) return;
  var keyMeta = document.querySelector('meta[name="timetrack-storage-key"]');
  var KEY = (keyMeta && keyMeta.content) || "timetrack_v1";
  var adopted = false;
  var lastCmdTs = 0;

  function readDb() { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { return null; } }
  function writeDb(db) { try { localStorage.setItem(KEY, JSON.stringify(db)); return true; } catch (e) { return false; } }

  function nameOf(db, taskId) {
    var t = (db.tasks || []).filter(function (x) { return x.id === taskId; })[0];
    if (!t) return { task: "", project: "" };
    var p = (db.projects || []).filter(function (x) { return x.id === t.projectId; })[0];
    return { task: t.name || "", project: p ? (p.name || "") : "" };
  }

  function pushTasks(db) {
    if (!db || !db.projects) return;
    var projName = {};
    (db.projects || []).forEach(function (p) { projName[p.id] = p.name; });
    var tasks = (db.tasks || []).map(function (t) {
      return { id: t.id, name: t.name, projectId: t.projectId, projectName: projName[t.projectId] || "" };
    });
    chrome.storage.local.set({ tt_tasks: tasks, tt_activeProjectId: db.activeProjectId || null });
    pushToday(db, projName);
  }

  // Authoritative "today" per-task totals, computed from the app's own entries so the
  // popup shows correct time no matter where it was tracked (app or extension).
  function pushToday(db, projName) {
    var d = new Date(); d.setHours(0, 0, 0, 0);
    var since = d.getTime();
    var items = (db.entries || []).filter(function (e) { return e.date >= since; }).map(function (e) {
      var t = (db.tasks || []).filter(function (x) { return x.id === e.taskId; })[0];
      return { taskId: e.taskId, taskName: t ? t.name : "", durationSec: e.durationSec, date: e.date };
    });
    chrome.storage.local.set({ tt_today: items });
  }

  // Mirror the app's running timer into the extension so the badge + popup show it.
  function mirrorRunning(db) {
    var r = db && db.running;
    if (r && r.taskId) {
      var nm = nameOf(db, r.taskId);
      chrome.storage.local.set({ tt_running: { taskId: r.taskId, taskName: nm.task, projectName: nm.project, startedAt: r.startedAt, pausedAt: r.pausedAt || null } });
    } else {
      chrome.storage.local.set({ tt_running: null });
    }
  }

  function flushPending(db) {
    chrome.storage.local.get("tt_pending", function (o) {
      var pending = Array.isArray(o.tt_pending) ? o.tt_pending : [];
      if (!pending.length) return;
      if (!Array.isArray(db.entries)) db.entries = [];
      var have = {};
      db.entries.forEach(function (e) { have[e.id] = 1; });
      var flushedIds = {}, added = 0;
      pending.forEach(function (e) {
        flushedIds[e.id] = 1;
        var taskOk = (db.tasks || []).some(function (t) { return t.id === e.taskId; });
        if (taskOk && !have[e.id]) { db.entries.push(e); added++; }
      });
      if (added) { if (writeDb(db)) window.dispatchEvent(new CustomEvent("tt-ext-sync")); }
      chrome.storage.local.get("tt_pending", function (o2) {
        var cur = Array.isArray(o2.tt_pending) ? o2.tt_pending : [];
        chrome.storage.local.set({ tt_pending: cur.filter(function (e) { return !flushedIds[e.id]; }) });
      });
    });
  }

  // A command issued from the popup while the app is open: relay it to the app so the
  // app's own toggleTimer/pauseResume runs (single source of truth), then re-mirror.
  function applyCmd() {
    chrome.storage.local.get("tt_cmd", function (o) {
      var cmd = o.tt_cmd;
      if (!cmd || !cmd.ts || cmd.ts <= lastCmdTs) return;
      lastCmdTs = cmd.ts;
      chrome.storage.local.remove("tt_cmd");
      window.dispatchEvent(new CustomEvent("tt-ext-command", { detail: cmd }));
      setTimeout(function () { var db = readDb(); if (db) mirrorRunning(db); }, 140);
    });
  }

  function sync() {
    var db = readDb();
    if (!db || !db.projects) return;
    chrome.storage.local.set({ tt_app_open: Date.now() });
    if (!adopted) {
      adopted = true;
      // If the extension was timing while the app was closed, adopt that timer into
      // the app (preserving elapsed time) so there is one running state going forward.
      chrome.storage.local.get("tt_running", function (o) {
        var er = o.tt_running;
        if (er && er.taskId && !(db.running && db.running.taskId)) {
          db.running = { taskId: er.taskId, startedAt: er.startedAt || Date.now(), pausedAt: er.pausedAt || null };
          if (writeDb(db)) window.dispatchEvent(new CustomEvent("tt-ext-sync"));
        }
        var d2 = readDb() || db;
        pushTasks(d2); mirrorRunning(d2); flushPending(d2);
      });
    } else {
      pushTasks(db); mirrorRunning(db); flushPending(db);
    }
    applyCmd();
  }

  sync();
  setInterval(sync, 2500);

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area !== "local") return;
    if (changes.tt_cmd) applyCmd();
    if (changes.tt_pending) { var db = readDb(); if (db) flushPending(db); }
  });

  window.addEventListener("focus", function () { var db = readDb(); if (db) { pushTasks(db); mirrorRunning(db); } });
})();
