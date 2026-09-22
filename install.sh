#!/usr/bin/env bash
#
# steve-designer installer — multi-CLI
#
# Installs Steve Designer into Claude Code, Kilo, and/or Codex from this single
# source tree. The portable runtime lives in skills/steve-designer/; the Kilo and
# Codex bundles are rendered from it by scripts/build_dist.mjs before install.
#
# Usage:
#   ./install.sh                                   # interactive
#   ./install.sh --cli claude --github             # Claude Code, from GitHub
#   ./install.sh --cli claude --local              # Claude Code, from this clone
#   ./install.sh --cli kilo   --global             # Kilo, user-level
#   ./install.sh --cli kilo   --project            # Kilo, into ./.kilo
#   ./install.sh --cli codex  --global             # Codex, user-level
#   ./install.sh --cli codex  --project            # Codex, into ./.codex
#   ./install.sh --cli all    --global             # every CLI detected on PATH
#   ./install.sh --cli kilo   --uninstall          # remove exactly what was installed
#   ./install.sh --help
#
# Ownership model
# ---------------
# For Kilo and Codex this installer is file-based, so it keeps a manifest of every
# path it wrote ($BASE/.steve-designer-manifest.json). Install refuses to overwrite
# a file that exists and is not in the manifest unless --force is given; uninstall
# deletes exactly the manifest's paths and nothing else. Namespace-wide globs are
# never used as an ownership mechanism.
#
# Claude Code does NOT auto-discover plugins in ~/.claude/plugins; its plugin is
# registered through `claude plugin marketplace add` + `claude plugin install`.
#
# After installing, RESTART the target CLI so the new commands/skills register.

set -euo pipefail

REPO_SHORT="eduardogarufi/steve-designer"
MARKETPLACE_NAME="steve-designer"
PLUGIN_NAME="steve-designer"
SKILL_DIR_TOKEN="<STEVE_SKILL_DIR>"
TOML_BEGIN="# >>> steve-designer (managed block) >>>"
TOML_END="# <<< steve-designer (managed block) <<<"
HOOK_MARKER="hook_design_lint.sh"

# -------- colors --------
if [[ -t 1 ]]; then
  BOLD=$'\033[1m'; DIM=$'\033[2m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'
  RED=$'\033[31m'; CYAN=$'\033[36m'; RESET=$'\033[0m'
else
  BOLD=''; DIM=''; GREEN=''; YELLOW=''; RED=''; CYAN=''; RESET=''
fi

die() { echo "${RED}$*${RESET}" >&2; exit 1; }

SCRIPT_DIR="$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# -------- parse args --------
MODE=""          # local | github        (Claude Code source)
CLI=""           # claude | kilo | codex | all
SCOPE=""         # global | project
UNINSTALL=0
FORCE=0

usage() {
  cat <<'HELP'
steve-designer installer (multi-CLI)

Usage:
  ./install.sh [--cli claude|kilo|codex|all] [--global|--project]
               [--local|--github] [--uninstall] [--force] [--help]

  --cli <name>    target CLI; "all" installs into every CLI found on PATH
  --global        install at user level (Kilo ~/.config/kilo, Codex ~/.agents + ~/.codex)
  --project       install into the current project (.kilo/ or .agents/ + .codex/)
  --local         (claude only) register this clone as the marketplace source
  --github        (claude only) register the GitHub repo as the marketplace source
  --uninstall     remove exactly what this installer wrote for the selected CLI
  --force         overwrite files that exist but are not owned by this installer
  --help          show this message

python3 is required for Kilo and Codex installs (safe config merging).
Restart the target CLI after installing.
HELP
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --cli)
      [[ $# -ge 2 && -n "${2:-}" ]] || die "--cli requires a value (claude, kilo, codex, all)"
      CLI="$2"; shift 2 ;;
    --global)    SCOPE="global"; shift ;;
    --project)   SCOPE="project"; shift ;;
    --local)     MODE="local"; shift ;;
    --github)    MODE="github"; shift ;;
    --uninstall) UNINSTALL=1; shift ;;
    --force)     FORCE=1; shift ;;
    --help|-h)   usage; exit 0 ;;
    *)           die "Unknown argument: $1 (see --help)" ;;
  esac
done

case "$CLI" in
  ""|claude|kilo|codex|all) ;;
  *) die "--cli must be one of: claude, kilo, codex, all" ;;
esac

# -------- interactive selection --------
if [[ -z "$CLI" ]]; then
  echo ""
  echo "${BOLD}${CYAN}steve-designer installer${RESET}"
  echo ""
  echo "Which CLI(s)?"
  echo "  ${BOLD}[1]${RESET} Claude Code"
  echo "  ${BOLD}[2]${RESET} Kilo"
  echo "  ${BOLD}[3]${RESET} Codex"
  echo "  ${BOLD}[4]${RESET} All detected"
  echo ""
  read -rp "Choose [1/2/3/4]: " choice
  case "$choice" in
    1) CLI="claude" ;;
    2) CLI="kilo" ;;
    3) CLI="codex" ;;
    4) CLI="all" ;;
    *) die "Invalid choice." ;;
  esac
fi

if [[ "$CLI" == "all" ]]; then
  CLI=""
  if command -v claude >/dev/null 2>&1; then CLI="${CLI:+$CLI,}claude"; fi
  if command -v kilo   >/dev/null 2>&1; then CLI="${CLI:+$CLI,}kilo"; fi
  if command -v codex  >/dev/null 2>&1; then CLI="${CLI:+$CLI,}codex"; fi
  [[ -z "$CLI" ]] && die "No supported CLI found on PATH (looked for claude, kilo, codex)."
  echo "${DIM}Detected: $CLI${RESET}"
fi

