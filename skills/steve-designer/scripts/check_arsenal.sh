#!/usr/bin/env bash
#
# check_arsenal.sh — verifies steve-designer's prerequisites for the CLI it is running in.
#
# Steve Designer runs in Claude Code, Kilo, and Codex. The design-system law is the
# same everywhere (AGENTS.md + docs/design/ + design_lint + pre-commit + CI); what
# differs is the surrounding toolchain:
#
#   Claude Code : frontend-design, ui-ux-pro-max-skill, context7, playwright, chrome-devtools
#   Kilo        : MCP servers declared in kilo.json (context7, playwright)
#   Codex       : MCP servers declared in ~/.codex/config.toml (context7, playwright)
#
# `frontend-design` and `ui-ux-pro-max-skill` are Claude Code plugins. Outside
# Claude Code they are reported as unavailable and Creation mode runs degraded —
# Governance and Direction do not depend on them.
#
# Usage:
#   check_arsenal.sh                  # report only (default)
#   check_arsenal.sh --cli kilo       # force the CLI instead of auto-detecting
#   check_arsenal.sh --install        # report, then offer to run install commands
#   check_arsenal.sh --install -y     # same, but skip the confirmation prompt
#   check_arsenal.sh --help
#
# Exit codes:
#   0 — everything actionable is present (degraded-only items do not fail the check)
#   1 — something actionable is missing and not installed
#   2 — no supported CLI detected (invalid environment)

set -u

# -------- parse args --------
INSTALL=0
ASSUME_YES=0
FORCED_CLI=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --cli)
      [[ $# -ge 2 && -n "${2:-}" ]] || {
        echo "--cli requires a value: claude, kilo, or codex" >&2
        exit 1
      }
      FORCED_CLI="$2"; shift 2 ;;
    --install)   INSTALL=1;    shift ;;
    -y|--yes)    ASSUME_YES=1; shift ;;
    -h|--help)
      cat <<'HELP'
check_arsenal.sh — verify steve-designer prerequisites for the current CLI

Usage:
  check_arsenal.sh                  report only (default)
  check_arsenal.sh --cli <name>     force the CLI: claude | kilo | codex
  check_arsenal.sh --install        report, then offer to run install commands
  check_arsenal.sh --install -y     install without confirmation prompt
  check_arsenal.sh --help           show this message

Exit codes:
  0  everything actionable is present
  1  something actionable is missing
  2  no supported CLI detected
HELP
      exit 0
      ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

# -------- colors (only if tty) --------
if [[ -t 1 ]]; then
  BOLD=$'\033[1m'; DIM=$'\033[2m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'
  RED=$'\033[31m'; CYAN=$'\033[36m'; RESET=$'\033[0m'
else
  BOLD=''; DIM=''; GREEN=''; YELLOW=''; RED=''; CYAN=''; RESET=''
fi

# -------- detect the CLI --------
detect_cli() {
  if [[ -n "$FORCED_CLI" ]]; then echo "$FORCED_CLI"; return; fi
  # Environment hints first: they identify the CLI we are actually running inside.
  [[ -n "${CLAUDECODE:-}" ]] && { echo "claude"; return; }
  [[ -n "${KILO_CONFIG_DIR:-}" || -n "${KILO_CONFIG:-}" ]] && { echo "kilo"; return; }
  [[ -n "${CODEX_HOME:-}" ]] && { echo "codex"; return; }
  for candidate in claude kilo codex; do
    if command -v "$candidate" >/dev/null 2>&1; then echo "$candidate"; return; fi
  done
  echo ""
}

CLI="$(detect_cli)"
case "$CLI" in
  claude|kilo|codex) ;;
  *)
    echo "${RED}No supported CLI detected.${RESET}"
    echo "steve-designer runs inside Claude Code, Kilo, or Codex."
    echo "  Claude Code: https://docs.claude.com/claude-code"
    echo "  Kilo:        https://kilo.ai/docs"
    echo "  Codex:       https://developers.openai.com/codex"
    echo ""
    echo "${DIM}Pass --cli <claude|kilo|codex> to force one.${RESET}"
    exit 2
    ;;
esac

# -------- helpers --------
mark_ok()        { printf "  ${GREEN}✓${RESET} %s\n" "$1"; }
mark_missing()   { printf "  ${YELLOW}✗${RESET} %s  ${DIM}%s${RESET}\n" "$1" "$2"; }
mark_degraded()  { printf "  ${CYAN}~${RESET} %s  ${DIM}%s${RESET}\n" "$1" "$2"; }

