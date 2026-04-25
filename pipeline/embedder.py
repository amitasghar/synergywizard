"""Generate sentence embeddings for entities using all-MiniLM-L6-v2 via fastembed."""

from __future__ import annotations
from functools import lru_cache
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from fastembed import TextEmbedding

DIMENSIONS = 384
MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"


@lru_cache(maxsize=1)
def _model() -> "TextEmbedding":
    from fastembed import TextEmbedding
    return TextEmbedding(model_name=MODEL_NAME)


def embed_text(text: str) -> list[float]:
    vectors = list(_model().embed([text]))
    return [float(v) for v in vectors[0]]


def embed_entity(entity: dict) -> list[float]:
    parts = [p for p in [entity.get("display_name", "")] if p]
    parts += entity.get("mechanic_tags", [])
    parts += entity.get("damage_tags", [])
    desc = entity.get("description", "")
    if desc:
        parts.append(desc)
    if not parts:
        raise ValueError(f"Entity has no embeddable text: {entity.get('entity_slug', '<unknown>')}")
    return embed_text(" ".join(parts))
