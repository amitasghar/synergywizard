"""Integration test: runs the indexer against 5 known POE2 skills and verifies
that Volcanic Fissure + Stampede produces a direct interaction.

Requires ANTHROPIC_API_KEY. Skipped automatically when not set.
"""

import json
import os
from pathlib import Path

import pytest

from pipeline import indexer

FIX = Path(__file__).parent / "fixtures" / "known_five.json"


@pytest.mark.skipif(not os.environ.get("ANTHROPIC_API_KEY"), reason="no ANTHROPIC_API_KEY")
def test_volcanic_fissure_stampede_direct_edge():
    entities = json.loads(FIX.read_text())
    results = indexer.index_many(entities)
    by_slug = {r["entity_slug"]: r for r in results}

    vf = by_slug["volcanic_fissure"]
    stampede = by_slug["stampede"]

    vf_targets = {e["entity_id"] for e in vf["synergizes_with"] if e.get("interaction_type") == "direct"}
    st_targets = {e["entity_id"] for e in stampede["synergizes_with"] if e.get("interaction_type") == "direct"}

    assert "stampede" in vf_targets or "volcanic_fissure" in st_targets, (
        "Expected Volcanic Fissure + Stampede to produce at least one direct edge; "
        f"got vf={vf['synergizes_with']}, st={stampede['synergizes_with']}"
    )
