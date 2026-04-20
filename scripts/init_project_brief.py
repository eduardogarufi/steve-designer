#!/usr/bin/env python3
"""
init_project_brief.py — Initialize design-brief.md in the current project

Reads the template and writes design-brief.md to the project root.
Called by steve-designer at the start of Phase 2 (Discovery).

Usage:
    python3 init_project_brief.py [--project-name NAME] [--project-root PATH]

If --project-root is omitted, writes to the current working directory.
If --project-name is omitted, uses the directory name.
"""

import argparse
import datetime
import os
import sys
from pathlib import Path


def find_template() -> Path:
    """Locate the template file relative to this script."""
    script_dir = Path(__file__).parent.resolve()

    # When installed as a plugin, structure is:
    #   plugin-root/scripts/init_project_brief.py (this file)
    #   plugin-root/skills/steve-designer/templates/design-brief.template.md
    candidates = [
        script_dir.parent / "skills" / "steve-designer" / "templates" / "design-brief.template.md",
        script_dir / "templates" / "design-brief.template.md",
        script_dir.parent / "templates" / "design-brief.template.md",
    ]

    for c in candidates:
        if c.exists():
            return c

    print("ERROR: Could not find design-brief.template.md in any of:", file=sys.stderr)
    for c in candidates:
        print(f"  - {c}", file=sys.stderr)
    sys.exit(1)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project-name", default=None,
                        help="Project name (default: current directory name)")
    parser.add_argument("--project-root", default=None,
                        help="Project root path (default: current working directory)")
    parser.add_argument("--force", action="store_true",
                        help="Overwrite existing design-brief.md (default: abort)")
    args = parser.parse_args()

    # Resolve project root
    project_root = Path(args.project_root).resolve() if args.project_root else Path.cwd()
    if not project_root.is_dir():
        print(f"ERROR: project root is not a directory: {project_root}", file=sys.stderr)
        sys.exit(1)

    # Resolve project name
    project_name = args.project_name or project_root.name

    # Check for existing brief
    brief_path = project_root / "design-brief.md"
    if brief_path.exists() and not args.force:
        print(f"design-brief.md already exists at {brief_path}.")
        print("Use --force to overwrite, or run /steve-designer:resume instead.")
        sys.exit(1)

    # Load template
    template_path = find_template()
    template = template_path.read_text(encoding="utf-8")

    # Fill placeholders
    today = datetime.date.today().isoformat()
    content = (
        template
        .replace("{{PROJECT_NAME}}", project_name)
        .replace("{{DATE}}", today)
    )

    # Write
    brief_path.write_text(content, encoding="utf-8")
    print(f"✓ Created {brief_path}")
    print(f"  Project:    {project_name}")
    print(f"  Date:       {today}")


if __name__ == "__main__":
    main()
