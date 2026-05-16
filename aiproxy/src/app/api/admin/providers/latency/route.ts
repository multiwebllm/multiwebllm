import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { providers } from "@/lib/db/schema";
import { validateAdmin } from "@/lib/auth";
import { isWebChatProvider } from "@/lib/models/catalog";
import { measureProvidersLatency } from "@/lib/provider-latency";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await validateAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const all = await db
    .select({
      slug: providers.slug,
      name: providers.name,
      baseUrl: providers.baseUrl,
      status: providers.status,
    })
    .from(providers);

  const targets = all.filter((p) => isWebChatProvider(p.slug));
  const measured = await measureProvidersLatency(targets);

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    serverNote: "延迟为 MultiWebLLM 所在服务器访问官网的 HTTP 耗时",
    providers: measured,
  });
}