[[ -z "$SCOPE" ]] && SCOPE="global"

if [[ "$CLI" == *"claude"* && "$SCOPE" == "project" ]]; then
  echo "${YELLOW}Note: Claude Code plugins are registered at user level; --project is ignored for claude.${RESET}"
fi

# -------- python helper: config merging, path rewriting, manifest --------
STEVE_PY=""
PYTHON_BIN=""
WORK_DIRS=()
cleanup() {
  local status=$? d
  if [[ -n "$STEVE_PY" && -f "$STEVE_PY" ]]; then rm -f -- "$STEVE_PY"; fi
  for d in "${WORK_DIRS[@]:-}"; do
    if [[ -n "$d" && -d "$d" ]]; then rm -rf -- "$d"; fi
  done
  return "$status"
}
trap cleanup EXIT

# Prefer an interpreter with tomllib so the TOML merge can be validated before it
# replaces the user's config. Falls back to plain python3 (JSON merges still work).
pick_python() {
  local candidate
  for candidate in python3 python3.13 python3.12 python3.11; do
    if command -v "$candidate" >/dev/null 2>&1 && "$candidate" -c 'import tomllib' >/dev/null 2>&1; then
      echo "$candidate"; return 0
    fi
  done
  if command -v python3 >/dev/null 2>&1; then echo python3; return 0; fi
  return 1
}

