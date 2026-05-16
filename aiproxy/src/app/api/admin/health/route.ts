import { NextRequest, NextResponse } from "next/server";
import { validateAdmin } from "@/lib/auth";
import {
  readSettings,
  writeSettings,
  sanitizeSettingsForClient,
  getCookieReloginRemindDays,
  getHealthCheckIntervalDays,
} from "@/lib/settings";
import {
  runAllProvidersHealthCheck,
  formatHealthReportForTelegram,
} from "@/lib/provider-health";
import { sendTelegramMessage } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await validateAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await readSettings();
  const intervalDays = getHealthCheckIntervalDays(settings);
  const lastAt = settings.last_health_check_at
    ? new Date(String(settings.last_health_check_at)).getTime()
    : 0;
  const due =
    !lastAt ||
    Date.now() - lastAt >= intervalDays * 24 * 60 * 60 * 1000;

  return NextResponse.json({
    intervalDays,
    reloginRemindDays: getCookieReloginRemindDays(settings),
    lastHealthCheckAt: settings.last_health_check_at ?? null,
    lastSummary: settings.last_health_check_summary ?? null,
    due,
    telegramConfigured: Boolean(
      settings.telegram_enabled &&
        settings.telegram_bot_token &&
        settings.telegram_chat_id
    ),
  });
}

export async function POST(request: NextRequest) {
  if (!(await validateAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { notify?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    // empty body ok
  }

  const settings = await readSettings();
  const reloginRemindDays = getCookieReloginRemindDays(settings);
  const intervalDays = getHealthCheckIntervalDays(settings);

  const summary = await runAllProvidersHealthCheck({
    reloginRemindDays,
  });
  summary.intervalDays = intervalDays;

  let telegramSent = false;
  let telegramError: string | undefined;

  if (body.notify !== false && settings.telegram_enabled) {
    const token = String(settings.telegram_bot_token || "");
    const chatId = String(settings.telegram_chat_id || "");
    if (token && chatId) {
      const appName = process.env.NEXT_PUBLIC_APP_NAME || "MultiWebLLM";
      const text = formatHealthReportForTelegram(summary, appName);
      const sent = await sendTelegramMessage(token, chatId, text);
      telegramSent = sent.ok;
      telegramError = sent.error;
    }
  }

  await writeSettings({
    ...settings,
    last_health_check_at: summary.checkedAt,
    last_health_check_summary: summary,
  });

  return NextResponse.json({
    summary,
    telegramSent,
    telegramError,
  });
}
