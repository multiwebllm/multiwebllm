import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiKeys } from "@/lib/db/schema";
import { validateAdmin, generateApiKey } from "@/lib/auth";

export async function GET(request: NextRequest) {
  if (!(await validateAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allKeys = await db.select().from(apiKeys);

  // Mask the key field: show first 7 + last 4 chars
  const masked = allKeys.map((k) => ({
    ...k,
    key: k.key.slice(0, 7) + "..." + k.key.slice(-4),
  }));

  return NextResponse.json(masked);
}

export async function POST(request: NextRequest) {
  if (!(await validateAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    name: string;
    allowedModels?: string[];
    rateLimit?: number;
    monthlyQuota?: number;
    expiresAt?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.name) {
    return NextResponse.json(
      { error: "Missing required field: name" },
      { status: 400 }
    );
  }

  const key = generateApiKey();

  try {
    const result = await db
      .insert(apiKeys)
      .values({
        name: body.name,
        key,
        allowedModels: body.allowedModels ?? [],
        rateLimit: body.rateLimit ?? 60,
        monthlyQuota: body.monthlyQuota ?? 0,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      })
      .returning();

    // Return full key only on creation
    return NextResponse.json(
      {
        ...result[0],
        key, // Full key, only visible at creation time
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to create API key: ${message}` },
      { status: 500 }
    );
  }
}
