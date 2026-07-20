// TimeTrack Timer — background service worker (MV3).
// Owns the timer ONLY while the TimeTrack app tab is closed (offline mode). While the
// app is open (a fresh tt_app_open heartbeat from the content script), start/stop/pause
// are relayed to the app as commands so both share a single running state.

const TICK_ALARM = "tt-tick";

function uid() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
}

async function get(key) {
  const o = await chrome.storage.local.get(key);
  return o[key];
}

async function getRunning() {
  return (await get("tt_running")) || null;
}

async function getPending() {
  const p = await get("tt_pending");
  return Array.isArray(p) ? p : [];
}

// The app tab is considered open if the content script pinged within the last 8s.
async function appOpen() {
  const t = await get("tt_app_open");
  return !!t && Date.now() - t < 8000;
}

async function issueCmd(action, taskId, taskName, projectName) {
  await chrome.storage.local.set({
    tt_cmd: { action, taskId: taskId || null, taskName: taskName || "", projectName: projectName || "", ts: Date.now() }
  });
  if (taskId) await chrome.storage.local.set({ tt_last: { taskId, taskName: taskName || "", projectName: projectName || "" } });
}

function elapsedSec(r) {
  const base = r.pausedAt || Date.now();
  return (base - r.startedAt) / 1000;
}

function badgeText(sec) {
  const m = Math.floor(sec / 60);
  if (m < 1) return "•"; // dot for the first minute
  if (m < 60) return m + "m";
  return Math.floor(m / 60) + "h";
}

async function updateBadge() {
  const r = await getRunning();
  if (!r) { chrome.action.setBadgeText({ text: "" }); return; }
  chrome.action.setBadgeText({ text: badgeText(elapsedSec(r)) });
  chrome.action.setBadgeBackgroundColor({ color: r.pausedAt ? "#8a8f98" : "#3b82f6" });
}

// ---- offline (app closed) standalone timer ----
async function startLocal(taskId, taskName, projectName) {
  if (!taskId) return;
  if (await getRunning()) await stopLocal();
  await chrome.storage.local.set({
    tt_running: { taskId, taskName: taskName || "", projectName: projectName || "", startedAt: Date.now(), pausedAt: null },
    tt_last: { taskId, taskName: taskName || "", projectName: projectName || "" }
  });
  chrome.alarms.create(TICK_ALARM, { periodInMinutes: 1 });
  await updateBadge();
}

async function stopLocal() {
  const r = await getRunning();
  if (!r) return;
  const durationSec = Math.max(1, Math.round(elapsedSec(r)));
  const entry = { id: uid(), taskId: r.taskId, durationSec, date: Date.now(), note: "", manual: false, source: "ext" };
  const pending = await getPending();
  pending.push(entry);
  const today = (await get("tt_today")) || [];
  today.push({ taskId: r.taskId, taskName: r.taskName || "", durationSec, date: entry.date });
  await chrome.storage.local.set({ tt_pending: pending, tt_running: null, tt_today: today.slice(-100) });
  chrome.alarms.clear(TICK_ALARM);
  chrome.action.setBadgeText({ text: "" });
}

async function pauseLocal() {
  const r = await getRunning();
  if (!r || r.pausedAt) return;
  r.pausedAt = Date.now();
  await chrome.storage.local.set({ tt_running: r });
  await updateBadge();
}

async function resumeLocal() {
  const r = await getRunning();
  if (!r || !r.pausedAt) return;
  r.startedAt += Date.now() - r.pausedAt;
  r.pausedAt = null;
  await chrome.storage.local.set({ tt_running: r });
  await updateBadge();
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    const open = await appOpen();
    if (msg && msg.type === "start") {
      if (open) await issueCmd("start", msg.taskId, msg.taskName, msg.projectName);
      else await startLocal(msg.taskId, msg.taskName, msg.projectName);
      sendResponse({ ok: true });
    } else if (msg && msg.type === "stop") {
      if (open) await issueCmd("stop");
      else await stopLocal();
      sendResponse({ ok: true });
    } else if (msg && msg.type === "pause") {
      if (open) await issueCmd("pause");
      else await pauseLocal();
      sendResponse({ ok: true });
    } else if (msg && msg.type === "resume") {
      if (open) await issueCmd("resume");
      else await resumeLocal();
      sendResponse({ ok: true });
    } else if (msg && msg.type === "state") {
      sendResponse({ running: await getRunning(), pending: await getPending() });
    } else {
      sendResponse({ ok: false });
    }
  })();
  return true; // async response
});

chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === TICK_ALARM) updateBadge();
});

chrome.commands.onCommand.addListener(async (cmd) => {
  if (cmd !== "toggle-timer") return;
  const open = await appOpen();
  const r = await getRunning();
  if (r) {
    if (open) await issueCmd("stop"); else await stopLocal();
  } else {
    const last = await get("tt_last");
    if (last && last.taskId) {
      if (open) await issueCmd("start", last.taskId, last.taskName, last.projectName);
      else await startLocal(last.taskId, last.taskName, last.projectName);
    }
  }
});

chrome.runtime.onStartup.addListener(updateBadge);
chrome.runtime.onInstalled.addListener(updateBadge);
