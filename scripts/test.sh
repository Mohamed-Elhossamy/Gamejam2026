#!/bin/bash
# Runs every deterministic test. Skips controller and *.integration tests,
# which need the server running (see README).
cd "$(dirname "$0")/.." || exit 1
status=0
for test in web/src/game/*.test.ts web/src/components/math/*.test.ts; do
  case "$test" in *controller.test.ts|*integration.test.ts) continue ;; esac
  if out=$(pnpm --silent exec tsx "$PWD/$test" 2>&1); then
    echo "PASS $(basename "$test")"
  else
    echo "FAIL $(basename "$test")"; echo "$out" | tail -15; status=1
  fi
done
exit $status
