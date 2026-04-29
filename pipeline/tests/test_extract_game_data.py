from pipeline.extract_game_data import map_skill_types, CLASS_ID_TO_TAG, WEAPON_REQ_TO_TAGS


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
