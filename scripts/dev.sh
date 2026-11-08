#!/bin/bash
# Runs λRush locally: bash scripts/dev.sh (or pnpm dev)
# Needs Node 24, pnpm 10 and GHC on PATH, and `pnpm install` done once.
# Starts the server (which builds and supervises the Haskell maths engine)
# on port 8080 and the game on http://localhost:5173.
set -e
cd "$(dirname "$0")/.."
API_PORT="${API_PORT:-8080}"
WEB_PORT="${WEB_PORT:-5173}"
PORT="$API_PORT" pnpm --filter @lambda-rush/server run dev &
API_PID=$!
trap 'kill $API_PID 2>/dev/null' EXIT
echo "Waiting for the Haskell maths engine..."
for i in $(seq 1 120); do
  curl -fs "http://localhost:$API_PORT/api/math/health" >/dev/null && break
  sleep 1
done
echo "Open http://localhost:$WEB_PORT"
PORT="$WEB_PORT" BASE_PATH=/ API_PROXY="http://localhost:$API_PORT" pnpm --filter @lambda-rush/web run dev