require_python() {
  PYTHON_BIN="$(pick_python)" || die "python3 is required for $1 installs (safe config merging). Install python3 and retry."
  if [[ -z "$STEVE_PY" ]]; then
    STEVE_PY="$(mktemp "${TMPDIR:-/tmp}/steve-designer.XXXXXX.py")"
    cat > "$STEVE_PY" <<'PYEOF'
import json, os, pathlib, re, sys, tempfile

BEGIN = "# >>> steve-designer (managed block) >>>"
END = "# <<< steve-designer (managed block) <<<"


def read(p):
    return pathlib.Path(p).read_text() if os.path.exists(p) else ""


def write_atomic(p, text):
    d = os.path.dirname(os.path.abspath(p)) or "."
    os.makedirs(d, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=d, prefix=".steve-", suffix=".tmp")
    with os.fdopen(fd, "w") as fh:
        fh.write(text)
    os.replace(tmp, p)


def load_json(p):
    text = read(p).strip()
    if not text:
        return {}
    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        raise SystemExit(f"refusing to touch {p}: not valid JSON ({exc})")


def dump_json(p, obj):
    write_atomic(p, json.dumps(obj, indent=2, ensure_ascii=False) + "\n")


def toml_parser():
    try:
        import tomllib as parser
        return parser
    except ImportError:
        pass
    try:
        import tomli as parser  # type: ignore
        return parser
    except ImportError:
        return None


def validate_toml(text):
    """Fail closed: without a parser we cannot prove the result is loadable."""
    parser = toml_parser()
    if parser is None:
        raise SystemExit(
            "no TOML parser available, so the Codex configuration cannot be validated. "
            "Use python3.11+ (tomllib) or install the tomli module."
        )
    parser.loads(text)


def subst(root, token, value):
    changed = 0
    for dirpath, _dirnames, filenames in os.walk(root):
        for name in filenames:
            fp = os.path.join(dirpath, name)
            try:
                text = pathlib.Path(fp).read_text()
            except (UnicodeDecodeError, IsADirectoryError, PermissionError):
                continue
            if token in text:
                pathlib.Path(fp).write_text(text.replace(token, value))
                changed += 1
    print(changed)


def escape_for(path, value):
    """Escape a substituted value for the file's string context.

    JSON and TOML basic strings share the same escapes for backslash and quote.
    Markdown, shell, python and YAML take the raw path.
    """
    if path.endswith(".json") or path.endswith(".toml"):
        return value.replace("\\", "\\\\").replace('"', '\\"')
    return value


def subst_file(path, token, value):
    """Rewrite a single file in place. Used on config fragments before merging."""
    p = pathlib.Path(path)
    text = p.read_text()
    if token in text:
        p.write_text(text.replace(token, escape_for(path, value)))
        print(1)
    else:
        print(0)


def subst_mapped(mapping_file, token, value):
    changed = 0
    for line in pathlib.Path(mapping_file).read_text().splitlines():
        if not line.strip():
            continue
        src = line.split("\t")[0]
        try:
            text = pathlib.Path(src).read_text()
        except (UnicodeDecodeError, IsADirectoryError, PermissionError):
            continue
        if token in text:
            pathlib.Path(src).write_text(text.replace(token, escape_for(src, value)))
            changed += 1
    print(changed)


def json_remove_mcp_owned(target, owned_json):
    """Remove only the servers we added AND that still match what we wrote.

    A server the user later edited is left alone: the manifest is a record of our
    actions, not a licence to delete whatever currently sits under that key.
    """
    owned = json.loads(owned_json)
    if not os.path.exists(target) or not owned:
        print("[]")
        return
    tgt = load_json(target)
    servers = tgt.get("mcp", {})
    removed = []
    for name, spec in owned.items():
        if name in servers and servers[name] == spec:
            servers.pop(name)
            removed.append(name)
    if not servers:
        tgt.pop("mcp", None)
    if removed:
        dump_json(target, tgt)
    print(json.dumps(removed))


def json_merge_mcp_plan(target, fragment):
    """Report what a merge would do, without writing anything."""
    tgt = load_json(target)
    frag = load_json(fragment)
    servers = tgt.get("mcp", {})
    added, skipped, conflicts = [], [], []
    for name, spec in frag.get("mcp", {}).items():
        if name not in servers:
            added.append(name)
        elif servers[name] == spec:
            skipped.append(name)
        else:
            conflicts.append(name)
    print(json.dumps({"added": added, "skipped": skipped, "conflicts": conflicts}))


def json_merge_mcp_apply(target, fragment):
    tgt = load_json(target)
    frag = load_json(fragment)
    servers = tgt.setdefault("mcp", {})
    added = []
    for name, spec in frag.get("mcp", {}).items():
        if name not in servers:
            servers[name] = spec
            added.append(name)
    if added:
        dump_json(target, tgt)
    print(json.dumps(added))


def _truthy(value):
    """Shell passes "0"/"1"; a non-empty Python string would be truthy otherwise."""
    return str(value).lower() in ("1", "true", "yes", "y")


def _commands(group):
    return [str(handler.get("command", "")) for handler in group.get("hooks", [])]


def json_merge_hooks_plan(target, fragment, marker, force):
    """Decide which hook groups to add. Returns the exact groups we would own.

    A group that matches ours by marker but not by value is a user edit: it is a
    conflict, not something to overwrite or duplicate.
    """
    tgt = load_json(target)
    frag = load_json(fragment)
    hooks = tgt.get("hooks", {})
    added, skipped, conflicts, owned = [], [], [], []
    force = _truthy(force)
    for event, groups in frag.get("hooks", {}).items():
        existing = hooks.get(event, [])
        for group in groups:
            if any(e == group for e in existing):
                skipped.append(event)
            elif any(marker in c for e in existing for c in _commands(e)):
                if force:
                    owned.append({"event": event, "group": group})
                    added.append(event)
                else:
                    conflicts.append(event)
            else:
                owned.append({"event": event, "group": group})
                added.append(event)
    print(json.dumps({"added": added, "skipped": skipped, "conflicts": conflicts, "owned": owned}))


def json_merge_hooks_apply(target, owned_json):
    owned = json.loads(owned_json)
    if not owned:
        print(0)
        return
    tgt = load_json(target)
    hooks = tgt.setdefault("hooks", {})
    written = 0
    for item in owned:
        event, group = item["event"], item["group"]
        existing = hooks.setdefault(event, [])
        if any(e == group for e in existing):
            continue
        existing.append(group)
        written += 1
    if written:
        dump_json(target, tgt)
    print(written)


def json_remove_hooks_owned(target, owned_json, marker):
    """Remove only hook groups that still match, exactly, what we recorded."""
    owned = json.loads(owned_json)
    if not os.path.exists(target) or not owned:
        print(json.dumps({"removed": 0, "kept": 0}))
        return
    tgt = load_json(target)
    hooks = tgt.get("hooks", {})
    removed = 0
    for item in owned:
        event, group = item["event"], item["group"]
        if event not in hooks:
            continue
        kept = [g for g in hooks[event] if g != group]
        removed += len(hooks[event]) - len(kept)
        if kept:
            hooks[event] = kept
        else:
            hooks.pop(event)
    # Groups that still look like ours but no longer match what we wrote: user edits.
    kept_marker = sum(
        1
        for event in hooks
        for group in hooks[event]
        for command in _commands(group)
        if marker in command
    )
    if not hooks:
        tgt.pop("hooks", None)
    if removed:
        dump_json(target, tgt)
    print(json.dumps({"removed": removed, "kept": kept_marker}))


def json_is_empty(p):
    if not os.path.exists(p):
        print("yes")
        return
    text = read(p).strip()
    print("yes" if not text or json.loads(text) in ({}, []) else "no")


def _block_body(text):
    if BEGIN not in text:
        return ""
    rest = text.split(BEGIN, 1)[1]
    if END not in rest:
        raise SystemExit("refusing to edit: the managed block is unterminated")
    return rest.split(END, 1)[0].strip("\n")


def _strip_block(text):
    if BEGIN not in text:
        return text
    head, rest = text.split(BEGIN, 1)
    if END not in rest:
        raise SystemExit("refusing to edit: the managed block is unterminated")
    _, tail = rest.split(END, 1)
    return head.rstrip("\n") + "\n" + tail.lstrip("\n")


def _server_names(text):
    """Declared mcp_servers keys, including quoted ones and inline tables."""
    names = set()
    for match in re.finditer(
        r'^\s*\[mcp_servers\s*\.\s*(?:"([^"]+)"|([A-Za-z0-9_.-]+))\s*\]', text, re.M
    ):
        names.add(match.group(1) or match.group(2))
    for chunk in re.findall(r"^\s*mcp_servers\s*=\s*\{([^}]*)\}", text, re.M):
        for match in re.finditer(r'(?:"([^"]+)"|([A-Za-z0-9_.-]+))\s*=', chunk):
            names.add(match.group(1) or match.group(2))
    return names


def toml_block_get(target):
    """Print the current managed block body (nothing if there is none)."""
    text = read(target)
    if BEGIN not in text:
        print("", end="")
        return
    print(_block_body(text))


def toml_merge_mcp_plan(target, fragment, recorded_file, force, candidate_out):
    """Validate a candidate config and stage it; print the plan. Nothing is replaced."""
    text = read(target)
    current = _block_body(text) if BEGIN in text else ""
    if current and current != read(recorded_file).strip("\n") and not _truthy(force):
        print(json.dumps({
            "added": [], "skipped": [], "refreshed": False,
            "conflicts": ["the managed block was edited after installation"],
        }))
        return
    refreshed = bool(current)
    present = _server_names(_strip_block(text))
    blocks, added, skipped = [], [], []
    for block in re.split(r"(?=^\[mcp_servers\.)", read(fragment), flags=re.M):
        block = block.strip("\n")
        if not block.strip():
            continue
        match = re.search(r"^\[mcp_servers\.([A-Za-z0-9_.-]+)\]", block, re.M)
        name = match.group(1) if match else None
        if name and name in present:
            skipped.append(name)
            continue
        blocks.append(block)
        if name:
            added.append(name)
    body = "\n\n".join(blocks)
    base = _strip_block(text)
    candidate = (
        base.rstrip("\n")
        + ("\n\n" if base.strip() else "")
        + BEGIN + "\n" + body + "\n" + END + "\n"
    )
    validate_toml(candidate)
    pathlib.Path(candidate_out).write_text(candidate)
    print(json.dumps({
        "added": added, "skipped": skipped, "refreshed": refreshed,
        "conflicts": [], "block": body,
    }))


def toml_apply(target, candidate_file):
    write_atomic(target, pathlib.Path(candidate_file).read_text())
    print("applied")


def toml_remove_block_owned(target, recorded_file):
    """Remove the managed block only if it still matches what we recorded."""
    if not os.path.exists(target):
        print("noop")
        return
    text = read(target)
    if BEGIN not in text:
        print("noop")
        return
    if _block_body(text) != read(recorded_file).strip("\n"):
        print("edited")
        return
    candidate = _strip_block(text)
    if candidate.strip():
        validate_toml(candidate)
    write_atomic(target, candidate)
    print("removed")


def manifest_collisions(manifest, mapping_file):
    owned = set(load_json(manifest).get("files", [])) if os.path.exists(manifest) else set()
    collisions = []
    for line in pathlib.Path(mapping_file).read_text().splitlines():
        if not line.strip():
            continue
        dest = line.split("\t")[1]
        if os.path.lexists(dest) and dest not in owned:
            collisions.append(dest)
    print(json.dumps(collisions))


def manifest_write(manifest, mapping_file, cli, scope, skill_dir, config_json):
    dests = [l.split("\t")[1] for l in pathlib.Path(mapping_file).read_text().splitlines() if l.strip()]
    dump_json(manifest, {
        "version": 1,
        "cli": cli,
        "scope": scope,
        "skillDir": skill_dir,
        "files": dests,
        "config": json.loads(config_json),
    })
    print(len(dests))


def manifest_list(manifest):
    print(json.dumps(load_json(manifest).get("files", [])))


def manifest_config(manifest):
    print(json.dumps(load_json(manifest).get("config", {})))


def prune_dirs(manifest, *roots):
    if not os.path.exists(manifest):
        print(0)
        return
    dirs = set()
    for entry in load_json(manifest).get("files", []):
        d = os.path.dirname(entry)
        while d and any(d.startswith(r + os.sep) for r in roots):
            dirs.add(d)
            d = os.path.dirname(d)
    removed = 0
    for d in sorted(dirs, key=len, reverse=True):
        try:
            os.rmdir(d)
            removed += 1
        except OSError:
            pass
    print(removed)


if __name__ == "__main__":
    cmd, args = sys.argv[1], sys.argv[2:]
    {
        "subst": subst,
        "subst-file": subst_file,
        "subst-mapped": subst_mapped,
        "json-merge-mcp-plan": json_merge_mcp_plan,
        "json-merge-mcp-apply": json_merge_mcp_apply,
        "json-remove-mcp-owned": json_remove_mcp_owned,
        "json-merge-hooks-plan": json_merge_hooks_plan,
        "json-merge-hooks-apply": json_merge_hooks_apply,
        "json-remove-hooks-owned": json_remove_hooks_owned,
        "json-is-empty": json_is_empty,
        "toml-block-get": toml_block_get,
        "toml-merge-mcp-plan": toml_merge_mcp_plan,
        "toml-apply": toml_apply,
        "toml-remove-block-owned": toml_remove_block_owned,
        "manifest-collisions": manifest_collisions,
        "manifest-write": manifest_write,
        "manifest-list": manifest_list,
        "manifest-config": manifest_config,
        "prune-dirs": prune_dirs,
    }[cmd](*args)
PYEOF
  fi
}

