#!/usr/bin/env bash
#
# hook_design_lint.sh — portable in-session design-lint gate for CLI hooks.
#
# Used by the Codex adapter (.codex/hooks.json -> hooks.PostToolUse on apply_patch).
# Silent and successful on a project that is not governed. When the governed design
# system is violated it writes the findings to stderr and exits 2, which is the
# feedback contract Codex uses for PostToolUse (exit 2 + stderr => the model sees
# the reason and continues).
#
# The git-level gate (pre-commit + CI) remains the guarantee — this is convenience.

set -u

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -z "$ROOT" ] && exit 0

# Not a governed project: nothing to enforce.
if [ ! -f "$ROOT/docs/design/manifest.json" ] && [ ! -f "$ROOT/design-system-manifest.json" ]; then
  exit 0
fi

# Hook commands run with the session cwd, which may be a subdirectory.
cd "$ROOT" || exit 0

if [ ! -f "$ROOT/scripts/design_lint.mjs" ]; then
  echo "design-lint: manifest present but scripts/design_lint.mjs is missing — run the enforce workflow." >&2
  exit 0
fi

FINDINGS="$(node "$ROOT/scripts/design_lint.mjs" --changed 2>&1)"
STATUS=$?

if [ "$STATUS" -ne 0 ]; then
  printf '%s\n' "$FINDINGS" >&2
  exit 2
fi

exit 0
