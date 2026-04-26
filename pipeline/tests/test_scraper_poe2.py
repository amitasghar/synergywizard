import json
import tempfile
from pathlib import Path
from unittest.mock import patch

from pipeline import scraper_poe2

FIX = Path(__file__).parent / "fixtures"


def test_parse_wiki_infobox_extracts_fields():
    wikitext = (FIX / "volcanic_fissure_wikitext.txt").read_text()
    entity = scraper_poe2.parse_wiki_infobox("Volcanic Fissure", wikitext)

    assert entity["entity_slug"] == "volcanic_fissure"
    assert entity["display_name"] == "Volcanic Fissure"
    assert entity["class_tags"] == ["warrior"]
    assert "slam" in entity["mechanic_tags"]
    assert "fire" in entity["mechanic_tags"]
    assert "aoe" in entity["mechanic_tags"]
    assert "ground_effect" in entity["mechanic_tags"]
    assert "fire" in entity["damage_tags"]
    assert "physical" in entity["damage_tags"]
    assert "molten rock" in entity["description"]


def test_parse_pob_lua_extracts_skill_types():
    lua = (FIX / "volcanic_fissure.lua").read_text()
    data = scraper_poe2.parse_pob_lua(lua)

    assert "VolcanicFissure" in data
    assert data["VolcanicFissure"]["name"] == "Volcanic Fissure"
    assert "Slam" in data["VolcanicFissure"]["skill_types"]
    assert "Fire" in data["VolcanicFissure"]["skill_types"]


def test_merge_sources_combines_wiki_and_pob():
    wiki = {
        "entity_slug": "volcanic_fissure",
        "display_name": "Volcanic Fissure",
        "mechanic_tags": ["slam", "fire"],
        "damage_tags": ["fire"],
        "class_tags": ["warrior"],
        "description": "Slam",
        "entity_type": "skill",
    }
    pob = {"VolcanicFissure": {"name": "Volcanic Fissure", "skill_types": ["Slam", "AreaSpell"]}}

    merged = scraper_poe2.merge_sources(wiki, pob)
    assert "areaspell" in merged["mechanic_tags"] or "aoe" in merged["mechanic_tags"]
    assert merged["entity_slug"] == "volcanic_fissure"


def test_scrape_all_uses_seed_when_present(tmp_path):
    seed = {
        "extracted_at": "2026-04-25T00:00:00+00:00",
        "patch_version": "3.25.0",
        "entity_counts": {"skill": 1, "support": 0, "passive": 0},
        "entities": [
            {
                "entity_slug": "arc",
                "display_name": "Arc",
                "entity_type": "skill",
                "class_tags": [],
                "mechanic_tags": ["lightning", "aoe"],
                "damage_tags": ["lightning"],
                "description": "Releases a beam of lightning",
            }
        ],
    }
    seed_file = tmp_path / "poe2_seed.json"
    seed_file.write_text(json.dumps(seed), encoding="utf-8")

    pob_data: dict = {}

    with (
        patch("pipeline.scraper_poe2.SEED_PATH", seed_file),
        patch("pipeline.scraper_poe2.ensure_pob_repo", return_value=tmp_path),
        patch("pipeline.scraper_poe2.load_all_pob_data", return_value=pob_data),
    ):
        entities = scraper_poe2.scrape_all()

    assert len(entities) == 1
    assert entities[0]["entity_slug"] == "arc"
    assert "lightning" in entities[0]["mechanic_tags"]


def test_load_from_seed_returns_none_when_missing(tmp_path):
    with patch("pipeline.scraper_poe2.SEED_PATH", tmp_path / "nonexistent.json"):
        result = scraper_poe2.load_from_seed()
    assert result is None
