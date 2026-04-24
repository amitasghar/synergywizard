"""Upload raw scraped JSON to Netlify Blobs keyed by patch version."""

from __future__ import annotations

import base64
import json
import os
import sys
from urllib.parse import quote

import requests


STORE_NAME = "synergywizard-raw"


def decode_context(ctx_b64: str) -> dict:
    return json.loads(base64.b64decode(ctx_b64).decode("utf-8"))


def upload(ctx_b64: str, *, key: str, payload: dict) -> None:
    ctx = decode_context(ctx_b64)
    site_id = ctx["siteID"]
    token = ctx["token"]
    url = (
        f"https://api.netlify.com/api/v1/blobs/{site_id}/{STORE_NAME}/"
        f"{quote(key, safe='/')}"
    )
    resp = requests.put(
        url,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        data=json.dumps(payload),
        timeout=30,
    )
    if resp.status_code >= 300:
        raise RuntimeError(f"Blob upload failed: {resp.status_code} {resp.text}")


def main() -> int:
    ctx = os.environ["NETLIFY_BLOBS_CONTEXT"]
    patch_version = os.environ.get("PATCH_VERSION", "unknown")
    data = json.loads(sys.stdin.read())
    upload(ctx, key=f"poe2/raw/{patch_version}.json", payload=data)
    print(f"Uploaded poe2/raw/{patch_version}.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
