import base64
import json
from unittest.mock import MagicMock, patch

from pipeline import blobs_backup


def test_decode_context_returns_site_and_token():
    raw = base64.b64encode(
        json.dumps({"siteID": "abc", "token": "t0ken", "primaryRegion": "us-east-1"}).encode()
    ).decode()
    ctx = blobs_backup.decode_context(raw)
    assert ctx["siteID"] == "abc"
    assert ctx["token"] == "t0ken"


def test_upload_posts_to_blobs_endpoint():
    raw = base64.b64encode(
        json.dumps({"siteID": "SITE", "token": "TOKEN", "primaryRegion": "us-east-1"}).encode()
    ).decode()
    with patch.object(blobs_backup, "requests") as req:
        resp = MagicMock(status_code=200)
        req.put.return_value = resp
        blobs_backup.upload(raw, key="poe2/raw/1.0.0.json", payload={"hello": "world"})
        called_url = req.put.call_args.args[0]
        headers = req.put.call_args.kwargs["headers"]
    assert "SITE" in called_url
    assert "poe2/raw/1.0.0.json" in called_url
    assert headers["Authorization"] == "Bearer TOKEN"
