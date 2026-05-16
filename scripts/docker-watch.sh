#!/bin/sh
# 监听 aiproxy 源码变更，防抖后自动 docker-rebuild
# 用法（仓库根目录）：./scripts/docker-watch.sh
# 或：cd aiproxy && npm run docker:watch
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/aiproxy"
DEBOUNCE_SEC="${DOCKER_WATCH_DEBOUNCE:-4}"

WATCH_PATHS="$APP/src $APP/public $APP/package.json $APP/package-lock.json $APP/next.config.ts $APP/tsconfig.json"

echo "监听目录（${DEBOUNCE_SEC}s 防抖后重建）:"
echo "  $WATCH_PATHS"
echo "按 Ctrl+C 停止"
echo ""

LAST_RUN=0
LOCK="$ROOT/.docker-watch.lock"

do_rebuild() {
  if [ -f "$LOCK" ]; then
    return
  fi
  now=$(date +%s)
  if [ "$LAST_RUN" -gt 0 ] && [ $((now - LAST_RUN)) -lt "$DEBOUNCE_SEC" ]; then
    return
  fi
  LAST_RUN=$now
  touch "$LOCK"
  trap 'rm -f "$LOCK"' EXIT INT TERM
  echo ""
  echo "[$(date '+%H:%M:%S')] 检测到变更，开始重建…"
  sh "$ROOT/scripts/docker-rebuild.sh" || echo "[docker-watch] 重建失败"
  rm -f "$LOCK"
  echo "[$(date '+%H:%M:%S')] 继续监听…"
  echo ""
}

if command -v fswatch >/dev/null 2>&1; then
  # shellcheck disable=SC2086
  fswatch -l 0.2 -r $WATCH_PATHS | while read -r _; do
    do_rebuild
  done
elif command -v docker >/dev/null 2>&1 && docker compose version 2>/dev/null | grep -q watch; then
  echo "未安装 fswatch，改用 docker compose watch（仅重建 app 镜像）"
  cd "$ROOT" || exit 1
  docker compose watch multiwebllm-app
else
  echo "建议安装 fswatch: brew install fswatch"
  echo "正在使用轮询模式（每 5 秒检查 mtime）…"
  while true; do
    sleep 5
    newest=0
    for p in $WATCH_PATHS; do
      [ -e "$p" ] || continue
      if [ -d "$p" ]; then
        t=$(find "$p" -type f -print0 2>/dev/null | xargs -0 stat -f "%m" 2>/dev/null | sort -n | tail -1)
      else
        t=$(stat -f "%m" "$p" 2>/dev/null || echo 0)
      fi
      [ -n "$t" ] && [ "$t" -gt "$newest" ] && newest=$t
    done
    if [ "$newest" -gt "${LAST_MTIME:-0}" ]; then
      LAST_MTIME=$newest
      do_rebuild
    fi
  done
fi
