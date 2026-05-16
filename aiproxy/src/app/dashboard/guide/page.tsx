"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  apiReferenceBlocks,
  dashboardNavItems,
  guidePageSections,
  setupFlowSteps,
} from "@/lib/dashboard/nav-guide";
import { ExternalLink, ArrowRight } from "lucide-react";

const TAB_VALUES = ["setup", "configure", "reference"] as const;
type TabValue = (typeof TAB_VALUES)[number];

function isTabValue(v: string | null): v is TabValue {
  return v !== null && (TAB_VALUES as readonly string[]).includes(v);
}

function GuidePageContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const defaultTab: TabValue = isTabValue(tabParam) ? tabParam : "setup";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">使用说明</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          MultiWebLLM 将网页订阅账号的 Cookie 转为 OpenAI 兼容 API。按顺序完成设置，再在客户端引用。
        </p>
      </div>

      <Card className="border-blue-100 bg-blue-50/40 dark:border-blue-900 dark:bg-blue-950/20">
        <CardContent className="flex flex-wrap items-center gap-2 py-3 text-sm">
          <span className="text-muted-foreground">侧栏导航：</span>
          {dashboardNavItems
            .filter((n) => n.href !== "/dashboard/guide")
            .map((n) => (
              <Link key={n.href} href={n.href}>
                <Badge
                  variant="outline"
                  className="cursor-pointer hover:border-blue-400 hover:bg-white dark:hover:bg-slate-900"
                >
                  {n.label}
                </Badge>
              </Link>
            ))}
        </CardContent>
      </Card>

      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-3 gap-1 p-1">
          <TabsTrigger value="setup" className="text-sm">
            如何设置
          </TabsTrigger>
          <TabsTrigger value="configure" className="text-sm">
            如何配置
          </TabsTrigger>
          <TabsTrigger value="reference" className="text-sm">
            如何引用
          </TabsTrigger>
        </TabsList>

        <TabsContent value="setup" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">推荐流程（首次部署）</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {setupFlowSteps.map((step) => (
                <div
                  key={step.title}
                  className="border-l-2 border-blue-500 pl-4"
                >
                  <p className="font-medium">{step.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {step.body}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">内置网页服务商</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                以下五家支持 Cookie 登录、模型同步与侧栏延迟探测：
                <span className="font-medium text-foreground">
                  {" "}
                  ChatGPT · Claude · Gemini · Grok · Kimi
                </span>
              </p>
              <p>
                其它平台可选「自定义服务商」，填写 OpenAI 兼容的聊天与模型列表地址。
              </p>
              <Link
                href="/dashboard/providers"
                className="inline-flex items-center gap-1 text-blue-600 hover:underline"
              >
                前往服务商管理
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="configure" className="mt-4 space-y-4">
          {guidePageSections.map((section) => {
            const nav = dashboardNavItems.find(
              (n) => n.href === section.navHref
            );
            return (
              <Card key={section.id} id={section.id}>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base">{section.title}</CardTitle>
                    {nav && (
                      <Link
                        href={section.navHref}
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                      >
                        打开页面
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                  {nav && (
                    <p className="text-xs text-muted-foreground">
                      {nav.description}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p className="text-muted-foreground">{section.summary}</p>
                  {section.setup && section.setup.length > 0 && (
                    <div>
                      <p className="mb-1 font-medium text-foreground">设置</p>
                      <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                        {section.setup.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {section.configure && section.configure.length > 0 && (
                    <div>
                      <p className="mb-1 font-medium text-foreground">配置</p>
                      <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                        {section.configure.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {section.tips && section.tips.length > 0 && (
                    <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                      {section.tips.join(" ")}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="reference" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">端点与鉴权</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">Base URL（本机 Docker 默认）</p>
                <code className="mt-1 block rounded-md bg-slate-100 px-3 py-2 text-xs dark:bg-slate-800">
                  {apiReferenceBlocks.baseUrl}
                </code>
                <p className="mt-2 text-xs text-muted-foreground">
                  OpenAI SDK 请填 <code className="text-foreground">/v1</code>{" "}
                  后缀，例如{" "}
                  <code className="text-foreground">
                    {apiReferenceBlocks.baseUrl}/v1
                  </code>
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">请求头</p>
                <code className="mt-1 block rounded-md bg-slate-100 px-3 py-2 text-xs dark:bg-slate-800">
                  {apiReferenceBlocks.authHeader}
                </code>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">聊天补全</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-2 text-sm text-muted-foreground">
                <code className="text-foreground">model</code> 填「模型配置」中的
                模型 ID；仅聊天类模型支持本接口。
              </p>
              <pre className="overflow-x-auto rounded-md bg-slate-950 p-4 text-xs text-slate-50">
                {apiReferenceBlocks.chat}
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">模型列表</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="overflow-x-auto rounded-md bg-slate-950 p-4 text-xs text-slate-50">
                {apiReferenceBlocks.models}
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">图片生成</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-2 text-sm text-muted-foreground">
                需使用已启用且类型为「图片」的模型（如 gpt-image-2）。
              </p>
              <pre className="overflow-x-auto rounded-md bg-slate-950 p-4 text-xs text-slate-50">
                {apiReferenceBlocks.images}
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Cursor / IDE</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap rounded-md bg-slate-100 p-4 text-xs dark:bg-slate-800">
                {apiReferenceBlocks.cursor}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function GuidePage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">加载说明…</div>}>
      <GuidePageContent />
    </Suspense>
  );
}
