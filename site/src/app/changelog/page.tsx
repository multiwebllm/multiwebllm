import Link from "next/link";

const versions = [
  {
    version: "v0.0.2",
    date: "2026-05-16",
    title: "模型与后台体验重构",
    changes: [
      "新增自定义服务商能力，内置网页聊天服务商与自定义 OpenAI 兼容端点统一接入。",
      "重构模型目录与同步逻辑，补充 2026 模型目录、模型分型、上下文窗口与旧版清理策略。",
      "重做监控与使用记录页面，补充服务商概览、API Key Top、筛选与延迟视图。",
      "侧栏新增使用指南与服务商状态探测，后台信息架构更适合自用部署运维。",
      "补充 Docker 重建与监听脚本，便于本地和服务器持续迭代。",
    ],
  },
  {
    version: "v0.0.1",
    date: "2026-04-04",
    title: "首个版本",
    changes: [
      "8个 AI 服务商支持：ChatGPT、Claude、Gemini、Grok、DeepSeek、Kimi、Minimax、豆包",
      "OpenAI 兼容 API：/v1/chat/completions、/v1/models、/v1/images/generations",
      "中文管理后台：服务商配置、密钥管理、用量统计",
      "Docker 一键部署：docker compose up 即可启动",
      "多密钥分发：为不同站点分配独立 API Key",
      "用量统计：请求数、Token 消耗、延迟、错误率实时监控",
      "配额管理：本地计数限流 + 远程额度抓取",
    ],
  },
];

export default function ChangelogPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900">
        更新日志
      </h1>
      <p className="mt-2 text-gray-600">MultiWebLLM 版本更新记录</p>

      <div className="mt-12 space-y-12">
        {versions.map((v) => (
          <article
            key={v.version}
            className="relative border-l-2 border-blue-600 pl-8"
          >
            <div className="absolute -left-2 top-0 h-4 w-4 bg-blue-600"></div>
            <div className="flex items-center gap-3">
              <span className="text-xl font-bold text-gray-900">
                {v.version}
              </span>
              <span className="border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-600">
                {v.date}
              </span>
            </div>
            <h2 className="mt-2 text-lg font-semibold text-gray-900">
              {v.title}
            </h2>
            <ul className="mt-4 space-y-2">
              {v.changes.map((change, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-600">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-blue-600"></span>
                  {change}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <div className="mt-16 border-t border-gray-200 pt-8 text-center">
        <Link
          href="/docs"
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          查看完整文档 &rarr;
        </Link>
      </div>
    </div>
  );
}
