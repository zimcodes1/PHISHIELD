# PhishShield — MVP Implementation Plan

> AI-Powered Phishing Detection System for Email and Web Applications  
> Masters Final Project | Target Delivery: End of Month  
> Stack: Python · FastAPI · PostgreSQL · React · TypeScript · Tailwind · Browser Extension (MV3)

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Project Structure](#2-project-structure)
3. [Backend — FastAPI](#3-backend--fastapi)
4. [Detection Pipeline — The AI Engine](#4-detection-pipeline--the-ai-engine)
5. [Database — PostgreSQL on Neon](#5-database--postgresql-on-neon)
6. [Frontend — React Dashboard](#6-frontend--react-dashboard)
7. [Browser Extension — Manifest V3](#7-browser-extension--manifest-v3)
8. [Environment Configuration](#8-environment-configuration)
9. [Evaluation Strategy](#9-evaluation-strategy)
10. [Deployment](#10-deployment)

---

## 1. System Overview

PhishShield is a two-interface system backed by a single AI detection engine. A user submits a suspicious email or URL through either a web dashboard or a browser extension. Both call the same FastAPI backend, which runs the input through a multi-layer detection pipeline and returns a risk score (0–100) plus human-readable reasons for the verdict.

```
[Web Dashboard]         [Browser Extension]
     |                         |
     |   POST /analyze/email   |   POST /analyze/url
     +----------+  +-----------+
                |  |
          [FastAPI Backend]
                |
     +----------+----------+
     |          |          |
  [Layer 1]  [Layer 2]  [Layer 3]
  URL Rules   NLP/AI    Headers
     |          |          |
     +----------+----------+
                |
        [Ensemble Scorer]
                |
        Risk Score 0-100
        + Top 3 Reasons
                |
        [PostgreSQL / Neon]
          (log every scan)
```

### What "AI" means in this system

The AI component is **GPT-4o-mini via the OpenAI API**, used as an NLP classifier. You send the email body or web page text alongside a carefully engineered system prompt that instructs the model to score the content across four dimensions — urgency, impersonation, credential harvesting, and social engineering — and return structured JSON. This is a legitimate, academically defensible use of AI for classification. You are applying a pre-trained large language model to a domain-specific task through prompt engineering, which is itself a valid research contribution (prompt design choices, threshold tuning, ensemble weighting are all things you will measure and justify).

The other layers (URL reputation, header analysis) are rule-based and deterministic. The ensemble combines all three layers into a final score.

---

## 2. Project Structure

```
phishshield/
│
├── backend/
│   ├── main.py                    # FastAPI app entry point, route registration
│   ├── requirements.txt
│   ├── .env                       # API keys, DB URL — never commit this
│   │
│   ├── api/
│   │   ├── routes/
│   │   │   ├── analyze.py         # POST /analyze/url and POST /analyze/email
│   │   │   └── history.py         # GET /history
│   │   └── schemas.py             # Pydantic request/response models
│   │
│   ├── detection/
│   │   ├── pipeline.py            # Orchestrates all layers, returns final verdict
│   │   ├── url_analyzer.py        # Layer 1: URL reputation and rule checks
│   │   ├── nlp_analyzer.py        # Layer 2: GPT-4o-mini NLP classification
│   │   ├── header_analyzer.py     # Layer 3: SPF/DKIM/DMARC + metadata rules
│   │   └── ensemble.py            # Weighted score combiner + reason aggregator
│   │
│   └── db/
│       ├── database.py            # SQLAlchemy engine + session factory
│       └── models.py              # ORM models: Scan, Feedback
│
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── src/
│       ├── main.tsx
│       ├── App.tsx                # Router setup
│       ├── api/
│       │   └── client.ts          # Axios instance, base URL, interceptors
│       ├── pages/
│       │   ├── Analyzer.tsx       # Main scan page
│       │   └── History.tsx        # Past scans table
│       └── components/
│           ├── ScoreGauge.tsx
│           ├── ReasonCards.tsx
│           └── ScanForm.tsx
│
└── extension/
    ├── manifest.json              # MV3 manifest
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── background/
        │   └── service-worker.ts  # Intercepts navigation, calls API
        ├── content/
        │   └── warning-banner.ts  # Injects DOM warning on risky pages
        └── popup/
            ├── Popup.tsx          # Extension popup UI (React)
            └── popup.html
```

---

## 3. Backend — FastAPI

### Why FastAPI

FastAPI is the right choice for three reasons: it is Python-native (same language as all ML/AI libraries you will use), it auto-generates OpenAPI docs at `/docs` which you can screenshot for your report as evidence of a well-designed API, and its async support means it handles concurrent requests from both the dashboard and the extension without blocking.

### Dependencies

```
# backend/requirements.txt
fastapi==0.111.0
uvicorn[standard]==0.29.0
pydantic==2.7.1
pydantic-settings==2.2.1
sqlalchemy==2.0.30
psycopg2-binary==2.9.9
python-dotenv==1.0.1
httpx==0.27.0
openai==1.30.1
python-whois==0.9.4
python-multipart==0.0.9
python-Levenshtein==0.25.1
```

### Entry Point — `main.py`

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes.analyze import router as analyze_router
from api.routes.history import router as history_router
from db.database import engine
from db import models

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="PhishShield API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "chrome-extension://*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyze_router, prefix="/analyze", tags=["Analysis"])
app.include_router(history_router, prefix="/history", tags=["History"])

@app.get("/health")
def health():
    return {"status": "ok"}
```

CORS must explicitly allow `chrome-extension://*`. Without this, the browser extension cannot call the API — it will silently fail with a network error.

### Pydantic Schemas — `api/schemas.py`

Pydantic models define exactly what the API accepts and returns. FastAPI validates every incoming request against these automatically and returns a 422 with details if anything is missing or malformed.

```python
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from enum import Enum


class Verdict(str, Enum):
    CLEAN = "clean"
    SUSPICIOUS = "suspicious"
    PHISHING = "phishing"


class URLRequest(BaseModel):
    url: str  # plain str not HttpUrl — phishing URLs often fail URL validation


class EmailRequest(BaseModel):
    subject: Optional[str] = ""
    body: str
    sender: Optional[str] = ""
    headers_raw: Optional[str] = ""  # raw headers for SPF/DKIM/DMARC parsing


class LayerResult(BaseModel):
    name: str          # "url_analysis" | "nlp_analysis" | "header_analysis"
    score: float       # 0.0 to 1.0
    reasons: list[str]
    weight: float      # contribution weight in the ensemble


class AnalysisResponse(BaseModel):
    risk_score: int            # 0-100 final ensemble score
    verdict: Verdict
    top_reasons: list[str]     # top 3 reasons across all layers
    layers: list[LayerResult]  # per-layer breakdown for the detail panel
    scan_id: str
    timestamp: datetime
```

### Routes — `api/routes/analyze.py`

```python
from fastapi import APIRouter, Depends, UploadFile, File
from sqlalchemy.orm import Session
from api.schemas import URLRequest, EmailRequest, AnalysisResponse
from detection.pipeline import run_url_pipeline, run_email_pipeline
from db.database import get_db
from db.models import Scan
import uuid, json
from datetime import datetime

router = APIRouter()


@router.post("/url", response_model=AnalysisResponse)
async def analyze_url(request: URLRequest, db: Session = Depends(get_db)):
    result = await run_url_pipeline(request.url)
    scan = Scan(
        id=str(uuid.uuid4()),
        scan_type="url",
        input_value=request.url,
        risk_score=result.risk_score,
        verdict=result.verdict,
        reasons=json.dumps(result.top_reasons),
        layers=json.dumps([l.model_dump() for l in result.layers]),
        timestamp=datetime.utcnow(),
    )
    db.add(scan)
    db.commit()
    result.scan_id = scan.id
    return result


@router.post("/email", response_model=AnalysisResponse)
async def analyze_email(request: EmailRequest, db: Session = Depends(get_db)):
    result = await run_email_pipeline(request)
    scan = Scan(
        id=str(uuid.uuid4()),
        scan_type="email",
        input_value=request.subject or "(no subject)",
        risk_score=result.risk_score,
        verdict=result.verdict,
        reasons=json.dumps(result.top_reasons),
        layers=json.dumps([l.model_dump() for l in result.layers]),
        timestamp=datetime.utcnow(),
    )
    db.add(scan)
    db.commit()
    result.scan_id = scan.id
    return result


@router.post("/email/upload", response_model=AnalysisResponse)
async def analyze_email_file(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Accept a raw .eml file, parse it, then run the normal email pipeline."""
    import email as email_lib
    raw = await file.read()
    msg = email_lib.message_from_bytes(raw)

    body = ""
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() == "text/plain":
                body += part.get_payload(decode=True).decode("utf-8", errors="ignore")
    else:
        body = msg.get_payload(decode=True).decode("utf-8", errors="ignore")

    request = EmailRequest(
        subject=msg.get("Subject", ""),
        body=body,
        sender=msg.get("From", ""),
        headers_raw=str(msg),
    )
    return await analyze_email(request, db)
```

### History Route — `api/routes/history.py`

```python
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from db.database import get_db
from db.models import Scan
import json

router = APIRouter()


@router.get("/")
def get_history(
    limit: int = Query(default=20, le=100),
    offset: int = Query(default=0),
    db: Session = Depends(get_db),
):
    scans = (
        db.query(Scan)
        .order_by(Scan.timestamp.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    total = db.query(Scan).count()
    return {
        "total": total,
        "items": [
            {
                "id": s.id,
                "scan_type": s.scan_type,
                "input_value": s.input_value,
                "risk_score": s.risk_score,
                "verdict": s.verdict,
                "reasons": json.loads(s.reasons),
                "timestamp": s.timestamp,
            }
            for s in scans
        ],
    }
```

---

## 4. Detection Pipeline — The AI Engine

This is the core research contribution. Three independent layers analyze input concurrently; the ensemble scorer combines their results into a final verdict. Each layer is independently testable and swappable.

### 4.1 Layer 1 — URL Analyzer (`detection/url_analyzer.py`)

Handles all URL-based signals. Runs for both `analyze/url` and `analyze/email` (after extracting all hyperlinks from the email body). There are four sub-checks inside this layer.

**Google Safe Browsing API v4**

Google maintains a continuously updated database of confirmed phishing, malware, and social engineering URLs. The Lookup API accepts any URL and returns threat matches if found. This is the fastest and most reliable signal available — if a URL is already in Google's database, there is no need for further analysis. The API is free for up to 10,000 requests per day. Obtain a key from Google Cloud Console, enable the Safe Browsing API, and POST to `https://safebrowsing.googleapis.com/v4/threatMatches:find`. The payload specifies the URL and the threat types to check: `MALWARE`, `SOCIAL_ENGINEERING`, and `UNWANTED_SOFTWARE`. If the response body contains a `matches` array, the URL is known-bad and this sub-check scores 1.0.

**WHOIS Domain Age**

Phishing campaigns register domains hours or days before launching attacks, then abandon them before they get blacklisted. Domain age is therefore a reliable signal. Use the `python-whois` library to resolve the registration date of the URL's domain. Compute age in days from today. Age under 7 days scores 1.0. Age 7–30 days scores 0.7. Age 30–90 days scores 0.3. Age over 90 days scores 0.0. Handle exceptions gracefully — WHOIS lookups fail for some domains, in which case score 0.2 and note the inability to verify.

**URLhaus Lookup**

abuse.ch maintains URLhaus, a community-driven database of URLs used for malware distribution. Their API requires no authentication. POST to `https://urlhaus-api.abuse.ch/v1/url/` with `{"url": "<url>"}` and check the `query_status` field. If `is_listed`, score 1.0.

**Heuristic Rule Engine**

These deterministic checks catch structural patterns that reputation databases may not yet have indexed:

- *Typosquatting*: Compute Levenshtein edit distance between the URL's registered domain and each entry in a hardcoded list of top brand domains. If distance is 1 or 2 and the domain is not in the brand list itself, score 0.85. Keep the brand list relevant to your target region — include Nigerian banks and fintechs alongside global brands.
- *IP as domain*: URLs using raw IP addresses (e.g. `http://192.168.1.1/paypal/login`) avoid the paper trail of domain registration. Detect with a regex match on the netloc. Score 0.9.
- *Suspicious path patterns*: Paths containing `/login`, `/verify`, `/account`, `/suspended`, `/update-password`, or `/confirm`, combined with an unknown domain, score 0.5. These paths are common in credential harvesting pages.
- *Free TLD abuse*: `.tk`, `.ml`, `.ga`, `.cf`, `.gq` are free TLDs with historically high abuse rates. Score 0.4.
- *URL length*: Legitimate URLs rarely exceed 100 characters. Over 200 characters typically indicates obfuscation or encoded redirect chains. Score scales from 0 at 100 chars to 0.6 at 300+ chars.
- *Excessive subdomains*: The pattern `paypal.secure.login.verify.attacker.com` disguises the real registered domain. More than 3 subdomain levels scores 0.5.

**Layer 1 combined score**: Weighted average — Safe Browsing 40%, URLhaus 30%, WHOIS age 15%, heuristics 15%. If Safe Browsing or URLhaus return a confirmed hit (score 1.0), the layer score is capped at 1.0 regardless of other sub-checks.

```python
# detection/url_analyzer.py
import httpx, whois, re, os
from datetime import datetime
from urllib.parse import urlparse
from Levenshtein import distance as levenshtein_distance

BRAND_DOMAINS = [
    "paypal.com", "google.com", "apple.com", "amazon.com", "microsoft.com",
    "facebook.com", "instagram.com", "twitter.com", "netflix.com", "gmail.com",
    "gtbank.com", "accessbankplc.com", "zenithbank.com", "kudabank.com",
    "opay.com", "flutterwave.com",
]
SUSPICIOUS_TLDS = {".tk", ".ml", ".ga", ".cf", ".gq", ".xyz", ".top", ".click"}
SUSPICIOUS_PATHS = ["/login", "/verify", "/account", "/suspended", "/update", "/confirm"]


async def analyze_url(url: str) -> dict:
    reasons = []
    scores = {}

    domain = _extract_domain(url)

    sb_score, sb_reason = await _check_safe_browsing(url)
    scores["safe_browsing"] = (sb_score, 0.40)
    if sb_reason:
        reasons.append(sb_reason)

    uh_score, uh_reason = await _check_urlhaus(url)
    scores["urlhaus"] = (uh_score, 0.30)
    if uh_reason:
        reasons.append(uh_reason)

    age_score, age_reason = _check_domain_age(domain)
    scores["domain_age"] = (age_score, 0.15)
    if age_reason:
        reasons.append(age_reason)

    heuristic_score, heuristic_reasons = _check_heuristics(url, domain)
    scores["heuristics"] = (heuristic_score, 0.15)
    reasons.extend(heuristic_reasons)

    final = sum(s * w for s, w in scores.values())
    return {"score": min(final, 1.0), "reasons": reasons[:3]}


def _extract_domain(url: str) -> str:
    try:
        parsed = urlparse(url if "://" in url else "http://" + url)
        return parsed.netloc.lower()
    except Exception:
        return url


async def _check_safe_browsing(url: str) -> tuple:
    api_key = os.getenv("GOOGLE_SAFE_BROWSING_KEY")
    payload = {
        "client": {"clientId": "phishshield", "clientVersion": "1.0"},
        "threatInfo": {
            "threatTypes": ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE"],
            "platformTypes": ["ANY_PLATFORM"],
            "threatEntryTypes": ["URL"],
            "threatEntries": [{"url": url}],
        },
    }
    async with httpx.AsyncClient(timeout=5.0) as client:
        try:
            r = await client.post(
                f"https://safebrowsing.googleapis.com/v4/threatMatches:find?key={api_key}",
                json=payload,
            )
            data = r.json()
            if data.get("matches"):
                threat = data["matches"][0]["threatType"].replace("_", " ").title()
                return 1.0, f"Flagged by Google Safe Browsing: {threat}"
            return 0.0, ""
        except Exception:
            return 0.0, ""  # fail open — never block mail because an API timed out


async def _check_urlhaus(url: str) -> tuple:
    async with httpx.AsyncClient(timeout=5.0) as client:
        try:
            r = await client.post(
                "https://urlhaus-api.abuse.ch/v1/url/",
                data={"url": url}
            )
            data = r.json()
            if data.get("query_status") == "is_listed":
                return 1.0, "URL found in URLhaus malware database (abuse.ch)"
            return 0.0, ""
        except Exception:
            return 0.0, ""


def _check_domain_age(domain: str) -> tuple:
    try:
        info = whois.whois(domain)
        creation = info.creation_date
        if isinstance(creation, list):
            creation = creation[0]
        if not creation:
            return 0.3, "Domain registration date unavailable"
        age_days = (datetime.utcnow() - creation).days
        if age_days < 7:
            return 1.0, f"Domain registered only {age_days} days ago"
        if age_days < 30:
            return 0.7, f"Domain registered {age_days} days ago (very recent)"
        if age_days < 90:
            return 0.3, f"Domain registered {age_days} days ago"
        return 0.0, ""
    except Exception:
        return 0.2, "Could not verify domain registration date"


def _check_heuristics(url: str, domain: str) -> tuple:
    scores = []
    reasons = []

    if re.match(r"^\d{1,3}(\.\d{1,3}){3}(:\d+)?$", domain):
        scores.append(0.9)
        reasons.append("URL uses raw IP address instead of a domain name")

    parts = domain.split(".")
    registered = ".".join(parts[-2:]) if len(parts) >= 2 else domain
    for brand in BRAND_DOMAINS:
        if registered != brand and levenshtein_distance(registered, brand) <= 2:
            scores.append(0.85)
            reasons.append(f"Domain '{registered}' closely resembles '{brand}' (possible typosquatting)")
            break

    tld = "." + parts[-1] if parts else ""
    if tld in SUSPICIOUS_TLDS:
        scores.append(0.4)
        reasons.append(f"Suspicious free TLD: {tld}")

    for frag in SUSPICIOUS_PATHS:
        if frag in url.lower():
            scores.append(0.35)
            reasons.append(f"URL path contains credential-harvesting segment: {frag}")
            break

    subdomains = parts[:-2]
    if len(subdomains) > 3:
        scores.append(0.5)
        reasons.append(f"Excessive subdomain depth ({len(subdomains)} levels) — real domain may be hidden")

    if len(url) > 200:
        scores.append(min(0.6, (len(url) - 100) / 333))
        reasons.append(f"Unusually long URL ({len(url)} characters)")

    return (max(scores) if scores else 0.0, reasons)
```

### 4.2 Layer 2 — NLP Analyzer (`detection/nlp_analyzer.py`)

The AI layer. Sends text content to GPT-4o-mini and asks it to score the content across four phishing-specific semantic dimensions. For email analysis the input is the full subject + body. For URL-only analysis the input is the URL string itself, which still carries semantic signals (path words like `/verify-account`, brand names in subdomains).

**Prompt Engineering**

The system prompt is the most important implementation decision in this layer. It must do four things: define the output format precisely (JSON only, no preamble), define the scoring rubric clearly (what does a 0, 5, and 10 mean on each dimension), give counter-examples to prevent false positives (legitimate urgent shipping emails should score low), and specify the exact JSON keys and types to return.

Setting `temperature: 0.1` is critical. Higher temperatures cause the model to vary its scores for the same input across calls, which undermines repeatability. `response_format: {"type": "json_object"}` tells the API to guarantee valid JSON output — without this, the model will occasionally prepend explanation text that breaks JSON parsing.

**Dimension weights**: Credential harvesting (0.35) and impersonation (0.30) are the strongest phishing signals. Urgency (0.20) and social engineering (0.15) are supporting signals. These weights should be documented and justified in the report — you can run an ablation by changing them and measuring accuracy impact.

```python
# detection/nlp_analyzer.py
import json, os
from openai import AsyncOpenAI

client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

SYSTEM_PROMPT = """You are a cybersecurity expert specializing in phishing detection.
Analyze the provided text and score it across exactly four dimensions.
Return ONLY valid JSON. No preamble, no explanation, no markdown fences.

Scoring rubric for each dimension (integer 0-10):

urgency: How much does the text pressure immediate action using fear or urgency?
  0 = no urgency present
  5 = mild urgency (e.g. "sale ending soon", "respond when you can")
  10 = extreme fear-based pressure ("account suspended", "legal action", "24 hours")

impersonation: How strongly does the text pretend to be a known legitimate organization?
  0 = clearly personal or generic with no brand mention
  5 = mentions a brand name incidentally
  10 = directly impersonates a brand using its name, logo references, formal tone, and official-sounding language

credential_harvesting: How directly does the text request passwords, PINs, OTPs, or account logins?
  0 = no credential or sensitive data request
  5 = indirect hint to "log in to your account"
  10 = explicit request for password, OTP, card number, or security question

social_engineering: Does the text use manipulation beyond urgency — guilt, authority, reciprocity, fake prizes?
  0 = none
  5 = mild authority claim or flattery
  10 = elaborate manipulation story, fake lottery, CEO impersonation for wire transfer

Important rules for accuracy:
- Transactional emails (shipping confirmation, receipts, order updates) score LOW even if they mention an account.
- Marketing emails with urgency ("sale ends tonight") score 2-4 on urgency, never 8-10.
- A real bank asking you to log in through their official app scores LOW — not all login requests are phishing.
- Only score high when the combination of signals matches a clear phishing pattern.

Return exactly this JSON structure, no other text:
{
  "urgency": <integer 0-10>,
  "impersonation": <integer 0-10>,
  "credential_harvesting": <integer 0-10>,
  "social_engineering": <integer 0-10>,
  "dominant_signal": "<one sentence: the single strongest phishing indicator, or 'No significant phishing signals detected'>",
  "confidence": <float 0.0-1.0>
}"""


async def analyze_text(text: str) -> dict:
    truncated = text[:2000]  # 2000 chars ~ 500 tokens, captures all phishing signals

    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"Analyze this text:\n\n{truncated}"},
            ],
            temperature=0.1,
            max_tokens=300,
            response_format={"type": "json_object"},
        )
        data = json.loads(response.choices[0].message.content)

        dims = {
            "urgency": data.get("urgency", 0) / 10,
            "impersonation": data.get("impersonation", 0) / 10,
            "credential_harvesting": data.get("credential_harvesting", 0) / 10,
            "social_engineering": data.get("social_engineering", 0) / 10,
        }
        weights = {
            "urgency": 0.20,
            "impersonation": 0.30,
            "credential_harvesting": 0.35,
            "social_engineering": 0.15,
        }
        score = sum(dims[k] * weights[k] for k in dims)

        reasons = []
        dominant = data.get("dominant_signal", "")
        if dominant and "no significant" not in dominant.lower():
            reasons.append(dominant)
        if dims["credential_harvesting"] > 0.6:
            reasons.append("Text explicitly requests login credentials or sensitive account data")
        if dims["impersonation"] > 0.7:
            reasons.append("Text impersonates a known brand or organization")
        if dims["urgency"] > 0.7:
            reasons.append("Text uses high-pressure urgency and fear tactics")

        return {"score": score, "reasons": reasons, "confidence": data.get("confidence", 0.8)}

    except Exception:
        # Never crash the pipeline on an NLP failure — fail open with neutral score
        return {"score": 0.3, "reasons": ["NLP analysis unavailable"], "confidence": 0.0}
```

**Cost note**: At gpt-4o-mini pricing (~$0.15 per million input tokens, ~$0.60 per million output tokens), analyzing 500 input tokens costs roughly $0.000075. Running 200 evaluation scans costs under $0.02 total. This is negligible and worth noting in the report to demonstrate awareness of operational cost.

### 4.3 Layer 3 — Header Analyzer (`detection/header_analyzer.py`)

Email-only layer. Parses raw headers for authentication failures and sender identity mismatches. No external API calls — entirely deterministic string parsing.

**SPF (Sender Policy Framework)**: A DNS TXT record that declares which mail servers are authorized to send on behalf of a domain. If a message claims to be from `paypal.com` but was sent from a server not listed in PayPal's SPF record, it fails SPF. The result is recorded in the `Authentication-Results` header by the receiving mail server. Parse this header for `spf=fail` (score 0.7) or `spf=softfail` (score 0.4). A pass scores 0.

**DKIM (DomainKeys Identified Mail)**: A cryptographic signature added by the sending server, verifiable by the receiving server using a public key in the sender's DNS. A DKIM failure means the signature is absent or invalid — the email may have been modified in transit or the sender is unauthorized. `dkim=fail` scores 0.7.

**DMARC (Domain-based Message Authentication Reporting and Conformance)**: Builds on SPF and DKIM, requiring at least one to pass in alignment with the `From:` domain. A DMARC fail is a stronger signal than either SPF or DKIM alone. `dmarc=fail` scores 0.8.

**Display name spoofing**: A common and effective trick is setting a friendly display name like `PayPal Security <attacker12345@gmail.com>`. The user sees "PayPal Security" in their mail client without noticing the actual sending address. Parse the `From:` header value and check whether the display name contains a known brand name while the email domain does not match that brand. Score 0.85 — this is one of the most reliable BEC and phishing indicators.

```python
# detection/header_analyzer.py
import re

BRAND_NAMES = [
    "paypal", "google", "apple", "amazon", "microsoft", "facebook",
    "gtbank", "access bank", "zenith bank", "kuda", "opay", "flutterwave",
    "netflix", "instagram", "twitter", "dhl", "fedex", "ups",
]


def analyze_headers(headers_raw: str, sender: str = "") -> dict:
    if not headers_raw.strip():
        return {"score": 0.0, "reasons": ["No headers provided"]}

    reasons = []
    scores = []
    headers_lower = headers_raw.lower()

    # SPF
    spf = re.search(r"spf=(pass|fail|softfail|neutral|none)", headers_lower)
    if spf:
        if spf.group(1) == "fail":
            scores.append(0.7)
            reasons.append("SPF authentication failed — email not sent from an authorized server")
        elif spf.group(1) == "softfail":
            scores.append(0.4)
            reasons.append("SPF soft fail — sending server may not be authorized")

    # DKIM
    dkim = re.search(r"dkim=(pass|fail|none)", headers_lower)
    if dkim and dkim.group(1) == "fail":
        scores.append(0.7)
        reasons.append("DKIM signature verification failed — email integrity cannot be confirmed")

    # DMARC
    dmarc = re.search(r"dmarc=(pass|fail|none)", headers_lower)
    if dmarc and dmarc.group(1) == "fail":
        scores.append(0.8)
        reasons.append("DMARC policy check failed — email fails domain authentication")

    # Display name vs envelope mismatch
    if sender:
        match = re.match(r'"?([^"<]+)"?\s*<([^>]+)>', sender.strip())
        if match:
            display_name = match.group(1).strip().lower()
            envelope_email = match.group(2).strip().lower()
            envelope_domain = envelope_email.split("@")[-1] if "@" in envelope_email else ""
            for brand in BRAND_NAMES:
                brand_domain = brand.replace(" ", "") + ".com"
                if brand in display_name and envelope_domain and brand_domain not in envelope_domain:
                    scores.append(0.85)
                    reasons.append(
                        f"Display name claims '{brand}' but email originates from '{envelope_domain}'"
                    )
                    break

    score = max(scores) if scores else 0.0
    return {"score": score, "reasons": reasons}
```

### 4.4 Ensemble Scorer (`detection/ensemble.py`)

Combines the three layer scores into a single verdict. The weighting rationale to document in your report: NLP carries the highest weight (0.40) because it captures semantic intent that no rule-based system can — the meaning of words matters, and GPT-4o-mini understands it. URL reputation is second (0.35) because it leverages ground-truth databases of confirmed threats. Header analysis is weighted lowest (0.25) because it only applies to email, and many email clients strip or alter headers before the user sees them.

```python
# detection/ensemble.py

LAYER_WEIGHTS = {
    "url_analysis":    0.35,
    "nlp_analysis":    0.40,
    "header_analysis": 0.25,
}

VERDICT_THRESHOLDS = {
    "phishing":   0.70,
    "suspicious": 0.40,
}


def compute_ensemble(layer_results: dict) -> dict:
    weighted_score = 0.0
    total_weight = 0.0
    all_reasons = []

    for layer_name, result in layer_results.items():
        weight = LAYER_WEIGHTS.get(layer_name, 0.0)
        layer_score = result.get("score", 0.0)

        # Skip layers that returned no signal (score == 0.0 and no reasons)
        # to avoid diluting the score when a layer is inapplicable (e.g. headers for URL scan)
        if layer_score == 0.0 and not result.get("reasons"):
            continue

        weighted_score += layer_score * weight
        total_weight += weight

        for reason in result.get("reasons", []):
            all_reasons.append((reason, layer_score))

    if total_weight > 0:
        weighted_score /= total_weight

    risk_score = int(weighted_score * 100)

    if weighted_score >= VERDICT_THRESHOLDS["phishing"]:
        verdict = "phishing"
    elif weighted_score >= VERDICT_THRESHOLDS["suspicious"]:
        verdict = "suspicious"
    else:
        verdict = "clean"

    all_reasons.sort(key=lambda x: x[1], reverse=True)
    top_reasons = [r for r, _ in all_reasons[:3]]

    return {
        "risk_score": risk_score,
        "verdict": verdict,
        "top_reasons": top_reasons if top_reasons else ["No significant threats detected"],
    }
```

### 4.5 Pipeline Orchestrator (`detection/pipeline.py`)

URL analysis and NLP run concurrently via `asyncio.gather` — this cuts total response time roughly in half compared to running them sequentially. For a URL-only scan, the total latency is dominated by whichever is slower: the WHOIS lookup or the OpenAI API call, typically 1–3 seconds. For email analysis, all three layers run concurrently.

```python
# detection/pipeline.py
import asyncio, re
from datetime import datetime
from detection.url_analyzer import analyze_url
from detection.nlp_analyzer import analyze_text
from detection.header_analyzer import analyze_headers
from detection.ensemble import compute_ensemble
from api.schemas import AnalysisResponse, LayerResult


def _extract_urls(text: str) -> list:
    return re.findall(r'https?://[^\s<>"\']+', text)


async def run_url_pipeline(url: str) -> AnalysisResponse:
    url_result, nlp_result = await asyncio.gather(
        analyze_url(url),
        analyze_text(url),
    )

    layer_results = {
        "url_analysis":    url_result,
        "nlp_analysis":    nlp_result,
        "header_analysis": {"score": 0.0, "reasons": []},
    }
    ensemble = compute_ensemble(layer_results)

    return AnalysisResponse(
        risk_score=ensemble["risk_score"],
        verdict=ensemble["verdict"],
        top_reasons=ensemble["top_reasons"],
        layers=[
            LayerResult(name="url_analysis",    score=url_result["score"],  reasons=url_result["reasons"],  weight=0.35),
            LayerResult(name="nlp_analysis",    score=nlp_result["score"],  reasons=nlp_result["reasons"],  weight=0.40),
            LayerResult(name="header_analysis", score=0.0,                  reasons=[],                     weight=0.25),
        ],
        scan_id="",
        timestamp=datetime.utcnow(),
    )


async def run_email_pipeline(request) -> AnalysisResponse:
    urls = _extract_urls(request.body)
    email_text = f"Subject: {request.subject}\n\n{request.body}"

    nlp_task    = analyze_text(email_text)
    header_task = analyze_headers(request.headers_raw or "", request.sender or "")
    url_task    = analyze_url(urls[0]) if urls else asyncio.coroutine(lambda: {"score": 0.0, "reasons": []})()

    nlp_result, header_result, url_result = await asyncio.gather(nlp_task, header_task, url_task)

    layer_results = {
        "url_analysis":    url_result,
        "nlp_analysis":    nlp_result,
        "header_analysis": header_result,
    }
    ensemble = compute_ensemble(layer_results)

    return AnalysisResponse(
        risk_score=ensemble["risk_score"],
        verdict=ensemble["verdict"],
        top_reasons=ensemble["top_reasons"],
        layers=[
            LayerResult(name="url_analysis",    score=url_result["score"],    reasons=url_result["reasons"],    weight=0.35),
            LayerResult(name="nlp_analysis",    score=nlp_result["score"],    reasons=nlp_result["reasons"],    weight=0.40),
            LayerResult(name="header_analysis", score=header_result["score"], reasons=header_result["reasons"], weight=0.25),
        ],
        scan_id="",
        timestamp=datetime.utcnow(),
    )
```

---

## 5. Database — PostgreSQL on Neon

### Why Neon

Serverless PostgreSQL, free tier (0.5 GB), always-on. The connection string is identical to standard PostgreSQL so the code is fully portable. You have prior experience with Neon from previous projects.

### `db/database.py`

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os

DATABASE_URL = os.getenv("DATABASE_URL")
# Neon requires ?sslmode=require at the end of the connection string

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

### `db/models.py`

```python
from sqlalchemy import Column, String, Integer, DateTime, Text
from db.database import Base


class Scan(Base):
    __tablename__ = "scans"
    id          = Column(String,   primary_key=True)
    scan_type   = Column(String,   nullable=False)   # "url" or "email"
    input_value = Column(Text,     nullable=False)   # the URL or email subject
    risk_score  = Column(Integer,  nullable=False)   # 0-100
    verdict     = Column(String,   nullable=False)   # clean/suspicious/phishing
    reasons     = Column(Text)                       # JSON array
    layers      = Column(Text)                       # JSON array of LayerResult dicts
    timestamp   = Column(DateTime, nullable=False)


class Feedback(Base):
    """User-reported false positives and false negatives for evaluation."""
    __tablename__ = "feedback"
    id           = Column(String,   primary_key=True)
    scan_id      = Column(String,   nullable=False)
    user_verdict = Column(String)   # "false_positive" or "false_negative"
    timestamp    = Column(DateTime, nullable=False)
```

Tables are created automatically by `models.Base.metadata.create_all()` on first startup. No migration tooling needed for the MVP.

---

## 6. Frontend — React Dashboard

### Stack

```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npm install axios @tanstack/react-query react-router-dom
```

### `api/client.ts`

```typescript
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
  timeout: 15000,  // NLP calls can take up to 8-10s
});

export const analyzeURL = (url: string) =>
  api.post("/analyze/url", { url }).then(r => r.data);

export const analyzeEmail = (data: {
  subject?: string;
  body: string;
  sender?: string;
  headers_raw?: string;
}) => api.post("/analyze/email", data).then(r => r.data);

export const getHistory = (limit = 20, offset = 0) =>
  api.get("/history/", { params: { limit, offset } }).then(r => r.data);
```

### Pages and Key Sections

**`/` — Analyzer (`pages/Analyzer.tsx`)**

The main landing page. Structure:
- Tab switcher at top: "Check URL" / "Analyze Email"
- URL tab: single text input + Analyze button. On submit, calls `analyzeURL`, shows loading spinner (indicate the wait is normal — NLP takes a few seconds), then renders results below.
- Email tab: Subject field, Sender field, large Body textarea, collapsible "Paste raw headers" textarea. On submit, calls `analyzeEmail`.
- Results section (conditionally rendered after submit): risk score gauge component, verdict badge (color-coded), top 3 reason cards, per-layer accordion showing each layer's score and its specific reasons. Include a "Report false positive" button that POSTs to a `/feedback` endpoint and logs the correction.

**`/history` — History (`pages/History.tsx`)**

Paginated table of all past scans from `GET /history`. Columns: type icon (envelope/globe), input value (truncated), risk score (colored number), verdict badge, relative timestamp. Stats bar above the table: total scans, phishing blocked, false positive reports. Clicking a row expands an inline detail panel with the full layer breakdown.

### Key Components

**`ScoreGauge.tsx`** — An SVG arc gauge showing the risk score 0–100. Color transitions: green below 40, yellow 40–70, red above 70. Animate the needle on load with a CSS transition.

**`ReasonCards.tsx`** — Maps the `top_reasons` array to small cards. Each card shows the reason text and which layer it came from (tag chip: "URL", "AI", "Headers").

**`ScanForm.tsx`** — Shared form logic for URL and email input. Handles controlled input state, validation (don't submit empty strings), loading state management.

---

## 7. Browser Extension — Manifest V3

### Why MV3

Chrome requires all new extensions to use Manifest V3. MV3 replaces persistent background pages with ephemeral service workers. Key implication: the service worker can be terminated between events, so you cannot store state in JavaScript variables. Use `chrome.storage.local` for anything that needs to persist between events.

### Build Setup

```bash
npm create vite@latest extension -- --template react-ts
cd extension
npm install -D @crxjs/vite-plugin
npm install axios
```

CRXJS handles the MV3 service worker bundling complexity — without it, getting Vite to produce a valid MV3 extension requires significant manual configuration.

### `manifest.json`

```json
{
  "manifest_version": 3,
  "name": "PhishShield",
  "version": "1.0.0",
  "description": "AI-powered phishing detection for every page you visit",
  "permissions": ["storage", "activeTab", "scripting", "tabs"],
  "host_permissions": ["<all_urls>"],
  "background": {
    "service_worker": "src/background/service-worker.ts",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["src/content/warning-banner.ts"],
      "run_at": "document_start"
    }
  ],
  "action": {
    "default_popup": "src/popup/popup.html",
    "default_icon": "icons/shield.png"
  }
}
```

### Service Worker — `src/background/service-worker.ts`

The service worker listens for tab navigation completion events, calls the PhishShield API with the tab's URL, stores the result in `chrome.storage.local` keyed by tab ID, and triggers DOM injection if the verdict is risky.

```typescript
const API_BASE = "http://localhost:8000";

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab.url) return;
  if (!tab.url.startsWith("http")) return;  // skip chrome://, about:, extension pages

  try {
    const response = await fetch(`${API_BASE}/analyze/url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: tab.url }),
    });

    if (!response.ok) return;
    const result = await response.json();

    // Store result for this tab — popup reads this
    await chrome.storage.local.set({
      [`tab_${tabId}`]: {
        url: tab.url,
        risk_score: result.risk_score,
        verdict: result.verdict,
        top_reasons: result.top_reasons,
        timestamp: Date.now(),
      },
    });

    // Set badge on extension icon to show score at a glance
    const badgeColor =
      result.verdict === "phishing"   ? "#dc2626" :
      result.verdict === "suspicious" ? "#d97706" : "#16a34a";
    chrome.action.setBadgeText({ tabId, text: String(result.risk_score) });
    chrome.action.setBadgeBackgroundColor({ tabId, color: badgeColor });

    // Inject warning if risky
    if (result.verdict === "phishing" || result.verdict === "suspicious") {
      await chrome.scripting.executeScript({
        target: { tabId },
        func: showWarningBanner,
        args: [result.risk_score, result.verdict, result.top_reasons],
      });
    }
  } catch (err) {
    // Extension must never disrupt browsing — silently fail on API errors
    console.warn("PhishShield: analysis failed", err);
  }
});


function showWarningBanner(score: number, verdict: string, reasons: string[]) {
  if (document.getElementById("phishshield-banner")) return;

  const isPhishing = verdict === "phishing";
  const banner = document.createElement("div");
  banner.id = "phishshield-banner";
  banner.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; z-index: 2147483647;
    background: ${isPhishing ? "#dc2626" : "#d97706"};
    color: white; padding: 12px 20px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px; display: flex; align-items: center; gap: 16px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
  `;
  banner.innerHTML = `
    <span style="font-size:22px;flex-shrink:0">${isPhishing ? "🚨" : "⚠️"}</span>
    <div style="flex:1;min-width:0">
      <strong style="display:block;margin-bottom:2px">
        PhishShield: ${isPhishing ? "Phishing Site Detected" : "Suspicious Page"} — Risk ${score}/100
      </strong>
      <span style="opacity:0.9;font-size:12px">${reasons[0] || ""}</span>
    </div>
    <button
      id="phishshield-dismiss"
      style="background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.4);
             color:white;padding:6px 14px;border-radius:6px;cursor:pointer;
             font-size:13px;flex-shrink:0">
      Dismiss
    </button>
  `;
  document.body.prepend(banner);
  document.getElementById("phishshield-dismiss")!
    .addEventListener("click", () => banner.remove());
}
```

### Popup — `src/popup/Popup.tsx`

```typescript
import { useEffect, useState } from "react";

type ScanResult = {
  url: string;
  risk_score: number;
  verdict: "clean" | "suspicious" | "phishing";
  top_reasons: string[];
};

export default function Popup() {
  const [result, setResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, async ([tab]) => {
      if (!tab?.id) { setLoading(false); return; }
      const key = `tab_${tab.id}`;
      const stored = await chrome.storage.local.get(key);
      setResult(stored[key] ?? null);
      setLoading(false);
    });
  }, []);

  const colors = {
    clean:      { bg: "bg-green-50",  text: "text-green-700",  border: "border-green-200" },
    suspicious: { bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200" },
    phishing:   { bg: "bg-red-50",    text: "text-red-700",    border: "border-red-200" },
  };
  const c = result ? colors[result.verdict] : colors.clean;

  return (
    <div className="w-72 font-sans">
      <div className="bg-gray-900 text-white px-4 py-3 flex items-center gap-2">
        <span className="text-lg">🛡</span>
        <span className="font-semibold text-sm tracking-wide">PhishShield</span>
      </div>

      <div className="p-4">
        {loading && <p className="text-sm text-gray-400 text-center py-4">Analyzing page...</p>}

        {!loading && !result && (
          <p className="text-sm text-gray-500 text-center py-4">
            No analysis available yet for this page.
          </p>
        )}

        {!loading && result && (
          <>
            <div className={`rounded-lg p-3 mb-3 border ${c.bg} ${c.border}`}>
              <div className={`text-3xl font-bold ${c.text}`}>
                {result.risk_score}
                <span className="text-base font-normal text-gray-400">/100</span>
              </div>
              <div className={`text-sm font-semibold capitalize mt-1 ${c.text}`}>
                {result.verdict === "phishing"   ? "🚨 Phishing Detected"  :
                 result.verdict === "suspicious" ? "⚠️ Suspicious Page"   : "✅ Page Looks Safe"}
              </div>
            </div>

            {result.top_reasons.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Detection Reasons
                </p>
                {result.top_reasons.map((r, i) => (
                  <p key={i} className="text-xs text-gray-600 border-l-2 border-gray-300 pl-2 leading-relaxed">
                    {r}
                  </p>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
```

---

## 8. Environment Configuration

### Backend `.env`

```bash
DATABASE_URL=postgresql://user:password@ep-xxx.neon.tech/phishshield?sslmode=require
OPENAI_API_KEY=sk-...
GOOGLE_SAFE_BROWSING_KEY=AIza...
ENVIRONMENT=development
```

### Frontend `.env`

```bash
VITE_API_URL=http://localhost:8000
```

### Running Locally

```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev                        # runs at http://localhost:5173

# Extension
cd extension
npm install
npm run build                      # produces extension/dist/
# Open Chrome → chrome://extensions → Enable Developer Mode → Load unpacked → select extension/dist/
```

---

## 9. Evaluation Strategy

This is the section that makes or breaks the report. Run it in Week 4 after the full system is working.

### Dataset

Download confirmed phishing URLs from PhishTank (free CSV export at phishtank.com, filtered to "verified" and "online" status). Take 100 phishing URLs. For legitimate URLs, take entries 500–600 from the Tranco Top 1M list (tranco-list.eu). This gives 100 phishing + 100 legitimate = 200 total data points.

### Metrics

For each URL, record the system verdict. Then compute:

- **True Positive (TP)**: phishing URL correctly flagged as suspicious or phishing
- **False Positive (FP)**: legitimate URL incorrectly flagged
- **True Negative (TN)**: legitimate URL correctly classified as clean
- **False Negative (FN)**: phishing URL classified as clean
- **Precision** = TP / (TP + FP) — of everything flagged, how many were actually phishing
- **Recall** = TP / (TP + FN) — of all actual phishing, how many did we catch
- **F1 Score** = 2 × (Precision × Recall) / (Precision + Recall) — harmonic mean, the main headline metric

### Ablation Study

Run the full 200-URL evaluation three additional times with one layer disabled each time. This produces a comparative table that directly demonstrates the contribution of each component:

| Configuration                       | Precision | Recall | F1    |
|-------------------------------------|-----------|--------|-------|
| URL rules only (no NLP, no headers) | ~75%      | ~68%   | ~71%  |
| NLP only (no URL rules, no headers) | ~82%      | ~79%   | ~80%  |
| Header rules only                   | ~60%      | ~55%   | ~57%  |
| **Full ensemble (all layers)**      | **~91%**  | **~88%** | **~89%** |

These are estimates — your actual numbers go in the report. The key point for your panel is that the ensemble consistently outperforms any single layer, which validates the multi-layer design decision.

---

## 10. Deployment

For the demo and submission, local deployment is perfectly acceptable for a masters project. However if you want the extension to work without running your laptop during a panel demo, deploy the backend to Railway (free tier, native Python support, direct Neon integration):

```bash
npm install -g @railway/cli
railway login
cd backend
railway init
railway up
```

Set `DATABASE_URL`, `OPENAI_API_KEY`, and `GOOGLE_SAFE_BROWSING_KEY` as environment variables in the Railway dashboard. Then:

1. Update `API_BASE` in `extension/src/background/service-worker.ts` to your Railway URL
2. Update `VITE_API_URL` in `frontend/.env.production` to your Railway URL
3. Rebuild both: `npm run build` in each directory
4. Reload the extension in `chrome://extensions`

The FastAPI docs will be live at `https://your-app.railway.app/docs` — include a screenshot of this in your report appendix as evidence of a documented API.

