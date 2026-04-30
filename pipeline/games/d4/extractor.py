"""Extract D4 skill/aspect data from blizzhackers/d4data community JSON export.

Actual tarball structure (tag 1.3.5.51869):
  <root>/
    json/
      base/
        meta/
          Aspect/   ← Asp_Legendary_<Class>_NNN.asp.json (aspect metadata)
          Power/    ← <Class>_<SkillName>.pow.json (power metadata, no descriptions)
      enUS_Text/
        meta/
          StringList/
            Power_<Class>_<SkillName>.stl.json  ← skill display name + description
            Affix_<affix_name>.stl.json          ← aspect display name + description

Skills are sourced from Power_<Class>_*.stl.json files.
Aspects are sourced from Aspect/*.asp.json → snoAffix.name → Affix_*.stl.json.

IMPORTANT: The tarball has ~430k entries. We use a SINGLE streaming pass to read all
needed files, storing their content in memory. This avoids the O(n²) cost of calling
extractfile() on a gzip stream (which requires rewinding for each member).
"""

from __future__ import annotations

import json
import re
import sys
import tempfile
import tarfile
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

try:
    from slugify import slugify
except ImportError:
    def slugify(text: str) -> str:
        return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")

# The blizzhackers/d4data repo has no "releases", only tags.
GITHUB_TAGS_API = "https://api.github.com/repos/blizzhackers/d4data/tags"
OUT_PATH = Path(__file__).parent.parent.parent / "data" / "d4_seed.json"

# Map StringList class name tokens → canonical class slug
STL_CLASS_MAP = {
    "Barbarian": "barbarian",
    "Druid": "druid",
    "Necromancer": "necromancer",
    "Rogue": "rogue",
    "Sorcerer": "sorcerer",
}

# Map Aspect filename class tokens → canonical class slug
ASP_CLASS_MAP = {
    "Barb": "barbarian",
    "Druid": "druid",
    "druid": "druid",
    "Necro": "necromancer",
    "Rogue": "rogue",
    "Sorc": "sorcerer",
    "sorc": "sorcerer",
    # Generic = no class
}

# Suffixes that indicate non-primary skills to exclude from the skills list.
# We want only the canonical active skill entries.
SKILL_EXCLUDE_SUFFIXES = (
    "_Passive",
    "_Talent",
    "_Proc_",
    "_Attack_2",
    "_Attack_3",
    "_WeaponExpertise",
    "_Bonus_",
    "_Rank10",
    "_KillCheck",
    "_Passability",
)

DAMAGE_KEYWORDS: dict[str, list[str]] = {
    "physical": ["physical", "weapon damage", "bleed", "bleeding"],
    "fire": ["fire", "burn", "burning", "ignite"],
    "cold": ["cold", "freeze", "freezing", "chill", "chilled", "frozen"],
    "lightning": ["lightning", "shock", "shocked"],
    "poison": ["poison", "toxic", "venom"],
    "shadow": ["shadow", "darkness", "dark"],
}

MECHANIC_KEYWORDS: dict[str, list[str]] = {
    "aoe": ["area", "aoe", "explode", "explosion", "radius", "nearby"],
    "dot": ["over time", "dot", "bleed", "burn", "burning", "poison"],
    "movement": ["dash", "teleport", "leap", "charge", "move", "evade"],
    "minion": ["minion", "skeleton", "golem", "companion", "wolf", "summon", "raised"],
    "stun": ["stun", "immobilize", "knockback", "knock back", "freeze", "frozen"],
    "barrier": ["barrier", "shield", "absorb"],
    "channel": ["channel", "channeled", "hold", "continuous"],
    "lucky": ["lucky hit"],
    "berserk": ["berserking", "berserk"],
    "shapeshifting": ["werewolf", "werebear", "shapeshift"],
}


def _infer_tags(text: str, keyword_map: dict[str, list[str]]) -> list[str]:
    text_lower = text.lower()
    return [tag for tag, kws in keyword_map.items() if any(kw in text_lower for kw in kws)]


