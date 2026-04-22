import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { usageLogs, providers, models, apiKeys } from "@/lib/db/schema";
import { validateAdmin } from "@/lib/auth";
import { sql } from "drizzle-orm";

// 生成随机数
const random = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

// 随机选择
const sample = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// 错误消息样本
const errorMessages = [
  "Rate limit exceeded",
  "Connection timeout",
  "Invalid API key",
  "Model not found",
  "Context length exceeded",
  "Service unavailable",
  "Authentication failed",
  "Quota exceeded",
  "Network error",
  "Internal server error",
];

// 模型列表
const modelList = [
  { id: "gpt-4", name: "GPT-4", provider: "openai" },
  { id: "gpt-4-turbo", name: "GPT-4 Turbo", provider: "openai" },
  { id: "gpt-3.5-turbo", name: "GPT-3.5", provider: "openai" },
  { id: "claude-3-opus", name: "Claude 3 Opus", provider: "anthropic" },
  { id: "claude-3-sonnet", name: "Claude 3 Sonnet", provider: "anthropic" },
  { id: "claude-3-haiku", name: "Claude 3 Haiku", provider: "anthropic" },
  { id: "gemini-pro", name: "Gemini Pro", provider: "google" },
  { id: "gemini-ultra", name: "Gemini Ultra", provider: "google" },
  { id: "grok-1", name: "Grok-1", provider: "xai" },
  { id: "deepseek-chat", name: "DeepSeek Chat", provider: "deepseek" },
  { id: "kimi-chat", name: "Kimi Chat", provider: "moonshot" },
  { id: "abab6", name: "abab6", provider: "minimax" },
  { id: "doubao-lite", name: "Doubao Lite", provider: "doubao" },
  { id: "doubao-pro", name: "Doubao Pro", provider: "doubao" },
];

export async function POST(request: NextRequest) {
  if (!(await validateAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 获取现有的提供商和API密钥
    const existingProviders = await db.select().from(providers);
    const existingApiKeys = await db.select().from(apiKeys);
    const existingModels = await db.select().from(models);

    if (existingProviders.length === 0) {
      return NextResponse.json({ error: "No providers found. Please add providers first." }, { status: 400 });
    }

    const providerIds = existingProviders.map(p => p.id);
    const apiKeyIds = existingApiKeys.length > 0 ? existingApiKeys.map(k => k.id) : [null];
    const modelIds = existingModels.length > 0 ? existingModels.map(m => m.modelId) : modelList.map(m => m.id);

    const now = new Date();
    const records: {
      apiKeyId: number | null;
      modelId: string;
      providerId: number;
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      latencyMs: number;
      status: string;
      errorMessage: string | null;
      createdAt: Date;
    }[] = [];

    // 生成24小时的数据，每分钟多条记录
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 5) {
        const time = new Date(now);
        time.setHours(time.getHours() - hour);
        time.setMinutes(minute);
        time.setSeconds(random(0, 59));

        // 每个时间点生成 1-5 条记录
        const count = random(1, 5);
        
        for (let i = 0; i < count; i++) {
          const model = sample(modelList);
          const provider = existingProviders.find(p => p.slug === model.provider) || sample(existingProviders);
          
          // 90% 成功率
          const isError = Math.random() < 0.1;
          const promptTokens = random(50, 2000);
          const completionTokens = isError ? 0 : random(100, 4000);
          
          records.push({
            apiKeyId: sample(apiKeyIds),
            modelId: model.id,
            providerId: provider.id,
            promptTokens,
            completionTokens,
            totalTokens: promptTokens + completionTokens,
            latencyMs: isError ? random(100, 5000) : random(200, 3000),
            status: isError ? "error" : "success",
            errorMessage: isError ? sample(errorMessages) : null,
            createdAt: time,
          });
        }
      }
    }

    // 批量插入数据
    const batchSize = 500;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      await db.insert(usageLogs).values(batch);
    }

    return NextResponse.json({
      success: true,
      message: `Generated ${records.length} test records`,
      stats: {
        totalRecords: records.length,
        errorRecords: records.filter(r => r.status === "error").length,
        successRecords: records.filter(r => r.status === "success").length,
        totalTokens: records.reduce((a, b) => a + b.totalTokens, 0),
        timeRange: "Last 24 hours",
      }
    });

  } catch (error) {
    console.error("Error generating test data:", error);
    return NextResponse.json({ 
      error: "Failed to generate test data",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// 清除测试数据
export async function DELETE(request: NextRequest) {
  if (!(await validateAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await db.execute(sql`TRUNCATE TABLE usage_logs RESTART IDENTITY`);
    
    return NextResponse.json({
      success: true,
      message: "All usage logs cleared"
    });
  } catch (error) {
    console.error("Error clearing test data:", error);
    return NextResponse.json({ error: "Failed to clear data" }, { status: 500 });
  }
}
