"""Detect POE2 patches by comparing GGG CDN version + Steam news GID to stored state."""

from __future__ import annotations

import json
import os
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import requests

GGG_CDN_URL = "http://patchcdn.pathofexile.com/pathofexile2/"
STEAM_NEWS_URL = (
    "https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/"
    "?appid=2694490&count=5&format=json"
)
STATE_PATH = Path(__file__).parent / "last_known_version.json"
USER_AGENT = "synergywizard-pipeline/0.1 (+https://github.com/)"


@dataclass
class DetectionResult:
    changed: bool
    ggg_version: str
    steam_latest_gid: str


def fetch_ggg_version() -> str:
    resp = requests.get(GGG_CDN_URL, headers={"User-Agent": USER_AGENT}, timeout=15)
    resp.raise_for_status()
    text = resp.text.strip()
    return text.splitlines()[0].strip() if text else ""


def fetch_steam_latest_gid() -> str:
    resp = requests.get(STEAM_NEWS_URL, headers={"User-Agent": USER_AGENT}, timeout=15)
    resp.raise_for_status()
    items = resp.json().get("appnews", {}).get("newsitems", [])
    return str(items[0]["gid"]) if items else ""


def load_state() -> dict:
    if not STATE_PATH.exists():
        return {"ggg_version": "", "steam_latest_gid": "", "checked_at": ""}
    return json.loads(STATE_PATH.read_text())


def save_state(ggg_version: str, steam_gid: str) -> None:
    STATE_PATH.write_text(
        json.dumps(
            {
                "ggg_version": ggg_version,
                "steam_latest_gid": steam_gid,
                "checked_at": datetime.now(timezone.utc).isoformat(),
            },
            indent=2,
        )
    )


def detect() -> DetectionResult:
    state = load_state()
    ggg_version = fetch_ggg_version()
    steam_gid = fetch_steam_latest_gid()

    changed = (
        ggg_version != state.get("ggg_version", "")
        or steam_gid != state.get("steam_latest_gid", "")
    )

    return DetectionResult(changed=changed, ggg_version=ggg_version, steam_latest_gid=steam_gid)


def main() -> int:
    result = detect()
    if result.changed:
        save_state(result.ggg_version, result.steam_latest_gid)
        print(f"PATCH_DETECTED version={result.ggg_version} steam_gid={result.steam_latest_gid}")
        gh_output = os.environ.get("GITHUB_OUTPUT")
        if gh_output:
            with open(gh_output, "a", encoding="utf-8") as fh:
                fh.write(f"patch_version={result.ggg_version}\n")
                fh.write("changed=true\n")
        return 0
    print("NO_CHANGE")
    gh_output = os.environ.get("GITHUB_OUTPUT")
    if gh_output:
        with open(gh_output, "a", encoding="utf-8") as fh:
            fh.write("changed=false\n")
    return 78


if __name__ == "__main__":
    sys.exit(main())
