import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { models, providers } from "@/lib/db/schema";
import { validateApiKey } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
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

  const allModels = await db
    .select({
      id: models.modelId,
      name: models.name,
      created: models.createdAt,
      providerId: models.providerId,
      providerName: providers.name,
    })
    .from(models)
    .leftJoin(providers, eq(models.providerId, providers.id))
    .where(eq(models.status, "active"));

  const data = allModels.map((m) => ({
    id: m.id,
    object: "model" as const,
    created: Math.floor((m.created?.getTime() ?? Date.now()) / 1000),
    owned_by: m.providerName ?? "unknown",
  }));

  return NextResponse.json({
    object: "list",
    data,
  });
}
