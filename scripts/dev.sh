#!/bin/bash
# Runs λRush locally: bash scripts/dev.sh (or pnpm dev)
# Needs Node 22+, pnpm 10 and GHC on PATH. Installs dependencies if missing.
# Starts the server (which builds and supervises the Haskell maths engine)
# on port 8080 and the game on http://localhost:5173, then opens the browser.
set -e
cd "$(dirname "$0")/.."
API_PORT="${API_PORT:-8080}"
WEB_PORT="${WEB_PORT:-5173}"

missing=""
for tool in node pnpm ghc curl; do
  command -v "$tool" >/dev/null 2>&1 || missing="$missing $tool"
done
if [ -n "$missing" ]; then
  echo "Missing:$missing" >&2
  echo "On a Mac: brew install node pnpm ghc" >&2
  exit 1
fi

for port in "$API_PORT" "$WEB_PORT" 8091; do
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Port $port is already in use. Stop the old run first: lsof -ti tcp:$port | xargs kill" >&2
    exit 1
  fi
done

[ -d node_modules ] || pnpm install

PORT="$API_PORT" pnpm --filter @lambda-rush/server run dev &
API_PID=$!
trap 'kill $API_PID 2>/dev/null' EXIT

echo "Building and starting the Haskell maths engine (first run takes about a minute)..."
ready=""
for i in $(seq 1 180); do
  if curl -fs "http://localhost:$API_PORT/api/math/health" >/dev/null; then ready=1; break; fi
  if ! kill -0 "$API_PID" 2>/dev/null; then break; fi
  sleep 1
done
if [ -z "$ready" ]; then
  echo "The server did not start. Read the error above this line." >&2
  exit 1
fi

echo "Opening http://localhost:$WEB_PORT"
PORT="$WEB_PORT" BASE_PATH=/ API_PROXY="http://localhost:$API_PORT" pnpm --filter @lambda-rush/web run dev -- --open
