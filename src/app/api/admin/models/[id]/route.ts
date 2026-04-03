import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { models } from "@/lib/db/schema";
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
  const modelDbId = parseInt(id, 10);
  if (isNaN(modelDbId)) {
    return NextResponse.json({ error: "Invalid model ID" }, { status: 400 });
  }

  let body: Partial<{
    providerId: number;
    name: string;
    modelId: string;
    upstreamModel: string;
    supportsVision: boolean;
    supportsImageGen: boolean;
    maxTokens: number;
    status: "active" | "inactive" | "error";
  }>;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const result = await db
      .update(models)
      .set(body)
      .where(eq(models.id, modelDbId))
      .returning();

    if (result.length === 0) {
      return NextResponse.json({ error: "Model not found" }, { status: 404 });
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to update model: ${message}` },
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
  const modelDbId = parseInt(id, 10);
  if (isNaN(modelDbId)) {
    return NextResponse.json({ error: "Invalid model ID" }, { status: 400 });
  }

  try {
    const result = await db
      .delete(models)
      .where(eq(models.id, modelDbId))
      .returning();

    if (result.length === 0) {
      return NextResponse.json({ error: "Model not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to delete model: ${message}` },
      { status: 500 }
    );
  }
}