py() { "$PYTHON_BIN" "$STEVE_PY" "$@"; }
pyc() { "$PYTHON_BIN" -c "$@"; }
# jlist <json-document> <key> — comma-joined list value
jlist() {
  pyc 'import json,sys
doc = json.loads(sys.argv[1])
value = doc.get(sys.argv[2], [])
print(",".join(str(v) for v in value) if isinstance(value, list) else value)' "$1" "$2"
}

# -------- shared helpers --------
safe_rm() {
  local target="$1"
  case "$target" in
    ""|"/"|"$HOME"|"$HOME/") echo "${RED}Refusing to remove '$target'.${RESET}" >&2; return 1 ;;
  esac
  [[ -e "$target" || -L "$target" ]] || return 0
  rm -rf -- "$target"
}

# mktmpdir <label> — sets MKTMPDIR_RESULT. Do NOT call it in a subshell: the
# ownership list for the cleanup trap would be lost with the subshell's state.
MKTMPDIR_RESULT=""
mktmpdir() {
  local d
  d="$(mktemp -d "${TMPDIR:-/tmp}/steve-${1}.XXXXXX")"
  WORK_DIRS+=("$d")
  MKTMPDIR_RESULT="$d"
}

BUNDLE_DIR=""
BASE_TMP=""
ensure_scratch() {
  if [[ -z "$BASE_TMP" ]]; then
    mktmpdir scratch
    BASE_TMP="$MKTMPDIR_RESULT"
  fi
}

build_bundles() {
  command -v node >/dev/null 2>&1 || die "node is required to render the Kilo/Codex bundles."
  # Build into an installer-owned staging dir: never mutate the clone.
  mktmpdir dist
  BUNDLE_DIR="$MKTMPDIR_RESULT"
  echo ""
  echo "${BOLD}Rendering bundles...${RESET}"
  node "$SCRIPT_DIR/scripts/build_dist.mjs" --out "$BUNDLE_DIR" || die "build_dist.mjs failed."
}

