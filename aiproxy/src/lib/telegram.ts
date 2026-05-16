export interface TelegramSendResult {
  ok: boolean;
  error?: string;
}

export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string,
  parseMode: "HTML" | "Markdown" = "HTML"
): Promise<TelegramSendResult> {
  const token = botToken.trim();
  const chat = chatId.trim();
  if (!token || !chat) {
    return { ok: false, error: "Telegram Bot Token 或 Chat ID 未配置" };
  }

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chat,
          text: text.slice(0, 4096),
          parse_mode: parseMode,
          disable_web_page_preview: true,
        }),
      }
    );

    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      description?: string;
    };

    if (!res.ok || !data.ok) {
      return {
        ok: false,
        error: data.description || `Telegram API HTTP ${res.status}`,
      };
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "发送 Telegram 失败",
    };
  }
}

export function escapeTelegramHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
