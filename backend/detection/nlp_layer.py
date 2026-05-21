import os
import json
import logging
from typing import Tuple

from google import genai
from google.genai import types
from dotenv import load_dotenv  # type: ignore

load_dotenv()

logger = logging.getLogger(__name__)

# Dimension weights per Section 6.1
_DIM_WEIGHTS = {
    "credential_harvesting": 0.35,
    "impersonation":         0.30,
    "urgency":               0.20,
    "social_engineering":    0.15,
}

_SYSTEM_PROMPT = """You are a phishing detection classifier. Analyze the provided text and return ONLY a JSON object with no preamble or markdown.

Score each dimension from 0 to 10:
- urgency: Fear-based pressure to act immediately. 0=none, 5=mild time pressure, 10=extreme threats/countdowns
- impersonation: Pretending to be a known organization. 0=none, 5=vague brand references, 10=direct brand impersonation with logos/names
- credential_harvesting: Requesting passwords, PINs, OTPs, or account access. 0=none, 5=indirect account prompts, 10=direct credential request
- social_engineering: Manipulation beyond urgency — guilt, false authority, fake prizes, BEC patterns. 0=none, 5=mild manipulation, 10=strong psychological manipulation

Counter-examples that should score LOW (0–2):
- Shipping notifications with tracking links
- Marketing emails with mild urgency ("sale ends soon")
- Password reset emails from known services
- Standard account activity notifications

Return exactly this JSON structure:
{
  "urgency": <int 0-10>,
  "impersonation": <int 0-10>,
  "credential_harvesting": <int 0-10>,
  "social_engineering": <int 0-10>,
  "reasoning": "<one sentence explaining the top signal>"
}"""

_FALLBACK: Tuple[float, list[str]] = (0.3, ["NLP analysis unavailable"])


async def analyze_nlp(text: str) -> Tuple[float, list[str]]:
    """
    Layer 2 — NLP Analyzer (Gemini 2.0 Flash).
    Scores text across 4 phishing dimensions and returns a weighted score + reasons.
    Never raises — returns fallback on any failure.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        logger.warning("GEMINI_API_KEY not set — NLP layer skipped")
        return _FALLBACK

    try:
        client = genai.Client(api_key=api_key)

        response = await client.aio.models.generate_content(
            model="gemini-2.0-flash",
            contents=text[:2000],
            config=types.GenerateContentConfig(
                system_instruction=_SYSTEM_PROMPT,
                response_mime_type="application/json",
                temperature=0.1,
            ),
        )

        if not response.text:
            return _FALLBACK
        data = json.loads(response.text)

        # Validate all expected keys are present
        if not all(k in data for k in _DIM_WEIGHTS):
            logger.warning("Gemini response missing expected keys: %s", data)
            return _FALLBACK

        # Weighted average of dimensions, normalized from 0–10 to 0–1
        score = sum(
            (data[dim] / 10) * weight
            for dim, weight in _DIM_WEIGHTS.items()
        )
        score = min(score, 1.0)

        reasons: list[str] = []

        # Surface the highest-scoring dimension as a human-readable reason
        top_dim = max(_DIM_WEIGHTS, key=lambda d: data[d])
        if data[top_dim] >= 5:
            dim_labels = {
                "credential_harvesting": "Requests credentials or account access",
                "impersonation":         "Impersonates a known organization",
                "urgency":               "Uses fear-based urgency tactics",
                "social_engineering":    "Contains social engineering patterns",
            }
            reasons.append(dim_labels[top_dim])

        if data.get("reasoning"):
            reasons.append(data["reasoning"])

        return score, reasons

    except (json.JSONDecodeError, KeyError) as e:
        logger.error("NLP layer parse error: %s", e)
        return _FALLBACK
    except Exception as e:
        logger.error("NLP layer error: %s", e)
        return _FALLBACK
