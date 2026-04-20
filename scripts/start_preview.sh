#!/usr/bin/env bash
#
# start_preview.sh — Start a local dev server for the current project
#
# Detects the project's framework and runs the appropriate dev command.
# Used by steve-designer in Phases 4 and 5 when previewing tokens or built sections.
#
# Usage:
#   ./start_preview.sh              # runs in current directory, prints the URL
#   ./start_preview.sh --path PATH  # runs in PATH
#   ./start_preview.sh --static     # serves static files (for tokens-preview.html etc.)
#
# Notes:
# - Does NOT block. Returns the URL once the server is up.
# - Writes the PID to .steve-designer-preview.pid for later stop.

set -euo pipefail

# -------- colors --------
if [[ -t 1 ]]; then
  BOLD=$'\033[1m'; DIM=$'\033[2m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'
  RED=$'\033[31m'; CYAN=$'\033[36m'; RESET=$'\033[0m'
else
  BOLD=''; DIM=''; GREEN=''; YELLOW=''; RED=''; CYAN=''; RESET=''
fi

# -------- parse args --------
TARGET_PATH="$PWD"
STATIC_MODE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --path) TARGET_PATH="$2"; shift 2 ;;
    --static) STATIC_MODE=true; shift ;;
    --help|-h)
      grep "^#" "$0" | head -15 | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

cd "$TARGET_PATH"

# -------- static server mode --------
if [[ "$STATIC_MODE" == "true" ]]; then
  PORT=8000
  # find a free port
  while lsof -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; do
    PORT=$((PORT + 1))
    if [[ $PORT -gt 8099 ]]; then
      echo "${RED}No free port between 8000-8099.${RESET}" >&2
      exit 1
    fi
  done

  echo "${CYAN}Starting static server on port $PORT...${RESET}"
  python3 -m http.server "$PORT" > /tmp/steve-designer-preview.log 2>&1 &
  PID=$!
  echo "$PID" > .steve-designer-preview.pid

  # wait up to 5s for the server to come up
  for i in {1..50}; do
    if curl -s "http://localhost:$PORT" >/dev/null 2>&1; then
      break
    fi
    sleep 0.1
  done

  echo "${GREEN}✓ Static server running${RESET}"
  echo "URL: ${BOLD}http://localhost:$PORT${RESET}"
  echo "PID: $PID (saved to .steve-designer-preview.pid)"
  exit 0
fi

# -------- framework detection --------
FRAMEWORK=""
DEV_CMD=""
DEFAULT_PORT=""

if [[ -f "package.json" ]]; then
  # Read package.json to detect framework
  if grep -q '"next"' package.json 2>/dev/null; then
    FRAMEWORK="Next.js"
    DEV_CMD="npm run dev"
    DEFAULT_PORT=3000
  elif grep -q '"vite"' package.json 2>/dev/null; then
    FRAMEWORK="Vite"
    DEV_CMD="npm run dev"
    DEFAULT_PORT=5173
  elif grep -q '"astro"' package.json 2>/dev/null; then
    FRAMEWORK="Astro"
    DEV_CMD="npm run dev"
    DEFAULT_PORT=4321
  elif grep -q '"remix"' package.json 2>/dev/null; then
    FRAMEWORK="Remix"
    DEV_CMD="npm run dev"
    DEFAULT_PORT=3000
  elif grep -q '"@sveltejs/kit"' package.json 2>/dev/null; then
    FRAMEWORK="SvelteKit"
    DEV_CMD="npm run dev"
    DEFAULT_PORT=5173
  elif grep -q '"expo"' package.json 2>/dev/null; then
    FRAMEWORK="Expo"
    DEV_CMD="npm run start"
    DEFAULT_PORT=8081
  else
    FRAMEWORK="Node (unknown)"
    DEV_CMD="npm run dev"
    DEFAULT_PORT=3000
  fi
elif [[ -f "index.html" ]]; then
  # Plain HTML — fall back to static server
  echo "${DIM}No package.json found. Using static server.${RESET}"
  exec "$0" --static --path "$TARGET_PATH"
else
  echo "${RED}Could not detect framework at $TARGET_PATH${RESET}" >&2
  echo "No package.json or index.html found." >&2
  exit 1
fi

echo "${CYAN}Detected: ${BOLD}$FRAMEWORK${RESET}"
echo "${CYAN}Running:  ${BOLD}$DEV_CMD${RESET}"
echo ""

# -------- check dependencies --------
if [[ ! -d "node_modules" ]]; then
  echo "${YELLOW}node_modules not found. Run 'npm install' first.${RESET}"
  echo "Aborting — I don't want to slow things down by installing without asking."
  exit 1
fi

# -------- launch dev server --------
mkdir -p /tmp
LOG=/tmp/steve-designer-preview.log
echo "${DIM}Logs: $LOG${RESET}"
nohup $DEV_CMD > "$LOG" 2>&1 &
PID=$!
echo "$PID" > .steve-designer-preview.pid

echo ""
echo "${DIM}Waiting for server to start (up to 30s)...${RESET}"

# wait for the port to respond
for i in {1..60}; do
  if curl -s "http://localhost:$DEFAULT_PORT" >/dev/null 2>&1; then
    echo ""
    echo "${GREEN}✓ Dev server up${RESET}"
    echo "URL: ${BOLD}http://localhost:$DEFAULT_PORT${RESET}"
    echo "PID: $PID"
    echo "Stop: kill $PID  (or delete .steve-designer-preview.pid after killing)"
    exit 0
  fi
  sleep 0.5
done

echo "${RED}Server did not respond within 30s.${RESET}"
echo "Check the log: $LOG"
exit 1
