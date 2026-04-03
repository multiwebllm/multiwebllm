import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { models, providers, usageLogs, apiKeys } from "@/lib/db/schema";
import { validateApiKey } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // Extract Bearer token
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      {
        error: {
          message: "Missing or invalid Authorization header",
          type: "invalid_request_error",
          code: "invalid_api_key",
        },
      },
      { status: 401 }
    );
  }

  const apiKey = authHeader.slice(7);
  const keyRecord = await validateApiKey(apiKey);
  if (!keyRecord) {
    return NextResponse.json(
      {
        error: {
          message: "Invalid API key",
          type: "invalid_request_error",
          code: "invalid_api_key",
        },
      },
      { status: 401 }
    );
  }

  let body: {
    prompt: string;
    model?: string;
    n?: number;
    size?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: {
          message: "Invalid JSON body",
          type: "invalid_request_error",
          code: "invalid_body",
        },
      },
      { status: 400 }
    );
  }

  if (!body.prompt) {
    return NextResponse.json(
      {
        error: {
          message: "Missing required field: prompt",
          type: "invalid_request_error",
          code: "missing_fields",
        },
      },
      { status: 400 }
    );
  }

  // Find an image generation model
  const modelId = body.model;
  let modelResults;

  if (modelId) {
    modelResults = await db
      .select()
      .from(models)
      .where(
        and(
          eq(models.modelId, modelId),
          eq(models.supportsImageGen, true),
          eq(models.status, "active")
        )
      )
      .limit(1);
  } else {
    modelResults = await db
      .select()
      .from(models)
      .where(
        and(eq(models.supportsImageGen, true), eq(models.status, "active"))
      )
      .limit(1);
  }

  if (modelResults.length === 0) {
    return NextResponse.json(
      {
        error: {
          message: modelId
            ? `Model '${modelId}' not found or does not support image generation`
            : "No image generation model available",
          type: "invalid_request_error",
          code: "model_not_found",
        },
      },
      { status: 404 }
    );
  }

  const modelRecord = modelResults[0];

  // Get provider
  const providerResults = await db
    .select()
    .from(providers)
    .where(eq(providers.id, modelRecord.providerId))
    .limit(1);

  if (providerResults.length === 0 || providerResults[0].status !== "active") {
    return NextResponse.json(
      {
        error: {
          message: "Provider is unavailable",
          type: "server_error",
          code: "provider_unavailable",
        },
      },
      { status: 500 }
    );
  }

  const providerRecord = providerResults[0];

  // Dynamic import of provider
  let providerModule: { default: new (config: { authData: Record<string, unknown>; baseUrl?: string }) => { generateImage: (options: { model: string; prompt: string; n: number; size: string }) => Promise<{ url: string }[]> } };
  try {
    providerModule = await import(`@/lib/providers/${providerRecord.slug}`);
  } catch {
    return NextResponse.json(
      {
        error: {
          message: `Provider '${providerRecord.slug}' implementation not found`,
          type: "server_error",
          code: "provider_not_implemented",
        },
      },
      { status: 500 }
    );
  }

  const ProviderClass = providerModule.default;
  const provider = new ProviderClass({
    authData: providerRecord.authData ?? {},
    baseUrl: providerRecord.baseUrl,
  });

  try {
    if (typeof provider.generateImage !== "function") {
      return NextResponse.json(
        {
          error: {
            message: "This provider does not support image generation",
            type: "invalid_request_error",
            code: "not_supported",
          },
        },
        { status: 400 }
      );
    }

    const images = await provider.generateImage({
      model: modelRecord.upstreamModel || modelRecord.modelId,
      prompt: body.prompt,
      n: body.n ?? 1,
      size: body.size ?? "1024x1024",
    });

    const latencyMs = Date.now() - startTime;

    // Log usage
    await db.insert(usageLogs).values({
      apiKeyId: keyRecord.id,
      modelId: modelRecord.modelId,
      providerId: providerRecord.id,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      latencyMs,
      status: "success",
    });

    // Update last used
    await db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, keyRecord.id));

    return NextResponse.json({
      created: Math.floor(Date.now() / 1000),
      data: images.map((img) => ({ url: img.url })),
    });
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    await db.insert(usageLogs).values({
      apiKeyId: keyRecord.id,
      modelId: modelRecord.modelId,
      providerId: providerRecord.id,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      latencyMs,
      status: "error",
      errorMessage,
    });

    return NextResponse.json(
      {
        error: {
          message: "An error occurred while generating the image",
          type: "server_error",
          code: "internal_error",
        },
      },
      { status: 500 }
    );
  }
}
