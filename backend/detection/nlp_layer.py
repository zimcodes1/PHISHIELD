import os
import json
import logging
from typing import Tuple

from groq import AsyncGroq
from dotenv import load_dotenv  # type: ignore

load_dotenv()

logger = logging.getLogger(__name__)

# Dimension weights per Section 6.1 of phishshield-roadmap-v3.md
_DIM_WEIGHTS = {
    "credential_harvesting": 0.35,
    "impersonation":         0.30,
    "urgency":               0.20,
    "social_engineering":    0.15,
}

_DIM_LABELS = {
    "credential_harvesting": "Requests credentials or account access",
    "impersonation":         "Impersonates a known organization",
    "urgency":               "Uses fear-based urgency tactics",
    "social_engineering":    "Contains social engineering patterns",
}

_SYSTEM_PROMPT = """You are a phishing detection classifier. Analyze the provided text and return ONLY a valid JSON object with no preamble, explanation, or markdown.

Score each dimension from 0 to 10:
- urgency: Fear-based pressure to act immediately. 0=none, 5=mild time pressure, 10=extreme threats/countdowns
- impersonation: Pretending to be a known organization. 0=none, 5=vague brand references, 10=direct brand impersonation
- credential_harvesting: Requesting passwords, PINs, OTPs, or account access. 0=none, 5=indirect account prompts, 10=direct credential request
- social_engineering: Manipulation beyond urgency — guilt, false authority, fake prizes, BEC patterns. 0=none, 5=mild manipulation, 10=strong psychological manipulation

Counter-examples that should score LOW (0-2):
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

# Best model on Groq free tier for classification: strong reasoning, 128k context
_MODEL = "llama-3.3-70b-versatile"


async def analyze_nlp(text: str) -> Tuple[float, list[str]]:
    """
    Layer 2 — NLP Analyzer (Groq / Llama 3.3 70B).
    Scores text across 4 phishing dimensions and returns a weighted score + reasons.
    Never raises — returns fallback on any failure.
    """
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        logger.warning("GROQ_API_KEY not set — NLP layer skipped")
        return _FALLBACK

    try:
        client = AsyncGroq(api_key=api_key)

        response = await client.chat.completions.create(
            model=_MODEL,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user",   "content": text[:2000]},
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
            max_tokens=256,
        )

        raw = response.choices[0].message.content
        if not raw:
            return _FALLBACK

        data = json.loads(raw)

        if not all(k in data for k in _DIM_WEIGHTS):
            logger.warning("Groq response missing expected keys: %s", data)
            return _FALLBACK

        # Weighted average of dimensions, normalized from 0-10 to 0-1
        score = min(
            sum((data[dim] / 10) * weight for dim, weight in _DIM_WEIGHTS.items()),
            1.0,
        )

        reasons: list[str] = []

        top_dim = max(_DIM_WEIGHTS, key=lambda d: data[d])
        if data[top_dim] >= 5:
            reasons.append(_DIM_LABELS[top_dim])

        if data.get("reasoning"):
            reasons.append(data["reasoning"])

        return score, reasons

    except json.JSONDecodeError as e:
        logger.error("NLP layer parse error: %s", e)
        return _FALLBACK
    except Exception as e:
        logger.error("NLP layer error: %s", e)
        return _FALLBACK
