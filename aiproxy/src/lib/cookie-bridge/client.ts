/**
 * Browser bridge for extensions/multiwebllm-cookie-bridge.
 * Export format matches Cookie Editor JSON (chrome.cookies.Cookie[]).
 */

export const COOKIE_BRIDGE_PING = "MULTIWEBLLM_COOKIE_BRIDGE_PING";
export const COOKIE_BRIDGE_PONG = "MULTIWEBLLM_COOKIE_BRIDGE_PONG";

const STORAGE_KEY = "multiwebllm_cookie_bridge_id";

export interface CookieBridgeInfo {
  extensionId: string;
  version?: string;
}

export interface ChromeCookieExport {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: string;
  expirationDate?: number;
  session?: boolean;
  hostOnly?: boolean;
  storeId?: string;
}

type ChromeRuntime = {
  runtime: {
    sendMessage: (
      extensionId: string,
      message: unknown,
      responseCallback: (response: unknown) => void
    ) => void;
    lastError?: { message?: string };
  };
};

function getChrome(): ChromeRuntime | null {
  if (typeof window === "undefined") return null;
  const c = (window as unknown as { chrome?: ChromeRuntime }).chrome;
  return c?.runtime?.sendMessage ? c : null;
}

export function isChromeBrowser(): boolean {
  return typeof window !== "undefined" && /Chrome\//.test(navigator.userAgent);
}

export function discoverCookieBridge(
  timeoutMs = 2500
): Promise<CookieBridgeInfo> {
  return new Promise((resolve, reject) => {
    const cached =
      typeof sessionStorage !== "undefined"
        ? sessionStorage.getItem(STORAGE_KEY)
        : null;
    if (cached) {
      resolve({ extensionId: cached });
      return;
    }

    const timer = window.setTimeout(() => {
      window.removeEventListener("message", onMessage);
      reject(
        new Error(
          "未检测到 MultiWebLLM Cookie Bridge 扩展，请先按说明安装并启用"
        )
      );
    }, timeoutMs);

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      if (event.data?.type !== COOKIE_BRIDGE_PONG) return;
      window.clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      const extensionId = String(event.data.extensionId || "");
      if (!extensionId) {
        reject(new Error("扩展响应无效"));
        return;
      }
      sessionStorage.setItem(STORAGE_KEY, extensionId);
      resolve({
        extensionId,
        version: event.data.version ? String(event.data.version) : undefined,
      });
    };

    window.addEventListener("message", onMessage);
    window.postMessage({ type: COOKIE_BRIDGE_PING }, window.location.origin);
  });
}

export async function checkCookieBridgeInstalled(
  extensionId: string
): Promise<boolean> {
  const chromeApi = getChrome();
  if (!chromeApi) return false;

  return new Promise((resolve) => {
    chromeApi.runtime.sendMessage(
      extensionId,
      { action: "check_install" },
      (response) => {
        const err = chromeApi.runtime.lastError;
        if (err) {
          resolve(false);
          return;
        }
        resolve(Boolean((response as { ok?: boolean })?.ok));
      }
    );
  });
}

export async function exportCookiesFromBridge(
  extensionId: string,
  url: string
): Promise<ChromeCookieExport[]> {
  const chromeApi = getChrome();
  if (!chromeApi) {
    throw new Error("请使用 Chrome 浏览器并安装 Cookie Bridge 扩展");
  }

  return new Promise((resolve, reject) => {
    chromeApi.runtime.sendMessage(
      extensionId,
      { action: "export_cookies", url },
      (response) => {
        const err = chromeApi.runtime.lastError;
        if (err) {
          reject(new Error(err.message || "无法连接扩展"));
          return;
        }
        const data = response as {
          ok?: boolean;
          cookies?: ChromeCookieExport[];
          error?: string;
        };
        if (!data?.ok || !Array.isArray(data.cookies)) {
          reject(new Error(data?.error || "导出 Cookie 失败"));
          return;
        }
        resolve(data.cookies);
      }
    );
  });
}

const POPUP_FEATURES =
  "popup=yes,width=520,height=780,menubar=no,toolbar=no,location=yes,status=no,resizable=yes,scrollbars=yes";

/** 在独立小窗中打开登录页（无扩展时回退到 window.open） */
export function openAuthPopupWindow(url: string): Window | null {
  return window.open(url, "multiwebllm_auth", POPUP_FEATURES);
}

function sendBridgeMessage<T>(
  extensionId: string,
  message: unknown
): Promise<T> {
  const chromeApi = getChrome();
  if (!chromeApi) {
    return Promise.reject(new Error("chrome.runtime 不可用"));
  }
  return new Promise((resolve, reject) => {
    chromeApi.runtime.sendMessage(extensionId, message, (response) => {
      const err = chromeApi.runtime.lastError;
      if (err) {
        reject(new Error(err.message || "无法连接扩展"));
        return;
      }
      resolve(response as T);
    });
  });
}

export async function openLoginPopupViaBridge(
  extensionId: string,
  url: string
): Promise<void> {
  try {
    const response = await sendBridgeMessage<{ ok?: boolean; error?: string }>(
      extensionId,
      { action: "open_popup", url, width: 520, height: 780 }
    );
    if (!response?.ok) {
      throw new Error(response?.error || "打开登录弹窗失败");
    }
  } catch {
    openAuthPopupWindow(url);
  }
}

/** 打开登录弹窗（优先扩展 popup，否则浏览器 window.open） */
export async function openAuthLoginPopup(baseUrl: string): Promise<{
  usedExtension: boolean;
}> {
  try {
    const bridge = await discoverCookieBridge(1500);
    const installed = await checkCookieBridgeInstalled(bridge.extensionId);
    if (installed) {
      await openLoginPopupViaBridge(bridge.extensionId, baseUrl);
      return { usedExtension: true };
    }
  } catch {
    // fall through
  }
  openAuthPopupWindow(baseUrl);
  return { usedExtension: false };
}

export async function openLoginTabViaBridge(
  extensionId: string,
  url: string
): Promise<void> {
  try {
    const response = await sendBridgeMessage<{ ok?: boolean; error?: string }>(
      extensionId,
      { action: "open_tab", url, active: true }
    );
    if (!response?.ok) {
      throw new Error(response?.error || "打开标签页失败");
    }
  } catch {
    openAuthPopupWindow(url);
  }
}

/** 发现扩展 → 导出 → 返回 JSON 字符串（Cookie Editor 兼容） */
export async function fetchCookieJsonForUrl(
  baseUrl: string
): Promise<{ json: string; extensionId: string; count: number }> {
  const bridge = await discoverCookieBridge();
  const installed = await checkCookieBridgeInstalled(bridge.extensionId);
  if (!installed) {
    throw new Error("Cookie Bridge 扩展未响应，请在 chrome://extensions 中启用");
  }
  const cookies = await exportCookiesFromBridge(bridge.extensionId, baseUrl);
  return {
    json: JSON.stringify(cookies),
    extensionId: bridge.extensionId,
    count: cookies.length,
  };
}

export const EXTENSION_INSTALL_PATH =
  "extensions/multiwebllm-cookie-bridge";
