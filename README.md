# MultiWebLLM

> 个人 AI API 统一网关 - 将多个 AI 网页订阅转成 OpenAI 兼容 API

[![Version](https://img.shields.io/badge/version-0.0.1-blue.svg)](https://github.com/gentpan/multiwebllm)

## 功能特性

- **OpenAI 兼容 API** - 统一的 `/v1/chat/completions` 接口，支持流式输出
- **8 大 AI 服务商** - ChatGPT、Claude、Gemini、Grok、DeepSeek、Kimi、Minimax、豆包
- **管理后台** - 蓝绿配色 SaaS 风格界面，全中文
- **多密钥管理** - 为不同站点分配独立 API Key，独立配额和限流
- **用量统计** - 实时请求监控、Token 用量图表、按模型/服务商维度分析
- **配额管理** - 本地计数限流 + 远程额度抓取双模式
- **Docker 部署** - 一键 `docker compose up`

## 技术栈

| 组件 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router) |
| 语言 | TypeScript |
| UI | shadcn/ui + Tailwind CSS |
| 图表 | Recharts |
| 数据库 | PostgreSQL + Drizzle ORM |
| 部署 | Docker Compose |

## 支持的服务商

| 服务商 | 聊天 | 图片生成 | 状态 |
|--------|------|----------|------|
| ChatGPT | ✅ | ✅ (DALL-E) | 可用 |
| Claude | ✅ | - | 可用 |
| Gemini | ✅ | - | 可用 |
| Grok | ✅ | - | 可用 |
| DeepSeek | ✅ | - | 可用 |
| Kimi | ✅ | - | 可用 |
| Minimax | ✅ | - | 可用 |
| 豆包 | ✅ | - | 可用 |

## 快速开始

### 环境要求

- Docker & Docker Compose
- 域名 (可选，用于 HTTPS)

### 部署

```bash
# 克隆项目
git clone https://github.com/gentpan/multiwebllm.git
cd multiwebllm

# 配置环境变量
cp .env.example .env
# 编辑 .env 设置数据库密码、管理员密码等

# 启动服务
docker compose up -d

# 初始化数据库
docker run --rm --network multiwebllm_aiproxy-net \
  -e DATABASE_URL='postgres://aiproxy:YOUR_PASSWORD@postgres:5432/aiproxy' \
  -v $(pwd):/app -w /app node:22-alpine \
  sh -c 'npm ci && npx drizzle-kit push && npx tsx src/lib/db/seed.ts'

# 访问管理后台
# http://localhost:3000/login
```

### 本地开发

```bash
npm install
docker compose up postgres -d
npm run db:push
npm run db:seed
npm run dev
```

## API 使用

```bash
# 聊天补全 (OpenAI 兼容)
curl https://your-domain.com/v1/chat/completions \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-v3",
    "messages": [{"role": "user", "content": "你好"}],
    "stream": true
  }'

# 查看可用模型
curl https://your-domain.com/v1/models \
  -H "Authorization: Bearer sk-your-api-key"
```

## 项目结构

```
src/
├── app/
│   ├── api/v1/          # OpenAI 兼容 API
│   ├── api/admin/       # 管理后台 API
│   ├── dashboard/       # 管理后台页面
│   └── login/           # 登录页
├── lib/
│   ├── providers/       # 8个服务商实现
│   ├── db/              # 数据库 Schema
│   └── auth.ts          # 认证
└── components/          # UI 组件
```

## 配置服务商

1. 登录管理后台
2. 进入「服务商管理」页面
3. 选择对应的服务商，填入 Cookie/Token
4. 点击「测试」验证连通性

### 获取 Cookie

1. 在浏览器中登录对应的 AI 服务
2. F12 打开开发者工具 -> Application -> Cookies
3. 复制所有 Cookie 为 JSON 格式
4. 粘贴到服务商配置的「认证数据」字段

## License

MIT
