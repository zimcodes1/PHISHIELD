import asyncio
import json
import os
import sys
from pathlib import Path
from typing import Tuple
from dotenv import load_dotenv  # type: ignore
from detection.url_analyzer.base import UrlSubCheck

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

_URLHAUS_SCRIPT = """
import json
import os
import sys
import httpx

api_url = "https://urlhaus-api.abuse.ch/v1/url/"
api_key = os.getenv("URLHAUS_API_KEY")
headers = {"Auth-Key": api_key} if api_key else {}

try:
    response = httpx.post(api_url, data={"url": sys.argv[1]}, headers=headers, timeout=4.5)
    response.raise_for_status()
    data = response.json()
    query_status = data.get("query_status")
    if query_status == "is_listed":
        url_status = data.get("url_status", "unknown")
        threat_type = data.get("threat", "unknown")
        score = 1.0 if url_status == "online" else 0.5
        print(json.dumps({"score": score, "reason": f"URLhaus: {url_status} - {threat_type}"}))
    elif query_status == "no_results":
        print(json.dumps({"score": 0.0, "reason": "No URLhaus match"}))
    else:
        print(json.dumps({"score": 0.0, "reason": f"URLhaus warning: {data.get('error', 'unknown response')}"}))
except Exception as exc:
    print(json.dumps({"score": 0.0, "reason": f"URLhaus lookup failed: {type(exc).__name__}"}))
"""

class UrlHausLookup(UrlSubCheck):
    name = "url_haus_lookup"
    weight = 0.15
    timeout_seconds = 5.0

    def __init__(self) -> None:
        self.api_key = os.getenv("URLHAUS_API_KEY")

    async def _execute(self, url: str) -> Tuple[float, str]:
        proc = await asyncio.create_subprocess_exec(
            sys.executable,
            "-c",
            _URLHAUS_SCRIPT,
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
        return float(data.get("score", 0.0)), data.get("reason", "URLhaus lookup failed")
