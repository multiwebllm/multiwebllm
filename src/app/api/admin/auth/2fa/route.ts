import { NextRequest, NextResponse } from "next/server";
import { validateAdmin } from "@/lib/auth";
import { authenticator } from "@otplib/preset-default";
import QRCode from "qrcode";
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

export async function GET(request: NextRequest) {
  if (!(await validateAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await readSettings();

  return NextResponse.json({
    enabled: !!settings.twoFactorEnabled,
    configured: !!settings.twoFactorSecret,
  });
}

export async function POST(request: NextRequest) {
  if (!(await validateAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { action: string; code?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const settings = await readSettings();

  // 生成 2FA 密钥和二维码
  if (body.action === "setup") {
    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri("admin", "MultiWebLLM", secret);

    // 生成二维码 data URL
    const qrDataUrl = await QRCode.toDataURL(otpauth);

    // 临时保存 secret（未激活）
    settings.twoFactorPendingSecret = secret;
    await writeSettings(settings);

    return NextResponse.json({
      secret,
      qrCode: qrDataUrl,
      otpauth,
    });
  }

  // 验证并激活 2FA
  if (body.action === "verify_and_enable") {
    if (!body.code) {
      return NextResponse.json({ error: "验证码不能为空" }, { status: 400 });
    }

    const pendingSecret = settings.twoFactorPendingSecret as string;
    if (!pendingSecret) {
      return NextResponse.json(
        { error: "请先生成 2FA 密钥" },
        { status: 400 }
      );
    }

    const isValid = authenticator.verify({
      token: body.code,
      secret: pendingSecret,
    });

    if (!isValid) {
      return NextResponse.json(
        { error: "验证码错误，请重试" },
        { status: 400 }
      );
    }

    // 激活 2FA
    settings.twoFactorSecret = pendingSecret;
    settings.twoFactorEnabled = true;
    delete settings.twoFactorPendingSecret;
    await writeSettings(settings);

    return NextResponse.json({ success: true, message: "2FA 已启用" });
  }

  // 关闭 2FA
  if (body.action === "disable") {
    if (!body.code && settings.twoFactorEnabled) {
      return NextResponse.json(
        { error: "关闭 2FA 需要验证码" },
        { status: 400 }
      );
    }

    if (settings.twoFactorEnabled && settings.twoFactorSecret) {
      const isValid = authenticator.verify({
        token: body.code!,
        secret: settings.twoFactorSecret as string,
      });

      if (!isValid) {
        return NextResponse.json(
          { error: "验证码错误" },
          { status: 400 }
        );
      }
    }

    settings.twoFactorEnabled = false;
    delete settings.twoFactorSecret;
    delete settings.twoFactorPendingSecret;
    await writeSettings(settings);

    return NextResponse.json({ success: true, message: "2FA 已关闭" });
  }

  // 验证 2FA code (登录时调用)
  if (body.action === "validate") {
    if (!settings.twoFactorEnabled || !settings.twoFactorSecret) {
      return NextResponse.json({ valid: true, required: false });
    }

    if (!body.code) {
      return NextResponse.json({ valid: false, required: true });
    }

    const isValid = authenticator.verify({
      token: body.code,
      secret: settings.twoFactorSecret as string,
    });

    return NextResponse.json({ valid: isValid, required: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
