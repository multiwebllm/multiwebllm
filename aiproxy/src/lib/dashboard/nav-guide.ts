import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Monitor,
  ScrollText,
  Unplug,
  BrainCircuit,
  KeySquare,
  SlidersHorizontal,
  BookOpen,
} from "lucide-react";

export interface DashboardNavItem {
  href: string;
  label: string;
  /** 侧栏一行说明 */
  description: string;
  icon: LucideIcon;
}

export const dashboardNavItems: DashboardNavItem[] = [
  {
    href: "/dashboard",
    label: "控制台",
    description: "今日概览与用量",
    icon: LayoutDashboard,
  },
  {
    href: "/dashboard/monitoring",
    label: "运维监控",
    description: "趋势 · 延迟 · 资源",
    icon: Monitor,
  },
  {
    href: "/dashboard/records",
    label: "使用记录",
    description: "明细 · 筛选 · 导出",
    icon: ScrollText,
  },
  {
    href: "/dashboard/providers",
    label: "服务商管理",
    description: "Cookie · 连接测试",
    icon: Unplug,
  },
  {
    href: "/dashboard/models",
    label: "模型配置",
    description: "同步 · 启用模型",
    icon: BrainCircuit,
  },
  {
    href: "/dashboard/keys",
    label: "API 密钥",
    description: "配额 · 限流",
    icon: KeySquare,
  },
  {
    href: "/dashboard/guide",
    label: "使用说明",
    description: "设置 · 配置 · 引用",
    icon: BookOpen,
  },
  {
    href: "/dashboard/settings",
    label: "系统设置",
    description: "账号 · 巡检 · 通知",
    icon: SlidersHorizontal,
  },
];

export interface GuideStep {
  title: string;
  body: string;
}

export interface GuidePageSection {
  id: string;
  navHref: string;
  title: string;
  summary: string;
  setup?: string[];
  configure?: string[];
  tips?: string[];
}

/** 「如何配置」：与各侧栏页面对应 */
export const guidePageSections: GuidePageSection[] = [
  {
    id: "dashboard",
    navHref: "/dashboard",
    title: "控制台",
    summary: "查看 API 密钥数量、今日请求、Token 与最近调用，快速判断网关是否在跑。",
    configure: [
      "顶部时间范围可选 24 小时 / 7 天 / 30 天。",
      "「最近调用」仅展示摘要；逐条明细请打开「使用记录」。",
    ],
  },
  {
    id: "monitoring",
    navHref: "/dashboard/monitoring",
    title: "运维监控",
    summary: "短周期（1 分钟～24 小时）趋势、延迟、错误与机器资源；不做分页明细。",
    configure: [
      "选择时间范围后图表自动刷新；「重新测试」仅重测侧栏延迟。",
      "「最近错误」可跳到使用记录并预筛失败记录。",
    ],
    tips: ["长周期日志与 CSV 导出请用「使用记录」。"],
  },
  {
    id: "records",
    navHref: "/dashboard/records",
    title: "使用记录",
    summary: "分页查看每次 API 调用，支持按密钥、模型、服务商、状态筛选与导出 CSV。",
    configure: [
      "时间范围最长 30 天；支持 URL 参数 ?status=error 只看失败。",
      "导出 CSV 为当前筛选条件下的当前页数据（需翻页导出全量时可调 pageSize）。",
    ],
    tips: ["趋势分析请用「运维监控」。"],
  },
  {
    id: "providers",
    navHref: "/dashboard/providers",
    title: "服务商管理",
    summary: "配置 ChatGPT / Claude / Gemini / Grok / Kimi 的 Cookie 或自定义 OpenAI 兼容端点。",
    setup: [
      "内置五家：选择预设 slug，填写与官网一致的基础地址（如 https://chatgpt.com）。",
      "推荐安装 Cookie Editor，在浏览器登录目标站点后导出 JSON，再回到后台剪贴板导入。",
      "保存后点击「测试连接」确认 Cookie 有效。",
    ],
    configure: [
      "自定义服务商：自填 slug、baseUrl、认证方式及 /v1/chat/completions、/v1/models 路径。",
      "Cookie 须在「本页」保存；系统设置里的批量 Cookie 目前不会参与转发。",
    ],
    tips: ["侧栏「服务状态」显示是否启用；延迟需点「重新测试」。"],
  },
  {
    id: "models",
    navHref: "/dashboard/models",
    title: "模型配置",
    summary: "管理对外 model_id、上游模型 ID、类型（聊天/图片/视频等）与启用状态。",
    setup: [
      "先完成服务商 Cookie 配置，再在本页点击「同步模型」。",
    ],
    configure: [
      "同步会合并 2026 目录与官网列表，并过滤 gpt-4o 等已下线旧版。",
      "可手动添加模型或编辑「上下文 / 默认输出」Token 上限。",
      "客户端请求里的 model 填本页「模型 ID」列。",
    ],
  },
  {
    id: "keys",
    navHref: "/dashboard/keys",
    title: "API 密钥",
    summary: "创建供 Cursor、脚本等使用的 Bearer Token，可限模型、配额与每分钟请求数。",
    setup: [
      "添加密钥并复制 sk- 开头的字符串，仅创建时完整显示一次。",
    ],
    configure: [
      "「允许模型」留空表示全部启用模型；可勾选子集限制访问。",
      "月配额为 0 表示不限制；rate limit 为每分钟请求数。",
    ],
  },
  {
    id: "settings",
    navHref: "/dashboard/settings",
    title: "系统设置",
    summary: "管理后台账号、全局限流、配额默认值、Telegram 通知与定时巡检。",
    configure: [
      "修改管理员密码、开启 2FA。",
      "配置 CRON_SECRET 后，Docker 内 health-cron 可每日触发服务商巡检。",
    ],
  },
];