MISSING_COMMANDS=()

claude_plugin_installed() {
  command -v claude >/dev/null 2>&1 || return 1
  claude plugin list 2>/dev/null | grep -qi -- "$1"
}

claude_mcp_installed() {
  command -v claude >/dev/null 2>&1 || return 1
  claude mcp list 2>/dev/null | grep -qi -- "$1"
}

# Grep a JSON/TOML config for a server key, across project and user scope.
config_mentions() {
  local needle="$1"; shift
  local file
  for file in "$@"; do
    [[ -f "$file" ]] || continue
    grep -qi -- "$needle" "$file" && return 0
  done
  return 1
}

kilo_mcp_installed() {
  config_mentions "$1" \
    "./.kilo/kilo.json" "./.kilo/kilo.jsonc" \
    "./kilo.json" "./kilo.jsonc" \
    "$HOME/.config/kilo/kilo.json" "$HOME/.config/kilo/kilo.jsonc"
}

codex_mcp_installed() {
  config_mentions "$1" "./.codex/config.toml" "$HOME/.codex/config.toml"
}

skill_dir_installed() {
  local name="$1"; shift
  local dir
  for dir in "$@"; do
    [[ -d "$dir/$name" ]] && return 0
  done
  return 1
}

# -------- report --------
echo ""
echo "${BOLD}steve-designer — arsenal check${RESET} ${DIM}(cli: $CLI)${RESET}"
echo ""

if [[ "$CLI" == "claude" ]]; then
  echo "${BOLD}Tier 1 — Essentials${RESET}"

  if claude_plugin_installed "frontend-design"; then
    mark_ok "frontend-design (plugin)"
  else
    mark_missing "frontend-design (plugin)" "— forces aesthetic direction in build"
    MISSING_COMMANDS+=("claude plugin add anthropic/frontend-design")
  fi

  if claude_plugin_installed "ui-ux-pro-max"; then
    mark_ok "ui-ux-pro-max-skill (plugin)"
  else
    mark_missing "ui-ux-pro-max-skill (plugin)" "— design vocabulary library"
    MISSING_COMMANDS+=("claude plugin add nextlevelbuilder/ui-ux-pro-max-skill")
  fi

  for server in context7 playwright chrome-devtools; do
    case "$server" in
      context7)        why="— up-to-date library docs";                 cmd="claude mcp add context7 -s user -- npx -y @upstash/context7-mcp@latest" ;;
      playwright)      why="— visual checkpoints (screenshots, browser automation)"; cmd="claude mcp add playwright -s user -- npx @playwright/mcp@latest" ;;
      chrome-devtools) why="— performance profiling in polish";         cmd="claude mcp add chrome-devtools -s user -- npx @anthropic-ai/chrome-devtools-mcp@latest" ;;
    esac
    if claude_mcp_installed "$server"; then
      mark_ok "$server (MCP)"
    else
      mark_missing "$server (MCP)" "$why"
      MISSING_COMMANDS+=("$cmd")
    fi
  done

  echo ""
  echo "${BOLD}Tier 2 — Polish pipeline${RESET}"
  for skill in baseline-ui fixing-accessibility fixing-motion-performance; do
    if skill_dir_installed "$skill" "$HOME/.claude/skills" "./.claude/skills"; then
      mark_ok "$skill (skill)"
    else
      mark_missing "$skill (skill)" "— polish pipeline"
      MISSING_COMMANDS+=("npx ui-skills add $skill")
    fi
  done
