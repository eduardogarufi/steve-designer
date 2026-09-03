import json, os, subprocess, sys, tempfile
from ingest_design_system import color_value

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
    assert color_value(m["tokens"]["color"]["bg-base"]) == "#0b0b0c"
    assert color_value(m["tokens"]["color"]["accent"]) == "#3b82f6"
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
    assert fp["states"] == ["default", "loading"], fp
    assert fp["a11y"] == ["aria-busy"], fp

def test_greenfield_emits_import_prefixes():
    """Greenfield components/ui/ still works and emits a usable matcher."""
    repo = os.path.join(HERE, "fixtures", "repo_shadcn")
    m = run_ingest(repo)
    assert any("components/ui" in p for p in m.get("dsImportPrefixes", [])), m.get("dsImportPrefixes")

def test_v2_feedback_typography_z_breakpoints_and_roles():
    repo = os.path.join(HERE, "fixtures", "repo_v2_tokens")
    m = run_ingest(repo)
    assert m["schemaVersion"] == 2
    assert m["tokens"]["feedback"]["success"]["solid"] == "#10b981"
    assert m["tokens"]["feedback"]["danger"]["solid"] == "#ef4444"
    assert m["tokens"]["typography"]["h1"]["lineHeight"] == "1.1"
    assert m["tokens"]["typography"]["sans"]["family"].startswith('"Inter"')
    assert m["tokens"]["zIndex"] == {"modal": 1000, "dropdown-in-modal": 1050}
    assert m["tokens"]["breakpoints"] == {"md": "768px", "xl": "1280px"}
    assert m["tokens"]["color"]["bg-base"]["role"] == "background"
    assert m["tokens"]["color"]["accent"]["role"] == "accent"

def test_roles_follow_name_heuristics():
    from ingest_design_system import infer_color_role
    assert infer_color_role("background") == "background"
    assert infer_color_role("card") == "surface"
    assert infer_color_role("heading") == "text"
    assert infer_color_role("primary") == "accent"
    assert infer_color_role("input") == "border"
    assert infer_color_role("ring") == "ring"
    assert infer_color_role("navy") == "brand"
    assert infer_color_role("custom") is None

def test_v1_fixture_still_has_empty_new_fields_and_i18n_disabled():
    m = run_ingest(os.path.join(HERE, "fixtures", "repo_tailwind_css"))
    assert m["tokens"]["feedback"] == {}
    assert m["i18n"]["enabled"] is False

def test_allowed_hex_i18n_voice_and_manifest_path():
    import shutil
    repo = os.path.join(HERE, "fixtures", "repo_v2_tokens")
    m = run_ingest(repo)
    for value in ("#080b12", "#3b82f6", "#10b981", "#34d399", "#ef4444"):
        assert value in m["allowedHex"], (value, m["allowedHex"])
    assert m["i18n"]["enabled"] is True
    assert m["voice"]["locale"] == "pt-BR"
    with tempfile.TemporaryDirectory() as tmp:
        copy = os.path.join(tmp, "repo")
        shutil.copytree(repo, copy)
        out = subprocess.run([sys.executable, os.path.join(HERE, "ingest_design_system.py"), "--root", copy, "--manifest", "docs/design/manifest.json"], capture_output=True, text=True)
        assert out.returncode == 0, out.stderr
        assert os.path.exists(os.path.join(copy, "docs", "design", "manifest.json"))

if __name__ == "__main__":
    test_tailwind_css_tokens_and_stack(); print("ok: tailwind_css")
    test_shadcn_components(); print("ok: shadcn_components")
    test_pkg_ds_auto_detect(); print("ok: pkg_ds_auto_detect")
    test_config_driven_sources(); print("ok: config_driven_sources")
    test_greenfield_emits_import_prefixes(); print("ok: greenfield_import_prefixes")
    test_v2_feedback_typography_z_breakpoints_and_roles(); print("ok: v2_tokens")
    test_roles_follow_name_heuristics(); print("ok: color_roles")
    test_v1_fixture_still_has_empty_new_fields_and_i18n_disabled(); print("ok: v1_compatibility")
    test_allowed_hex_i18n_voice_and_manifest_path(); print("ok: manifest_path")
