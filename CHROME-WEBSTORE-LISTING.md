# Chrome Web Store — listing copy (paste into the dashboard)

Upload file: **`timetrack-timer-extension.zip`** (built from `extension/`).
Developer console: https://chrome.google.com/webstore/devconsole (one-time $5 fee).

---

## Store listing

**Name:** TimeTrack Timer

**Summary (132 chars max):**
Start and stop a task timer from any page. Tracked time syncs into your TimeTrack + Estimates app. Offline, private, no account.

**Category:** Workflow & Planning

**Language:** English

**Description:**
TimeTrack Timer is the companion timer for the TimeTrack + Estimates app for freelancers.

Track a task without switching back to the app:
• Start or stop the timer from ANY page — Gmail, Docs, Figma, anywhere.
• See elapsed time right on the toolbar icon.
• Tracked time syncs into your TimeTrack app automatically the moment it is open in a tab.
• Keyboard shortcut (⌘⇧Y / Ctrl+Shift+Y) to start/stop from anywhere.

Private by design:
• 100% offline. No account, no server, no analytics.
• Your data stays in your browser and on your device — nothing is sent anywhere.

Requires the TimeTrack + Estimates app (a free companion web app / downloadable file).

---

## Privacy

**Single purpose:**
A companion timer that tracks time for a task and writes it into the user's own TimeTrack + Estimates app.

**Permission justifications:**
- **storage** — remember the running timer and tracked time between browser sessions.
- **alarms** — refresh the elapsed-time badge on the toolbar icon once a minute while a timer runs.
- **Host access (the TimeTrack app page)** — write tracked time into the app the user has open. The content script only runs on the user's TimeTrack app page (identified by a meta tag) and does not read any other site.

**Data usage:** No user data is collected or transmitted. Everything is stored locally (chrome.storage / localStorage).

**Privacy policy URL:** https://viktoriiatyrous.github.io/timetrack/privacy.html

---

## Assets still needed before submitting
- [ ] Icon 128×128 — already in `extension/icons/icon128.png`.
- [ ] At least 1 screenshot 1280×800 or 640×400 (popup + a page with the badge). Take after installing.
- [ ] Small promo tile 440×280 (optional but recommended).
