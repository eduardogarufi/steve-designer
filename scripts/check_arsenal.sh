#!/usr/bin/env bash
#
# check_arsenal.sh — verifies steve-designer's prerequisite plugins, skills, and MCPs
#
# Exit codes:
#   0 — all essentials present
#   1 — some essentials missing (caller should surface install commands)
#   2 — claude CLI not found (user isn't in Claude Code)
#
# Output format: two sections printed to stdout
#   Section 1: human-readable status
#   Section 2: a single block of shell commands to install missing essentials
#              (empty if nothing missing)

set -u

# -------- colors (only if tty) --------
if [[ -t 1 ]]; then
  BOLD=$'\033[1m'; DIM=$'\033[2m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'
  RED=$'\033[31m'; RESET=$'\033[0m'
else
  BOLD=''; DIM=''; GREEN=''; YELLOW=''; RED=''; RESET=''
fi

# -------- preflight: claude CLI present? --------
if ! command -v claude >/dev/null 2>&1; then
  echo "${RED}claude CLI not found on PATH.${RESET}"
  echo "steve-designer runs inside Claude Code. Install Claude Code first:"
  echo "  https://docs.claude.com/claude-code"
  exit 2
fi

# -------- helpers --------
plugin_installed() {
  # `claude plugin list` format is not perfectly stable; grep permissively.
  claude plugin list 2>/dev/null | grep -qi -- "$1"
}

mcp_installed() {
  claude mcp list 2>/dev/null | grep -qi -- "$1"
}

# ui-skills is a separate npx-based registry; check via a heuristic.
ui_skill_installed() {
  # Look for the skill dir in the common locations.
  local name="$1"
  [[ -d "$HOME/.claude/skills/$name" ]] || \
  [[ -d "./.claude/skills/$name" ]] || \
  find "$HOME/.claude" -maxdepth 4 -type d -name "$name" 2>/dev/null | grep -q .
}

mark_ok()      { printf "  ${GREEN}✓${RESET} %s\n" "$1"; }
mark_missing() { printf "  ${YELLOW}✗${RESET} %s  ${DIM}%s${RESET}\n" "$1" "$2"; }

# -------- check essentials --------
echo ""
echo "${BOLD}steve-designer — arsenal check${RESET}"
echo ""
echo "${BOLD}Tier 1 — Essentials${RESET}"

MISSING_COMMANDS=()

# frontend-design
if plugin_installed "frontend-design"; then
  mark_ok "frontend-design (plugin)"
else
  mark_missing "frontend-design (plugin)" "— forces aesthetic direction in build"
  MISSING_COMMANDS+=("claude plugin add anthropic/frontend-design")
fi

# ui-ux-pro-max-skill
if plugin_installed "ui-ux-pro-max"; then
  mark_ok "ui-ux-pro-max-skill (plugin)"
else
  mark_missing "ui-ux-pro-max-skill (plugin)" "— design vocabulary library"
  MISSING_COMMANDS+=("claude plugin add nextlevelbuilder/ui-ux-pro-max-skill")
fi

# context7 MCP
if mcp_installed "context7"; then
  mark_ok "context7 (MCP)"
else
  mark_missing "context7 (MCP)" "— up-to-date library docs"
  MISSING_COMMANDS+=("claude mcp add context7 -s user -- npx -y @upstash/context7-mcp@latest")
fi

# playwright MCP
if mcp_installed "playwright"; then
  mark_ok "playwright (MCP)"
else
  mark_missing "playwright (MCP)" "— visual checkpoints (screenshots, browser automation)"
  MISSING_COMMANDS+=("claude mcp add playwright -s user -- npx @playwright/mcp@latest")
fi

# chrome-devtools MCP (essential for polish phase)
if mcp_installed "chrome-devtools"; then
  mark_ok "chrome-devtools (MCP)"
else
  mark_missing "chrome-devtools (MCP)" "— performance profiling in polish phase"
  MISSING_COMMANDS+=("claude mcp add chrome-devtools -s user -- npx @anthropic-ai/chrome-devtools-mcp@latest")
fi

# -------- check polish pipeline (Tier 2 but strongly recommended) --------
echo ""
echo "${BOLD}Tier 2 — Polish pipeline${RESET}"

if ui_skill_installed "baseline-ui"; then
  mark_ok "baseline-ui (skill)"
else
  mark_missing "baseline-ui (skill)" "— spacing/type/states polish"
  MISSING_COMMANDS+=("npx ui-skills add baseline-ui")
fi

if ui_skill_installed "fixing-accessibility"; then
  mark_ok "fixing-accessibility (skill)"
else
  mark_missing "fixing-accessibility (skill)" "— keyboard, focus, semantic HTML"
  MISSING_COMMANDS+=("npx ui-skills add fixing-accessibility")
fi

if ui_skill_installed "fixing-motion-performance"; then
  mark_ok "fixing-motion-performance (skill)"
else
  mark_missing "fixing-motion-performance (skill)" "— reduced-motion, 60fps budget"
  MISSING_COMMANDS+=("npx ui-skills add fixing-motion-performance")
fi

# -------- summary + install block --------
echo ""
if [[ ${#MISSING_COMMANDS[@]} -eq 0 ]]; then
  echo "${GREEN}${BOLD}All set.${RESET} steve-designer can operate at full capacity."
  echo ""
  exit 0
fi

echo "${YELLOW}${BOLD}Missing ${#MISSING_COMMANDS[@]} item(s).${RESET}"
echo ""
echo "${BOLD}Copy-paste to install everything missing:${RESET}"
echo ""
echo "${DIM}---BEGIN INSTALL BLOCK---${RESET}"
for cmd in "${MISSING_COMMANDS[@]}"; do
  echo "$cmd"
done
echo "${DIM}---END INSTALL BLOCK---${RESET}"
echo ""
echo "${DIM}After installing, restart Claude Code for plugins/MCPs to register.${RESET}"
echo ""

exit 1
