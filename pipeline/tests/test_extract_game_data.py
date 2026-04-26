from pipeline.extract_game_data import map_skill_types, CLASS_ID_TO_TAG


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