# install_owned <mapping_file> <manifest> <cli> <scope> <skill_dest> <config_json>
# mapping_file lines are "<source><TAB><dest>".
install_owned() {
  local mapping="$1" manifest="$2" cli="$3" scope="$4" skill_dest="$5" config_json="$6"

  local collisions
  collisions="$(py manifest-collisions "$manifest" "$mapping")" || return 1
  if [[ "$collisions" != "[]" && $FORCE -eq 0 ]]; then
    echo "${RED}Refusing to overwrite files this installer does not own:${RESET}" >&2
    pyc 'import json,sys
for p in json.loads(sys.argv[1]):
    print("  " + p)' "$collisions" >&2
    echo "${DIM}Move them aside, or re-run with --force.${RESET}" >&2
    return 1
  fi

  # Anchor the skill path in the staged sources before copying.
  if ! py subst-mapped "$mapping" "$SKILL_DIR_TOKEN" "$skill_dest" >/dev/null; then
    echo "${RED}Failed to anchor the skill path in the staged bundle.${RESET}" >&2
    return 1
  fi

  # Track only what actually landed: the manifest must never claim a file that was
  # not written, and a partial install must still be rollback-able with --uninstall.
  local done_mapping="$mapping.done"
  : > "$done_mapping"
  local count=0 failed=0 src dest first_error=""
  while IFS=$'\t' read -r src dest; do
    [[ -n "$src" ]] || continue
    if mkdir -p -- "$(dirname -- "$dest")" 2>/dev/null && cp -p -- "$src" "$dest" 2>/dev/null; then
      printf '%s\t%s\n' "$src" "$dest" >> "$done_mapping"
      count=$((count + 1))
    else
      failed=$((failed + 1))
      if [[ -z "$first_error" ]]; then first_error="$dest"; fi
    fi
  done < "$mapping"

  if ! py manifest-write "$manifest" "$done_mapping" "$cli" "$scope" "$skill_dest" "$config_json" >/dev/null; then
    echo "${RED}Failed to write the manifest at $manifest.${RESET}" >&2
    return 1
  fi

  if [[ $failed -gt 0 ]]; then
    echo "${RED}✗ $failed file(s) could not be written (first: $first_error).${RESET}" >&2
    echo "${DIM}Check permissions and free space. The manifest records the $count that did land,${RESET}" >&2
    echo "${DIM}so --uninstall can roll the partial install back.${RESET}" >&2
    return 1
  fi
  echo "${DIM}Installed $count file(s); manifest at $manifest${RESET}"
}

# uninstall_owned <manifest> <root>...
uninstall_owned() {
  local manifest="$1"; shift
  if [[ ! -f "$manifest" ]]; then
    echo "${YELLOW}No manifest at $manifest — this installer has no record of an install here.${RESET}"
    echo "${DIM}Nothing was deleted. Remove files manually only if you are sure.${RESET}"
    return 1
  fi
  local removed=0 path
  while IFS= read -r path; do
    [[ -n "$path" ]] || continue
    if [[ -e "$path" || -L "$path" ]]; then
      rm -f -- "$path"
      removed=$((removed + 1))
    fi
  done < <(py manifest-list "$manifest" | pyc 'import json,sys; [print(p) for p in json.load(sys.stdin)]')
  py prune-dirs "$manifest" "$@" >/dev/null || true
  safe_rm "$manifest"
  echo "${GREEN}✓ Removed $removed owned file(s).${RESET}"
}

# -------- Claude Code --------
claude_install() {
  command -v claude >/dev/null 2>&1 || die "claude CLI not found on PATH. Install Claude Code first: https://docs.claude.com/claude-code"

  if [[ -z "$MODE" ]]; then
    echo ""
    echo "Claude Code source:"
    echo "  ${BOLD}[1]${RESET} Local clone     — ${DIM}$SCRIPT_DIR${RESET}"
    echo "  ${BOLD}[2]${RESET} GitHub (latest) — ${DIM}$REPO_SHORT${RESET}"
    local choice
    read -rp "Choose [1/2]: " choice
    case "$choice" in
      1) MODE="local" ;;
      2) MODE="github" ;;
      *) die "Invalid choice." ;;
    esac
  fi

  local source label
  if [[ "$MODE" == "local" ]]; then
    [[ -f "$SCRIPT_DIR/.claude-plugin/marketplace.json" ]] || die "Can't find .claude-plugin/marketplace.json next to installer."
    source="$SCRIPT_DIR"; label="local directory"
  else
    source="$REPO_SHORT"; label="GitHub ($REPO_SHORT)"
  fi

  echo ""
  echo "${BOLD}Claude Code — registering marketplace from:${RESET} $label"
  claude plugin marketplace remove "$MARKETPLACE_NAME" >/dev/null 2>&1 || true
  claude plugin marketplace add "$source" || die "Failed to add marketplace."
  claude plugin install "${PLUGIN_NAME}@${MARKETPLACE_NAME}" || die "Failed to install plugin."
  echo "${GREEN}✓ Claude Code installed.${RESET}"
}

claude_uninstall() {
  command -v claude >/dev/null 2>&1 || { echo "${DIM}claude CLI not found — nothing to uninstall.${RESET}"; return 0; }
  claude plugin uninstall "${PLUGIN_NAME}@${MARKETPLACE_NAME}" 2>&1 || true
  claude plugin marketplace remove "$MARKETPLACE_NAME" 2>&1 || true
  echo "${GREEN}✓ Claude Code removed.${RESET}"
}

