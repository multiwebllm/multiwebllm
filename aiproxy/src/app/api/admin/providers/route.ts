import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { providers } from "@/lib/db/schema";
import { validateAdmin } from "@/lib/auth";
import { normalizeAuthInput, authDataToRecord } from "@/lib/auth-data";
import {
  isRemovedProvider,
  isWebChatProvider,
  validateCustomProviderSlug,
} from "@/lib/models/catalog";

export async function GET(request: NextRequest) {
  if (!(await validateAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allProviders = await db.select().from(providers);

  // Exclude sensitive auth_data, just show auth_type and whether auth_data is set
  const sanitized = allProviders.map((p) => ({
    ...p,
    authData: undefined,
    hasAuthData: p.authData !== null && Object.keys(p.authData ?? {}).length > 0,
  }));

  return NextResponse.json(sanitized);
}

export async function POST(request: NextRequest) {
  if (!(await validateAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    name: string;
    slug: string;
    baseUrl: string;
    authType?: "cookie" | "token" | "api_key";
    authData?: Record<string, unknown> | string;
    quotaUrl?: string;
    quotaCheckInterval?: number;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.name || !body.slug || !body.baseUrl) {
    return NextResponse.json(
      { error: "Missing required fields: name, slug, baseUrl" },
      { status: 400 }
    );
  }

  const slug = body.slug.trim().toLowerCase();
  if (isRemovedProvider(slug)) {
    return NextResponse.json(
      { error: "该服务商已下线，请使用「自定义服务商」添加其它平台" },
      { status: 400 }
    );
  }
  if (!isWebChatProvider(slug)) {
    const slugError = validateCustomProviderSlug(slug);
    if (slugError) {
      return NextResponse.json({ error: slugError }, { status: 400 });
    }
  }

  const authPayload =
    typeof body.authData === "string"
      ? authDataToRecord(normalizeAuthInput(body.authData, body.baseUrl))
      : body.authData
        ? authDataToRecord(
            normalizeAuthInput(JSON.stringify(body.authData), body.baseUrl)
          )
        : {};

  try {
    const result = await db
      .insert(providers)
      .values({
        name: body.name,
        slug,
        baseUrl: body.baseUrl,
        authType: body.authType ?? "cookie",
        authData: authPayload,
        quotaUrl: body.quotaUrl,
        quotaCheckInterval: body.quotaCheckInterval,
      })
      .returning();

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to create provider: ${message}` },
      { status: 500 }
    );
  }
}
