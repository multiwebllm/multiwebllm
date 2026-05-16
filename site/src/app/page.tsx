import Link from "next/link";
import Image from "next/image";
import { CopyTerminal } from "@/components/copy-terminal";
import {
  Unplug,
  Code,
  KeySquare,
  BarChart3,
  Shield,
  Container,
} from "lucide-react";

const features = [
  {
    icon: Unplug,
    title: "8大服务商",
    desc: "ChatGPT、Claude、Gemini、Grok、DeepSeek、Kimi、Minimax、豆包",
  },
  {
    icon: Code,
    title: "OpenAI 兼容",
    desc: "标准 /v1/chat/completions 接口，支持流式输出，无缝替换",
  },
  {
    icon: KeySquare,
    title: "多密钥管理",
    desc: "为不同站点分配独立 API Key，独立配额和限流",
  },
  {
    icon: BarChart3,
    title: "用量统计",
    desc: "实时监控请求、Token 消耗、延迟、错误率",
  },
  {
    icon: Shield,
    title: "配额管理",
    desc: "本地计数限流 + 远程额度抓取，订阅不浪费",
  },
  {
    icon: Container,
    title: "Docker 部署",
    desc: "docker compose up 一键启动，5分钟搞定",
  },
];

const providers = [
  { name: "ChatGPT", icon: "/providers/chatgpt.svg", color: "bg-emerald-50 text-emerald-800 border-emerald-200", models: "GPT-4.5 / o3 / o4-mini" },
  { name: "Claude", icon: "/providers/claude.svg", color: "bg-amber-50 text-amber-800 border-amber-200", models: "Opus 4.6 / Sonnet 4.6" },
  { name: "Gemini", icon: "/providers/gemini.svg", color: "bg-blue-50 text-blue-800 border-blue-200", models: "2.5 Pro / 2.5 Flash" },
  { name: "Grok", icon: "/providers/grok.svg", color: "bg-gray-50 text-gray-800 border-gray-200", models: "Grok 3 / 3 Thinking" },
  { name: "DeepSeek", icon: "/providers/deepseek.svg", color: "bg-indigo-50 text-indigo-800 border-indigo-200", models: "V3-0324 / R1" },
  { name: "Kimi", icon: "/providers/kimi.svg", color: "bg-purple-50 text-purple-800 border-purple-200", models: "K2 / K1.5 / Long" },
  { name: "Minimax", icon: "/providers/minimax.svg", color: "bg-cyan-50 text-cyan-800 border-cyan-200", models: "MiniMax-01" },
  { name: "豆包", icon: "/providers/doubao.svg", color: "bg-red-50 text-red-800 border-red-200", models: "Pro 256K / 1.5 Pro" },
];

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-50 to-white py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <h1 className="text-5xl font-bold tracking-tight text-gray-900 sm:text-7xl">
            MultiWebLLM
          </h1>
          <p className="mt-4 text-xl font-medium text-blue-600 sm:text-2xl">
            统一管理你的 AI 订阅，一个 API 连接所有大模型
          </p>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-gray-600">
            将 ChatGPT、Claude、Gemini、Grok、DeepSeek、Kimi
            等网页订阅转为 OpenAI 兼容 API，支持多密钥分发、用量统计、配额管理
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              href="/docs/getting-started"
              className="bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
            >
              开始使用
            </Link>
            <a
              href="https://github.com/gentpan/multiwebllm"
              target="_blank"
              rel="noopener noreferrer"
              className="border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-50 transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900">
            核心功能
          </h2>
          <p className="mt-4 text-center text-gray-600">
            一站式 AI 订阅管理平台
          </p>
          <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="border border-gray-200 bg-white p-8 hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <f.icon className="h-8 w-8 text-blue-600" />
                <h3 className="mt-4 text-lg font-semibold text-gray-900">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Providers */}
      <section className="border-t border-gray-200 bg-gray-50 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900">
            支持的服务商
          </h2>
          <p className="mt-4 text-center text-gray-600">
            主流 AI 服务商全覆盖，最新模型实时同步
          </p>
          <div className="mt-12 grid grid-cols-4 gap-4">
            {providers.map((p) => (
              <div
                key={p.name}
                className={`flex items-center gap-3 border px-4 py-3 ${p.color} transition-all hover:shadow-sm`}
              >
                <Image
                  src={p.icon}
                  alt={p.name}
                  width={24}
                  height={24}
                  className="shrink-0"
                />
                <div className="min-w-0">
                  <p className="font-semibold text-sm">{p.name}</p>
                  <p className="text-xs opacity-70 truncate">{p.models}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quick Start */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900">
            快速开始
          </h2>
          <p className="mt-4 text-center text-gray-600">
            4 条命令，5 分钟启动
          </p>
          <CopyTerminal />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-8">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-sm text-gray-500">
            <p>&copy; 2026 MultiWebLLM. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
