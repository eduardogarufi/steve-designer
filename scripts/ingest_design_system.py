#!/usr/bin/env python3
"""ingest_design_system.py — auto-detect a repo's design system and emit a manifest.

Usage:
  ingest_design_system.py --root PATH [--stdout | --out PATH]
Exit codes: 0 ok, 1 error.

Design-system detection is configurable (brownfield-friendly):
  - If `steve.config.json` (or a `steveDesigner` field in package.json / the
    manifest) declares `dsSources`, those sources are used.
  - Otherwise the detector auto-detects: workspace packages that expose `.tsx`
    exports (a package that IS the design system, e.g. `@vinci/ui`) AND the
    greenfield `**/components/ui/**` convention.

A DS source is `{ "dir": <glob under root>, "package": <import specifier> }`.
Either key may be omitted. Components are extracted from real exports
(`export function|const <PascalCase>`), not from a fixed path.
"""
import argparse, glob, json, os, re, sys

CSS_VAR_RE = re.compile(r"--([a-z0-9-]+)\s*:\s*([^;]+);", re.I)
HEX_RE = re.compile(r"#[0-9a-fA-F]{3,8}\b")

def read(path):
    try:
        with open(path, encoding="utf-8") as f:
            return f.read()
    except (OSError, UnicodeDecodeError):
        return ""

def find_files(root, patterns):
    out = []
    for pat in patterns:
        out += glob.glob(os.path.join(root, "**", pat), recursive=True)
    return [p for p in out if "node_modules" not in p]

def classify_token(name):
    if name.startswith("color-") or name.startswith("color"):
        return ("color", name[len("color-"):] if name.startswith("color-") else name)
    if name.startswith("space-") or name.startswith("spacing-"):
        return ("spacing", name.split("-", 1)[1])
    if name.startswith("radius-"):
        return ("radius", name.split("-", 1)[1])
    if name.startswith("shadow-"):
        return ("shadow", name.split("-", 1)[1])
    if name.startswith("motion-") or name.startswith("duration-") or name.startswith("ease-"):
        return ("motion", name.split("-", 1)[1])
    return (None, name)

def detect_tokens(root):
    tokens = {"color": {}, "spacing": {}, "radius": {}, "shadow": {}, "motion": {}}
    for css in find_files(root, ["*.css"]):
        for name, value in CSS_VAR_RE.findall(read(css)):
            bucket, short = classify_token(name.lower())
            if bucket:
                tokens[bucket][short] = value.strip()
    return tokens

def load_json(path):
    txt = read(path)
    if not txt:
        return None
    try:
        return json.loads(txt)
    except json.JSONDecodeError:
        return None

def detect_packages(root):
    data = load_json(os.path.join(root, "package.json"))
    if not data:
        return {}
    deps = {}
    deps.update(data.get("dependencies", {}))
    deps.update(data.get("devDependencies", {}))
    return {k: str(v).lstrip("^~") for k, v in deps.items()}

def has_tailwind(root, packages):
    """Real Tailwind = a positive signal, not the mere absence of anything else.

    A signal is: the `tailwindcss` dependency (Tailwind v4 needs no config file),
    a `tailwind.config.*`, or a CSS entrypoint that imports Tailwind. A repo with
    none of these is token-based/CSS-modules, never `tailwind-css`.
    """
    if "tailwindcss" in packages:
        return True
    if find_files(root, ["tailwind.config.*"]):
        return True
    for css in find_files(root, ["*.css"]):
        if re.search(r'@import\s+["\']tailwindcss|@tailwind\b', read(css)):
            return True
    return False

def detect_stack(root, packages, tokens, components):
    framework = "unknown"
    if "next" in packages:
        framework = "next"
    elif "astro" in packages:
        framework = "astro"
    elif "vite" in packages:
        framework = "vite"
    tailwind = has_tailwind(root, packages)
    has_tokens = any(tokens.get(b) for b in tokens)
    if os.path.exists(os.path.join(root, "components.json")):
        stype = "shadcn"
    elif tailwind:
        stype = "tailwind-css"
    elif has_tokens:
        # Token-based system without Tailwind (CSS custom properties / tokens.ts).
        stype = "token-css"
    elif components:
        stype = "own-primitives"
    else:
        stype = "css-modules"
    return {"type": stype, "framework": framework, "tailwind": tailwind}

EXPORT_RE = re.compile(r"export\s+(?:default\s+)?(?:function|const)\s+([A-Z][A-Za-z0-9]+)")
PROPS_IFACE_RE = re.compile(r"interface\s+([A-Z][A-Za-z0-9]*Props)\s*\{([^}]*)\}", re.S)
PROP_NAME_RE = re.compile(r"([A-Za-z0-9]+)\??\s*:")

def _is_test_file(rel):
    return bool(re.search(r"\.(test|spec|stories)\.[jt]sx?$", rel))

def extract_from_file(path, root, import_for):
    """Return component dicts for one .tsx/.jsx file, or [] if none."""
    rel = os.path.relpath(path, root).replace("\\", "/")
    if _is_test_file(rel):
        return []
    src = read(path)
    exports = EXPORT_RE.findall(src)
    if not exports:
        return []
    props_by_iface = {name: PROP_NAME_RE.findall(body)
                      for name, body in PROPS_IFACE_RE.findall(src)}
    imp = import_for(path, rel)
    return [{"name": name, "import": imp,
             "props": sorted(set(props_by_iface.get(name + "Props", [])))}
            for name in exports]

