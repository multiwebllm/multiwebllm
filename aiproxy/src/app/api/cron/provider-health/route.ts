import { NextRequest, NextResponse } from "next/server";
import {
  readSettings,
  writeSettings,
  getHealthCheckIntervalDays,
  getCookieReloginRemindDays,
} from "@/lib/settings";
import {
  runAllProvidersHealthCheck,
  formatHealthReportForTelegram,
} from "@/lib/provider-health";
import { sendTelegramMessage } from "@/lib/telegram";

export const dynamic = "force-dynamic";

function authorizeCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const q = request.nextUrl.searchParams.get("secret");
  return q === secret;
}

export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const force = request.nextUrl.searchParams.get("force") === "1";
  const settings = await readSettings();
  const intervalDays = getHealthCheckIntervalDays(settings);
  const reloginRemindDays = getCookieReloginRemindDays(settings);

  const lastAt = settings.last_health_check_at
    ? new Date(String(settings.last_health_check_at)).getTime()
    : 0;

  if (
    !force &&
    lastAt > 0 &&
    Date.now() - lastAt < intervalDays * 24 * 60 * 60 * 1000
  ) {
    return NextResponse.json({
      skipped: true,
      message: `距上次巡检未满 ${intervalDays} 天`,
      lastHealthCheckAt: settings.last_health_check_at,
      nextDueAt: new Date(
        lastAt + intervalDays * 24 * 60 * 60 * 1000
      ).toISOString(),
    });
  }

  const summary = await runAllProvidersHealthCheck({
    reloginRemindDays: reloginRemindDays,
  });
  summary.intervalDays = intervalDays;

  const appName = process.env.NEXT_PUBLIC_APP_NAME || "MultiWebLLM";
  let telegramSent = false;
  let telegramError: string | undefined;

  if (settings.telegram_enabled) {
    const token = String(settings.telegram_bot_token || "");
    const chatId = String(settings.telegram_chat_id || "");
    if (token && chatId) {
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
    skipped: false,
    summary,
    telegramSent,
    telegramError,
  });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
