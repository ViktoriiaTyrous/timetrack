// TimeTrack Timer — content script.
// Runs only on the TimeTrack app page (detected via the <meta name="timetrack-app">
// marker). It mirrors the app's task list into the extension so the popup can list
// tasks, and flushes extension-recorded time entries into the app's localStorage,
// then tells the running app to reload via the "tt-ext-sync" event.

(function () {
  var marker = document.querySelector('meta[name="timetrack-app"]');
  if (!marker) return;
  var keyMeta = document.querySelector('meta[name="timetrack-storage-key"]');
  var KEY = (keyMeta && keyMeta.content) || "timetrack_v1";

  function readDb() {
    try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { return null; }
  }
  function writeDb(db) {
    try { localStorage.setItem(KEY, JSON.stringify(db)); return true; } catch (e) { return false; }
  }

  function pushTasks() {
    var db = readDb();
    if (!db || !db.projects) return;
    var projName = {};
    (db.projects || []).forEach(function (p) { projName[p.id] = p.name; });
    var tasks = (db.tasks || []).map(function (t) {
      return { id: t.id, name: t.name, projectId: t.projectId, projectName: projName[t.projectId] || "" };
    });
    chrome.storage.local.set({ tt_tasks: tasks, tt_activeProjectId: db.activeProjectId || null });
  }

  function flushPending() {
    chrome.storage.local.get("tt_pending", function (o) {
      var pending = Array.isArray(o.tt_pending) ? o.tt_pending : [];
      if (!pending.length) return;
      var db = readDb();
      if (!db || !db.projects) return;
      if (!Array.isArray(db.entries)) db.entries = [];
      var have = {};
      db.entries.forEach(function (e) { have[e.id] = 1; });
      var flushedIds = {};
      var added = 0;
      pending.forEach(function (e) {
        flushedIds[e.id] = 1;
        // only entries whose task still exists in the app
        var taskOk = (db.tasks || []).some(function (t) { return t.id === e.taskId; });
        if (taskOk && !have[e.id]) { db.entries.push(e); added++; }
      });
      if (added) {
        if (writeDb(db)) window.dispatchEvent(new CustomEvent("tt-ext-sync"));
      }
      // remove only the entries we just handled (avoid clobbering ones added meanwhile)
      chrome.storage.local.get("tt_pending", function (o2) {
        var cur = Array.isArray(o2.tt_pending) ? o2.tt_pending : [];
        var remain = cur.filter(function (e) { return !flushedIds[e.id]; });
        chrome.storage.local.set({ tt_pending: remain });
      });
    });
  }

  function syncAll() { pushTasks(); flushPending(); }

  syncAll();
  setInterval(syncAll, 5000);

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area === "local" && changes.tt_pending) flushPending();
  });

  // Re-mirror tasks when the user comes back to the app tab (they may have edited tasks).
  window.addEventListener("focus", pushTasks);
})();
