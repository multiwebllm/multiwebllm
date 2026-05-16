import { NextRequest, NextResponse } from "next/server";
import { validateAdmin } from "@/lib/auth";
import { readSettings } from "@/lib/settings";
import { sendTelegramMessage } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!(await validateAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await readSettings();
  const token = String(settings.telegram_bot_token || "");
  const chatId = String(settings.telegram_chat_id || "");

  if (!token || !chatId) {
    return NextResponse.json(
      { ok: false, error: "请先保存 Bot Token 与 Chat ID" },
      { status: 400 }
    );
  }

  const appName = process.env.NEXT_PUBLIC_APP_NAME || "MultiWebLLM";
  const result = await sendTelegramMessage(
    token,
    chatId,
    `✅ <b>${appName}</b> Telegram 通知测试成功。\n自用订阅巡检将按设定周期推送。`
  );

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
