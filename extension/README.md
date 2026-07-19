# TimeTrack Timer — Chrome extension

A companion timer for the **TimeTrack + Estimates** app. Start and stop a task
timer from **any page** (Gmail, Docs, Figma, anywhere). Tracked time syncs into
the app automatically. Fully offline, no account, no server.

## How it works

- The extension times a task in the background and shows the elapsed time on the
  toolbar icon (badge).
- Time is stored inside the extension (`chrome.storage`).
- Whenever the **TimeTrack app page is open in a tab**, a content script writes
  the tracked entries into the app's storage and the app updates live.
- If the app is closed, time is buffered in the extension and syncs the next time
  you open the app.

## Install (unpacked, for testing / personal use)

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked** and select this `extension/` folder.
4. The TimeTrack Timer icon appears in the toolbar (pin it for quick access).

### Enable syncing with the downloaded HTML file

The app is a local `.html` file (a `file://` page). Chrome blocks extensions from
`file://` pages by default, so enable it once:

1. `chrome://extensions` → **TimeTrack Timer** → **Details**.
2. Turn on **Allow access to file URLs**.

Now open your TimeTrack `index.html` in a tab at least once so the extension can
read your task list and push tracked time back in.

> Hosting the app instead of using a file? Add your URL to `content_scripts.matches`
> in `manifest.json` (e.g. `"https://yourdomain.com/*"`).

## Use

1. Click the toolbar icon → pick a task → **Start timer**.
2. Work on any page. The icon badge shows elapsed time.
3. Click the icon → **Stop** (or press the shortcut) to record the time.
4. Open the TimeTrack app — the time appears in that task.

**Keyboard shortcut:** `⌘⇧Y` (Mac) / `Ctrl+Shift+Y` (Win/Linux) starts/stops the
last task from anywhere, without opening the popup. Change it at
`chrome://extensions/shortcuts`.

## Files

| File | Role |
|------|------|
| `manifest.json` | Extension config (MV3) |
| `background.js` | Service worker: timer, toolbar badge, shortcut |
| `content.js` | Runs on the TimeTrack page; syncs time in |
| `popup.html` / `popup.js` | Toolbar popup UI |
| `icons/` | Toolbar icons |

## Publishing to the Chrome Web Store

Zip the contents of this folder and upload at
<https://chrome.google.com/webstore/devconsole> (one-time \$5 developer fee).
Keep `manifest.json` at the root of the zip.
