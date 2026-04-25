"""Send changed entities to Claude Sonnet and return structured synergy output."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Iterable

from anthropic import Anthropic

PROMPT_DIR = Path(__file__).parent / "prompts"
SYSTEM_PROMPT = (PROMPT_DIR / "indexing_system.txt").read_text(encoding="utf-8")
FEW_SHOT = json.loads((PROMPT_DIR / "few_shot_examples.json").read_text(encoding="utf-8"))

ALLOWED_MECHANIC_TAGS = {
    "slam", "fire", "cold", "lightning", "physical", "chaos", "aoe", "duration",
    "projectile", "melee", "totem", "trap", "mine", "minion", "channelling",
    "movement", "travel", "warcry", "trigger", "ground_effect", "debuff", "buff",
    "charge", "stance", "brand", "aura", "hex", "mark", "herald", "guard",
    "blink", "spell", "attack", "bow", "crossbow", "shield", "strike",
}
ALLOWED_DAMAGE_TAGS = {"fire", "cold", "lightning", "physical", "chaos"}
ALLOWED_INTERACTION_TYPES = {"direct", "extended", "conditional"}

MODEL = "claude-sonnet-4-6"
MAX_TOKENS = 1500

_client = Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))


class CostGuardError(RuntimeError):
    pass


def check_cost_guard(entities: list[dict], threshold: int = 50) -> None:
    if len(entities) > threshold:
        raise CostGuardError(
            f"Cost guard tripped: {len(entities)} entities queued for reindex (threshold={threshold}). "
            "Abort the pipeline run and investigate."
        )


def _build_messages(entity: dict) -> list[dict]:
    messages: list[dict] = []
    for example in FEW_SHOT:
        messages.append({"role": "user", "content": json.dumps(example["input"])})
        messages.append({"role": "assistant", "content": json.dumps(example["output"])})
    messages.append({"role": "user", "content": json.dumps(entity)})
    return messages


def validate_output(payload: dict) -> None:
    mech = set(payload.get("mechanic_tags", []))
    bad_mech = mech - ALLOWED_MECHANIC_TAGS
    if bad_mech:
        print(f"WARNING: filtering unknown mechanic_tags: {sorted(bad_mech)}", file=sys.stderr)
        payload["mechanic_tags"] = sorted(mech - bad_mech)

    dmg = set(payload.get("damage_tags", []))
    bad_dmg = dmg - ALLOWED_DAMAGE_TAGS
    if bad_dmg:
        print(f"WARNING: filtering unknown damage_tags: {sorted(bad_dmg)}", file=sys.stderr)
        payload["damage_tags"] = sorted(dmg - bad_dmg)

    valid_edges = []
    for edge in payload.get("synergizes_with", []):
        if edge.get("interaction_type") not in ALLOWED_INTERACTION_TYPES:
            print(f"WARNING: dropping edge with bad interaction_type: {edge.get('interaction_type')}", file=sys.stderr)
            continue
        if not edge.get("entity_id"):
            print("WARNING: dropping edge missing entity_id", file=sys.stderr)
            continue
        valid_edges.append(edge)
    payload["synergizes_with"] = valid_edges


def index_one(entity: dict) -> dict:
    response = _client.messages.create(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        system=SYSTEM_PROMPT,
        messages=_build_messages(entity),
    )
    text = response.content[0].text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:].strip()
    payload = json.loads(text)
    validate_output(payload)
    return payload


def index_many(entities: Iterable[dict]) -> list[dict]:
    entities_list = list(entities)
    results: list[dict] = []
    for entity in entities_list:
        results.append(index_one(entity))
    return results


def main() -> int:
    data = json.loads(sys.stdin.read())
    entities = data["entities"]
    changed_slugs = set(data.get("changed_slugs", [e["entity_slug"] for e in entities]))
    to_index = [e for e in entities if e["entity_slug"] in changed_slugs]
    try:
        indexed = index_many(to_index)
    except CostGuardError as exc:
        sys.stderr.write(f"ERROR: {exc}\n")
        return 1
    sys.stdout.write(json.dumps({"entities": entities, "indexed": indexed}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
