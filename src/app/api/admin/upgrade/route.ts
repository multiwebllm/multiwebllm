import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "";

function verifyGitHubSignature(
  payload: string,
  signature: string | null
): boolean {
  if (!WEBHOOK_SECRET || !signature) return false;
  const hmac = crypto.createHmac("sha256", WEBHOOK_SECRET);
  const digest = "sha256=" + hmac.update(payload).digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(digest),
    Buffer.from(signature)
  );
}

// GitHub Webhook → 自动拉取代码并重建
export async function POST(request: NextRequest) {
  const body = await request.text();

  // 验证来源: GitHub webhook secret 或 admin token
  const ghSignature = request.headers.get("x-hub-signature-256");
  const adminToken = request.cookies.get("admin_token")?.value;

  if (ghSignature) {
    // GitHub webhook 验证
    if (!verifyGitHubSignature(body, ghSignature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  } else if (!adminToken) {
    // 手动触发需要登录
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 返回确认，实际升级由服务器脚本执行
  // 升级流程: webhook → 写标记文件 → cron 检测并执行
  try {
    const fs = await import("fs");
    const path = await import("path");
    const flagFile = path.join(process.cwd(), ".upgrade-requested");
    fs.writeFileSync(flagFile, JSON.stringify({
      time: new Date().toISOString(),
      source: ghSignature ? "github" : "manual",
    }));

    return NextResponse.json({
      message: "升级请求已接收，服务将在几分钟内自动更新",
      status: "pending",
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to trigger upgrade" },
      { status: 500 }
    );
  }
}

// 查询升级状态
export async function GET() {
  return NextResponse.json({
    currentVersion: "0.0.1",
    name: "multiwebllm",
  });
}
