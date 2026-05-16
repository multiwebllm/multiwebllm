#!/bin/bash
# MultiWebLLM 自动升级脚本
# 用法:
#   手动: ./scripts/upgrade.sh
#   自动: crontab -e → */2 * * * * /opt/aiproxy/scripts/upgrade.sh

set -e

APP_DIR="/opt/aiproxy"
FLAG_FILE="$APP_DIR/.upgrade-requested"
LOG_FILE="$APP_DIR/upgrade.log"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
  echo "$1"
}

# 检查是否有升级请求 (webhook 触发) 或手动执行
if [ "$1" != "--force" ] && [ ! -f "$FLAG_FILE" ]; then
  exit 0
fi

log "开始升级..."

# 删除标记文件
rm -f "$FLAG_FILE"

cd "$APP_DIR"

# 拉取最新代码
log "拉取最新代码..."
git pull origin main 2>&1 | tee -a "$LOG_FILE"

# 重建并重启
log "重建 Docker 镜像..."
docker compose build 2>&1 | tail -5 >> "$LOG_FILE"

log "重启服务..."
docker compose down 2>&1 >> "$LOG_FILE"
docker compose up -d 2>&1 >> "$LOG_FILE"

# 检查是否有新的 seed 数据需要更新
log "检查数据库更新..."
docker run --rm --network aiproxy_aiproxy-net \
  -e DATABASE_URL='postgres://aiproxy:Proxy@2025-Secure@aiproxy-postgres-1:5432/aiproxy' \
  -v "$APP_DIR":/app -w /app node:22-alpine \
  sh -c 'npx tsx src/lib/db/seed.ts 2>&1' >> "$LOG_FILE" 2>&1

log "升级完成!"
