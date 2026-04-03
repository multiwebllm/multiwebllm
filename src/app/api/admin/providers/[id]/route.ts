import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { providers } from "@/lib/db/schema";
import { validateAdmin } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await validateAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const providerId = parseInt(id, 10);
  if (isNaN(providerId)) {
    return NextResponse.json({ error: "Invalid provider ID" }, { status: 400 });
  }

  let body: Partial<{
    name: string;
    slug: string;
    baseUrl: string;
    authType: "cookie" | "token" | "api_key";
    authData: Record<string, unknown>;
    status: "active" | "inactive" | "error";
    quotaUrl: string;
    quotaCheckInterval: number;
  }>;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const result = await db
      .update(providers)
      .set({
        ...body,
        updatedAt: new Date(),
      })
      .where(eq(providers.id, providerId))
      .returning();

    if (result.length === 0) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to update provider: ${message}` },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await validateAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const providerId = parseInt(id, 10);
  if (isNaN(providerId)) {
    return NextResponse.json({ error: "Invalid provider ID" }, { status: 400 });
  }

  try {
    const result = await db
      .delete(providers)
      .where(eq(providers.id, providerId))
      .returning();

    if (result.length === 0) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to delete provider: ${message}` },
      { status: 500 }
    );
  }
}
