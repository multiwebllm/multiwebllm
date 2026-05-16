/* global chrome */

/**
 * Lets the dashboard discover this extension's ID without manual configuration.
 */
const PING = "MULTIWEBLLM_COOKIE_BRIDGE_PING";
const PONG = "MULTIWEBLLM_COOKIE_BRIDGE_PONG";

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (event.data?.type !== PING) return;

  window.postMessage(
    {
      type: PONG,
      extensionId: chrome.runtime.id,
      version: chrome.runtime.getManifest().version,
    },
    window.location.origin
  );
});
