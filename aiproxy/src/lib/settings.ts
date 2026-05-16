import { promises as fs } from "fs";
import path from "path";

const SETTINGS_FILE = path.join(process.cwd(), "settings.json");

export interface AppSettings {
  rate_limit?: number;
  quota_threshold?: number;
  admin_username?: string;
  twoFactorEnabled?: boolean;
  telegram_enabled?: boolean;
  telegram_bot_token?: string;
  telegram_chat_id?: string;
  health_check_interval_days?: number;
  cookie_relogin_remind_days?: number;
  last_health_check_at?: string | null;
  last_health_check_summary?: HealthCheckSummary | null;
}

export interface HealthCheckSummary {
  checkedAt: string;
  intervalDays: number;
  total: number;
  ok: number;
  failed: number;
  stale: number;
  results: Array<{
    id: number;
    name: string;
    slug: string;
    ok: boolean;
    message: string;
    authAgeDays: number | null;
    needsRelogin: boolean;
  }>;
}

export async function readSettings(): Promise<Record<string, unknown>> {
  try {
    const data = await fs.readFile(SETTINGS_FILE, "utf-8");
    return JSON.parse(data) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function writeSettings(settings: Record<string, unknown>) {
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf-8");
}

export function getHealthCheckIntervalDays(settings: Record<string, unknown>): number {
  const n = Number(settings.health_check_interval_days);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 7;
}

export function getCookieReloginRemindDays(settings: Record<string, unknown>): number {
  const n = Number(settings.cookie_relogin_remind_days);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 7;
}

export function maskTelegramToken(token?: string): string {
  if (!token) return "";
  if (token.length <= 8) return "****";
  return `${token.slice(0, 4)}…${token.slice(-4)}`;
}

export function sanitizeSettingsForClient(
  settings: Record<string, unknown>
): Record<string, unknown> {
  const {
    adminPasswordOverride,
    twoFactorSecret,
    twoFactorPendingSecret,
    telegram_bot_token,
    ...rest
  } = settings;

  return {
    ...rest,
    telegram_bot_token_set: Boolean(
      typeof telegram_bot_token === "string" && telegram_bot_token.length > 0
    ),
    telegram_bot_token_masked: maskTelegramToken(
      typeof telegram_bot_token === "string" ? telegram_bot_token : undefined
    ),
  };
}
