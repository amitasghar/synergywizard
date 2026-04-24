import json
from unittest.mock import MagicMock, patch

from pipeline import indexer


FAKE_CLAUDE_JSON = {
    "entity_slug": "stampede",
    "mechanic_tags": ["slam", "aoe", "movement"],
    "damage_tags": ["physical"],
    "creates": [],
    "triggered_by": [],
    "synergizes_with": [
        {"entity_id": "volcanic_fissure", "reason": "Stampede repeatedly triggers the fissure.", "interaction_type": "direct"}
    ],
    "recommended_supports": [],
    "relevant_passives": [],
    "conversions_available": []
}


def _mock_message(text):
    msg = MagicMock()
    msg.content = [MagicMock(text=text)]
    return msg


def test_index_one_returns_parsed_output():
    entity = {"entity_slug": "stampede", "display_name": "Stampede", "entity_type": "skill",
              "class_tags": ["warrior"], "mechanic_tags": ["slam", "movement"], "damage_tags": ["physical"],
              "description": "Charge forward, knocking enemies aside."}

    with patch.object(indexer, "_client") as client:
        client.messages.create.return_value = _mock_message(json.dumps(FAKE_CLAUDE_JSON))
        result = indexer.index_one(entity)

    assert result["entity_slug"] == "stampede"
    assert "volcanic_fissure" in {s["entity_id"] for s in result["synergizes_with"]}


def test_cost_guard_raises_when_too_many_entities():
    entities = [{"entity_slug": f"x{i}"} for i in range(51)]
    try:
        indexer.check_cost_guard(entities, threshold=50)
        assert False, "expected CostGuardError"
    except indexer.CostGuardError as exc:
        assert "51" in str(exc)


def test_cost_guard_passes_under_threshold():
    indexer.check_cost_guard([{"entity_slug": "a"}], threshold=50)


def test_validate_output_rejects_bad_tag():
    bad = dict(FAKE_CLAUDE_JSON)
    bad["mechanic_tags"] = ["slam", "made_up_tag"]
    try:
        indexer.validate_output(bad)
        assert False, "expected ValueError"
    except ValueError as exc:
        assert "made_up_tag" in str(exc)
