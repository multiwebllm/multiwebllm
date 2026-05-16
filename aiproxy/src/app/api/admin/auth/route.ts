import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";
import { authenticator } from "@otplib/preset-default";
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

export async function POST(request: NextRequest) {
  let body: { username?: string; password: string; totp_code?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (!body.username || !body.password) {
    return NextResponse.json(
      { error: "Username and password are required" },
      { status: 400 }
    );
  }

  const adminUsername = process.env.ADMIN_USERNAME || "admin";
  const adminPassword = process.env.ADMIN_PASSWORD;
  
  if (!adminPassword) {
    return NextResponse.json(
      { error: "Admin password not configured" },
      { status: 500 }
    );
  }

  if (body.username !== adminUsername || body.password !== adminPassword) {
    return NextResponse.json(
      { error: "Invalid username or password" },
      { status: 401 }
    );
  }

  // 检查 2FA
  const settings = await readSettings();
  if (settings.twoFactorEnabled && settings.twoFactorSecret) {
    if (!body.totp_code) {
      return NextResponse.json(
        { error: "2FA code required", requires_2fa: true },
        { status: 403 }
      );
    }

    const isValid = authenticator.verify({
      token: body.totp_code,
      secret: settings.twoFactorSecret as string,
    });

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid 2FA code", requires_2fa: true },
        { status: 401 }
      );
    }
  }

  const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
  const token = await new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(secret);

  const response = NextResponse.json({ success: true });
  response.cookies.set("admin_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 24 hours
    path: "/",
  });

  return response;
}
