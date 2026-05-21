import os
import httpx
from typing import Tuple
from dotenv import load_dotenv  # type: ignore
from detection.url_analyzer.base import UrlSubCheck

load_dotenv()

class UrlHausLookup(UrlSubCheck):
    name = "url_haus_lookup"
    weight = 0.15

    API_URL = "https://urlhaus-api.abuse.ch/v1/url/"

    def __init__(self) -> None:
        self.api_key = os.getenv("URLHAUS_API_KEY")

    async def _execute(self, url: str) -> Tuple[float, str]:
        payload = {"url": url}
        headers = {"Auth-Key": self.api_key} if self.api_key else {}

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(self.API_URL, data=payload, headers=headers, timeout=5.0)
            response.raise_for_status()
            
            data = response.json()
            query_status = data.get("query_status")
            
            if query_status == "is_listed":
                url_status = data.get("url_status", "unknown")
                threat_type = data.get("threat", "unknown")
                score = 1.0 if url_status == "online" else 0.5
                return score, f"URLhaus: {url_status} — {threat_type}"
            elif query_status == "no_results":
                return 0.0, ""
                
            # Outcome 3: The API structure rejected the payload
            else:
                return 0.0, f"API Warning: {data.get('error', 'Unknown response structural error')}"
                
        except httpx.HTTPError as err:
            # Fail gracefully by passing a zero score and capturing the exception text
            return 0.0, f"Lookup error: {str(err)}"
