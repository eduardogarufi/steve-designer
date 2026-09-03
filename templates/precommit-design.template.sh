#!/usr/bin/env bash
# Installed by steve-designer at .git/hooks/pre-commit (or via husky/lefthook).
# Blocks commits that violate the design system.
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
if [ -n "${DESIGN_MANIFEST:-}" ]; then
  exec node "$ROOT/scripts/design_lint.mjs" --manifest "$DESIGN_MANIFEST" --changed
fi
if [ ! -f "$ROOT/docs/design/manifest.json" ] && [ ! -f "$ROOT/design-system-manifest.json" ]; then
  echo "design-lint: no manifest — run /steve-designer:enforce. Skipping."
  exit 0
fi
exec node "$ROOT/scripts/design_lint.mjs" --changed
