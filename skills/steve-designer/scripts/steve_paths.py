#!/usr/bin/env python3
"""Path resolution shared by Steve's manifest and brief readers/writers."""
import os

MANIFEST_NEW = os.path.join("docs", "design", "manifest.json")
MANIFEST_LEGACY = "design-system-manifest.json"
BRIEF_NEW = os.path.join("docs", "design", "brief.md")
BRIEF_LEGACY = "design-brief.md"


class StevePathError(Exception):
    """Raised when two candidate paths exist and neither can be preferred."""


def resolve_artifact_path(explicit, new_path, legacy_path, root=".", kind="manifest"):
    if explicit:
        return os.path.abspath(os.path.join(root, explicit))
    modern = os.path.abspath(os.path.join(root, new_path))
    legacy = os.path.abspath(os.path.join(root, legacy_path))
    if os.path.exists(modern) and os.path.exists(legacy):
        raise StevePathError(
            f'Two {kind} files exist: "{new_path}" and "{legacy_path}". '
            "Steve will not guess which one is authoritative. Delete or merge one, "
            "or pass an explicit path."
        )
    return modern if os.path.exists(modern) or not os.path.exists(legacy) else legacy


def resolve_manifest_path(explicit=None, root="."):
    return resolve_artifact_path(explicit, MANIFEST_NEW, MANIFEST_LEGACY, root, "manifest")


def resolve_brief_path(explicit=None, root="."):
    return resolve_artifact_path(explicit, BRIEF_NEW, BRIEF_LEGACY, root, "design brief")


def ensure_parent_dir(path):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    return path
