"""SHA-256 diff utilities for the pipeline."""

from __future__ import annotations

import hashlib
import json
from typing import Iterable


def _canonical(entity: dict) -> str:
    payload = {
        "description": entity.get("description", "") or "",
        "mechanic_tags": sorted(entity.get("mechanic_tags", []) or []),
        "damage_tags": sorted(entity.get("damage_tags", []) or []),
        "class_tags": sorted(entity.get("class_tags", []) or []),
    }
    return json.dumps(payload, sort_keys=True, ensure_ascii=False)


def content_hash(entity: dict) -> str:
    return hashlib.sha256(_canonical(entity).encode("utf-8")).hexdigest()


def diff(scraped: Iterable[dict], db_hashes: dict[str, str]) -> list[str]:
    """Return slugs for entities whose content_hash differs from (or is missing from) the DB."""
    changed: list[str] = []
    for entity in scraped:
        slug = entity["entity_slug"]
        if db_hashes.get(slug) != content_hash(entity):
            changed.append(slug)
    return changed
