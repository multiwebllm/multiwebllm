import { db } from "@/lib/db";
import { apiKeys } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { jwtVerify } from "jose";
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export async function validateApiKey(key: string) {
  const results = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.key, key), eq(apiKeys.status, "active")))
    .limit(1);

  if (results.length === 0) return null;

  const record = results[0];

  // Check expiration
  if (record.expiresAt && record.expiresAt < new Date()) {
    return null;
  }

  return record;
}

export async function validateAdmin(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get("admin_token")?.value;
  if (!token) return false;

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}

export function generateApiKey(): string {
  const hex = crypto.randomUUID().replace(/-/g, "") +
    crypto.randomUUID().replace(/-/g, "");
  return "sk-" + hex.slice(0, 48);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
