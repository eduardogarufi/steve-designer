#!/usr/bin/env bash
# Installed by steve-designer Sheriff Mode at .git/hooks/pre-commit (or via husky/lefthook).
# Blocks commits that violate the design system.
set -euo pipefail
MANIFEST="${DESIGN_MANIFEST:-design-system-manifest.json}"
if [ ! -f "$MANIFEST" ]; then
  echo "design-lint: no manifest ($MANIFEST) — run /steve-designer:guard. Skipping."
  exit 0
fi
node "$(git rev-parse --show-toplevel)/scripts/design_lint.mjs" --manifest "$MANIFEST" --changed
