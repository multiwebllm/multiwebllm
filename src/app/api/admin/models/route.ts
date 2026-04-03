import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { models, providers } from "@/lib/db/schema";
import { validateAdmin } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  if (!(await validateAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allModels = await db
    .select({
      id: models.id,
      providerId: models.providerId,
      providerName: providers.name,
      providerSlug: providers.slug,
      name: models.name,
      modelId: models.modelId,
      upstreamModel: models.upstreamModel,
      supportsVision: models.supportsVision,
      supportsImageGen: models.supportsImageGen,
      maxTokens: models.maxTokens,
      status: models.status,
      createdAt: models.createdAt,
    })
    .from(models)
    .leftJoin(providers, eq(models.providerId, providers.id));

  return NextResponse.json(allModels);
}

export async function POST(request: NextRequest) {
  if (!(await validateAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    providerId: number;
    name: string;
    modelId: string;
    upstreamModel?: string;
    supportsVision?: boolean;
    supportsImageGen?: boolean;
    maxTokens?: number;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.providerId || !body.name || !body.modelId) {
    return NextResponse.json(
      { error: "Missing required fields: providerId, name, modelId" },
      { status: 400 }
    );
  }

  try {
    const result = await db
      .insert(models)
      .values({
        providerId: body.providerId,
        name: body.name,
        modelId: body.modelId,
        upstreamModel: body.upstreamModel,
        supportsVision: body.supportsVision ?? false,
        supportsImageGen: body.supportsImageGen ?? false,
        maxTokens: body.maxTokens ?? 4096,
      })
      .returning();

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to create model: ${message}` },
      { status: 500 }
    );
  }
}
