from pipeline import hasher


def test_stable_hash_is_deterministic():
    entity = {
        "entity_slug": "volcanic_fissure",
        "description": "Slam the ground",
        "mechanic_tags": ["slam", "fire"],
        "damage_tags": ["fire", "physical"],
    }
    assert hasher.content_hash(entity) == hasher.content_hash(entity)


def test_hash_ignores_tag_order():
    a = {"entity_slug": "x", "description": "d", "mechanic_tags": ["a", "b"], "damage_tags": ["x"]}
    b = {"entity_slug": "x", "description": "d", "mechanic_tags": ["b", "a"], "damage_tags": ["x"]}
    assert hasher.content_hash(a) == hasher.content_hash(b)


def test_diff_returns_changed_slugs():
    scraped = [
        {"entity_slug": "a", "description": "1", "mechanic_tags": [], "damage_tags": []},
        {"entity_slug": "b", "description": "2", "mechanic_tags": [], "damage_tags": []},
        {"entity_slug": "c", "description": "3", "mechanic_tags": [], "damage_tags": []},
    ]
    # DB returned hashes: a unchanged, b stale, c missing entirely.
    db_hashes = {
        "a": hasher.content_hash(scraped[0]),
        "b": "stale",
    }
    changed = hasher.diff(scraped, db_hashes)
    assert set(changed) == {"b", "c"}
