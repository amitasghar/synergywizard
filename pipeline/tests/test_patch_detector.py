import json
from pathlib import Path
from unittest.mock import patch

from pipeline import patch_detector


def test_detects_new_ggg_version(tmp_path, monkeypatch):
    state = tmp_path / "state.json"
    state.write_text(json.dumps({"ggg_version": "1.0.0", "steam_latest_gid": "G1", "checked_at": ""}))
    monkeypatch.setattr(patch_detector, "STATE_PATH", state)

    with patch.object(patch_detector, "fetch_ggg_version", return_value="1.0.1"), \
         patch.object(patch_detector, "fetch_steam_latest_gid", return_value="G1"):
        result = patch_detector.detect()

    assert result.changed is True
    assert result.ggg_version == "1.0.1"


def test_no_change_returns_false(tmp_path, monkeypatch):
    state = tmp_path / "state.json"
    state.write_text(json.dumps({"ggg_version": "1.0.0", "steam_latest_gid": "G1", "checked_at": ""}))
    monkeypatch.setattr(patch_detector, "STATE_PATH", state)

    with patch.object(patch_detector, "fetch_ggg_version", return_value="1.0.0"), \
         patch.object(patch_detector, "fetch_steam_latest_gid", return_value="G1"):
        result = patch_detector.detect()

    assert result.changed is False


def test_steam_gid_change_triggers(tmp_path, monkeypatch):
    state = tmp_path / "state.json"
    state.write_text(json.dumps({"ggg_version": "1.0.0", "steam_latest_gid": "G1", "checked_at": ""}))
    monkeypatch.setattr(patch_detector, "STATE_PATH", state)

    with patch.object(patch_detector, "fetch_ggg_version", return_value="1.0.0"), \
         patch.object(patch_detector, "fetch_steam_latest_gid", return_value="G2"):
        result = patch_detector.detect()

    assert result.changed is True
