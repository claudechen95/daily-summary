// background.js — Service worker. Receives captured pages and forwards to local server.
// Falls back to chrome.storage.local if the server is not running.

const SERVER_URL  = 'http://localhost:7823/capture';
const TIME_URL    = 'http://localhost:7823/time';
const STORAGE_KEY = 'captured_pages';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'PAGE_CAPTURED') {
    saveCapture(message.data);
    sendResponse({ ok: true });
    return true;
  }
  if (message.type === 'TIME_RECORD') {
    saveTimeRecord(message.data);
    sendResponse({ ok: true });
    return true;
  }
});

async function saveCapture(data) {
  // Try local server first (fast path)
  try {
    const res = await fetch(SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.ok) return; // done
  } catch (_) {
    // Server not running — fall back to chrome.storage
  }

  // Fallback: accumulate in chrome.storage.local
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const pages  = stored[STORAGE_KEY] || [];
  pages.push(data);
  // Keep only last 2000 entries to avoid unbounded growth
  if (pages.length > 2000) pages.splice(0, pages.length - 2000);
  await chrome.storage.local.set({ [STORAGE_KEY]: pages });
}

async function saveTimeRecord(data) {
  try {
    await fetch(TIME_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  } catch (_) {
    // server not running — time data is best-effort, discard silently
  }
}