# ---- DS source resolution ---------------------------------------------------

def load_config(root):
    """User config: steve.config.json, or a `steveDesigner` field in package.json."""
    cfg = load_json(os.path.join(root, "steve.config.json"))
    if cfg:
        return cfg
    pkg = load_json(os.path.join(root, "package.json")) or {}
    return pkg.get("steveDesigner")

def _iter_workspace_pkg_dirs(root):
    data = load_json(os.path.join(root, "package.json")) or {}
    ws = data.get("workspaces")
    globs = ws.get("packages", []) if isinstance(ws, dict) else (ws or [])
    seen = set()
    for g in globs:
        for pkg_json in glob.glob(os.path.join(root, g, "package.json")):
            d = os.path.dirname(pkg_json)
            if d not in seen and "node_modules" not in pkg_json:
                seen.add(d)
                yield d

def _package_is_design_system(pkg_dir):
    """A workspace package whose `exports` map points at .tsx files IS the design
    system (a component library). Apps (Next.js etc.) don't export their
    components — they have no such exports map — so they are correctly skipped.
    """
    data = load_json(os.path.join(pkg_dir, "package.json"))
    if not data or not data.get("name"):
        return None
    exports = data.get("exports")
    if not exports or ".tsx" not in json.dumps(exports):
        return None
    return data["name"]

def resolve_sources(root, config):
    """Return list of source descriptors: {files, import_for, prefixes}."""
    sources = []

    def add_dir_source(dir_glob, pkg_name):
        base_dir = os.path.join(root, dir_glob.rstrip("*/ "))
        files = [p for p in glob.glob(os.path.join(root, dir_glob), recursive=True)
                 if p.endswith((".tsx", ".jsx")) and "node_modules" not in p]
        if not files:
            # dir_glob may be a directory rather than a file glob
            files = [p for p in find_files(base_dir, ["*.tsx", "*.jsx"])]

        def import_for(path, rel):
            if pkg_name:
                return f"{pkg_name}/{os.path.splitext(os.path.basename(path))[0]}"
            return os.path.splitext(rel)[0]
        prefixes = [pkg_name, pkg_name + "/*"] if pkg_name else []
        sources.append({"files": files, "import_for": import_for, "prefixes": prefixes})

    # 1. Explicit config wins.
    if config and config.get("dsSources"):
        for s in config["dsSources"]:
            if isinstance(s, str):
                add_dir_source(s, None)
            else:
                add_dir_source(s.get("dir", "**"), s.get("package"))
        return sources

    # 2. Auto-detect: workspace packages that ARE the design system.
    for pkg_dir in _iter_workspace_pkg_dirs(root):
        pkg_name = _package_is_design_system(pkg_dir)
        if not pkg_name:
            continue
        src_root = os.path.join(pkg_dir, "src") if os.path.isdir(os.path.join(pkg_dir, "src")) else pkg_dir
        files = find_files(src_root, ["*.tsx", "*.jsx"])

        def make_import_for(pn):
            def import_for(path, rel):
                return f"{pn}/{os.path.splitext(os.path.basename(path))[0]}"
            return import_for
        sources.append({"files": files, "import_for": make_import_for(pkg_name),
                        "prefixes": [pkg_name, pkg_name + "/*"]})

    # 3. Auto-detect: greenfield components/ui/ convention.
    green = [p for p in find_files(root, ["*.tsx", "*.jsx"])
             if "/components/ui/" in p.replace("\\", "/")
             or "/components/" in p.replace("\\", "/")]
    if green:
        def import_for(path, rel):
            return os.path.splitext(rel)[0]
        sources.append({"files": green, "import_for": import_for,
                        "prefixes": ["*/components/ui/*", "*/components/*"]})

    return sources

def detect_components(root, config):
    comps = []
    prefixes = []
    seen = set()
    for src in resolve_sources(root, config):
        for pre in src["prefixes"]:
            if pre and pre not in prefixes:
                prefixes.append(pre)
        for path in src["files"]:
            for comp in extract_from_file(path, root, src["import_for"]):
                key = (comp["name"], comp["import"])
                if key in seen:
                    continue
                seen.add(key)
                comps.append(comp)
    return comps, prefixes

def build_manifest(root):
    config = load_config(root)
    packages = detect_packages(root)
    tokens = detect_tokens(root)
    components, ds_prefixes = detect_components(root, config)
    allowed = sorted({h.lower() for v in tokens["color"].values() for h in HEX_RE.findall(v)})
    return {
        "generatedAt": "GENERATED",
        "stack": detect_stack(root, packages, tokens, components),
        "tokens": tokens,
        "components": components,
        "dsImportPrefixes": ds_prefixes,
        "packages": packages,
        "allowedHex": allowed,
    }

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True)
    ap.add_argument("--stdout", action="store_true")
    ap.add_argument("--out")
    args = ap.parse_args()
    if not os.path.isdir(args.root):
        print(f"root not found: {args.root}", file=sys.stderr)
        return 1
    manifest = build_manifest(args.root)
    text = json.dumps(manifest, indent=2)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(text + "\n")
    if args.stdout or not args.out:
        print(text)
    return 0

if __name__ == "__main__":
    sys.exit(main())