def _clean_description(raw: str) -> str:
    """Strip game formatting tokens like {c_label}...{/c_label}, {Script Formula N}, etc."""
    # Remove paired format tags keeping inner text: {c_label}TEXT{/c_label} → TEXT
    text = re.sub(r"\{c_[^}]+\}(.*?)\{/c[^}]*\}", r"\1", raw, flags=re.DOTALL)
    # Remove remaining {tags}
    text = re.sub(r"\{[^}]+\}", "", text)
    # Collapse whitespace
    return " ".join(text.split()).strip()


def _get_tarball_url() -> tuple[str, str]:
    """Return (tarball_url, tag_name) for the latest blizzhackers/d4data tag."""
    req = urllib.request.Request(
        GITHUB_TAGS_API,
        headers={"User-Agent": "synergywizard-d4-pipeline/1.0"},
    )
    with urllib.request.urlopen(req) as resp:
        tags = json.loads(resp.read())
    if not tags:
        raise RuntimeError("No tags found in blizzhackers/d4data")
    latest = tags[0]
    tag_name = latest["name"]
    tarball_url = latest["tarball_url"]
    return tarball_url, tag_name


def _load_needed_files(tarball_path: Path) -> tuple[str, dict[str, bytes]]:
    """Single streaming pass through the tarball.

    Returns:
        prefix: root directory prefix (e.g. 'blizzhackers-d4data-abc123/')
        contents: {member_name: raw_bytes} for all files we need
    """
    prefix = ""
    contents: dict[str, bytes] = {}

    # Pre-compile patterns for the files we care about
    cls_tokens = "|".join(STL_CLASS_MAP.keys())
    skill_stl_re = re.compile(
        r"/json/enUS_Text/meta/StringList/Power_("
        + cls_tokens
        + r")_[^/]+\.stl\.json$"
    )
    aspect_re = re.compile(r"/json/base/meta/Aspect/Asp_Legendary_[^/]+\.asp\.json$")
    affix_stl_re = re.compile(r"/json/enUS_Text/meta/StringList/Affix_[^/]+\.stl\.json$")

    print("  (streaming pass through tarball…)", file=sys.stderr)
    with tarfile.open(tarball_path, "r:gz") as tf:
        for member in tf:
            name = member.name

            # Detect prefix from first real path entry
            if not prefix and "/" in name:
                prefix = name.split("/")[0] + "/"

            if not member.isfile():
                continue

            if (
                skill_stl_re.search(name)
                or aspect_re.search(name)
                or affix_stl_re.search(name)
            ):
                f = tf.extractfile(member)
                if f:
                    contents[name] = f.read()

    return prefix, contents


def _parse_stl(raw: bytes) -> dict[str, str]:
    """Parse a StringList JSON bytes → {szLabel: szText}."""
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return {
        item.get("szLabel", ""): item.get("szText", "")
        for item in data.get("arStrings", [])
    }


def extract_skills(contents: dict[str, bytes], prefix: str) -> list[dict]:
    """Extract active skills from Power_<Class>_*.stl.json StringList files."""
    entities: list[dict] = []

    for cls_token, cls_slug in STL_CLASS_MAP.items():
        pattern_prefix = f"{prefix}json/enUS_Text/meta/StringList/Power_{cls_token}_"
        skill_stl = [
            name for name in contents
            if name.startswith(pattern_prefix) and name.endswith(".stl.json")
        ]

        for member_path in skill_stl:
            filename = member_path.split("/")[-1]
            # e.g. Power_Barbarian_Bash.stl.json → skill_part = "Bash"
            skill_part = filename[len(f"Power_{cls_token}_"):].removesuffix(".stl.json")

            # Skip non-primary skill variants
            if any(suffix in skill_part for suffix in SKILL_EXCLUDE_SUFFIXES):
                continue

            strings = _parse_stl(contents[member_path])
            if not strings:
                continue

            display_name = strings.get("name", "").strip()
            if not display_name:
                display_name = re.sub(r"([A-Z])", r" \1", skill_part).strip()

            # Prefer simple_desc (cleaner), fall back to desc
            desc_raw = strings.get("simple_desc") or strings.get("desc") or ""
            desc = _clean_description(desc_raw)

            entities.append({
                "entity_slug": slugify(f"d4-{cls_slug}-{display_name}"),
                "display_name": display_name,
                "entity_type": "skill",
                "class_tags": [cls_slug],
                "mechanic_tags": _infer_tags(desc, MECHANIC_KEYWORDS),
                "damage_tags": _infer_tags(desc, DAMAGE_KEYWORDS),
                "weapon_tags": [],
                "description": desc,
                "recommended_supports": [],
                "relevant_passives": [],
                "conversions_available": [],
            })

    return entities


