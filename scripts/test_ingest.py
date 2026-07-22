import json, os, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))

def run_ingest(repo):
    out = subprocess.run(
        [sys.executable, os.path.join(HERE, "ingest_design_system.py"), "--root", repo, "--stdout"],
        capture_output=True, text=True,
    )
    assert out.returncode == 0, f"ingest failed: {out.stderr}"
    return json.loads(out.stdout)

def test_tailwind_css_tokens_and_stack():
    repo = os.path.join(HERE, "fixtures", "repo_tailwind_css")
    m = run_ingest(repo)
    assert m["stack"]["type"] == "tailwind-css", m["stack"]
    assert m["stack"]["tailwind"] is True
    assert m["tokens"]["color"]["bg-base"] == "#0b0b0c"
    assert m["tokens"]["color"]["accent"] == "#3b82f6"
    assert m["tokens"]["spacing"]["1"] == "4px"
    assert m["tokens"]["radius"]["sm"] == "4px"
    assert sorted(m["allowedHex"]) == ["#0b0b0c", "#3b82f6"]
    assert m["packages"]["tailwindcss"] == "4.0.0"

def test_shadcn_components():
    repo = os.path.join(HERE, "fixtures", "repo_shadcn")
    m = run_ingest(repo)
    assert m["stack"]["type"] == "shadcn", m["stack"]
    assert m["stack"]["framework"] == "next"
    names = {c["name"] for c in m["components"]}
    assert "Button" in names, names
    button = next(c for c in m["components"] if c["name"] == "Button")
    assert sorted(button["props"]) == ["asChild", "size", "variant"], button["props"]
    assert button["import"].endswith("components/ui/button")

def test_pkg_ds_auto_detect():
    """Brownfield: a workspace package that IS the design system (@acme/ui),
    detected from real exports outside components/ui/, no Tailwind."""
    repo = os.path.join(HERE, "fixtures", "repo_pkg_ds")
    m = run_ingest(repo)
    # Stack: token-based, NOT tailwind (no tailwind.config, no tailwindcss dep).
    assert m["stack"]["tailwind"] is False, m["stack"]
    assert m["stack"]["type"] in ("token-css", "own-primitives"), m["stack"]
    # Components come from export function|const <PascalCase>, tests excluded.
    names = {c["name"] for c in m["components"]}
    assert {"UiButton", "UiCloseIconButton", "StatusPill"} <= names, names
    assert "useThing" not in names and "UiFakeFromTest" not in names, names
    # Import specifier is the package subpath, not a file path.
    btn = next(c for c in m["components"] if c["name"] == "UiButton")
    assert btn["import"] == "@acme/ui/primitives", btn["import"]
    assert sorted(btn["props"]) == ["size", "variant"], btn["props"]
    # Import matcher for the linter is emitted and covers the package + subpaths.
    assert "@acme/ui" in m["dsImportPrefixes"], m["dsImportPrefixes"]
    assert "@acme/ui/*" in m["dsImportPrefixes"], m["dsImportPrefixes"]

def test_config_driven_sources():
    """steve.config.json points the detector at a non-standard dir + package."""
    repo = os.path.join(HERE, "fixtures", "repo_config_ds")
    m = run_ingest(repo)
    names = {c["name"] for c in m["components"]}
    assert {"FancyPanel", "GlassCard"} <= names, names
    fp = next(c for c in m["components"] if c["name"] == "FancyPanel")
    assert fp["import"] == "@custom/ds/widgets", fp["import"]
    assert "@custom/ds" in m["dsImportPrefixes"], m["dsImportPrefixes"]
    assert m["stack"]["tailwind"] is False, m["stack"]

def test_greenfield_emits_import_prefixes():
    """Greenfield components/ui/ still works and emits a usable matcher."""
    repo = os.path.join(HERE, "fixtures", "repo_shadcn")
    m = run_ingest(repo)
    assert any("components/ui" in p for p in m.get("dsImportPrefixes", [])), m.get("dsImportPrefixes")

if __name__ == "__main__":
    test_tailwind_css_tokens_and_stack(); print("ok: tailwind_css")
    test_shadcn_components(); print("ok: shadcn_components")
    test_pkg_ds_auto_detect(); print("ok: pkg_ds_auto_detect")
    test_config_driven_sources(); print("ok: config_driven_sources")
    test_greenfield_emits_import_prefixes(); print("ok: greenfield_import_prefixes")
