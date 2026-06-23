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

if __name__ == "__main__":
    test_tailwind_css_tokens_and_stack(); print("ok: tailwind_css")
    test_shadcn_components(); print("ok: shadcn_components")
