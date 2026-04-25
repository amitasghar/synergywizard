from unittest.mock import MagicMock

from pipeline import db_writer


def test_upsert_entity_issues_insert_on_conflict():
    conn = MagicMock()
    cursor = MagicMock()
    conn.cursor.return_value.__enter__.return_value = cursor
    cursor.fetchone.return_value = ("11111111-1111-1111-1111-111111111111",)

    entity = {
        "entity_slug": "volcanic_fissure",
        "display_name": "Volcanic Fissure",
        "entity_type": "skill",
        "class_tags": ["warrior"],
        "mechanic_tags": ["slam", "fire"],
        "damage_tags": ["fire", "physical"],
        "description": "Slam",
        "creates": [],
        "triggered_by": [],
        "recommended_supports": [],
        "relevant_passives": [],
        "conversions_available": [],
    }
    entity_id = db_writer.upsert_entity(
        conn, entity, patch_version="1.0.0", content_hash_value="h", raw_ai_output={}
    )
    assert entity_id == "11111111-1111-1111-1111-111111111111"
    sql_called = cursor.execute.call_args_list[0][0][0]
    assert "INSERT INTO entities" in sql_called
    assert "ON CONFLICT" in sql_called


def test_upsert_edge_issues_insert_on_conflict():
    conn = MagicMock()
    cursor = MagicMock()
    conn.cursor.return_value.__enter__.return_value = cursor

    db_writer.upsert_edge(
        conn,
        game="poe2",
        from_id="a",
        to_id="b",
        interaction_type="direct",
        reason="x",
    )
    sql_called = cursor.execute.call_args_list[0][0][0]
    assert "INSERT INTO synergy_edges" in sql_called
    assert "ON CONFLICT" in sql_called


def test_update_embedding_formats_vector_correctly():
    conn = MagicMock()
    cur = MagicMock()
    conn.cursor.return_value.__enter__.return_value = cur

    from pipeline.db_writer import update_embedding
    update_embedding(conn, "volcanic_fissure", [0.1, 0.2, 0.3])

    call_args = cur.execute.call_args[0]
    sql, params = call_args
    assert "[0.1,0.2,0.3]" in params[0]
    assert params[1] == "poe2"
    assert params[2] == "volcanic_fissure"
