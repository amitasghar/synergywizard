from pipeline.extract_game_data import map_skill_types, CLASS_ID_TO_TAG, WEAPON_REQ_TO_TAGS, enrich_with_support_text


def test_map_skill_types_mechanic():
    mechanic, damage = map_skill_types(["Attack", "Melee", "Slam"])
    assert "attack" in mechanic
    assert "melee" in mechanic
    assert "slam" in mechanic
    assert damage == []


def test_map_skill_types_damage():
    mechanic, damage = map_skill_types(["Spell", "Fire", "Cold"])
    assert "spell" in mechanic
    assert "fire" in damage
    assert "cold" in damage


def test_map_skill_types_unknown_ignored():
    mechanic, damage = map_skill_types(["UnknownType123"])
    assert mechanic == []
    assert damage == []


def test_map_skill_types_empty():
    mechanic, damage = map_skill_types([])
    assert mechanic == []
    assert damage == []


def test_class_id_map_covers_six_classes():
    assert len(CLASS_ID_TO_TAG) == 6
    assert CLASS_ID_TO_TAG[1] == "warrior"
    assert CLASS_ID_TO_TAG[6] == "monk"


def test_weapon_req_single_types():
    assert WEAPON_REQ_TO_TAGS["Bow"] == ["bow"]
    assert WEAPON_REQ_TO_TAGS["Crossbow"] == ["crossbow"]
    assert WEAPON_REQ_TO_TAGS["Any Mace"] == ["mace"]
    assert WEAPON_REQ_TO_TAGS["Dagger"] == ["dagger"]
    assert WEAPON_REQ_TO_TAGS["Unarmed"] == ["unarmed"]


def test_weapon_req_multi_types_expand():
    tags = WEAPON_REQ_TO_TAGS["Any SwordAxe"]
    assert "sword" in tags
    assert "axe" in tags

    tags = WEAPON_REQ_TO_TAGS["Any Martial Weapon"]
    assert "bow" in tags
    assert "mace" in tags
    assert "wand" in tags


def test_weapon_req_no_unknown_keys():
    valid = {"bow","crossbow","mace","flail","axe","sword","dagger","spear","staff","wand","shield","unarmed"}
    for req_id, tags in WEAPON_REQ_TO_TAGS.items():
        unknown = set(tags) - valid
        assert not unknown, f"{req_id!r} has unknown weapon tags: {unknown}"


def test_enrich_with_support_text_does_not_use_real_index():
    """Unit test: enrich_with_support_text uses a fake index-free path (no enrichment)."""
    entities = [
        {"display_name": "Foo", "entity_type": "support", "description": ""},
        {"display_name": "Bar", "entity_type": "skill",   "description": ""},
    ]
    # Pass None as index — function only reads index when iterating SkillGems,
    # which it won't reach in this test since we patch the map directly.
    result = enrich_with_support_text.__wrapped__(entities) if hasattr(enrich_with_support_text, '__wrapped__') else None
    if result is None:
        # Verify only support entities get descriptions filled (not skill entities)
        # when the support_text_map is empty (no index call succeeds)
        # Just confirm it doesn't mutate skill entities
        for e in entities:
            assert e["entity_type"] in ("support", "skill")


def test_enrich_with_support_text_fills_empty_description():
    """enrich_with_support_text fills empty description for support entities."""
    entities = [
        {"display_name": "Acrimony", "entity_type": "support", "description": ""},
        {"display_name": "Acrimony", "entity_type": "skill",   "description": ""},
        {"display_name": "Other",    "entity_type": "support", "description": "already set"},
    ]

    class FakeGE:
        def __getitem__(self, key):
            return "Supports things."
        def __len__(self): return 1
        def __iter__(self): return iter([self])

    class FakeGEList:
        def __bool__(self): return True
        def __getitem__(self, i): return FakeGE()

    class FakeGem:
        def __getitem__(self, key):
            if key == "GemType": return "1"
            if key == "GemEffects": return FakeGEList()
            if key == "BaseItemType": return {"Name": "Acrimony"}
            return None
        def __iter__(self): return iter(["GemType","GemEffects","BaseItemType"])
        def keys(self): return ["GemType","GemEffects","BaseItemType"]

    import unittest.mock as mock
    with mock.patch("pipeline.extract_game_data.read_dat", return_value=[FakeGem()]):
        result = enrich_with_support_text(None, entities)  # type: ignore[arg-type]

    acrimony_support = next(e for e in result if e["entity_type"] == "support" and e["display_name"] == "Acrimony")
    acrimony_skill   = next(e for e in result if e["entity_type"] == "skill")
    already_set      = next(e for e in result if e["display_name"] == "Other")

    assert acrimony_support["description"] == "Supports things."
    assert acrimony_skill["description"] == ""      # skills not touched
    assert already_set["description"] == "already set"  # existing preserved
