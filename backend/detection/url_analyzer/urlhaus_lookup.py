import httpx
from typing import Tuple
from detection.url_analyzer.base import UrlSubCheck

class UrlHausLookup(UrlSubCheck):
    name = "url_haus_lookup"
    weight = 0.3
    
    # Define class constants for your credentials and URLhaus base setup
    API_URL = "https://abuse.ch"
    AUTH_KEY = "YOUR_ABUSE_CH_AUTH_KEY"  # Replace with your key

    async def _execute(self, url: str) -> Tuple[float, str]:
        # URLhaus endpoints expect key-value pairs formatted as urlencoded data
        payload = {
            "url": url
        }
        
        # Optional: Include your Auth-Key in the headers to prevent rate limits
        headers = {
            "Auth-Key": self.AUTH_KEY
        }
        
        try:
            # URLhaus lookups require a POST request with body parameters
            async with httpx.AsyncClient() as client:
                response = await client.post(self.API_URL, data=payload, headers=headers)
            response.raise_for_status()
            
            data = response.json()
            query_status = data.get("query_status")
            
            # Outcome 1: The URL is known to URLhaus and actively malicious
            if query_status == "ok":
                url_status = data.get("url_status")
                threat_type = data.get("threat", "unknown_threat")
                
                # Assign maximum weight/score if the threat site is currently active
                score = 1.0 if url_status == "online" else 0.5
                return score, f"Malicious status: {url_status} ({threat_type})"
                
            # Outcome 2: The URL is not present in the malicious dataset
            elif query_status == "no_results":
                return 0.0, "Safe"
                
            # Outcome 3: The API structure rejected the payload
            else:
                return 0.0, f"API Warning: {data.get('error', 'Unknown response structural error')}"
                
        except httpx.HTTPError as err:
            # Fail gracefully by passing a zero score and capturing the exception text
            return 0.0, f"Lookup error: {str(err)}"
