// content.js — Captures page content for daily activity summaries.
// Runs on every page after it loads. Sends text to background.js → local server.

(function () {
  // Skip these domains (sensitive / login pages / internal)
  const BLOCKED = [
    'accounts.google.com', 'login.', 'signin.', 'auth.',
    'paypal.com', 'chase.com', 'wellsfargo.com', 'bankofamerica.com',
    'healthcare.gov', 'myhealth', 'patient'
  ];

  const hostname = location.hostname;
  if (BLOCKED.some(b => hostname.includes(b))) return;
  if (location.protocol === 'chrome-extension:' || location.protocol === 'chrome:') return;

  // --- Extraction helpers ---

  function extractClaude() {
    // Wait until conversation turns are in the DOM, then grab them.
    // claude.ai uses data-testid attributes on message containers.
    const humanSels  = ['[data-testid="user-message"]', '.human-turn p', '[class*="HumanTurn"] p'];
    const assistSels = ['[data-testid="assistant-message"]', '.assistant-turn p', '[class*="AssistantTurn"] p'];

    function queryAll(sels) {
      for (const sel of sels) {
        const els = document.querySelectorAll(sel);
        if (els.length) return Array.from(els);
      }
      return [];
    }

    const humanEls  = queryAll(humanSels);
    const assistEls = queryAll(assistSels);

    if (!humanEls.length && !assistEls.length) return extractGeneric(); // fallback

    const turns = [];

    // Interleave by DOM order
    const all = [...humanEls.map(el => ({ role: 'You', el })),
                 ...assistEls.map(el => ({ role: 'Claude', el }))];
    all.sort((a, b) => a.el.compareDocumentPosition(b.el) & 4 ? -1 : 1);

    for (const { role, el } of all) {
      const text = el.innerText.trim();
      if (text) turns.push(`${role}: ${text.slice(0, 2000)}`);
    }

    return turns.join('\n\n').slice(0, 10000);
  }

  function extractGeneric() {
    // Remove noise elements, grab remaining text
    const noiseSelectors = 'nav, header, footer, script, style, aside, [role="banner"], [role="navigation"]';
    const root = document.querySelector('main, article, [role="main"]') || document.body;
    const clone = root.cloneNode(true);
    clone.querySelectorAll(noiseSelectors).forEach(el => el.remove());
    return clone.innerText.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, 8000);
  }

  // --- Main capture logic ---

  function capture() {
    let content = '';

    if (hostname === 'claude.ai') {
      content = extractClaude();
    } else {
      content = extractGeneric();
    }

    if (!content || content.length < 80) return; // skip empty / trivial pages

    chrome.runtime.sendMessage({
      type: 'PAGE_CAPTURED',
      data: {
        url:       location.href,
        title:     document.title,
        domain:    hostname,
        content,
        timestamp: new Date().toISOString()
      }
    });
  }

  // --- Foreground time tracking ---
  // Uses Page Visibility API: only the visible tab accumulates time,
  // so the total across all tabs can't exceed real wall-clock hours.

  let visibleSince = document.visibilityState === 'visible' ? Date.now() : null;
  let pendingMs = 0;

  function flush() {
    if (visibleSince !== null) {
      pendingMs += Date.now() - visibleSince;
      visibleSince = Date.now(); // reset so flush is idempotent
    }
    if (pendingMs < 1000) return; // ignore sub-second visits
    chrome.runtime.sendMessage({
      type: 'TIME_RECORD',
      data: { domain: hostname, active_ms: pendingMs, timestamp: new Date().toISOString() }
    });
    pendingMs = 0;
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      if (visibleSince !== null) { pendingMs += Date.now() - visibleSince; visibleSince = null; }
      flush();
    } else {
      visibleSince = Date.now();
    }
  });

  // Flush every 5 min so long sessions aren't lost to crashes
  setInterval(flush, 5 * 60 * 1000);

  // Flush on unload (best-effort; may be blocked in some browsers)
  window.addEventListener('pagehide', flush);

  // --- Run once after initial load
  let captured = false;
  function runOnce() {
    if (captured) return;
    captured = true;
    // Small delay so SPAs finish rendering
    setTimeout(capture, hostname === 'claude.ai' ? 4000 : 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runOnce);
  } else {
    runOnce();
  }

  // Re-capture on SPA URL changes (e.g. navigating between Claude conversations)
  let lastUrl = location.href;
  const observer = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      captured = false;
      runOnce();
    }
  });
  observer.observe(document.documentElement, { subtree: true, childList: true });
})();
