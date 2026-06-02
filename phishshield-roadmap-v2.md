# PhishShield — MVP Implementation Roadmap

> AI-Powered Phishing Detection for Email and Web Applications
> Masters Final Project | 4-Week Delivery Target
> Stack: Python · FastAPI · PostgreSQL (Neon) · React 18 · TypeScript · Tailwind · Chrome Extension (MV3)

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [User Model & Authentication](#2-user-model--authentication)
3. [Week 1 — Backend Foundation + Auth](#3-week-1--backend-foundation--auth)
4. [Week 2 — AI Detection Pipeline](#4-week-2--ai-detection-pipeline)
5. [Week 3 — React Dashboard](#5-week-3--react-dashboard)
6. [Week 4 — Browser Extension & Evaluation](#6-week-4--browser-extension--evaluation)
7. [Dependencies & API Keys](#7-dependencies--api-keys)
8. [Deployment](#8-deployment)

---

## 1. System Architecture

Two interfaces, one backend, one AI pipeline. The dashboard and the browser extension both call the same FastAPI backend. The backend authenticates the request, runs the input through four detection layers, combines their scores into a final verdict, logs the result against the authenticated user in PostgreSQL, and returns a structured response.

```
[Web Dashboard]              [Browser Extension]
       |                             |
 POST /analyze/email           POST /analyze/url
 Authorization: Bearer <JWT>   Authorization: Bearer <JWT>
       |                             |
       +-----------+  +--------------+
                   |  |
            [FastAPI Backend]
                   |
            [Auth Middleware]
            Validate JWT → get user_id
                   |
       +-----------+-----------+----------+
       |           |           |          |
   [Layer 1]   [Layer 2]   [Layer 3]  [Layer 4]
   URL Rules    NLP/AI      Headers    Visual AI
       |           |           |          |
       +-----------+-----------+----------+
                   |
           [Ensemble Scorer]
          Risk Score 0–100
            + Top Reasons
                   |
           [PostgreSQL/Neon]
        Scan logged against user_id
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
│   │   │   ├── auth.py          # POST /auth/register, POST /auth/login
│   │   │   ├── analyze.py       # POST /analyze/url, POST /analyze/email
│   │   │   └── history.py       # GET /history (user-scoped)
│   │   ├── schemas.py           # Pydantic models
│   │   └── dependencies.py      # get_current_user dependency
│   ├── detection/
│   │   ├── pipeline.py          # Layer orchestrator
│   │   ├── url_analyzer.py      # Layer 1
│   │   ├── nlp_analyzer.py      # Layer 2
│   │   ├── header_analyzer.py   # Layer 3
│   │   ├── visual_analyzer.py   # Layer 4
│   │   └── ensemble.py          # Score combiner
│   └── db/
│       ├── database.py
│       └── models.py            # User, Scan, Feedback
├── frontend/
│   └── src/
│       ├── api/client.ts        # Axios + auth token injection
│       ├── context/AuthContext.tsx
│       ├── pages/
│       │   ├── Login.tsx
│       │   ├── Register.tsx
│       │   ├── Analyzer.tsx
│       │   └── History.tsx
│       └── components/
│           ├── ProtectedRoute.tsx
│           ├── ScoreGauge.tsx
│           ├── ReasonCards.tsx
│           └── ScanForm.tsx
└── extension/
    ├── manifest.json
    └── src/
        ├── background/service-worker.ts
        ├── content/warning-banner.ts
        └── popup/
            ├── Popup.tsx
            └── Login.tsx        # Token entry for extension auth
```

---

## 2. User Model & Authentication

### Who is a User

A user is anyone who registers for PhishShield via the web dashboard. Every scan, piece of history, and feedback entry is linked to a user. The extension authenticates as the same user by storing their JWT token in `chrome.storage.local` after they enter it once in the extension popup.

There is one role in the MVP: **standard user**. All users have identical permissions — register, log in, submit scans, view their own history, report false positives. There is no admin role in the MVP; that is a post-submission concern.

### User Data Model

The `users` table holds everything needed for authentication and identification:

- `id` — UUID, primary key, generated on registration
- `email` — unique, used as the login identifier
- `hashed_password` — bcrypt hash of the password, never the plaintext
- `full_name` — display name shown in the dashboard header
- `created_at` — registration timestamp
- `is_active` — boolean, defaults to true, reserved for future account suspension

The `scans` table gains a `user_id` foreign key column pointing to `users.id`. Every scan is therefore owned by a user. The history endpoint filters by the authenticated user's ID so users only ever see their own scan history — not other users' data.

The `feedback` table similarly gains a `user_id` column so false positive reports are traceable to the user who submitted them.

### Authentication Strategy — JWT (JSON Web Tokens)

JWT is the right choice for this system because it is stateless (no session table in the database), works identically for both the web dashboard and the browser extension, and is the standard approach for FastAPI applications.

**How it works end to end:**

1. User registers with email, full name, and password. The backend hashes the password with bcrypt and stores the user row. Returns a success response (no token yet).
2. User logs in with email and password. The backend retrieves the user by email, verifies the password against the bcrypt hash. If correct, generates a JWT signed with a secret key stored in `.env`. The JWT payload contains `user_id` and `exp` (expiry timestamp, set to 7 days). Returns the token.
3. Every subsequent request to a protected endpoint must include the token in the `Authorization` header as `Bearer <token>`.
4. A FastAPI dependency function (`get_current_user`) runs on every protected route. It extracts the token from the header, verifies the signature and expiry using the same secret key, decodes the `user_id` from the payload, fetches the user from the database, and returns the user object to the route handler. If the token is missing, expired, or invalid, it raises a 401 Unauthorized.
5. The route handler receives the current user as a parameter and can use `current_user.id` to scope database queries.

**Token storage:**
- Web dashboard: store the JWT in `localStorage` under the key `phishshield_token`. The Axios client reads it from there and injects it into every request header automatically via a request interceptor.
- Browser extension: store the JWT in `chrome.storage.local` under `auth_token`. The service worker reads it before every API call. The popup shows a token input field on first use (the user pastes their token from the dashboard, or logs in directly in the popup if you add a login form there).

**Libraries:**
- `python-jose[cryptography]` — JWT encoding and decoding in Python
- `passlib[bcrypt]` — password hashing
- `python-multipart` — required by FastAPI for form-based login (OAuth2PasswordRequestForm)

### Auth Endpoints

`POST /auth/register` — accepts email, full_name, password. Validates email is not already taken. Hashes password. Creates user row. Returns user id and email (no token).

`POST /auth/login` — accepts email and password (as form data, compatible with OAuth2PasswordRequestForm). Verifies credentials. Returns `{"access_token": "<jwt>", "token_type": "bearer"}`.

`GET /auth/me` — protected route. Returns the current authenticated user's profile (id, email, full_name, created_at). Used by the dashboard to display the user's name and confirm the token is still valid on app load.

### What Requires Authentication

Every route except `/health`, `/auth/register`, and `/auth/login` requires a valid JWT. This means:
- `POST /analyze/url` — protected
- `POST /analyze/email` — protected
- `POST /analyze/email/upload` — protected
- `GET /history` — protected, results filtered to current user only
- `POST /feedback` — protected

Unauthenticated requests to these endpoints receive a 401 with `{"detail": "Not authenticated"}`.

---

## 3. Week 1 — Backend Foundation + Auth

Goal by end of week: a user can register, log in, submit a URL, and get a real score back. All routes are authenticated.

### 3.1 Project Setup

Initialize the FastAPI app with CORS middleware configured to allow both the frontend origin (`localhost:5173`) and `chrome-extension://*`. Register all routers. Add a `/health` GET endpoint. Run with Uvicorn in reload mode during development.

CORS must explicitly whitelist `chrome-extension://*` — without this the browser extension will silently fail when calling the API.

### 3.2 Pydantic Schemas

Define all request and response shapes before writing any route logic. Schemas needed:

- `UserCreate` — email, full_name, password (min length 8)
- `UserResponse` — id, email, full_name, created_at (never include password hash in responses)
- `TokenResponse` — access_token, token_type
- `URLRequest` — plain string URL (not validated HttpUrl — phishing URLs frequently fail standard URL validation)
- `EmailRequest` — subject, body, sender, optional raw headers string
- `LayerResult` — name, score (float 0–1), list of reason strings, weight
- `AnalysisResponse` — risk_score (int 0–100), verdict enum, top_reasons list, layers list, scan_id UUID, timestamp
- `Verdict` — string enum: clean, suspicious, phishing

### 3.3 Database — PostgreSQL on Neon

Three tables:

**users** — id (UUID PK), email (unique), hashed_password, full_name, created_at, is_active.

**scans** — id (UUID PK), user_id (FK → users.id), scan_type, input_value, risk_score, verdict, reasons (JSON as text), layers (JSON as text), timestamp.

**feedback** — id (UUID PK), scan_id (FK → scans.id), user_id (FK → users.id), user_verdict (false_positive or false_negative), timestamp.

Use SQLAlchemy with a sync engine. Tables are created automatically on first startup via `metadata.create_all()`. Neon requires `?sslmode=require` in the connection string.

### 3.4 Auth Implementation

Implement registration and login routes, the JWT encode/decode utility functions, and the `get_current_user` FastAPI dependency. Apply the dependency to all analyze and history routes. Test with the auto-generated `/docs` UI — FastAPI renders an Authorize button that accepts a Bearer token, making manual testing of protected routes straightforward without needing a frontend.

### 3.5 Layer 1 — URL Analyzer

The first and fastest detection layer. Four sub-checks run per URL, combined into a single layer score.

**Sub-check 1: Google Safe Browsing API (weight 40%)**
POST the URL to Google's Threat Matches endpoint specifying threat types MALWARE, SOCIAL_ENGINEERING, and UNWANTED_SOFTWARE. If the response contains any matches, score 1.0. If the API is unreachable, score 0.0 and continue — never block on an unavailable external service. Free tier: 10,000 requests/day.

**Sub-check 2: URLhaus Lookup (weight 30%)**
POST the URL to abuse.ch URLhaus API. No authentication required. If `query_status` is `is_listed`, score 1.0. Fail open on timeout.

**Sub-check 3: WHOIS Domain Age (weight 15%)**
Extract registered domain, query WHOIS for creation date, compute age in days. Under 7 days → 1.0, 7–30 days → 0.7, 30–90 days → 0.3, over 90 days → 0.0. WHOIS failure → score 0.2.

**Sub-check 4: Heuristic Rules (weight 15%)**
- *IP-as-domain*: raw IPv4 in the netloc → score 0.9
- *Typosquatting*: Levenshtein distance ≤ 2 from any brand domain in a curated list (global brands + Nigerian banks/fintechs) → score 0.85
- *Free TLD abuse*: .tk, .ml, .ga, .cf, .gq → score 0.4
- *Suspicious path segments*: /login, /verify, /account, /suspended, /update, /confirm on an unknown domain → score 0.5
- *Excessive subdomain depth*: more than 3 levels → score 0.5
- *Abnormal URL length*: over 200 characters, scaling to 0.6 at 300+ characters

Final layer score = weighted average of all sub-checks, capped at 1.0.

### 3.6 Analyze & History Routes

`POST /analyze/url` and `POST /analyze/email` — both protected, both call the pipeline, both persist the scan with the authenticated user's ID, return `AnalysisResponse`. A third endpoint `POST /analyze/email/upload` accepts a `.eml` file, parses it with Python's standard `email` library, then delegates to the email pipeline.

`GET /history` — protected, returns scans filtered to `current_user.id` only, paginated with `limit` and `offset` query params.

---

## 4. Week 2 — AI Detection Pipeline

Goal by end of week: all four detection layers working, full ensemble score returned, preliminary accuracy measured.

### 4.1 Layer 2 — NLP Analyzer (GPT-4o-mini)

The primary AI layer. Sends text content to GPT-4o-mini via the Chat Completions API and receives a structured JSON classification.

**Input**: For email, concatenate subject and body, truncated to 2000 characters. For URL-only scans, use the URL string itself — path words and brand names in subdomains carry semantic signal even without body text.

**Prompt engineering**: The system prompt must specify output format (JSON only, no preamble), a scoring rubric per dimension defining what 0, 5, and 10 mean, counter-examples to suppress false positives (shipping notifications and marketing urgency should score low), and exact expected JSON keys and types. Use `temperature: 0.1` for repeatable output. Use `response_format: {"type": "json_object"}` to guarantee parseable JSON.

**Dimensions scored (each 0–10, normalized to 0–1 for the layer score)**:
- *urgency* — fear-based pressure to act immediately
- *impersonation* — degree to which text pretends to be a known organization
- *credential_harvesting* — directness of request for passwords, PINs, OTPs, or account access
- *social_engineering* — manipulation beyond urgency: false authority, guilt, fake prizes, BEC patterns

**Dimension weights**: credential_harvesting 35%, impersonation 30%, urgency 20%, social_engineering 15%. Document the rationale in the report — these weights are a research decision, not arbitrary.

**Failure handling**: If the OpenAI call fails for any reason, return score 0.3 with "NLP analysis unavailable". The pipeline never crashes due to a single layer failure.

**Cost at gpt-4o-mini pricing**: ~$0.000075 per scan. Full 200-scan evaluation costs under $0.02.

### 4.2 Layer 3 — Header Analyzer

Email-only layer. Entirely deterministic string parsing — no external API calls. Parses the `Authentication-Results` header and the `From:` field.

**SPF**: `spf=fail` → score 0.7, `spf=softfail` → score 0.4, `spf=pass` → score 0.0. Verifies the sending server is authorized by the claimed domain.

**DKIM**: `dkim=fail` → score 0.7. Verifies the email was not modified in transit.

**DMARC**: `dmarc=fail` → score 0.8. The strongest of the three — requires SPF or DKIM to pass in alignment with the From domain.

**Display name spoofing**: Separate the display name from the actual envelope address in the `From:` header. If the display name contains a known brand but the sending domain does not match that brand, score 0.85. This catches "PayPal Security \<attacker@gmail.com\>" — the most common impersonation pattern.

Final layer score: the maximum of all triggered checks, not the average. Any single authentication failure is independently significant.

### 4.3 Layer 4 — Visual Analyzer (GPT-4o Vision)

The visual AI layer, triggered by the browser extension and optionally from the dashboard URL checker. Analyzes a screenshot of the loaded web page to detect visual phishing cues — pages designed to look like legitimate brand login pages.

**Screenshot capture in the extension**: Use `chrome.tabs.captureVisibleTab()`, a built-in Chrome API available in the service worker. This captures the visible portion of the current tab as a base64-encoded PNG. No external libraries, no headless browser, no Playwright. One API call.

**What gets sent to the backend**: The extension POSTs to a new endpoint `POST /analyze/visual` with the base64 image string and the page URL. The backend receives this and passes the image to GPT-4o Vision.

**Visual analysis via GPT-4o Vision**: The image is sent to GPT-4o (not mini — vision capability requires the full model) via the Chat Completions API with an image content block. The system prompt instructs the model to assess the screenshot across four visual dimensions and return structured JSON:

- *login_form_present* — does the page contain a visible login form or credential input fields (0–10)
- *brand_impersonation* — does the page visually imitate a known brand through logos, color schemes, layout, or official-looking design elements (0–10), and if so, which brand
- *trust_signal_abuse* — are padlock icons, "secure" badges, official seals, or bank logos used in a context that appears designed to manufacture false trust (0–10)
- *url_visual_mismatch* — given the URL provided alongside the image, does the visual design of the page suggest it is impersonating a brand that the URL does not belong to (0–10)

The fourth dimension is the most powerful — a page that looks exactly like GTBank's login portal but is served from `gtb-secure-login.tk` is a near-certain phishing site. The model can reason about this because both the URL and the screenshot are in the same prompt.

**Layer score computation**: Weighted average of the four dimensions. `url_visual_mismatch` carries the highest weight (40%) because it directly combines the URL and visual signals. `brand_impersonation` 30%, `login_form_present` 20%, `trust_signal_abuse` 10%.

**When it runs**: The visual layer is triggered asynchronously — it does not block the initial URL analysis response. The service worker captures the screenshot after the page loads, sends it to the backend, and if the visual verdict changes the overall score meaningfully (e.g. upgrades suspicious to phishing), the popup and banner update. This two-phase approach avoids making the user wait for the slower vision API before showing an initial result.

**Cost at GPT-4o Vision pricing**: ~$0.002 per image at low resolution. Running 100 evaluation scans for the visual layer costs ~$0.20. Still negligible.

**Failure handling**: If the visual layer fails or times out, omit it from the ensemble. Never block the result waiting for a screenshot.

### 4.4 Updated Ensemble Scorer

With four layers, the weights become:

| Layer | Weight | Applies to |
|---|---|---|
| URL analysis | 30% | URL and email scans |
| NLP analysis | 35% | URL and email scans |
| Header analysis | 20% | Email scans only |
| Visual analysis | 15% | URL scans (when screenshot available) |

Layers that do not apply to the current scan type (headers for URL scans, visual for email scans) are excluded from the weighted average — their weight redistributed proportionally rather than treated as zero. This prevents inapplicable layers from diluting the score.

**Verdict thresholds remain**: ≥ 70 → phishing, 40–69 → suspicious, < 40 → clean.

**Reason aggregation**: Collect all reasons across all four layers, rank by layer score, return top 3. The visual layer reasons are phrased naturally: "Page visually impersonates GTBank login portal despite unrelated domain."

### 4.5 Updated Pipeline Orchestrator

For URL scans: URL analysis and NLP run concurrently via `asyncio.gather`. Visual analysis runs asynchronously after the initial response is returned (it arrives as a second update). For email scans: URL analysis (on extracted links), NLP, and header analysis run concurrently. Visual analysis does not run for email scans.

Total expected latency for initial response: 2–4 seconds. Visual analysis follow-up: an additional 3–6 seconds, arriving as a patch to the existing result.

### 4.6 New Backend Endpoint

`POST /analyze/visual` — protected. Accepts the base64 screenshot and the page URL. Calls `visual_analyzer.py`. Returns a `LayerResult` (score, reasons, weight). This endpoint is called separately from the main analyze endpoint, allowing the two-phase response pattern.

### 4.7 Preliminary Evaluation

At end of Week 2, run a sanity check against 100 phishing URLs from PhishTank and 100 legitimate URLs from Tranco. Compute F1 score with the layers implemented so far (Layers 1–3; visual is added during Week 4 extension work). This is a checkpoint, not the final evaluation.

---

## 5. Week 3 — React Dashboard

Goal by end of week: a non-technical user can register, log in, scan a URL or email, and see a clear result with per-layer explanations.

### Setup

Scaffold with Vite React-TS. Install Tailwind CSS, Axios, TanStack React Query, React Router.

### Auth Context (`context/AuthContext.tsx`)

A React context that holds the current user and token state for the entire app. On mount, reads the JWT from `localStorage`. If a token exists, calls `GET /auth/me` to validate it and hydrate the user object. If the call fails (expired token), clears `localStorage` and redirects to login. Exposes `login(token)`, `logout()`, and `currentUser` to all child components.

### Axios Client (`api/client.ts`)

Single Axios instance with base URL from `VITE_API_URL`. A request interceptor reads the token from `localStorage` and injects it as `Authorization: Bearer <token>` on every outgoing request. A response interceptor catches 401 responses and triggers a logout (redirects to login). Timeout: 20 seconds to accommodate visual analysis latency.

### Page: Login (`/login`)

Email and password fields. On submit, calls `POST /auth/login`, stores the returned token via the auth context, redirects to `/`. Link to register page. No protected route wrapping — accessible without a token.

### Page: Register (`/register`)

Full name, email, password, confirm password fields. Client-side validation: passwords match, password minimum 8 characters, valid email format. Calls `POST /auth/register` on submit, then automatically logs in with the same credentials (calls login immediately after), redirects to `/`.

### Protected Route Component

A wrapper component that checks `AuthContext` for a current user. If no user, redirects to `/login`. Wrap all authenticated pages with this. The Analyzer and History pages are both protected.

### Page: Analyzer (`/`)

**Input area** — tab switcher between "Check URL" and "Analyze Email". URL tab: single text input and Analyze button. Email tab: Subject, Sender, Body textarea, collapsible raw headers textarea. On submit, disable the form and show a loading spinner. Note to user that analysis takes a few seconds.

**Results area** — rendered after response:
- *Score gauge*: SVG arc, green below 40, yellow 40–70, red above 70
- *Verdict badge*: colored pill with icon
- *Reason cards*: one per top reason, tagged with source layer (URL / AI / Headers / Visual)
- *Layer breakdown*: expandable section showing each layer's individual score and reasons
- *Visual analysis panel*: shown only for URL scans, renders after the async visual result arrives as a second API response. Shows the screenshot thumbnail alongside the visual layer score and reasons.

**False positive button** — "Report incorrect result" link that POSTs scan_id and user verdict to a `/feedback` endpoint.

### Page: History (`/history`)

Stats bar: total scans, phishing blocked, suspicious flagged, clean. Paginated table: type icon, input (truncated), risk score (colored), verdict badge, timestamp. Row expansion shows full layer breakdown. Filters bar: filter by verdict, filter by scan type (url/email).

### Page: Profile (optional, low priority)

If time allows: shows current user's email and name. Logout button. Account created date.

---

## 6. Week 4 — Browser Extension & Evaluation

Goal by end of week: extension warns in real time on a PhishTank URL, visual analysis fires after page load, full evaluation table complete.

### 6.1 Extension Setup

Scaffold with Vite React-TS. Install CRXJS Vite plugin. Permissions in manifest: `storage`, `activeTab`, `scripting`, `tabs`. Host permissions: `<all_urls>`. The `activeTab` permission is specifically required for `captureVisibleTab()`.

### 6.2 Authentication in the Extension

The extension needs a JWT to call protected API endpoints. There is no browser-based login flow in MV3 service workers (no DOM, no redirect handling). The simplest approach for a university project:

The extension popup shows a "Connect Account" screen on first use. The user pastes their JWT from the dashboard (visible on the Profile page or in browser DevTools under localStorage). The extension stores it in `chrome.storage.local` under `auth_token`. The service worker reads this token and injects it as a Bearer header on every API call.

A logout button in the popup clears `chrome.storage.local` and shows the Connect screen again.

### 6.3 Service Worker — Phase 1 (URL Analysis)

On every `chrome.tabs.onUpdated` completion event for an HTTP URL:

1. Read auth token from `chrome.storage.local`. If no token, skip analysis.
2. POST the URL to `POST /analyze/url` with Bearer token.
3. Store the result in `chrome.storage.local` keyed by tab ID.
4. Set the extension badge to the risk score, colored by verdict.
5. If verdict is suspicious or phishing, inject the warning banner into the page via `chrome.scripting.executeScript`.

### 6.4 Service Worker — Phase 2 (Visual Analysis)

After Phase 1 completes, and only if the initial verdict is suspicious or above:

1. Capture the current tab screenshot using `chrome.tabs.captureVisibleTab(null, { format: "jpeg", quality: 60 })`. JPEG at 60% quality keeps the payload under 200KB in most cases.
2. POST the base64 image and the URL to `POST /analyze/visual` with Bearer token.
3. Receive the visual layer result. Merge it with the stored Phase 1 result — recompute the ensemble score client-side using the same weighting logic, or simply add the visual reasons to the existing result and flag whether the visual layer upgraded the verdict.
4. Update `chrome.storage.local` with the merged result.
5. Send a message to the popup (if open) via `chrome.runtime.sendMessage` to re-render with the updated result.
6. If the visual layer upgrades the verdict (e.g. suspicious → phishing), re-inject an upgraded warning banner.

### 6.5 Warning Banner (Content Script)

Fixed-position div at z-index 2147483647. Red for phishing, amber for suspicious. Shows risk score, verdict, and first reason. Dismiss button. Check for existing banner to prevent duplicates. If Phase 2 upgrades the verdict, remove the Phase 1 banner and inject a new one — so users see it go from amber to red if visual analysis confirms phishing.

### 6.6 Popup (`popup/Popup.tsx`)

Three states: connect screen (no token stored), loading (analysis in progress), result (show score, verdict, reasons). If Phase 2 is still running, show a "Checking visual similarity..." indicator below the Phase 1 result. Update in place when Phase 2 arrives via `chrome.runtime.onMessage`. Include a link to the full dashboard for the detailed layer breakdown.

### 6.7 Formal Evaluation

Run after the complete system including visual analysis is working.

**Dataset**: 100 confirmed phishing URLs from PhishTank (CSV export, filter to verified + online) and 100 legitimate URLs from Tranco Top 1M (entries 500–600).

**Metrics**: True Positives, False Positives, True Negatives, False Negatives → Precision, Recall, F1 Score.

**Ablation study** — five configurations:

| Configuration | Precision | Recall | F1 |
|---|---|---|---|
| URL layer only | measured | measured | measured |
| NLP layer only | measured | measured | measured |
| Visual layer only | measured | measured | measured |
| Layers 1–3 (no visual) | measured | measured | measured |
| Full ensemble (all 4 layers) | measured | measured | measured |

The visual-only row is particularly interesting academically — it shows what pure screenshot analysis contributes independent of text or URL signals. The comparison between Layers 1–3 and the full ensemble shows the incremental gain from adding visual analysis, which is the contribution of Layer 4 to the research.

---

## 7. Dependencies & API Keys

### Backend (`requirements.txt`)

| Package | Purpose |
|---|---|
| `fastapi` | Web framework |
| `uvicorn[standard]` | ASGI server |
| `pydantic` | Request/response validation |
| `sqlalchemy` | ORM |
| `psycopg2-binary` | PostgreSQL driver |
| `python-dotenv` | Load `.env` variables |
| `httpx` | Async HTTP client for external APIs |
| `openai` | OpenAI SDK (NLP + Vision) |
| `python-jose[cryptography]` | JWT encoding and decoding |
| `passlib[bcrypt]` | Password hashing |
| `python-whois` | WHOIS domain age lookups |
| `python-multipart` | `.eml` file uploads + OAuth2 form login |
| `python-Levenshtein` | Edit distance for typosquatting detection |

### Frontend (`package.json`)

| Package | Purpose |
|---|---|
| `axios` | HTTP client |
| `@tanstack/react-query` | Server state, caching, loading states |
| `react-router-dom` | Client-side routing |
| `tailwindcss` | Utility CSS |

### Extension (`package.json`)

| Package | Purpose |
|---|---|
| `@crxjs/vite-plugin` | MV3-compatible Vite bundling |

### API Keys Required

| Service | Where to obtain | Free tier |
|---|---|---|
| Google Safe Browsing API v4 | Google Cloud Console → Enable Safe Browsing API → Create API key | 10,000 requests/day |
| OpenAI API | platform.openai.com → API keys | Pay-as-you-go. NLP: ~$0.02 for 200 scans. Vision: ~$0.20 for 100 scans. |

No key required for URLhaus or python-whois.

### Environment Variables (`.env`)

```
DATABASE_URL=postgresql://...@neon.tech/phishshield?sslmode=require
OPENAI_API_KEY=sk-...
GOOGLE_SAFE_BROWSING_KEY=AIza...
JWT_SECRET_KEY=<random 32+ character string — generate once, never change>
JWT_ALGORITHM=HS256
JWT_EXPIRY_DAYS=7
```

---

## 8. Deployment

Local deployment is sufficient for the demo. For a live URL:

**Backend → Railway**: Python natively supported, direct Neon connection, free tier. Set all five environment variables in the Railway dashboard. The FastAPI docs at `/docs` on the Railway URL serve as API documentation for the report appendix.

**Frontend → Vercel**: Connect GitHub repo, set `VITE_API_URL` to Railway URL as environment variable. Auto-deploys on push.

**Extension**: After backend deployment, update `API_BASE` in the service worker to the Railway URL, rebuild (`npm run build`), reload unpacked in `chrome://extensions`. Unpacked loading is sufficient — Chrome Web Store submission is not required for a university project.

