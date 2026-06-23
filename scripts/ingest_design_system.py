#!/usr/bin/env python3
"""ingest_design_system.py — auto-detect a repo's design system and emit a manifest.

Usage:
  ingest_design_system.py --root PATH [--stdout | --out PATH]
Exit codes: 0 ok, 1 error.
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

def detect_packages(root):
    pkg = read(os.path.join(root, "package.json"))
    if not pkg:
        return {}
    try:
        data = json.loads(pkg)
    except json.JSONDecodeError:
        return {}
    deps = {}
    deps.update(data.get("dependencies", {}))
    deps.update(data.get("devDependencies", {}))
    return {k: v.lstrip("^~") for k, v in deps.items()}

def detect_stack(root, packages):
    framework = "unknown"
    if "next" in packages:
        framework = "next"
    elif "astro" in packages:
        framework = "astro"
    elif "vite" in packages:
        framework = "vite"
    tailwind = "tailwindcss" in packages
    if os.path.exists(os.path.join(root, "components.json")):
        stype = "shadcn"
    elif find_files(root, ["*.tsx", "*.jsx"]) and (
        os.path.isdir(os.path.join(root, "components"))
        or os.path.isdir(os.path.join(root, "src", "components"))
    ):
        stype = "own-primitives"
    else:
        stype = "tailwind-css"
    return {"type": stype, "framework": framework, "tailwind": tailwind}

EXPORT_RE = re.compile(r"export\s+(?:default\s+)?(?:function|const)\s+([A-Z][A-Za-z0-9]+)")
PROPS_IFACE_RE = re.compile(r"interface\s+([A-Z][A-Za-z0-9]*Props)\s*\{([^}]*)\}", re.S)
PROP_NAME_RE = re.compile(r"([A-Za-z0-9]+)\??\s*:")

def detect_components(root):
    comps = []
    for path in find_files(root, ["*.tsx", "*.jsx"]):
        if "/components/" not in path.replace("\\", "/"):
            continue
        src = read(path)
        exports = EXPORT_RE.findall(src)
        if not exports:
            continue
        props_by_iface = {name: PROP_NAME_RE.findall(body) for name, body in PROPS_IFACE_RE.findall(src)}
        rel = os.path.relpath(path, root).replace("\\", "/")
        imp = os.path.splitext(rel)[0]
        for name in exports:
            props = props_by_iface.get(name + "Props", [])
            comps.append({"name": name, "import": imp, "props": sorted(set(props))})
    return comps

def build_manifest(root):
    packages = detect_packages(root)
    tokens = detect_tokens(root)
    allowed = sorted({h.lower() for v in tokens["color"].values() for h in HEX_RE.findall(v)})
    return {
        "generatedAt": "GENERATED",
        "stack": detect_stack(root, packages),
        "tokens": tokens,
        "components": detect_components(root),
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