def extract_aspects(contents: dict[str, bytes], prefix: str) -> list[dict]:
    """Extract legendary aspects from Aspect/*.asp.json + Affix_*.stl.json."""
    entities: list[dict] = []

    asp_pattern_prefix = f"{prefix}json/base/meta/Aspect/"
    asp_files = [
        name for name in contents
        if name.startswith(asp_pattern_prefix) and name.endswith(".asp.json")
    ]

    for member_path in asp_files:
        try:
            asp_data = json.loads(contents[member_path])
        except json.JSONDecodeError:
            continue

        affix_name = asp_data.get("snoAffix", {}).get("name", "")
        if not affix_name:
            continue

        stl_path = f"{prefix}json/enUS_Text/meta/StringList/Affix_{affix_name}.stl.json"
        if stl_path not in contents:
            continue

        strings = _parse_stl(contents[stl_path])
        if not strings:
            continue

        display_name = strings.get("Name", strings.get("name", "")).strip()
        desc_raw = strings.get("Desc", strings.get("desc", "")).strip()
        desc = _clean_description(desc_raw)

        if not display_name or not desc:
            continue

        # Infer class from the Aspect filename, e.g. Asp_Legendary_Barb_001
        asp_filename = member_path.split("/")[-1]
        cls_slug: str | None = None
        m = re.match(r"Asp_Legendary_([^_]+)_", asp_filename)
        if m:
            cls_slug = ASP_CLASS_MAP.get(m.group(1))  # None for "Generic"

        entities.append({
            "entity_slug": slugify(f"d4-aspect-{affix_name}"),
            "display_name": display_name,
            "entity_type": "aspect",
            "class_tags": [cls_slug] if cls_slug else [],
            "mechanic_tags": _infer_tags(desc, MECHANIC_KEYWORDS),
            "damage_tags": _infer_tags(desc, DAMAGE_KEYWORDS),
            "weapon_tags": [],
            "description": desc,
            "recommended_supports": [],
            "relevant_passives": [],
            "conversions_available": [],
        })

    return entities


def main() -> None:
    print("Fetching latest blizzhackers/d4data tag…", file=sys.stderr)
    url, tag = _get_tarball_url()
    print(f"Tag: {tag}", file=sys.stderr)
    print(f"Downloading {url}", file=sys.stderr)

    with tempfile.NamedTemporaryFile(suffix=".tar.gz", delete=False) as tmp:
        tmp_path = Path(tmp.name)

    urllib.request.urlretrieve(url, tmp_path)
    print(f"Downloaded ({tmp_path.stat().st_size // 1024 // 1024} MB)", file=sys.stderr)

    print("Reading needed files (single streaming pass)…", file=sys.stderr)
    prefix, contents = _load_needed_files(tmp_path)
    print(f"Root prefix: {prefix!r}  |  files loaded: {len(contents)}", file=sys.stderr)

    print("Extracting skills…", file=sys.stderr)
    skills = extract_skills(contents, prefix)
    print(f"  {len(skills)} skills", file=sys.stderr)

    print("Extracting aspects…", file=sys.stderr)
    aspects = extract_aspects(contents, prefix)
    print(f"  {len(aspects)} aspects", file=sys.stderr)

    entities = skills + aspects

    # De-duplicate by slug
    seen: set[str] = set()
    unique: list[dict] = []
    for e in entities:
        if e["entity_slug"] not in seen:
            seen.add(e["entity_slug"])
            unique.append(e)

    seed = {
        "game": "d4",
        "extracted_at": datetime.now(timezone.utc).isoformat(),
        "source_tag": tag,
        "entities": unique,
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(seed, indent=2, ensure_ascii=False))
    print(f"Wrote {len(unique)} entities → {OUT_PATH}", file=sys.stderr)


if __name__ == "__main__":
    main()
