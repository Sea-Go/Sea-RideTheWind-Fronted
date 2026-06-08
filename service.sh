#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
RUNTIME_DIR="$ROOT_DIR/.runtime"
PID_FILE="$RUNTIME_DIR/frontend.pid"
LOG_FILE="$RUNTIME_DIR/frontend.log"

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-3001}"
BUILD_NODE_OPTIONS="${BUILD_NODE_OPTIONS:---max-old-space-size=768}"
RUNTIME_NODE_OPTIONS="${RUNTIME_NODE_OPTIONS:---max-old-space-size=384}"
BUILD_ON_START="${BUILD_ON_START:-0}"
LOW_MEMORY_BUILD="${LOW_MEMORY_BUILD:-1}"
PNPM_NETWORK_CONCURRENCY="${PNPM_NETWORK_CONCURRENCY:-8}"
PNPM_CHILD_CONCURRENCY="${PNPM_CHILD_CONCURRENCY:-2}"

pnpm_cmd() {
  corepack pnpm "$@"
}

ensure_runtime_dir() {
  mkdir -p "$RUNTIME_DIR"
}

find_running_pid() {
  if [ -f "$PID_FILE" ]; then
    pid=$(cat "$PID_FILE" 2>/dev/null || true)
    if [ -n "${pid:-}" ] && kill -0 "$pid" 2>/dev/null; then
      echo "$pid"
      return 0
    fi
  fi

  if command -v ss >/dev/null 2>&1; then
    pid=$(ss -ltnp "sport = :$PORT" 2>/dev/null | sed -n 's/.*pid=\([0-9][0-9]*\).*/\1/p' | head -n 1)
    if [ -n "${pid:-}" ] && kill -0 "$pid" 2>/dev/null; then
      echo "$pid"
      return 0
    fi
  fi

  return 1
}

install_deps() {
  if [ -d "$ROOT_DIR/node_modules" ]; then
    return 0
  fi

  echo "==> pnpm install"
  (
    cd "$ROOT_DIR"
    HUSKY=0 CI=1 pnpm_cmd install \
      --frozen-lockfile \
      --prefer-offline \
      --network-concurrency="$PNPM_NETWORK_CONCURRENCY" \
      --child-concurrency="$PNPM_CHILD_CONCURRENCY"
  )
}

build_app() {
  install_deps
  echo "==> next build"
  (
    cd "$ROOT_DIR"
    NEXT_TELEMETRY_DISABLED=1 \
      LOW_MEMORY_BUILD="$LOW_MEMORY_BUILD" \
      NODE_OPTIONS="$BUILD_NODE_OPTIONS" \
      pnpm_cmd exec next build
  )
}

is_running() {
  pid=$(find_running_pid 2>/dev/null || true)
  if [ -z "${pid:-}" ]; then
    return 1
  fi

  printf '%s\n' "$pid" > "$PID_FILE"
  return 0
}

start_app() {
  ensure_runtime_dir

  if [ ! -f "$ROOT_DIR/.next/standalone/server.js" ]; then
    if [ "$BUILD_ON_START" != "1" ]; then
      echo "ERROR: missing .next/standalone/server.js" >&2
      echo "Refusing to build during start on this low-resource server." >&2
      echo "Run './service.sh build' on a stronger machine and upload the build output," >&2
      echo "or set BUILD_ON_START=1 if you really want to build here." >&2
      exit 1
    fi

    build_app
  fi

  if is_running; then
    echo "==> frontend already running (pid $(cat "$PID_FILE"))"
    return 0
  fi

  load_runtime_env

  echo "==> start frontend"
  (
    cd "$ROOT_DIR"
    nohup env \
      NODE_ENV=production \
      NEXT_TELEMETRY_DISABLED=1 \
      HOSTNAME="$HOST" \
      PORT="$PORT" \
      NODE_OPTIONS="$RUNTIME_NODE_OPTIONS" \
      node .next/standalone/server.js >"$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
  )

  sleep 3

  if is_running; then
    echo "==> frontend started on ${HOST}:${PORT} (pid $(cat "$PID_FILE"))"
    return 0
  fi

  echo "ERROR: frontend failed to start, see $LOG_FILE" >&2
  exit 1
}

stop_app() {
  pid=$(find_running_pid 2>/dev/null || true)
  if [ -z "${pid:-}" ]; then
    rm -f "$PID_FILE"
    echo "==> frontend not running"
    return 0
  fi

  kill "$pid"
  rm -f "$PID_FILE"
  echo "==> frontend stopped"
}

status_app() {
  if is_running; then
    echo "running pid=$(cat "$PID_FILE") port=$PORT"
  else
    echo "stopped"
  fi
}

logs_app() {
  ensure_runtime_dir
  tail -n 80 "$LOG_FILE"
}

load_runtime_env() {
  set -a
  if [ -f "$ROOT_DIR/.env" ]; then
    . "$ROOT_DIR/.env"
  fi
  if [ -f "$ROOT_DIR/.env.local" ]; then
    . "$ROOT_DIR/.env.local"
  fi
  set +a
}

case "${1:-}" in
  install)
    install_deps
    ;;
  build)
    build_app
    ;;
  start)
    start_app
    ;;
  stop)
    stop_app
    ;;
  restart)
    stop_app
    start_app
    ;;
  status)
    status_app
    ;;
  logs)
    logs_app
    ;;
  *)
    echo "Usage: $0 {install|build|start|stop|restart|status|logs}" >&2
    exit 1
    ;;
esac