else
  # Kilo and Codex: MCP servers come from config files; the Anthropic design
  # plugins do not exist here, so Creation degrades instead of failing.
  echo "${BOLD}Tier 1 — MCP servers${RESET}"
  for server in context7 playwright; do
    case "$server" in
      context7)   why="— up-to-date library docs" ;;
      playwright) why="— visual checkpoints (screenshots, browser automation)" ;;
    esac
    if [[ "$CLI" == "kilo" ]]; then
      if kilo_mcp_installed "$server"; then mark_ok "$server (MCP)"
      else
        mark_missing "$server (MCP)" "$why"
        MISSING_COMMANDS+=("merge the '$server' block from dist/$CLI/kilo.json into your kilo.json")
      fi
    else
      if codex_mcp_installed "$server"; then mark_ok "$server (MCP)"
      else
        mark_missing "$server (MCP)" "$why"
        MISSING_COMMANDS+=("merge the '$server' block from dist/$CLI/.codex/mcp.toml into .codex/config.toml")
      fi
    fi
  done

  echo ""
  echo "${BOLD}Tier 2 — Design engines${RESET}"
  mark_degraded "frontend-design" "— Claude Code only; Creation runs degraded"
  mark_degraded "ui-ux-pro-max-skill" "— Claude Code only; Creation runs degraded"
  echo ""
  echo "${DIM}Governance and Direction do not depend on these — the design-system law is"
  echo "AGENTS.md + docs/design/ + design_lint + pre-commit + CI, identical in every CLI.${RESET}"

  if [[ "$CLI" == "codex" ]]; then
    echo ""
    echo "${BOLD}Tier 3 — In-session hook${RESET}"
    if grep -qF "hook_design_lint.sh" ./.codex/hooks.json "$HOME/.codex/hooks.json" 2>/dev/null; then
      mark_ok "PostToolUse hook on apply_patch"
      echo "${DIM}    Non-managed hooks must be trusted: run /hooks in Codex.${RESET}"
    else
      mark_missing "PostToolUse hook on apply_patch" "— convenience only; the git gate still holds"
      MISSING_COMMANDS+=("merge dist/codex/.codex/hooks.json into .codex/hooks.json")
    fi
  fi
fi

# -------- summary + install block --------
echo ""
if [[ ${#MISSING_COMMANDS[@]} -eq 0 ]]; then
  echo "${GREEN}${BOLD}All set.${RESET} steve-designer can operate at full capacity for $CLI."
  echo ""
  exit 0
fi

echo "${YELLOW}${BOLD}Missing ${#MISSING_COMMANDS[@]} actionable item(s).${RESET}"
echo ""
echo "${BOLD}Next steps:${RESET}"
echo ""
echo "${DIM}---BEGIN BLOCK---${RESET}"
for cmd in "${MISSING_COMMANDS[@]}"; do
  echo "$cmd"
done
echo "${DIM}---END BLOCK---${RESET}"
echo ""

if [[ $INSTALL -eq 0 ]]; then
  echo "${DIM}Re-run with --install to execute the install commands, or copy-paste them yourself.${RESET}"
  echo ""
  exit 1
fi

if [[ "$CLI" != "claude" ]]; then
  echo "${DIM}--install is a no-op for $CLI: MCP servers are config merges, not installs.${RESET}"
  echo "${DIM}Run ./install.sh --cli $CLI --global to write the fragments, then merge them.${RESET}"
  echo ""
  exit 1
fi

if [[ $ASSUME_YES -eq 0 ]]; then
  if [[ ! -t 0 ]]; then
    echo "${RED}--install requires a TTY for confirmation, or pass -y / --yes.${RESET}"
    exit 1
  fi
  read -rp "Run all ${#MISSING_COMMANDS[@]} command(s) now? [y/N]: " reply
  case "$reply" in
    y|Y|yes|YES) ;;
    *) echo "Aborted."; exit 1 ;;
  esac
fi

echo ""
echo "${BOLD}Installing...${RESET}"
FAILED=()
for cmd in "${MISSING_COMMANDS[@]}"; do
  echo ""
  echo "${DIM}\$ $cmd${RESET}"
  if ! bash -c "$cmd"; then
    FAILED+=("$cmd")
    echo "${RED}  ✗ Failed.${RESET}"
  else
    echo "${GREEN}  ✓ Done.${RESET}"
  fi
done

echo ""
if [[ ${#FAILED[@]} -eq 0 ]]; then
  echo "${GREEN}${BOLD}All ${#MISSING_COMMANDS[@]} item(s) installed.${RESET}"
  echo "${DIM}Restart Claude Code so new plugins/MCPs register.${RESET}"
  echo ""
  exit 0
fi

echo "${RED}${BOLD}${#FAILED[@]} command(s) failed:${RESET}"
for cmd in "${FAILED[@]}"; do
  echo "  ${RED}✗${RESET} $cmd"
done
echo ""
echo "${DIM}Re-run them manually, or re-run this script with --install once resolved.${RESET}"
echo ""
exit 1
