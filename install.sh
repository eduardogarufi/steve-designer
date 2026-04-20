#!/usr/bin/env bash
#
# steve-designer installer
#
# Registers this plugin as a Claude Code marketplace and installs it.
# Claude Code does NOT auto-discover plugins in ~/.claude/plugins; plugins must
# be added via `claude plugin marketplace add` + `claude plugin install`.
#
# Usage:
#   ./install.sh                 # interactive — asks local clone or GitHub
#   ./install.sh --local         # register this directory as a marketplace
#   ./install.sh --github        # register the GitHub repo as a marketplace
#   ./install.sh --uninstall     # remove plugin + marketplace
#   ./install.sh --help
#
# After install, RESTART Claude Code so the new commands/skills register.

set -euo pipefail

REPO_SHORT="eduardogarufi/steve-designer"
MARKETPLACE_NAME="steve-designer"
PLUGIN_NAME="steve-designer"

# -------- colors --------
if [[ -t 1 ]]; then
  BOLD=$'\033[1m'; DIM=$'\033[2m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'
  RED=$'\033[31m'; CYAN=$'\033[36m'; RESET=$'\033[0m'
else
  BOLD=''; DIM=''; GREEN=''; YELLOW=''; RED=''; CYAN=''; RESET=''
fi

# -------- parse args --------
MODE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --local)     MODE="local";     shift ;;
    --github)    MODE="github";    shift ;;
    --uninstall) MODE="uninstall"; shift ;;
    --help|-h)
      cat <<'HELP'
steve-designer installer

Registers the plugin as a Claude Code marketplace, then installs it.

Usage:
  ./install.sh               interactive
  ./install.sh --local       register this directory as a marketplace
  ./install.sh --github      register the GitHub repo as a marketplace
  ./install.sh --uninstall   remove plugin + marketplace
  ./install.sh --help

After install, RESTART Claude Code so the new commands register.
HELP
      exit 0
      ;;
    *) echo "${RED}Unknown argument: $1${RESET}" >&2; exit 1 ;;
  esac
done

# -------- preflight --------
if ! command -v claude >/dev/null 2>&1; then
  echo "${RED}claude CLI not found on PATH.${RESET}"
  echo "steve-designer is a Claude Code plugin. Install Claude Code first:"
  echo "  https://docs.claude.com/claude-code"
  exit 2
fi

SCRIPT_DIR="$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# -------- uninstall --------
if [[ "$MODE" == "uninstall" ]]; then
  echo "${BOLD}Uninstalling steve-designer...${RESET}"
  claude plugin uninstall "${PLUGIN_NAME}@${MARKETPLACE_NAME}" 2>&1 || true
  claude plugin marketplace remove "${MARKETPLACE_NAME}" 2>&1 || true
  echo "${GREEN}✓ Removed.${RESET}"
  echo "${DIM}Restart Claude Code to unload the plugin.${RESET}"
  exit 0
fi

# -------- interactive mode selection --------
if [[ -z "$MODE" ]]; then
  echo ""
  echo "${BOLD}${CYAN}steve-designer installer${RESET}"
  echo ""
  echo "Install source:"
  echo "  ${BOLD}[1]${RESET} Local clone     — register ${DIM}$SCRIPT_DIR${RESET}"
  echo "      ${DIM}good for plugin development: your edits show up after restart${RESET}"
  echo "  ${BOLD}[2]${RESET} GitHub (latest) — register ${DIM}$REPO_SHORT${RESET}"
  echo "      ${DIM}good for users: just installs the published version${RESET}"
  echo ""
  read -rp "Choose [1/2]: " choice
  case "$choice" in
    1) MODE="local"  ;;
    2) MODE="github" ;;
    *) echo "${RED}Invalid choice.${RESET}"; exit 1 ;;
  esac
fi

# -------- determine source --------
if [[ "$MODE" == "local" ]]; then
  if [[ ! -f "$SCRIPT_DIR/.claude-plugin/marketplace.json" ]]; then
    echo "${RED}Can't find .claude-plugin/marketplace.json next to installer.${RESET}"
    echo "Run this from inside the steve-designer repo clone, or use --github."
    exit 1
  fi
  SOURCE="$SCRIPT_DIR"
  SOURCE_LABEL="local directory"
else
  SOURCE="$REPO_SHORT"
  SOURCE_LABEL="GitHub ($REPO_SHORT)"
fi

# -------- add marketplace (idempotent: remove-then-add) --------
echo ""
echo "${BOLD}Registering marketplace from:${RESET} $SOURCE_LABEL"
claude plugin marketplace remove "$MARKETPLACE_NAME" >/dev/null 2>&1 || true
if ! claude plugin marketplace add "$SOURCE"; then
  echo "${RED}Failed to add marketplace.${RESET}"
  exit 1
fi

# -------- install plugin --------
echo ""
echo "${BOLD}Installing plugin...${RESET}"
if ! claude plugin install "${PLUGIN_NAME}@${MARKETPLACE_NAME}"; then
  echo "${RED}Failed to install plugin.${RESET}"
  exit 1
fi

# -------- done --------
echo ""
echo "${GREEN}${BOLD}✓ Installed.${RESET}"
echo ""
echo "${BOLD}Next steps:${RESET}"
echo "  1. Restart Claude Code (or start a new session)"
echo "  2. Run ${CYAN}/steve-designer:arsenal${RESET} to check prerequisites"
echo "  3. Run ${CYAN}/steve-designer:start${RESET} to begin a new design session"
echo "     (or ${CYAN}/steve-designer:resume${RESET} to continue an existing project)"
echo ""
echo "${DIM}Uninstall with: ./install.sh --uninstall${RESET}"
echo ""
