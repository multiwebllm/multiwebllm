import { NextRequest, NextResponse } from "next/server";
import { validateAdmin } from "@/lib/auth";
import { promises as fs } from "fs";
import path from "path";

const SETTINGS_FILE = path.join(process.cwd(), "settings.json");

async function readSettings(): Promise<Record<string, unknown>> {
  try {
    const data = await fs.readFile(SETTINGS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function writeSettings(settings: Record<string, unknown>) {
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf-8");
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

    // Store the new password in settings file
    // Note: In production, you would update the env var or use a more secure method
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
    const updatedSettings = { ...currentSettings, ...body.settings };
    await writeSettings(updatedSettings);

    return NextResponse.json({
      success: true,
      settings: updatedSettings,
    });
  }

  if (body.action === "get_settings") {
    const settings = await readSettings();
    // Remove sensitive fields
    const { adminPasswordOverride, ...safeSettings } = settings;
    return NextResponse.json(safeSettings);
  }

  return NextResponse.json(
    { error: "Unknown action. Use: change_password, update_settings, get_settings" },
    { status: 400 }
  );
}
