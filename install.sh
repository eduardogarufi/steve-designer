#!/usr/bin/env bash
#
# steve-designer installer
#
# Usage:
#   ./install.sh               # interactive — asks personal or project
#   ./install.sh --personal    # installs to ~/.claude/plugins/steve-designer
#   ./install.sh --project     # installs to ./.claude/plugins/steve-designer
#
# After install, restart Claude Code and run /steve-designer:start

set -euo pipefail

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
    --personal) MODE="personal"; shift ;;
    --project)  MODE="project";  shift ;;
    --help|-h)
      grep "^#" "$0" | head -20 | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

# -------- interactive mode selection --------
if [[ -z "$MODE" ]]; then
  echo ""
  echo "${BOLD}${CYAN}steve-designer installer${RESET}"
  echo ""
  echo "Install as:"
  echo "  ${BOLD}[1]${RESET} Personal  — available in every Claude Code session"
  echo "      ${DIM}(~/.claude/plugins/steve-designer)${RESET}"
  echo "  ${BOLD}[2]${RESET} Project   — only this project's .claude/plugins"
  echo "      ${DIM}(./.claude/plugins/steve-designer)${RESET}"
  echo ""
  read -rp "Choose [1/2]: " choice
  case "$choice" in
    1) MODE="personal" ;;
    2) MODE="project"  ;;
    *) echo "${RED}Invalid choice.${RESET}"; exit 1 ;;
  esac
fi

# -------- determine install path --------
if [[ "$MODE" == "personal" ]]; then
  DEST="$HOME/.claude/plugins/steve-designer"
else
  DEST="$PWD/.claude/plugins/steve-designer"
fi

# -------- detect source directory (next to this script) --------
SCRIPT_DIR="$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Validate we're running from a plugin directory
if [[ ! -f "$SCRIPT_DIR/.claude-plugin/plugin.json" ]]; then
  echo "${RED}Can't find .claude-plugin/plugin.json next to installer.${RESET}"
  echo "Make sure you're running this from inside the steve-designer plugin directory."
  exit 1
fi

# -------- backup existing install --------
if [[ -d "$DEST" ]]; then
  TS=$(date +%Y%m%d-%H%M%S)
  BACKUP="${DEST}.backup.${TS}"
  echo "${YELLOW}Existing install found at $DEST${RESET}"
  echo "Backing up to: $BACKUP"
  mv "$DEST" "$BACKUP"
fi

# -------- copy files --------
echo ""
echo "${BOLD}Installing to:${RESET} $DEST"
mkdir -p "$(dirname "$DEST")"
cp -r "$SCRIPT_DIR" "$DEST"

# Remove the installer itself from the installed copy
rm -f "$DEST/install.sh"

# Ensure scripts are executable
find "$DEST/scripts" -name "*.sh" -type f -exec chmod +x {} \; 2>/dev/null || true

# -------- done --------
echo ""
echo "${GREEN}${BOLD}✓ Installed.${RESET}"
echo ""
echo "${BOLD}Next steps:${RESET}"
echo "  1. Restart Claude Code (or start a new session)"
echo "  2. Run ${CYAN}/steve-designer:start${RESET} to begin a new design session"
echo "  3. Or ${CYAN}/steve-designer:resume${RESET} to continue an existing project"
echo ""
echo "${DIM}Arsenal check will run first and tell you which plugins/MCPs to install.${RESET}"
echo ""
