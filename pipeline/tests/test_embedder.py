import pytest
from pipeline.embedder import embed_entity, embed_text, DIMENSIONS

def test_embed_text_returns_correct_dimensions():
    vec = embed_text("fire slam skill")
    assert len(vec) == DIMENSIONS
    assert all(isinstance(v, float) for v in vec)

def test_embed_text_is_deterministic():
    assert embed_text("volcanic fissure") == embed_text("volcanic fissure")

def test_embed_entity_uses_name_and_tags():
    entity = {
        "display_name": "Volcanic Fissure",
        "mechanic_tags": ["slam", "fire", "aoe"],
        "damage_tags": ["fire"],
        "description": "Slams creating a fissure",
    }
    vec = embed_entity(entity)
    assert len(vec) == DIMENSIONS

def test_different_entities_produce_different_vectors():
    a = embed_text("fire slam skill")
    b = embed_text("cold projectile support")
    assert a != b
