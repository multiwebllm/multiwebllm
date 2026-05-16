import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { models, providers, usageLogs, apiKeys } from "@/lib/db/schema";
import { validateApiKey } from "@/lib/auth";
import { eq, sql } from "drizzle-orm";
import type { ChatOptions } from "@/lib/providers/base";

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

  // Check quota
  if (keyRecord.monthlyQuota && keyRecord.monthlyQuota > 0 && keyRecord.usedQuota >= keyRecord.monthlyQuota) {
    return NextResponse.json(
      {
        error: {
          message: "Monthly quota exceeded",
          type: "insufficient_quota",
          code: "quota_exceeded",
        },
      },
      { status: 429 }
    );
  }

  let body: {
    model: string;
    messages: ChatOptions["messages"];
    stream?: boolean;
    temperature?: number;
    max_tokens?: number;
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

  if (!body.model || !body.messages) {
    return NextResponse.json(
      {
        error: {
          message: "Missing required fields: model, messages",
          type: "invalid_request_error",
          code: "missing_fields",
        },
      },
      { status: 400 }
    );
  }

  // Check allowed models
  if (
    keyRecord.allowedModels &&
    keyRecord.allowedModels.length > 0 &&
    !keyRecord.allowedModels.includes(body.model)
  ) {
    return NextResponse.json(
      {
        error: {
          message: `Model '${body.model}' is not allowed for this API key`,
          type: "invalid_request_error",
          code: "model_not_allowed",
        },
      },
      { status: 403 }
    );
  }

  // Look up model in DB
  const modelResults = await db
    .select()
    .from(models)
    .where(eq(models.modelId, body.model))
    .limit(1);

  if (modelResults.length === 0) {
    return NextResponse.json(
      {
        error: {
          message: `Model '${body.model}' not found`,
          type: "invalid_request_error",
          code: "model_not_found",
        },
      },
      { status: 404 }
    );
  }

  const modelRecord = modelResults[0];

  if (modelRecord.status !== "active") {
    return NextResponse.json(
      {
        error: {
          message: `Model '${body.model}' is currently unavailable`,
          type: "server_error",
          code: "model_unavailable",
        },
      },
      { status: 404 }
    );
  }

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

  // Get provider instance
  let provider;
  try {
    const { getProvider } = await import("@/lib/providers");
    provider = getProvider(providerRecord.slug, {
      authData: (providerRecord.authData as Record<string, unknown>) ?? {},
      baseUrl: providerRecord.baseUrl,
    });
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

  const chatOptions: ChatOptions = {
    model: modelRecord.upstreamModel || modelRecord.modelId,
    messages: body.messages,
    stream: body.stream !== false, // default true
    temperature: body.temperature,
    max_tokens: body.max_tokens ?? modelRecord.maxTokens ?? undefined,
  };

  const shouldStream = body.stream !== false;

  try {
    const stream = await provider.chat(chatOptions);

    // Update last used
    await db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, keyRecord.id));

    if (shouldStream) {
      // Return SSE stream, log usage after stream ends
      const [logStream, responseStream] = stream.tee();

      // Background: read logStream to estimate tokens
      (async () => {
        try {
          const reader = logStream.getReader();
          const decoder = new TextDecoder();
          let fullContent = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const text = decoder.decode(value, { stream: true });
            // Extract content from SSE chunks
            for (const line of text.split("\n")) {
              if (line.startsWith("data: ") && line !== "data: [DONE]") {
                try {
                  const chunk = JSON.parse(line.slice(6));
                  const delta = chunk.choices?.[0]?.delta?.content;
                  if (delta) fullContent += delta;
                } catch {
                  // skip parse errors
                }
              }
            }
          }

          const latencyMs = Date.now() - startTime;
          const promptText = body.messages.map((m) =>
            typeof m.content === "string" ? m.content : ""
          ).join(" ");
          const promptTokens = Math.ceil(promptText.length / 4);
          const completionTokens = Math.ceil(fullContent.length / 4);

          await db.insert(usageLogs).values({
            apiKeyId: keyRecord.id,
            modelId: body.model,
            providerId: providerRecord.id,
            promptTokens,
            completionTokens,
            totalTokens: promptTokens + completionTokens,
            latencyMs,
            status: "success",
          });

          await db
            .update(apiKeys)
            .set({ usedQuota: sql`${apiKeys.usedQuota} + ${promptTokens + completionTokens}` })
            .where(eq(apiKeys.id, keyRecord.id));
        } catch {
          // Background logging should not throw
        }
      })();

      return new Response(responseStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    } else {
      // Non-streaming: collect full response
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        for (const line of text.split("\n")) {
          if (line.startsWith("data: ") && line !== "data: [DONE]") {
            try {
              const chunk = JSON.parse(line.slice(6));
              const delta = chunk.choices?.[0]?.delta?.content;
              if (delta) fullContent += delta;
            } catch {
              // skip
            }
          }
        }
      }

      const latencyMs = Date.now() - startTime;
      const promptText = body.messages.map((m) =>
        typeof m.content === "string" ? m.content : ""
      ).join(" ");
      const promptTokens = Math.ceil(promptText.length / 4);
      const completionTokens = Math.ceil(fullContent.length / 4);
      const totalTokens = promptTokens + completionTokens;

      // Log usage
      await db.insert(usageLogs).values({
        apiKeyId: keyRecord.id,
        modelId: body.model,
        providerId: providerRecord.id,
        promptTokens,
        completionTokens,
        totalTokens,
        latencyMs,
        status: "success",
      });

      await db
        .update(apiKeys)
        .set({ usedQuota: sql`${apiKeys.usedQuota} + ${totalTokens}` })
        .where(eq(apiKeys.id, keyRecord.id));

      const completionId = `chatcmpl-${Date.now()}`;
      return NextResponse.json({
        id: completionId,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: body.model,
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: fullContent,
            },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: totalTokens,
        },
      });
    }
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Log failed request
    await db.insert(usageLogs).values({
      apiKeyId: keyRecord.id,
      modelId: body.model,
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
          message: "An error occurred while processing your request",
          type: "server_error",
          code: "internal_error",
        },
      },
      { status: 500 }
    );
  }
}
