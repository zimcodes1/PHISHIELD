# PhishShield — MVP Implementation Roadmap

> AI-Powered Phishing Detection for Email and Web Applications
> Masters Final Project | 4-Week Delivery Target
> Stack: Python · FastAPI · PostgreSQL (Neon) · React 18 · TypeScript · Tailwind · Chrome Extension (MV3)

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Week 1 — Backend Foundation](#2-week-1--backend-foundation)
3. [Week 2 — AI Detection Pipeline](#3-week-2--ai-detection-pipeline)
4. [Week 3 — React Dashboard](#4-week-3--react-dashboard)
5. [Week 4 — Browser Extension & Evaluation](#5-week-4--browser-extension--evaluation)
6. [Dependencies & API Keys](#6-dependencies--api-keys)
7. [Deployment](#7-deployment)

---

## 1. System Architecture

Two interfaces, one backend, one AI pipeline. The dashboard and the browser extension both call the same FastAPI backend. The backend runs every input through three detection layers, combines their scores into a final verdict, logs the result to PostgreSQL, and returns a structured response.

```
[Web Dashboard]          [Browser Extension]
       |                         |
 POST /analyze/email       POST /analyze/url
       |                         |
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
         Risk Score 0–100
           + Top Reasons
                  |
          [PostgreSQL/Neon]
```

### Folder Structure

```
phishshield/
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── .env
│   ├── api/
│   │   ├── routes/
│   │   │   ├── analyze.py       # POST /analyze/url, POST /analyze/email
│   │   │   └── history.py       # GET /history
│   │   └── schemas.py           # Pydantic request/response models
│   ├── detection/
│   │   ├── pipeline.py          # Layer orchestrator
│   │   ├── url_analyzer.py      # Layer 1
│   │   ├── nlp_analyzer.py      # Layer 2
│   │   ├── header_analyzer.py   # Layer 3
│   │   └── ensemble.py          # Score combiner
│   └── db/
│       ├── database.py
│       └── models.py
├── frontend/
│   └── src/
│       ├── api/client.ts
│       ├── pages/
│       │   ├── Analyzer.tsx
│       │   └── History.tsx
│       └── components/
│           ├── ScoreGauge.tsx
│           ├── ReasonCards.tsx
│           └── ScanForm.tsx
└── extension/
    ├── manifest.json
    └── src/
        ├── background/service-worker.ts
        ├── content/warning-banner.ts
        └── popup/Popup.tsx
```

---

## 2. Week 1 — Backend Foundation

Goal by end of week: `POST /analyze/url` returns a real score from a running server.

### 2.1 Project Setup

Initialize the FastAPI app with CORS middleware configured to allow both the frontend origin (`localhost:5173`) and `chrome-extension://*`. Register the analyze and history routers under `/analyze` and `/history` prefixes. Add a `/health` GET endpoint. Run with Uvicorn in reload mode during development.

CORS must explicitly whitelist `chrome-extension://*` — without this the browser extension will silently fail when calling the API.

### 2.2 Pydantic Schemas

Define all request and response shapes before writing any route logic. Schemas needed:

- `URLRequest` — accepts a plain string URL (not a validated HttpUrl type, because phishing URLs frequently fail standard URL validation)
- `EmailRequest` — accepts subject, body, sender, and optional raw headers string
- `LayerResult` — name, score (float 0–1), list of reason strings, weight
- `AnalysisResponse` — final risk score (int 0–100), verdict enum (clean/suspicious/phishing), top 3 reasons, list of LayerResults, scan UUID, timestamp
- `Verdict` — string enum with three values: clean, suspicious, phishing

### 2.3 Database — PostgreSQL on Neon

Two tables only:

**scans** — stores every analysis run. Columns: id (UUID primary key), scan_type (url or email), input_value (the URL or email subject), risk_score (0–100), verdict, reasons (JSON array serialized as text), layers (JSON array serialized as text), timestamp.

**feedback** — stores user-reported corrections for the evaluation section. Columns: id, scan_id (foreign reference), user_verdict (false_positive or false_negative), timestamp.

Use SQLAlchemy with a sync engine for simplicity. Tables are created automatically on first startup via `metadata.create_all()` — no migration tooling needed for the MVP. Neon requires `?sslmode=require` appended to the connection string.

### 2.4 Layer 1 — URL Analyzer

The first and fastest detection layer. Four sub-checks run per URL, their scores combined into a single layer score using fixed weights.

**Sub-check 1: Google Safe Browsing API (weight 40%)**
POST the URL to Google's Threat Matches endpoint specifying threat types MALWARE, SOCIAL_ENGINEERING, and UNWANTED_SOFTWARE. If the response contains any matches, score 1.0 and record the threat type as a reason. If the API is unreachable, score 0.0 and continue — never block on an unavailable external service. Free tier allows 10,000 requests per day.

**Sub-check 2: URLhaus Lookup (weight 30%)**
POST the URL to the abuse.ch URLhaus API. No authentication required. If `query_status` is `is_listed`, score 1.0. Fail open on timeout.

**Sub-check 3: WHOIS Domain Age (weight 15%)**
Extract the registered domain from the URL, query WHOIS for creation date, compute age in days. Scoring: under 7 days → 1.0, 7–30 days → 0.7, 30–90 days → 0.3, over 90 days → 0.0. If WHOIS lookup fails, score 0.2 (unknown is mildly suspicious).

**Sub-check 4: Heuristic Rules (weight 15%)**
Deterministic checks for structural phishing patterns:
- *IP-as-domain*: raw IPv4 address in the netloc position instead of a domain name → score 0.9
- *Typosquatting*: compute Levenshtein edit distance between the URL's registered domain and each entry in a curated brand domain list (top global brands + Nigerian banks and fintechs). Distance of 1 or 2 with no exact match → score 0.85
- *Free TLD abuse*: domains ending in .tk, .ml, .ga, .cf, .gq → score 0.4
- *Suspicious path segments*: /login, /verify, /account, /suspended, /update, /confirm appearing on an unknown domain → score 0.5
- *Excessive subdomain depth*: more than 3 subdomain levels → score 0.5
- *Abnormal URL length*: over 200 characters, scaling to 0.6 at 300+ characters

Final layer score = weighted average of all sub-checks, capped at 1.0.

### 2.5 Analyze Routes

Two POST endpoints: `/analyze/url` and `/analyze/email`. Both accept their respective Pydantic request model, call the pipeline orchestrator, persist the result to the scans table with a generated UUID, attach the UUID to the response, and return the `AnalysisResponse`. A third endpoint `/analyze/email/upload` accepts a `.eml` file upload, parses it using Python's standard `email` library to extract subject, body, sender, and raw headers, then delegates to the email pipeline.

### 2.6 History Route

`GET /history` accepts `limit` and `offset` query parameters (default 20, max 100). Returns total count and a paginated list of past scans ordered by timestamp descending. Each item includes all fields except the full layers JSON — that detail is only needed when viewing a specific result.

---

## 3. Week 2 — AI Detection Pipeline

Goal by end of week: both `/analyze/url` and `/analyze/email` return full ensemble scores with NLP-powered reasons. Accuracy measured against 200 test cases.

### 3.1 Layer 2 — NLP Analyzer (GPT-4o-mini)

The AI layer. Sends the text content to OpenAI's GPT-4o-mini model via the Chat Completions API and receives a structured JSON classification.

**Input**: For email, concatenate subject and body (first 2000 characters). For URL-only scans, use the URL string itself — path words like `/verify-account` and brand names in subdomains still carry semantic signal.

**Prompt engineering**: The system prompt is the most critical implementation decision in this layer. It must specify: output format (JSON only, no preamble or markdown), a scoring rubric for each dimension (what score 0, 5, and 10 mean), counter-examples to prevent false positives (shipping notifications and marketing emails with mild urgency should score low), and the exact JSON keys and types expected. Use `temperature: 0.1` for repeatable classification. Use `response_format: {"type": "json_object"}` to guarantee parseable output.

**Dimensions scored (each 0–10)**:
- *urgency* — degree of fear-based pressure to act immediately
- *impersonation* — how strongly the text pretends to be a known organization
- *credential_harvesting* — how directly passwords, PINs, OTPs, or account access is requested
- *social_engineering* — manipulation beyond urgency: guilt, false authority, fake prizes, BEC patterns

**Dimension weights for final layer score**: credential_harvesting 35%, impersonation 30%, urgency 20%, social_engineering 15%. These weights are a research decision — document the rationale and vary them in the ablation study.

**Failure handling**: If the OpenAI call fails for any reason, return a neutral score of 0.3 with a "NLP analysis unavailable" reason. The pipeline must never crash because one layer is unavailable.

**Cost**: At gpt-4o-mini pricing (~$0.15 per million input tokens), 500 tokens per scan costs ~$0.000075. Running 1000 evaluation scans costs under $0.10 total.

### 3.2 Layer 3 — Header Analyzer

Email-only layer. No external API calls — entirely string parsing of the raw `Authentication-Results` header and the `From:` field.

**SPF check**: Parse `spf=` result from Authentication-Results. `fail` → score 0.7, `softfail` → score 0.4, `pass` → score 0.0. SPF verifies that the sending server is authorized to send on behalf of the claimed domain.

**DKIM check**: Parse `dkim=` result. `fail` → score 0.7. DKIM verifies the email was not modified in transit and was signed by the domain owner.

**DMARC check**: Parse `dmarc=` result. `fail` → score 0.8. DMARC is the strongest of the three — it requires at least one of SPF or DKIM to pass in alignment with the From domain.

**Display name spoofing**: Parse the `From:` header to separate the display name from the actual envelope address. If the display name contains a known brand name but the envelope domain does not match that brand's domain, score 0.85. This is one of the most reliable BEC and impersonation indicators — the user sees "PayPal Security" in their mail client without noticing the actual sending address is `attacker12345@gmail.com`.

Final layer score: maximum of all triggered checks (not average — any one of these failing is independently significant).

### 3.3 Ensemble Scorer

Combines the three layer scores into a final verdict.

**Weights**: NLP 40%, URL 35%, Headers 25%. NLP carries the highest weight because it captures semantic intent that no rule-based system can — the meaning of language matters, and GPT-4o-mini understands it. URL reputation is second because it draws on ground-truth threat intelligence databases. Headers are weighted lowest because they only apply to email, and many email clients strip or alter headers.

**Normalization**: If a layer was skipped (e.g. header analysis on a URL-only scan), exclude it from the weighted average entirely rather than diluting the score with a zero.

**Verdict thresholds**: Score ≥ 70 → phishing. Score 40–69 → suspicious. Score < 40 → clean.

**Reason aggregation**: Collect all reason strings from all layers, rank them by the score of the layer they came from, return the top 3. These are the human-readable explanations shown in the UI and the extension popup.

### 3.4 Pipeline Orchestrator

Coordinates all layers for both scan types. Key implementation point: URL analysis and NLP analysis must run **concurrently** using `asyncio.gather`, not sequentially. Running them sequentially doubles the latency unnecessarily — both are network-bound (external API calls) and independent of each other.

For email scans, all three layers run concurrently. For URL-only scans, two layers run (URL + NLP); headers return empty with zero score.

Total expected latency: dominated by whichever external call is slowest. Typically 2–4 seconds for a full scan. Set the frontend Axios timeout to at least 15 seconds.

### 3.5 Evaluation Run

At the end of Week 2, run a preliminary accuracy test:
- 100 confirmed phishing URLs from PhishTank (free CSV export, filter to verified + online)
- 100 legitimate URLs from Tranco Top 1M (entries 500–600)
- Record verdict per URL, compute precision, recall, F1

This is a sanity check — the full formal evaluation with ablation study runs in Week 4 after the system is complete.

---

## 4. Week 3 — React Dashboard

Goal by end of week: a non-technical user can open the web app, paste a URL or email, and see a clear result with explanations.

### Setup

Scaffold with Vite React-TS template. Install Tailwind CSS with PostCSS. Install Axios and TanStack React Query for server state management. Install React Router for page navigation.

### Axios Client (`api/client.ts`)

Single Axios instance with base URL from `VITE_API_URL` environment variable (defaults to `http://localhost:8000`). Timeout set to 15 seconds. Export individual typed functions: `analyzeURL`, `analyzeEmail`, `getHistory`. React Query wraps these for caching, loading states, and error handling.

### Page: Analyzer (`/`)

The main landing page. Sections:

**Input area** — tab switcher between "Check URL" and "Analyze Email". URL tab: single text input with placeholder and Analyze button. Email tab: Subject field, Sender field, Body textarea, collapsible "Paste raw email headers" textarea. On submit, disable the form and show a loading indicator with a note that analysis takes a few seconds.

**Results area** (conditionally rendered after a successful response) — four components rendered together:
- *Score gauge*: SVG arc gauge showing 0–100. Green below 40, yellow 40–70, red above 70. Animate the fill on mount.
- *Verdict badge*: colored pill showing clean/suspicious/phishing with an appropriate icon.
- *Reason cards*: one card per item in `top_reasons`, each showing the reason text and a tag indicating which layer produced it (URL, AI, or Headers).
- *Layer breakdown*: accordion or expandable section showing each layer's individual score and its own reasons. This is the "explainability" component — important for the report.

**False positive button** — small "Report incorrect result" link below the results. POSTs the scan ID and a user verdict to a `/feedback` endpoint. The feedback table collects this for the evaluation section.

### Page: History (`/history`)

Stats bar at top: total scans, phishing blocked, suspicious flagged, clean passed. Below that, a paginated table with columns: type (icon), input (truncated to 60 chars), risk score (colored), verdict (badge), timestamp (relative e.g. "3 minutes ago"). Clicking a row expands an inline panel showing the full reason list and layer breakdown for that scan. Pagination controls at the bottom.

---

## 5. Week 4 — Browser Extension & Evaluation

Goal by end of week: the extension warns in real time on a live PhishTank URL. Full evaluation table complete. Report methodology section written.

### 5.1 Extension Setup

Scaffold with Vite React-TS. Install CRXJS Vite plugin — this handles the MV3 service worker bundling that plain Vite cannot do correctly. Load the unpacked extension from the `dist/` folder in `chrome://extensions` with Developer Mode enabled.

### 5.2 Manifest (MV3)

Permissions required: `storage` (for persisting scan results per tab), `activeTab`, `scripting` (for injecting the warning banner), `tabs`. Host permissions: `<all_urls>`. Background: service worker module. Content scripts: run at `document_start` on all URLs. Action: popup HTML pointing to the React popup component.

### 5.3 Service Worker (`background/service-worker.ts`)

Listens on `chrome.tabs.onUpdated` for `status === "complete"` events. Skips non-HTTP URLs (chrome://, about:, extension pages). For every HTTP page load:

1. POSTs the tab URL to `POST /analyze/url` on the PhishShield backend
2. Stores the result in `chrome.storage.local` keyed by tab ID — this is how the popup reads the result without making its own API call
3. Sets the extension icon badge to the risk score number, colored green/yellow/red by verdict
4. If verdict is suspicious or phishing, calls `chrome.scripting.executeScript` to inject the warning banner function into the page

All of this must be wrapped in try-catch. The extension must never interfere with browsing — silently fail on any API error.

Service workers in MV3 are ephemeral — they can be terminated between events. Never store state in JavaScript variables at module scope. Everything that must persist between events goes in `chrome.storage.local`.

### 5.4 Warning Banner (Content Script)

A function injected into the page DOM when a risky verdict is returned. Creates a fixed-position div at the top of the viewport above all other content (z-index 2147483647). Red background for phishing, amber for suspicious. Shows the risk score, verdict label, and the first reason string. Includes a dismiss button. Checks for an existing banner element before creating one to prevent duplicates on page refresh.

### 5.5 Popup (`popup/Popup.tsx`)

React component rendered in the extension popup (the small window that appears when the user clicks the shield icon). On mount, queries the active tab ID, reads the stored result from `chrome.storage.local`, and renders it. Three states: loading (while reading storage), no data (tab was opened before the extension analyzed it or API failed), and result (show score gauge, verdict, top reasons). Keep it narrow — 288px wide is standard popup width.

### 5.6 Formal Evaluation

Run the full evaluation after the complete system is working.

**Dataset**: 100 phishing URLs from PhishTank + 100 legitimate URLs from Tranco Top 1M.

**Metrics to compute**:
- True Positives, False Positives, True Negatives, False Negatives
- Precision = TP / (TP + FP)
- Recall = TP / (TP + FN)
- F1 Score = 2 × (Precision × Recall) / (Precision + Recall)

**Ablation study** — run the evaluation four times, disabling one layer each time:

| Configuration | Precision | Recall | F1 |
|---|---|---|---|
| URL layer only | measured | measured | measured |
| NLP layer only | measured | measured | measured |
| Headers only | measured | measured | measured |
| Full ensemble | measured | measured | measured |

The improvement of the ensemble over any individual layer is the central experimental finding. It validates the multi-layer architecture as a design decision and is the core of the report's results section.

---

## 6. Dependencies & API Keys

### Backend (`requirements.txt`)

| Package | Purpose |
|---|---|
| `fastapi` | Web framework |
| `uvicorn[standard]` | ASGI server |
| `pydantic` | Request/response validation |
| `sqlalchemy` | ORM |
| `psycopg2-binary` | PostgreSQL driver |
| `python-dotenv` | Load `.env` file |
| `httpx` | Async HTTP client for external API calls |
| `openai` | OpenAI Python SDK |
| `python-whois` | WHOIS domain age lookups |
| `python-multipart` | `.eml` file upload support |
| `python-Levenshtein` | Edit distance for typosquatting detection |

### Frontend (`package.json` dependencies)

| Package | Purpose |
|---|---|
| `axios` | HTTP client |
| `@tanstack/react-query` | Server state management |
| `react-router-dom` | Client-side routing |
| `tailwindcss` | Utility CSS |

### Extension (`package.json` dependencies)

| Package | Purpose |
|---|---|
| `@crxjs/vite-plugin` | MV3-compatible Vite bundling |
| `axios` | HTTP client (for popup if needed) |

### API Keys Required

| Service | Where to get | Free tier |
|---|---|---|
| Google Safe Browsing API v4 | Google Cloud Console → Enable Safe Browsing API → Create API key | 10,000 requests/day |
| OpenAI API | platform.openai.com → API keys | Pay-as-you-go, ~$0.10 for full evaluation run |

No key required for URLhaus (abuse.ch) or python-whois.

---

## 7. Deployment

Local deployment is sufficient for the masters project demo. For a live URL that works without running your laptop:

**Backend → Railway**
Railway supports Python natively, connects directly to Neon, and has a free tier. Install the Railway CLI, initialize from the backend directory, push. Set the three environment variables (`DATABASE_URL`, `OPENAI_API_KEY`, `GOOGLE_SAFE_BROWSING_KEY`) in the Railway dashboard.

**Frontend → Vercel**
Connect the GitHub repo, set `VITE_API_URL` to the Railway backend URL as an environment variable. Vercel auto-deploys on every push.

**Extension**
After deploying the backend, update the `API_BASE` constant in the service worker to the Railway URL, rebuild with `npm run build`, and reload the unpacked extension. For the demo, load it unpacked — Chrome Web Store submission is not needed for a university project.

The FastAPI auto-generated docs at `/docs` on your Railway URL serve as API documentation evidence for the report appendix
