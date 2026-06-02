import asyncio
import json
import os
import sys
from pathlib import Path
from dotenv import load_dotenv #type: ignore
from typing import Tuple
from .base import UrlSubCheck

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

_GSB_SCRIPT = """
import json
import os
import sys
import httpx

endpoint = "https://safebrowsing.googleapis.com/v4/threatMatches:find"
api_key = os.getenv("GOOGLE_SAFE_BROWSING_KEY")
url = sys.argv[1]
payload = {
    "client": {"clientId": "phishshield", "clientVersion": "1.0"},
    "threatInfo": {
        "threatTypes": ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE"],
        "platformTypes": ["ANY_PLATFORM"],
        "threatEntryTypes": ["URL"],
        "threatEntries": [{"url": url}],
    },
}

try:
    response = httpx.post(endpoint, params={"key": api_key}, json=payload, timeout=3.5)
    if response.status_code == 200:
        data = response.json()
        matches = data.get("matches") or []
        if matches:
            threat_type = matches[0].get("threatType", "THREAT").replace("_", " ").title()
            print(json.dumps({"score": 1.0, "reason": f"URL flagged by Google Safe Browsing: {threat_type}"}))
        else:
            print(json.dumps({"score": None, "reason": "No Google Safe Browsing match"}))
    elif response.status_code in (400, 403):
        print(json.dumps({"score": 0.0, "reason": f"Google Safe Browsing lookup rejected: HTTP {response.status_code}"}))
    else:
        print(json.dumps({"score": 0.0, "reason": f"Google Safe Browsing lookup failed: HTTP {response.status_code}"}))
except Exception as exc:
    print(json.dumps({"score": 0.0, "reason": f"Google Safe Browsing lookup failed: {type(exc).__name__}"}))
"""

class GoogleSafeBrowsingCheck(UrlSubCheck):
    name = "google_safe_browsing"
    weight = 0.40
    timeout_seconds = 4.0

    def __init__(self) -> None:
        self.api_key = os.getenv("GOOGLE_SAFE_BROWSING_KEY")

    async def _execute(self, url: str) -> Tuple[float | None, str]:
        if not self.api_key:
            return 0.0, "Google Safe Browsing API key not configured"

        return await self._run_lookup(url)

    async def _run_lookup(self, url: str) -> Tuple[float | None, str]:
        proc = await asyncio.create_subprocess_exec(
            sys.executable,
            "-c",
            _GSB_SCRIPT,
            url,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=self.timeout_seconds)
        except asyncio.TimeoutError:
            proc.kill()
            await proc.communicate()
            raise

        data = json.loads(stdout.decode() or "{}")
        score = data.get("score")
        reason = data.get("reason", "")
        # score is None when the URL was simply not found in the GSB database
        if score is None or reason in ("No Google Safe Browsing match",):
            return self.no_data()
        return float(score), reason
