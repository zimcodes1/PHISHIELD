import os
from dotenv import load_dotenv #type: ignore
from typing import Tuple
import httpx #type: ignore
from .base import UrlSubCheck

load_dotenv()

class GoogleSafeBrowsingCheck(UrlSubCheck):
    name = "google_safe_browsing"
    weight = 0.4

    def __init__(self) -> None:
        self.api_key = os.getenv("GOOGLE_SAFE_BROWSING_KEY")
        self.endpoint = "https://safebrowsing.googleapis.com/v4/threatMatches:find"

    async def _execute(self, url: str) -> Tuple[float, str]:
        payload = {
            "client": {"clientId": "phishshield", "clientVersion": "1.0"},
            "threatInfo": {
                "threatTypes": [
                    "MALWARE",
                    "SOCIAL_ENGINEERING",
                    "UNWANTED_SOFTWARE",
                ],
                "platformTypes": ["ANY_PLATFORM"],
                "threatEntryTypes": ["URL"],
                "threatEntries": [{"url": url}],
            },
        }
        response = httpx.post(
            self.endpoint,
            params={"key": self.api_key},
            json=payload,
            timeout=2.5,
        )
        if response.status_code == 200:
            data = response.json()
            if data.get("matches"):
                threat_type = (
                    data["matches"][0]
                    .get("threatType", "THREAT")
                    .replace("_", " ")
                    .title()
                )
                return 1.0, f"URL flagged by Google Safe Browsing: {threat_type}"
        return 0.0, ""