/* global chrome */

/**
 * Cookie export API aligned with Cookie Editor JSON export (chrome.cookies.getAll).
 * @see https://github.com/buigiathanh/Cookie_Editor
 */

async function exportCookiesForUrl(url) {
  if (!url || typeof url !== "string") {
    throw new Error("url is required");
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("invalid url");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("url must be http or https");
  }
  const cookies = await chrome.cookies.getAll({ url: parsed.href });
  return cookies;
}

chrome.runtime.onMessageExternal.addListener((request, _sender, sendResponse) => {
  (async () => {
    try {
      switch (request?.action) {
        case "check_install":
          sendResponse({
            ok: true,
            version: chrome.runtime.getManifest().version,
            name: chrome.runtime.getManifest().name,
          });
          return;

        case "export_cookies": {
          const cookies = await exportCookiesForUrl(request.url);
          sendResponse({ ok: true, cookies, url: request.url });
          return;
        }

        case "open_tab": {
          const tab = await chrome.tabs.create({
            url: request.url,
            active: request.active !== false,
          });
          sendResponse({ ok: true, tabId: tab.id });
          return;
        }

        case "open_popup": {
          const width = Math.min(request.width || 520, 900);
          const height = Math.min(request.height || 780, 1000);
          const win = await chrome.windows.create({
            url: request.url,
            type: "popup",
            width,
            height,
            focused: true,
          });
          sendResponse({ ok: true, windowId: win.id });
          return;
        }

        default:
          sendResponse({ ok: false, error: "unknown action" });
      }
    } catch (err) {
      sendResponse({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  })();
  return true;
});