# -------- Kilo --------
kilo_targets() {
  if [[ "$SCOPE" == "project" ]]; then KILO_BASE="$PWD/.kilo"; else KILO_BASE="$HOME/.config/kilo"; fi
  KILO_MANIFEST="$KILO_BASE/.steve-designer-manifest.json"
  KILO_SKILL_DEST="$KILO_BASE/skills/$PLUGIN_NAME"
  KILO_CONFIG="$KILO_BASE/kilo.json"
}

kilo_mapping() {
  local src="$1" mapping="$2"
  : > "$mapping"
  local f
  while IFS= read -r f; do
    printf '%s\t%s\n' "$f" "$KILO_BASE/${f#"$src"/}" >> "$mapping"
  done < <(find "$src/skills" "$src/command" "$src/agent" -type f | sort)
  [[ -s "$mapping" ]] || die "empty Kilo mapping — the rendered bundle looks wrong."
}

kilo_install() {
  require_python "Kilo"
  kilo_targets
  build_bundles
  local src="$BUNDLE_DIR/kilo"
  [[ -d "$src" ]] || die "build_dist.mjs produced no Kilo bundle"

  # Ownership carried over from a previous install, so a failed run cannot lose it.
  local prev_config='{}'
  if [[ -f "$KILO_MANIFEST" ]]; then prev_config="$(py manifest-config "$KILO_MANIFEST")"; fi

  # 1. Plan the config change. Nothing is written yet, and nothing is installed yet.
  py subst-file "$src/kilo.json" "$SKILL_DIR_TOKEN" "$KILO_SKILL_DEST" >/dev/null \
    || die "failed to resolve the skill path in the Kilo MCP fragment"
  local plan conflicts added skipped
  plan="$(py json-merge-mcp-plan "$KILO_CONFIG" "$src/kilo.json")" \
    || die "cannot read $KILO_CONFIG as JSON — fix or remove it, then retry"
  conflicts="$(jlist "$plan" conflicts)"
  added="$(jlist "$plan" added)"
  skipped="$(jlist "$plan" skipped)"
  if [[ -n "$conflicts" ]]; then
    if [[ $FORCE -eq 0 ]]; then
      die "refusing to overwrite MCP servers you changed: $conflicts (re-run with --force)"
    fi
    echo "${YELLOW}•${RESET} $KILO_CONFIG — overwriting edited MCP servers: $conflicts"
  fi

  # 2. Install the files. The manifest keeps the previous config record for now.
  local stage mapping
  mktmpdir kilo; stage="$MKTMPDIR_RESULT"
  cp -R "$src/skills" "$src/command" "$src/agent" "$stage/"
  mapping="$stage/.mapping"
  kilo_mapping "$stage" "$mapping"

  echo "${DIM}Installing into $KILO_BASE${RESET}"
  install_owned "$mapping" "$KILO_MANIFEST" "kilo" "$SCOPE" "$KILO_SKILL_DEST" "$prev_config" \
    || die "Kilo install aborted; run --uninstall to roll back."

  # 3. Apply the planned change, then record what we now own.
  py json-merge-mcp-apply "$KILO_CONFIG" "$src/kilo.json" >/dev/null \
    || die "failed to write $KILO_CONFIG (files were installed; run --uninstall to roll back)"

  local owned
  owned="$(pyc 'import json,sys
frag = json.load(open(sys.argv[1]))
added = set(k for k in sys.argv[2].split(",") if k)
print(json.dumps({k: v for k, v in frag.get("mcp", {}).items() if k in added}))' "$src/kilo.json" "$added")"

  py manifest-write "$KILO_MANIFEST" "$mapping" "kilo" "$SCOPE" "$KILO_SKILL_DEST" \
    "$(pyc 'import json,sys
prev = json.loads(sys.argv[1])
owned = dict(prev.get("mcpOwned", {}))
owned.update(json.loads(sys.argv[2]))
print(json.dumps({"mcpOwned": owned}))' "$prev_config" "$owned")" >/dev/null \
    || die "failed to record ownership in $KILO_MANIFEST"

  if [[ -n "$added" ]]; then echo "${GREEN}•${RESET} $KILO_CONFIG — added MCP: $added"; fi
  if [[ -n "$skipped" ]]; then echo "${YELLOW}•${RESET} $KILO_CONFIG — kept your existing MCP: $skipped"; fi
  if [[ -z "$added$skipped" ]]; then echo "${DIM}•${RESET} $KILO_CONFIG — MCP already present"; fi
  echo "${GREEN}✓ Kilo installed.${RESET}"
}

kilo_uninstall() {
  require_python "Kilo"
  kilo_targets
  # No manifest means no ownership: never touch the user's config on a guess.
  if [[ ! -f "$KILO_MANIFEST" ]]; then
    echo "${YELLOW}No manifest at $KILO_MANIFEST — no record of an install here.${RESET}"
    echo "${DIM}Nothing was deleted, and $KILO_CONFIG was left untouched.${RESET}"
    return 1
  fi
  local owned removed
  owned="$(py manifest-config "$KILO_MANIFEST" | pyc 'import json,sys; print(json.dumps(json.load(sys.stdin).get("mcpOwned", {})))')"
  if [[ "$owned" != "{}" ]]; then
    removed="$(py json-remove-mcp-owned "$KILO_CONFIG" "$owned")" || die "failed to update $KILO_CONFIG"
    echo "${GREEN}•${RESET} $KILO_CONFIG — removed the MCP entries we added: $removed"
  fi
  uninstall_owned "$KILO_MANIFEST" "$KILO_BASE" || true
}

