// TimeTrack Timer — background service worker (MV3).
// Owns the running timer, the toolbar badge, and the keyboard shortcut.
// It records tracked time into chrome.storage; the content script flushes it
// into the TimeTrack app's localStorage whenever the app page is open.

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

function badgeText(sec) {
  const m = Math.floor(sec / 60);
  if (m < 1) return "•"; // dot for the first minute
  if (m < 60) return m + "m";
  const h = Math.floor(m / 60);
  return h + "h";
}

async function updateBadge() {
  const r = await getRunning();
  if (!r) {
    chrome.action.setBadgeText({ text: "" });
    return;
  }
  const sec = (Date.now() - r.startedAt) / 1000;
  chrome.action.setBadgeText({ text: badgeText(sec) });
  chrome.action.setBadgeBackgroundColor({ color: "#3b82f6" });
}

async function startTimer(taskId, taskName, projectName) {
  if (!taskId) return;
  const prev = await getRunning();
  if (prev) await stopTimer(); // one timer at a time
  await chrome.storage.local.set({
    tt_running: { taskId, taskName: taskName || "", projectName: projectName || "", startedAt: Date.now() },
    tt_last: { taskId, taskName: taskName || "", projectName: projectName || "" }
  });
  chrome.alarms.create(TICK_ALARM, { periodInMinutes: 1 });
  await updateBadge();
}

async function stopTimer() {
  const r = await getRunning();
  if (!r) return;
  const durationSec = Math.max(1, Math.round((Date.now() - r.startedAt) / 1000));
  const entry = {
    id: uid(),
    taskId: r.taskId,
    durationSec: durationSec,
    date: Date.now(),
    note: "",
    manual: false,
    source: "ext"
  };
  const pending = await getPending();
  pending.push(entry);
  // Keep a local "today" log for the popup (survives flush into the app).
  const today = (await get("tt_today")) || [];
  today.push({ taskId: r.taskId, taskName: r.taskName || "", durationSec: durationSec, date: entry.date });
  await chrome.storage.local.set({ tt_pending: pending, tt_running: null, tt_today: today.slice(-100) });
  chrome.alarms.clear(TICK_ALARM);
  chrome.action.setBadgeText({ text: "" });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg && msg.type === "start") {
      await startTimer(msg.taskId, msg.taskName, msg.projectName);
      sendResponse({ ok: true });
    } else if (msg && msg.type === "stop") {
      await stopTimer();
      sendResponse({ ok: true });
    } else if (msg && msg.type === "state") {
      sendResponse({ running: await getRunning(), pending: await getPending() });
    } else {
      sendResponse({ ok: false });
    }
  })();
  return true; // keep the channel open for the async response
});

chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === TICK_ALARM) updateBadge();
});

chrome.commands.onCommand.addListener(async (cmd) => {
  if (cmd !== "toggle-timer") return;
  const r = await getRunning();
  if (r) {
    await stopTimer();
  } else {
    const last = await get("tt_last");
    if (last && last.taskId) await startTimer(last.taskId, last.taskName, last.projectName);
  }
});

chrome.runtime.onStartup.addListener(updateBadge);
chrome.runtime.onInstalled.addListener(updateBadge);
