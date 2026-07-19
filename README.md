# TimeTrack + Estimates

Offline time tracker, client estimates and invoices for freelancers — a single
self-contained web app. **All data stays in your browser** (localStorage). No
account, no server, works fully offline.

- **App:** `index.html` (also installable as a PWA — offline via `sw.js`).
- **Chrome extension:** `extension/` — a companion timer you can start/stop from
  any page; tracked time syncs back into the app automatically.

## Use it

Open the hosted app, or download `index.html` and open it locally. Your projects,
time entries and estimates are saved on your device only.

## Companion timer (Chrome extension)

See [`extension/README.md`](extension/README.md). Install from the Chrome Web
Store (one click), then the timer syncs your tracked time into the app while it is
open in a tab.

## Tech

Plain HTML + CSS + vanilla JavaScript. No build step, no dependencies. OKLCH color
system, `@media print` estimate/invoice templates, service-worker offline cache.