export const setupFlowSteps: GuideStep[] = [
  {
    title: "1. 部署并登录",
    body: "Docker 启动后访问 http://127.0.0.1:3000/login，使用 .env 中的管理员账号登录。",
  },
  {
    title: "2. 配置服务商",
    body: "进入「服务商管理」，为每家填写基础地址并保存 Cookie（推荐 Cookie Editor 导出 JSON 后剪贴板导入）。测试连接通过后再进行下一步。",
  },
  {
    title: "3. 同步模型",
    body: "进入「模型配置」，点击「同步模型」。确认列表中有需要的聊天/图片等模型并保持「启用」。",
  },
  {
    title: "4. 创建 API 密钥",
    body: "进入「API 密钥」，新建密钥并复制。在客户端中将 base_url 指向本网关地址。",
  },
  {
    title: "5. 验证调用",
    body: "用 curl 或 Cursor 发一条 chat/completions，在「使用记录」中应能看到成功记录。",
  },
];

export const apiReferenceBlocks = {
  baseUrl: "http://127.0.0.1:3000",
  authHeader: "Authorization: Bearer <你的 API Key>",
  chat: `curl http://127.0.0.1:3000/v1/chat/completions \\
  -H "Authorization: Bearer sk-xxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-5.5",
    "messages": [{"role": "user", "content": "你好"}],
    "stream": true
  }'`,
  models: `curl http://127.0.0.1:3000/v1/models \\
  -H "Authorization: Bearer sk-xxxx"`,
  images: `curl http://127.0.0.1:3000/v1/images/generations \\
  -H "Authorization: Bearer sk-xxxx" \\
  -H "Content-Type: application/json" \\
  -d '{"prompt": "a cat", "model": "gpt-image-2"}'`,
  cursor: `// Cursor / Continue 等（OpenAI 兼容）
Base URL: http://127.0.0.1:3000/v1
API Key: sk-xxxx（后台创建的密钥）
Model: 模型配置页中的「模型 ID」，如 gpt-5.5、claude-opus-4.7`,
};
