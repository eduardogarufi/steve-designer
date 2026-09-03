#!/usr/bin/env bash
# PostToolUse hook: runs design-lint on a single edited UI file.
# Silent on pass; emits a blocking message on violation. Reads tool input JSON from stdin.
set -euo pipefail
INPUT="$(cat)"
FILE="$(printf '%s' "$INPUT" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("tool_input",{}).get("file_path",""))' 2>/dev/null || true)"
case "$FILE" in
  *.tsx|*.jsx|*.css) ;;
  *) exit 0 ;;
esac
ROOT="$(git -C "$(dirname "$FILE")" rev-parse --show-toplevel 2>/dev/null || true)"
[ -z "$ROOT" ] && exit 0
MANIFEST=""
if [ -f "$ROOT/docs/design/manifest.json" ] && [ -f "$ROOT/design-system-manifest.json" ]; then
  echo "design-lint: both docs/design/manifest.json and design-system-manifest.json exist — resolve the ambiguity." >&2
  exit 2
elif [ -f "$ROOT/docs/design/manifest.json" ]; then
  MANIFEST="$ROOT/docs/design/manifest.json"
elif [ -f "$ROOT/design-system-manifest.json" ]; then
  MANIFEST="$ROOT/design-system-manifest.json"
else
  exit 0
fi
if ! OUT="$(node "$ROOT/scripts/design_lint.mjs" --manifest "$MANIFEST" "$FILE" 2>&1)"; then
  echo "design-lint blocked this edit:" >&2
  echo "$OUT" >&2
  exit 2   # exit 2 surfaces the message back to the agent
fi
exit 0
