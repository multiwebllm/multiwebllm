import { NextRequest, NextResponse } from "next/server";
import { validateAdmin } from "@/lib/auth";
import {
  readSettings,
  writeSettings,
  sanitizeSettingsForClient,
} from "@/lib/settings";

export async function GET(request: NextRequest) {
  if (!(await validateAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const settings = await readSettings();
  return NextResponse.json(sanitizeSettingsForClient(settings));
}

export async function POST(request: NextRequest) {
  if (!(await validateAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    action: string;
    currentPassword?: string;
    newPassword?: string;
    settings?: Record<string, unknown>;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.action === "change_password") {
    if (!body.currentPassword || !body.newPassword) {
      return NextResponse.json(
        { error: "Both currentPassword and newPassword are required" },
        { status: 400 }
      );
    }

    const adminPassword = process.env.ADMIN_PASSWORD;
    if (body.currentPassword !== adminPassword) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 401 }
      );
    }

    const settings = await readSettings();
    settings.adminPasswordOverride = body.newPassword;
    await writeSettings(settings);

    return NextResponse.json({
      success: true,
      message: "Password updated. Please update your ADMIN_PASSWORD environment variable.",
    });
  }

  if (body.action === "update_settings") {
    if (!body.settings) {
      return NextResponse.json(
        { error: "Settings object is required" },
        { status: 400 }
      );
    }

    const currentSettings = await readSettings();

    const merged = { ...currentSettings, ...body.settings };

    if ("telegram_bot_token" in body.settings) {
      const token = String(body.settings.telegram_bot_token ?? "").trim();
      if (token) {
        merged.telegram_bot_token = token;
      } else {
        merged.telegram_bot_token = currentSettings.telegram_bot_token;
      }
    }

    await writeSettings(merged);

    return NextResponse.json({
      success: true,
      settings: sanitizeSettingsForClient(merged),
    });
  }

  if (body.action === "get_settings") {
    const settings = await readSettings();
    return NextResponse.json(sanitizeSettingsForClient(settings));
  }

  return NextResponse.json(
    { error: "Unknown action. Use: change_password, update_settings, get_settings" },
    { status: 400 }
  );
}
