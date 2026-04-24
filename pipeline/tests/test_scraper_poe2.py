from pathlib import Path

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
