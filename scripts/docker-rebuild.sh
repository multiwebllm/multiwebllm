#!/bin/sh
# 从仓库根目录执行：重建 multiwebllm-app 并启动依赖
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 1

echo "==> db:push"
docker compose run --rm multiwebllm-migrate

echo "==> build multiwebllm-app (--no-cache)"
docker compose build --no-cache multiwebllm-app

echo "==> up -d"
docker compose up -d multiwebllm-app

if curl -sf -o /dev/null "http://127.0.0.1:3000/login"; then
  echo "==> OK http://127.0.0.1:3000"
else
  echo "==> 应用已启动，请稍候再访问 http://127.0.0.1:3000"
fi