# -------- Codex --------
codex_targets() {
  if [[ "$SCOPE" == "project" ]]; then
    CODEX_SKILLS="$PWD/.agents/skills"
    CODEX_HOME_DIR="$PWD/.codex"
  else
    CODEX_SKILLS="$HOME/.agents/skills"
    CODEX_HOME_DIR="$HOME/.codex"
  fi
  CODEX_MANIFEST="$CODEX_HOME_DIR/.steve-designer-manifest.json"
  CODEX_SKILL_DEST="$CODEX_SKILLS/$PLUGIN_NAME"
  CODEX_CONFIG="$CODEX_HOME_DIR/config.toml"
  CODEX_HOOKS="$CODEX_HOME_DIR/hooks.json"
}

codex_install() {
  require_python "Codex"
  codex_targets
  ensure_scratch
  build_bundles
  local src="$BUNDLE_DIR/codex"
  [[ -d "$src" ]] || die "build_dist.mjs produced no Codex bundle"

  # Ownership carried over from a previous install, so a failed run cannot lose it.
  local prev_config='{}'
  if [[ -f "$CODEX_MANIFEST" ]]; then prev_config="$(py manifest-config "$CODEX_MANIFEST")"; fi
  local prev_mcp_block
  prev_mcp_block="$BASE_TMP/mcp-block.txt"
  pyc 'import json,sys; d=json.loads(sys.argv[1]); open(sys.argv[2],"w").write(d.get("mcpBlock",""))' "$prev_config" "$prev_mcp_block"

  # 1. Plan both config changes. Nothing is written and nothing is installed yet.
  py subst-file "$src/.codex/mcp.toml" "$SKILL_DIR_TOKEN" "$CODEX_SKILL_DEST" >/dev/null \
    || die "failed to resolve the skill path in the Codex MCP fragment"
  py subst-file "$src/.codex/hooks.json" "$SKILL_DIR_TOKEN" "$CODEX_SKILL_DEST" >/dev/null \
    || die "failed to resolve the skill path in the Codex hooks fragment"

  local mcp_plan conflicts added skipped
  mcp_plan="$(py toml-merge-mcp-plan "$CODEX_CONFIG" "$src/.codex/mcp.toml" "$prev_mcp_block" "$FORCE" "$BASE_TMP/config.candidate.toml")" \
    || die "cannot merge $CODEX_CONFIG safely — fix it or re-run with --force"
  conflicts="$(jlist "$mcp_plan" conflicts)"
  added="$(jlist "$mcp_plan" added)"
  skipped="$(jlist "$mcp_plan" skipped)"
  if [[ -n "$conflicts" && $FORCE -eq 0 ]]; then
    die "$CODEX_CONFIG: $conflicts — re-run with --force to overwrite"
  fi

  local hooks_plan hooks_owned
  hooks_plan="$(py json-merge-hooks-plan "$CODEX_HOOKS" "$src/.codex/hooks.json" "$HOOK_MARKER" "$FORCE")" \
    || die "cannot read $CODEX_HOOKS as JSON — fix or remove it, then retry"
  if [[ -n "$(jlist "$hooks_plan" conflicts)" && $FORCE -eq 0 ]]; then
    die "$CODEX_HOOKS: a steve-designer hook was edited — re-run with --force to replace it"
  fi
  hooks_owned="$(pyc 'import json,sys; print(json.dumps(json.loads(sys.argv[1])["owned"]))' "$hooks_plan")"

  # 2. Install the files.
  local stage mapping
  mktmpdir codex; stage="$MKTMPDIR_RESULT"
  cp -R "$src/.agents/skills/$PLUGIN_NAME" "$stage/skill"
  mkdir -p "$stage/agents"
  cp "$src"/.codex/agents/steve_*.toml "$stage/agents/"
  mapping="$stage/.mapping"
  : > "$mapping"
  local f
  while IFS= read -r f; do
    printf '%s\t%s\n' "$f" "$CODEX_SKILL_DEST/${f#"$stage/skill"/}" >> "$mapping"
  done < <(find "$stage/skill" -type f | sort)
  while IFS= read -r f; do
    printf '%s\t%s\n' "$f" "$CODEX_HOME_DIR/agents/$(basename -- "$f")" >> "$mapping"
  done < <(find "$stage/agents" -type f | sort)
  [[ -s "$mapping" ]] || die "empty Codex mapping — the rendered bundle looks wrong."

  echo "${DIM}Installing into $CODEX_SKILLS and $CODEX_HOME_DIR${RESET}"
  install_owned "$mapping" "$CODEX_MANIFEST" "codex" "$SCOPE" "$CODEX_SKILL_DEST" "$prev_config" \
    || die "Codex install aborted; run --uninstall to roll back."

  # 3. Apply the planned config changes, then record ownership.
  py toml-apply "$CODEX_CONFIG" "$BASE_TMP/config.candidate.toml" >/dev/null \
    || die "failed to write $CODEX_CONFIG (files were installed; run --uninstall to roll back)"
  py json-merge-hooks-apply "$CODEX_HOOKS" "$hooks_owned" >/dev/null \
    || die "failed to write $CODEX_HOOKS (files were installed; run --uninstall to roll back)"

  local all_hooks
  all_hooks="$(pyc 'import json,sys
prev = json.loads(sys.argv[1]).get("hookGroups", [])
new = json.loads(sys.argv[2])
print(json.dumps(prev + new))' "$prev_config" "$hooks_owned")"
  local new_mcp_block
  new_mcp_block="$(pyc 'import json,sys; print(json.loads(sys.argv[1]).get("block",""))' "$mcp_plan")"

  py manifest-write "$CODEX_MANIFEST" "$mapping" "codex" "$SCOPE" "$CODEX_SKILL_DEST" \
    "$(pyc 'import json,sys
print(json.dumps({"hookMarker": "hook_design_lint.sh",
                  "hookGroups": json.loads(sys.argv[1]),
                  "mcpBlock": sys.argv[2]}))' "$all_hooks" "$new_mcp_block")" >/dev/null \
    || die "failed to record ownership in $CODEX_MANIFEST"

  local refreshed
  refreshed="$(pyc 'import json,sys; print("yes" if json.loads(sys.argv[1]).get("refreshed") else "no")' "$mcp_plan")"
  if [[ "$refreshed" == "yes" ]]; then
    echo "${DIM}•${RESET} $CODEX_CONFIG — MCP block refreshed (servers: $(jlist "$mcp_plan" added))"
  else
    echo "${DIM}•${RESET} $CODEX_CONFIG — MCP added: $added | kept yours: $skipped"
  fi
  if [[ -z "$hooks_owned" || "$hooks_owned" == "[]" ]]; then
    echo "${DIM}•${RESET} $CODEX_HOOKS — PostToolUse hook already present"
  else
    echo "${DIM}•${RESET} $CODEX_HOOKS — PostToolUse hook added"
  fi
  echo "${GREEN}✓ Codex installed.${RESET}"
  echo "${DIM}Run /hooks in Codex to review and trust the handler; project hooks also need a trusted project.${RESET}"
}

codex_uninstall() {
  require_python "Codex"
  codex_targets
  ensure_scratch
  # No manifest means no ownership: never touch the user's configuration on a guess.
  if [[ ! -f "$CODEX_MANIFEST" ]]; then
    echo "${YELLOW}No manifest at $CODEX_MANIFEST — no record of an install here.${RESET}"
    echo "${DIM}Nothing was deleted, and $CODEX_HOOKS / $CODEX_CONFIG were left untouched.${RESET}"
    return 1
  fi
  local recorded_mcp recorded_hooks
  recorded_mcp="$BASE_TMP/mcp-recorded.txt"
  recorded_hooks="$BASE_TMP/hooks-recorded.json"
  pyc 'import json,sys; d=json.loads(sys.stdin.read()); open(sys.argv[1],"w").write(d.get("mcpBlock","")); open(sys.argv[2],"w").write(json.dumps(d.get("hookGroups",[])))' \
    "$recorded_mcp" "$recorded_hooks" < <(py manifest-config "$CODEX_MANIFEST")

  # Configuration first: a config failure must not leave files already deleted.
  if [[ -f "$CODEX_HOOKS" ]]; then
    local hook_result hook_removed hook_kept
    hook_result="$(py json-remove-hooks-owned "$CODEX_HOOKS" "$(cat "$recorded_hooks")" "$HOOK_MARKER")" \
      || die "failed to update $CODEX_HOOKS"
    hook_removed="$(pyc 'import json,sys; print(json.loads(sys.argv[1])["removed"])' "$hook_result")"
    hook_kept="$(pyc 'import json,sys; print(json.loads(sys.argv[1])["kept"])' "$hook_result")"
    if [[ "$hook_removed" == "0" && "$hook_kept" != "0" ]]; then
      echo "${YELLOW}•${RESET} $CODEX_HOOKS — your edited steve-designer hook was left in place"
    elif [[ "$(py json-is-empty "$CODEX_HOOKS")" == "yes" ]]; then
      safe_rm "$CODEX_HOOKS"
      echo "${GREEN}•${RESET} removed $CODEX_HOOKS (no other hooks were configured)"
    else
      echo "${GREEN}•${RESET} removed the steve-designer hook from $CODEX_HOOKS"
    fi
  fi
  local block_result
  block_result="$(py toml-remove-block-owned "$CODEX_CONFIG" "$recorded_mcp")" \
    || die "refusing to edit $CODEX_CONFIG — fix the managed block manually."
  case "$block_result" in
    removed) echo "${GREEN}•${RESET} removed the MCP block from $CODEX_CONFIG" ;;
    edited)  echo "${YELLOW}•${RESET} $CODEX_CONFIG — the MCP block was edited after install; left in place" ;;
    noop)    echo "${DIM}•${RESET} $CODEX_CONFIG — no steve-designer MCP block found" ;;
  esac
  uninstall_owned "$CODEX_MANIFEST" "$CODEX_HOME_DIR" "$(dirname "$CODEX_SKILLS")" || true
}

# -------- dispatch --------
IFS=',' read -r -a CLIS <<< "$CLI"

if [[ $UNINSTALL -eq 1 ]]; then
  echo ""
  echo "${BOLD}Uninstalling steve-designer...${RESET}"
  for one in "${CLIS[@]}"; do
    case "$one" in
      claude) claude_uninstall ;;
      kilo)   kilo_uninstall ;;
      codex)  codex_uninstall ;;
    esac
  done
  echo ""
  echo "${DIM}Restart the target CLI to unload.${RESET}"
  exit 0
fi

for one in "${CLIS[@]}"; do
  case "$one" in
    claude) claude_install ;;
    kilo)   kilo_install ;;
    codex)  codex_install ;;
  esac
done

echo ""
echo "${GREEN}${BOLD}✓ Done.${RESET}"
echo ""
echo "${BOLD}Next steps:${RESET}"
echo "  1. Restart the target CLI"
echo "  2. Existing project: ${CYAN}/steve-enforce${RESET} (Kilo) or ${CYAN}\$steve-designer enforce${RESET} (Codex)"
echo "     Claude Code keeps the namespaced form: ${CYAN}/steve-designer:enforce${RESET}"
echo "  3. New project: ${CYAN}/steve-start${RESET} (Claude: ${CYAN}/steve-designer:start${RESET})"
echo ""
echo "${DIM}Uninstall with: ./install.sh --cli <claude|kilo|codex> --uninstall${RESET}"
echo ""
