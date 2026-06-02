# PhishShield — MVP Implementation Roadmap v4

> AI-Powered Phishing Detection for Email and Web Applications
> Masters Final Project | 4-Week Delivery Target
> Stack: Python · FastAPI · PostgreSQL (Neon) · React 18 · TypeScript · Tailwind · Chrome Extension (MV3)
> v4 update: dedicated email Random Forest layer added; email scans no longer reuse the URL model on sender addresses.

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [User Model & Authentication](#2-user-model--authentication)
3. [ML Model Design — Multi-Model Random Forest Architecture](#3-ml-model-design--multi-model-random-forest-architecture)
4. [Week 0 — Model Training (Offline, Pre-Development)](#4-week-0--model-training-offline-pre-development)
5. [Week 1 — Backend Foundation + Auth](#5-week-1--backend-foundation--auth)
6. [Week 2 — AI Detection Pipeline](#6-week-2--ai-detection-pipeline)
7. [Week 3 — React Dashboard](#7-week-3--react-dashboard)
8. [Week 4 — Browser Extension & Evaluation](#8-week-4--browser-extension--evaluation)
9. [Dependencies & API Keys](#9-dependencies--api-keys)
10. [Deployment](#10-deployment)

---

## 1. System Architecture

Two interfaces, one backend, one orchestrated AI pipeline. The dashboard and the browser extension both call the same FastAPI backend. The backend authenticates the request, chooses the scan-specific detection path, combines active layer scores into a final verdict, logs the result against the authenticated user, and returns a structured response.

A key v4 architectural distinction exists between URL analysis and email analysis:

- URL scans use a URL-specific Random Forest model plus URL reputation subchecks. This model was trained on URL/domain/page features and must only receive URL-shaped inputs.
- Email scans use a separate Email Random Forest model trained on email-message features matching the backend `EmailRequest` schema: `subject`, `body`, `sender`, and optional `raw_headers`.
- Header analysis remains deterministic and email-only, parsing SPF, DKIM, DMARC, and sender metadata.
- NLP remains shared because natural-language intent can be extracted from both URLs and email content.

This replaces the earlier behavior where `request.sender` was passed into the URL analyzer during email scans. That was removed in v4 because an email address is not a URL and the URL RF model was not trained for mailbox strings.

```
[Web Dashboard]                    [Browser Extension]
       |                                    |
POST /analyze/email              chrome.tabs.onUpdated fires
Authorization: Bearer <JWT>             |
       |                         [Model A — ONNX, runs locally]
       |                         Tier 1+2 features only
       |                         Instant, zero network, private
       |                                    |
       |                         POST /analyze/url
       |                         Authorization: Bearer <JWT>
       |                                    |
       +------------------+  +--------------+
                          |  |
                   [FastAPI Backend]
                          |
                   [Auth Middleware]
                   Validate JWT → get user_id
                          |
          +----------------------+--------------------+
          |                                           |
     [URL Pipeline]                              [Email Pipeline]
          |                                           |
 [URL RF + Reputation]                    [Email RF Model]
 [GSB + URLhaus + WHOIS]                  subject/body/sender/headers
          |                                           |
       [NLP]                                      [NLP]
          |                                           |
          |                                    [Headers]
          |                                SPF/DKIM/DMARC
          +----------------------+--------------------+
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
├── ml/                              # Offline model training — run once before development
│   ├── train.py                     # Offline training entrypoint
│   ├── phishing.csv                 # URL phishing dataset
│   ├── models/
│   │   ├── model_a.onnx             # Extension model (Tier 1+2 features, bundled in extension)
│   │   ├── model_b.pkl              # Server URL model
│   │   ├── email_rf_model.pkl       # Server email model bundle
│   │   ├── email_rf_model.onnx      # Email RF ONNX export
│   │   └── outputs/                 # Confusion matrices, ROC curves, feature importance plots
│   └── notebooks/
│       ├── evaluate_url.ipynb
│       ├── phishing-email-detection.ipynb
│       ├── phishing_url.csv
│       └── phishing_email.csv
│
├── backend/
│   ├── main.py
│   ├── pyproject.toml
│   ├── .env
│   ├── models/
│   │   ├── model_b.pkl              # URL RF model, loaded by URL analyzer
│   │   └── email_rf_model.pkl       # Email RF model bundle, loaded by email analyzer
│   ├── api/
│   │   ├── routes/
│   │   │   ├── auth.py              # POST /auth/register, POST /auth/login, GET /auth/me
│   │   │   ├── analyze.py           # POST /analyze/url, /analyze/email, /analyze/visual
│   │   │   └── history.py           # GET /history (user-scoped)
│   │   ├── schemas.py               # Pydantic models
│   │   └── dependencies.py          # get_current_user dependency
│   ├── detection/
│   │   ├── pipeline.py              # Layer orchestrator
│   │   ├── url_layer.py             # URL layer aggregator
│   │   ├── nlp_layer.py             # Shared NLP analyzer
│   │   ├── url_analyzer/
│   │   │   ├── base.py
│   │   │   ├── rf_model.py          # URL RF model task
│   │   │   ├── google_safe_browsing.py
│   │   │   ├── urlhaus_lookup.py
│   │   │   ├── whois.py
│   │   │   ├── tier3_features.py
│   │   │   └── url_risk_heuristics.py
│   │   └── email_analyzer/
│   │       ├── rf_model.py          # Email RF task
│   │       └── header_analyzer.py   # SPF/DKIM/DMARC + metadata rules
│   └── database/
│       ├── database.py
│       └── models.py                # User, Scan, Feedback
│
├── frontend/
│   └── src/
│       ├── api/client.ts
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
│
└── extension/
    ├── manifest.json
    ├── models/
    │   └── model_a.onnx             # Bundled Model A — loaded by service worker at runtime
    └── src/
        ├── background/service-worker.ts
        ├── content/warning-banner.ts
        └── popup/
            ├── Popup.tsx
            └── Login.tsx
```

---

## 2. User Model & Authentication

### Who is a User

A user is anyone who registers for PhishShield via the web dashboard. Every scan, piece of history, and feedback entry is linked to a user. The extension authenticates as the same user by storing their JWT token in `chrome.storage.local` after they enter it once in the extension popup.

There is one role in the MVP: **standard user**. All users have identical permissions — register, log in, submit scans, view their own history, report false positives. There is no admin role in the MVP.

### User Data Model

The `users` table holds everything needed for authentication and identification:

- `id` — UUID, primary key, generated on registration
- `email` — unique, used as the login identifier
- `hashed_password` — bcrypt hash of the password, never the plaintext
- `full_name` — display name shown in the dashboard header
- `created_at` — registration timestamp
- `is_active` — boolean, defaults to true, reserved for future account suspension

The `scans` table has a `user_id` foreign key pointing to `users.id`. Every scan is owned by a user. The history endpoint filters by the authenticated user's ID so users only ever see their own scans.

The `feedback` table similarly has a `user_id` column so false positive reports are traceable.

### Authentication Strategy — JWT (JSON Web Tokens)

JWT is stateless (no session table needed), works identically for both the dashboard and the extension, and is the standard FastAPI auth pattern.

**Flow end to end:**

1. User registers with email, full name, and password. Backend hashes the password with bcrypt, stores the user row, returns success (no token yet).
2. User logs in with email and password. Backend verifies credentials, generates a JWT signed with a secret key from `.env`. Payload contains `user_id` and `exp` (7-day expiry). Returns the token.
3. Every protected request includes `Authorization: Bearer <token>` in the header.
4. A FastAPI dependency `get_current_user` runs on every protected route — extracts the token, verifies signature and expiry, decodes `user_id`, fetches the user from DB, returns the user object. Invalid or expired tokens raise 401.
5. Route handlers receive `current_user` and use `current_user.id` to scope all queries.

**Token storage:**
- Dashboard: JWT stored in `localStorage` under `phishshield_token`. Axios request interceptor injects it automatically on every request.
- Extension: JWT stored in `chrome.storage.local` under `auth_token`. Service worker reads it before every API call. Popup shows a "Connect Account" screen on first use where the user pastes their token from the dashboard.

**Auth libraries:** `python-jose[cryptography]` for JWT, `passlib[bcrypt]` for hashing, `python-multipart` for OAuth2 form login.

### Auth Endpoints

`POST /auth/register` — accepts email, full_name, password. Validates email uniqueness. Hashes password. Returns user id and email.

`POST /auth/login` — accepts email and password as form data. Verifies credentials. Returns `{"access_token": "<jwt>", "token_type": "bearer"}`.

`GET /auth/me` — protected. Returns current user's profile. Called by the dashboard on load to validate the stored token.

### What Requires Authentication

Every route except `/health`, `/auth/register`, and `/auth/login` requires a valid JWT. Unauthenticated requests receive 401 `{"detail": "Not authenticated"}`.

---

## 3. ML Model Design — Multi-Model Random Forest Architecture

This is the core research contribution of the project. Rather than a single classifier for every input type, PhishShield uses task-specific models whose feature spaces match the data they receive at runtime.

v4 uses three Random Forest artifacts:

- **Model A — Extension URL Model**: ONNX model for local browser inference on URL features.
- **Model B — Backend URL Model**: pickle model for server-side URL analysis with Tier 3 infrastructure features.
- **Email RF Model**: pickle model bundle trained on email-message features matching `EmailRequest`.

The important v4 correction is that email sender addresses are no longer analyzed by the URL RF model. URL models classify URLs; email models classify email messages.

### URL Dataset

Source: `phishing.csv` — 11,054 labeled URL samples. Target column `class` uses `1` for phishing and `-1` for legitimate. Before training, remap to `1` = phishing, `0` = legitimate to make sklearn probability outputs intuitive. Class distribution: 6,157 phishing (55.7%), 4,897 legitimate (44.3%) — mildly imbalanced but not severe enough to require resampling.

### Email Dataset

Source: `ml/notebooks/phishing_email.csv` — labeled email samples with `text_combined` and `label`.

The training notebook derives backend-shaped inputs from the dataset:

```
subject: first 120 characters of text_combined
body: full text_combined
sender: synthetic/default sender when unavailable in source data
raw_headers: empty string when unavailable in source data
```

At runtime, the backend receives the real schema values:

```
class EmailRequest(BaseModel):
    subject: str
    body: str
    sender: EmailStr
    raw_headers: Optional[str] = None
```

The Email RF model extracts deterministic numeric features from these fields: text length, word counts, unique word ratio, uppercase/digit/punctuation ratios, URL/email counts, phishing-term counts, money/brand keyword counts, HTML markers, sender-domain features, SPF/DKIM/DMARC failure flags, and Reply-To/Return-Path mismatch flags.

### Feature Selection Rationale

Features are selected based on two axes: statistical predictive power (from Pearson correlation and Random Forest importance ranking on the full dataset) and deployment feasibility (whether the feature can be extracted in a given environment without violating latency or privacy constraints). This produces three tiers.

**Tier 1 — Lexical URL Features (instant, zero-network, client-safe)**

These are extracted from the URL string alone using regex or string operations. Sub-millisecond computation. Safe to run in a browser extension without any network request.

- `UsingIP`: Raw IPv4 address in place of a domain name. Phishers use IPs to avoid domain registration trails. RF importance: 1.3%.
- `LongURL`: URL length exceeding a threshold. Phishing URLs are often padded with encoded parameters to obfuscate the real destination. RF importance: moderate.
- `ShortURL`: Presence of a URL shortener service (bit.ly, tinyurl, etc.). Shorteners hide the real destination domain entirely.
- `Symbol@`: The `@` symbol in a URL causes browsers to treat everything before it as credentials, redirecting to what follows. `http://paypal.com@evil.com` navigates to `evil.com`.
- `PrefixSuffix-`: Hyphen present in the domain name. Legitimate brands almost never hyphenate their primary domain. RF importance: 3.5%.
- `SubDomains`: Count of subdomain levels. Phishers stack subdomains to bury the real registered domain. RF importance: 6.3%.

**Tier 2 — DOM / Page Content Features (requires page render, fast)**

These require reading the loaded page's HTML structure. Available to a browser extension content script after page load. Available to the backend if it fetches the URL's HTML.

- `HTTPS`: Whether the site uses HTTPS with a valid certificate. Strongest single predictor. Correlation: 0.71, RF importance: 34.2%. Note: HTTPS alone no longer guarantees safety — phishing sites increasingly obtain free certificates — but the combination of HTTPS status with other features remains highly predictive.
- `AnchorURL`: Percentage of `<a>` tags that are blank, dead (`javascript:void(0)`), or point to a completely different domain. Cloned phishing pages break internal navigation. RF importance: 23.8%.
- `LinksInScriptTags`: Proportion of script and link tags loading resources from external domains. Attackers hotlink assets from the real brand's servers to pass visual inspection.
- `RequestURL`: Percentage of embedded objects (images, iframes) loaded from a domain other than the page's own. Complements `LinksInScriptTags`.
- `ServerFormHandler`: The `action` attribute of HTML `<form>` elements. Blank, `about:blank`, or an unrelated external domain indicates credential theft infrastructure. RF importance: 2.0%.

**Tier 3 — Network / Infrastructure Features (require external API calls, server-only)**

These require querying external databases. Introducing them into the browser extension would mean sending every URL the user visits to a third-party server — a significant privacy violation and source of latency. Restricted to server-side use only.

- `WebsiteTraffic`: Global traffic rank proxy. New phishing domains have near-zero traffic rank. RF importance: 7.5%.
- `AgeofDomain`: Domain registration age from WHOIS. Phishing campaigns use freshly registered domains. RF importance: 1.6%.
- `DomainRegLen`: Registration period length. Throwaway domains are registered for the minimum duration (1 year).
- `GoogleIndex`: Whether the domain appears in Google's index. Brand-new phishing domains are never indexed.
- `DNSRecording`: Whether the domain has a valid, stable DNS record. Some throwaway domains have misconfigured DNS.

### Model A — Extension Model

**Features**: All 11 Tier 1 + Tier 2 features listed above.

**Purpose**: Runs entirely inside the browser extension. Bundled as an ONNX file and loaded by the service worker at runtime using the `onnxruntime-web` library. Zero network calls. Zero privacy exposure. Inference completes in under 5ms.

**Training**: `RandomForestClassifier` with `n_estimators=100`, `random_state=42`. Train on the 11 selected features. Export with `skl2onnx`.

**Expected performance**: ~88–92% F1 on test set. Slightly lower than Model B due to absence of network features, but the gap is the research finding — it quantifies the privacy-accuracy tradeoff.

**Deployment**: Exported to `ml/models/model_a.onnx`. Copied into `extension/models/model_a.onnx` at build time. Loaded in the service worker using `onnxruntime-web`. The extension never needs to call the backend for the initial URL classification — only for NLP (Layer 2) and visual (Layer 4) analysis.

### Model B — Server Model

**Features**: All 13 features — the 11 from Model A plus `WebsiteTraffic`, `AgeofDomain`, `DomainRegLen`, `GoogleIndex`, `DNSRecording`.

**Purpose**: Runs on the FastAPI backend for URL scans only. Has full access to WHOIS, traffic rank proxies, DNS checks, Google Safe Browsing, URLhaus, and URL-specific heuristic calibration.

**Training**: Same `RandomForestClassifier` config. Saved as a joblib pickle.

**Expected performance**: ~95–97% F1 on test set. The Tier 3 features — especially `WebsiteTraffic` and `AgeofDomain` — push accuracy meaningfully higher.

**Deployment**: Saved to `ml/models/model_b.pkl`. Copied to `backend/models/model_b.pkl`. Loaded once at FastAPI startup via a global model instance. Inference is synchronous and fast (~1ms per prediction).

### Email RF Model — Server Email Model

**Features**: Numeric features extracted from `subject`, `body`, `sender`, and optional `raw_headers`.

**Purpose**: Runs on the FastAPI backend for email scans. It captures message-level statistical and security-header patterns that the URL model cannot represent.

**Training**: `RandomForestClassifier` trained in `ml/notebooks/phishing-email-detection.ipynb` with a backend-shaped input contract. The notebook reports accuracy, precision, recall, F1, ROC-AUC, confusion matrix, ROC curve, and feature importance.

**Observed evaluation from current run**:

- Accuracy: 0.8761
- Precision: 0.8968
- Recall: 0.8608
- F1: 0.8784
- ROC-AUC: 0.9474

**Deployment**: Exported to `ml/models/email_rf_model.pkl` and `ml/models/email_rf_model.onnx`. The backend loads `backend/models/email_rf_model.pkl` in `detection/email_analyzer/rf_model.py`. The pickle bundle stores the trained model plus the feature contract. Runtime inference returns a phishing probability and calibrated reasons.

**Calibration**: The backend wraps the raw RF probability with conservative production calibration. Strong signals such as phishing terms plus links, multiple authentication failures, or sender-domain mismatch preserve or boost the score. Clean authenticated emails with no phishing indicators are capped low to reduce false positives.

### Why Random Forest for a Masters Project

Random Forest is the correct choice here for reasons that go beyond "it's easy to implement":

- **Handles mixed binary and continuous features** — the dataset mixes binary flags (-1/1) and continuous ratios without needing normalization
- **Natively produces probability scores** via `predict_proba`, not just binary labels — this lets you feed a continuous confidence score into the ensemble rather than a hard 0/1
- **Feature importances are built-in** — the `feature_importances_` attribute produces the chart you've already seen, which goes directly into the report's methodology section
- **Robust to the -1/0/1 encoding** — no preprocessing required for the existing dataset encoding
- **Small serialized size** — a 100-tree RF on 11 features serializes to ~200KB in ONNX format, easily bundled in an extension
- **Interpretable** — examiners can ask "why did this score high?" and you can point to feature importances. You cannot do this with a neural network.

### The Research Narrative

The v4 architecture enables two research comparisons:

1. **Privacy-accuracy tradeoff for URL detection**: Model A runs locally with client-safe features, while Model B runs server-side with richer reputation and infrastructure signals.
2. **Task-specific modeling for phishing detection**: URL RF and Email RF use separate feature contracts instead of forcing email addresses through a URL classifier.

---

## 4. Week 0 — Model Training (Offline, Pre-Development)

This happens **before Week 1**, in parallel with environment setup. It is a one-time offline task. The trained model files become build artifacts that the backend and extension consume.

### 4.1 Data Preparation

Load `phishing.csv`. Remap the `class` column: replace `-1` with `0` (legitimate becomes 0, phishing stays 1). Drop the `Index` column — it is a row counter, not a feature. Verify no null values (the dataset is clean). Split into train (80%) and test (20%) with `random_state=42` for reproducibility. Stratify the split on the target column to preserve the class ratio in both sets.

### 4.2 Feature Sets

Define two feature lists explicitly in the training script:

```
FEATURES_MODEL_A = [
    'UsingIP', 'LongURL', 'ShortURL', 'Symbol@',
    'PrefixSuffix-', 'SubDomains', 'HTTPS',
    'AnchorURL', 'LinksInScriptTags', 'RequestURL', 'ServerFormHandler'
]

FEATURES_MODEL_B = FEATURES_MODEL_A + [
    'WebsiteTraffic', 'AgeofDomain', 'DomainRegLen',
    'GoogleIndex', 'DNSRecording'
]
```

### 4.3 Training

Train both models with identical hyperparameters for a fair comparison: `RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1)`. Fit Model A on `X_train[FEATURES_MODEL_A]`. Fit Model B on `X_train[FEATURES_MODEL_B]`.

### 4.4 Evaluation

Evaluate both on their respective test feature subsets. Record and store for the report:

- Accuracy, Precision, Recall, F1 Score
- Confusion matrix (plot with matplotlib/seaborn)
- Feature importance bar chart for each model
- ROC-AUC curve for both models on the same plot — this is the cleanest visual for showing the accuracy gap between Model A and Model B

This evaluation output is a direct section of your report's results chapter. Run it, save the plots as PNGs, and keep them.

### 4.5 Export

Export Model A to ONNX using `skl2onnx`. The input shape must match the 11 Tier 1+2 features exactly. Verify the ONNX model produces identical predictions to the sklearn model on 10 test samples before proceeding.

Save Model B as a joblib pickle.

Train the Email RF model in `ml/notebooks/phishing-email-detection.ipynb`. Export:

- `ml/models/email_rf_model.pkl`
- `ml/models/email_rf_model.onnx`
- `ml/models/email_feature_contract.json`

Copy runtime files to destination directories:

- `extension/models/model_a.onnx`
- `backend/models/model_b.pkl`
- `backend/models/email_rf_model.pkl`

### 4.6 Feature Extraction Contract

The most critical engineering decision from training is establishing a strict **feature extraction contract** — the exact order, encoding, and computation method for each feature must be identical between the training dataset and the runtime feature extractors. Document this explicitly:

| Feature | Encoding in dataset | Runtime extraction method |
|---|---|---|
| `UsingIP` | 1 if IP, -1 if domain | Regex match on URL netloc |
| `LongURL` | 1 if len > 54, -1 otherwise | `len(url) > 54` |
| `ShortURL` | 1 if shortener detected, -1 otherwise | Match against shortener domain list |
| `Symbol@` | 1 if `@` in URL, -1 otherwise | `'@' in url` |
| `PrefixSuffix-` | -1 if `-` in domain, 1 otherwise | `'-' in domain` |
| `SubDomains` | 1=1 subdomain, 0=2, -1=3+ | Count dots in domain minus 1 |
| `HTTPS` | 1 if HTTPS+valid cert, -1 otherwise | `url.startswith('https')` |
| `AnchorURL` | 1/>66% safe, 0/33–66%, -1/<33% | DOM: count external/blank anchors |
| `LinksInScriptTags` | same 1/0/-1 thresholds | DOM: count external script/link tags |
| `RequestURL` | same 1/0/-1 thresholds | DOM: count external resource URLs |
| `ServerFormHandler` | 1=safe, 0=suspicious, -1=external | DOM: check `form.action` attribute |

Any mismatch between how a feature was encoded during training and how it is computed at runtime causes silent model degradation — the model is making predictions on a different feature space than it was trained on. This contract must be version-controlled alongside the model file.

### 4.7 Email Feature Extraction Contract

The Email RF model takes a fixed numeric vector in this order:

```
subject_len, body_len, total_len, word_count, unique_word_ratio,
uppercase_ratio, digit_ratio, punctuation_count, exclamation_count,
question_count, url_count, email_count, suspicious_word_count,
money_word_count, brand_word_count, has_html, sender_domain_len,
sender_is_free_mail, spf_fail, dkim_fail, dmarc_fail,
auth_missing, reply_to_mismatch, return_path_mismatch
```

The backend implementation lives in `backend/detection/email_analyzer/rf_model.py`. The notebook and backend extractor must remain synchronized. If the feature list changes, regenerate `email_rf_model.pkl`, `email_rf_model.onnx`, and `email_feature_contract.json`.

---

## 5. Week 1 — Backend Foundation + Auth

Goal by end of week: a user can register, log in, submit a URL, and get a real score back from the full Layer 1 pipeline. All routes are authenticated.

### 5.1 Project Setup

Initialize the FastAPI app with CORS middleware allowing both `localhost:5173` and `chrome-extension://*`. Register all routers. Add `/health` endpoint. Run with Uvicorn in reload mode.

CORS must explicitly whitelist `chrome-extension://*` — without this, the extension silently fails on every API call.

Load `model_b.pkl` once at application startup into a global variable. Do not reload it per-request — joblib deserialization is slow and the model is immutable.

### 5.2 Pydantic Schemas

- `UserCreate` — email, full_name, password (min length 8)
- `UserResponse` — id, email, full_name, created_at (never expose hashed_password)
- `TokenResponse` — access_token, token_type
- `URLRequest` — plain string (not HttpUrl — phishing URLs fail URL validation)
- `EmailRequest` — subject, body, sender, optional raw_headers string
- `LayerResult` — name, score (float 0–1), reasons (list[str]), weight (float), optional sub_checks (list[LayerResult])
- `AnalysisResponse` — scan_id (UUID), risk_score (int 0–100), verdict (Verdict enum), top_reasons (list[str]), layers_list (list[LayerResult]), timestamp
- `Verdict` — string enum: Clean / Suspicious / Phishing

### 5.3 Database

Three tables. Use SQLAlchemy sync engine. `metadata.create_all()` on startup. Neon requires `?sslmode=require`.

**users**: id (UUID PK), email (unique, indexed), hashed_password, full_name, created_at, is_active.

**scans**: id (UUID PK), user_id (FK → users.id, indexed), scan_type (ScanType enum), input_value (Text), risk_score (Integer), verdict (Verdict enum), top_reasons (JSON), layers_list (JSON), visual_score (Float, nullable), visual_reasons (JSON, nullable), visual_analyzed_at (DateTime, nullable), timestamp.

**feedback**: id (UUID PK), scan_id (FK → scans.id), user_id (FK → users.id), user_verdict (false_positive / false_negative), note (Text, nullable), created_at.

**ScanType enum** (four values): `url`, `email_text`, `email_file`, `extension_url`.

The three `visual_*` columns on `scans` are nullable — populated by the async Phase 2 patch from the extension. For `url`, `email_text`, and `email_file` scan types, they remain null.

### 5.4 Auth Implementation

Implement register and login routes, JWT utility functions (create_token, decode_token), and the `get_current_user` dependency. Apply the dependency to all analyze and history routes. Test using FastAPI's `/docs` UI — it renders an Authorize button that accepts a Bearer token, enabling manual route testing without a frontend.

### 5.5 URL Analyzer — URL RF Model + Reputation APIs

The URL analyzer is a combination of the trained URL Random Forest model and external reputation APIs. The RF model handles structural URL features; the APIs handle real-time reputation signals. Together they form a more robust signal than either alone.

**Sub-check 1: RF Model B (weight 40%)**

Load `model_b.pkl` at startup. At inference time, extract the 13 features from the URL and (if available) the fetched page HTML. Call `model.predict_proba(feature_vector)` and select the probability for the phishing class using `model.classes_` rather than assuming a fixed column index. This prevents class-order mistakes in serialized sklearn artifacts.

Feature extraction follows the contract defined in Section 4.6. For Tier 3 features that require external calls (WebsiteTraffic, AgeofDomain, etc.), these run as async tasks and their results are folded into the feature vector before calling the model. If a Tier 3 feature is unavailable (API timeout), substitute the training dataset's median value for that feature — never leave the vector incomplete.

The reason string from this sub-check is generated from the top 3 features by importance that pushed the score above 0.5: "Model flagged: suspicious subdomain depth, no HTTPS, domain registered 3 days ago."

**Sub-check 2: Google Safe Browsing API (weight 30%)**

POST the URL to Google's v4 `threatMatches:find` endpoint with threat types MALWARE, SOCIAL_ENGINEERING, UNWANTED_SOFTWARE. Match → score 1.0 with threat type as reason. No match → score 0.0. Fail open on timeout.

**Sub-check 3: URLhaus Lookup (weight 15%)**

POST to abuse.ch URLhaus API. `is_listed` → score 1.0. No auth required. Fail open.

**Sub-check 4: WHOIS Domain Age (weight 15%)**

Query WHOIS for domain creation date. Under 7 days → 1.0, 7–30 days → 0.7, 30–90 days → 0.3, over 90 days → 0.0. Failure → 0.2.

Final URL layer score: weighted average of all four sub-checks, capped at 1.0. If Safe Browsing or URLhaus returns a confirmed hit (1.0), the layer score is immediately set to 1.0 regardless of the RF model — a known-bad reputation signal overrides the structural classifier. The response includes sub-check breakdowns for RF, Google Safe Browsing, URLhaus, and WHOIS age.

### 5.6 Email RF Analyzer

The email RF analyzer is new in v4 and replaces the previous incorrect use of `analyze_url(request.sender)`.

**Why the change was necessary**: `request.sender` is an email address. The URL RF model was trained on URL/domain/page features, so passing an email address into that model was not a valid metric. It could produce noisy scores and misleading explanations.

**Runtime task**: `backend/detection/email_analyzer/rf_model.py`

**Model artifact**: `backend/models/email_rf_model.pkl`

**Input**: full `EmailRequest` object:

```
subject: str
body: str
sender: EmailStr
raw_headers: Optional[str]
```

**Output**: `(score: float, reasons: list[str])`

**Reason examples**:

- "Email contains multiple phishing-related terms"
- "Email body contains links"
- "DMARC-related header feature indicates failure or absence"
- "Reply-To domain differs from sender domain"

**Calibration**: clean authenticated emails are capped low when they have no phishing indicators; strong phishing signals preserve or raise the model score.

### 5.7 Routes

`POST /analyze/url` and `POST /analyze/email` — protected, call pipeline, persist scan with `current_user.id`, return `AnalysisResponse`.

`POST /analyze/email/upload` — accepts `.eml` file upload, parses with Python's `email` library, delegates to email pipeline.

`POST /analyze/visual` — protected, accepts base64 screenshot + URL, runs Layer 4, patches the existing scan row's `visual_*` columns, returns updated `LayerResult`.

`GET /history` — protected, filtered to `current_user.id`, paginated.

---

## 6. Week 2 — AI Detection Pipeline

Goal by end of week: all four layers working and returning scores with reasons. Preliminary accuracy measured on 200-URL test set.

### 6.1 Layer 2 — NLP Analyzer (GPT-4o-mini)

Sends text content to GPT-4o-mini via Chat Completions API, receives structured JSON classification.

**Input**: Email subject + body (first 2000 chars). For URL-only scans, the URL string itself — path words and brand names in subdomains carry semantic signal.

**Prompt engineering**: System prompt specifies JSON-only output, scoring rubric for each dimension (what 0, 5, 10 mean), counter-examples to prevent false positives on transactional emails, exact JSON keys and types. `temperature: 0.1` for reproducibility. `response_format: {"type": "json_object"}` to guarantee parseable output.

**Dimensions scored 0–10, normalized to 0–1:**
- *urgency* — fear-based pressure to act immediately
- *impersonation* — degree of pretending to be a known organization
- *credential_harvesting* — directness of request for passwords, PINs, OTPs
- *social_engineering* — manipulation beyond urgency: guilt, false authority, fake prizes, BEC

**Dimension weights**: credential_harvesting 35%, impersonation 30%, urgency 20%, social_engineering 15%.

**Failure handling**: return score 0.3, reason "NLP analysis unavailable". Never crash the pipeline.

**Cost**: ~$0.000075 per scan at gpt-4o-mini pricing.

### 6.2 Email RF Layer

Email-only Random Forest classifier. Runs concurrently with NLP and, when available, header analysis.

**Input**: `EmailRequest` fields directly: subject, body, sender, raw_headers.

**Model**: `backend/models/email_rf_model.pkl`, trained from `ml/notebooks/phishing-email-detection.ipynb`.

**Feature families**:

- Text statistics: subject/body length, word count, unique word ratio
- Style signals: uppercase ratio, digit ratio, punctuation/exclamation/question counts
- Content signals: URL count, email address count, suspicious words, money words, brand words, HTML markers
- Sender/header signals: sender domain length, free-mail domain flag, SPF/DKIM/DMARC flags, Reply-To mismatch, Return-Path mismatch

**Failure handling**: if the model artifact is unavailable, return neutral `(0.0, [])` so the email scan can still proceed through NLP and headers.

### 6.3 Header Analyzer

Email-only. Deterministic string parsing of `Authentication-Results`, `From`, `Reply-To`, `Return-Path`, and related authentication domains. No external calls.

**SPF**: `fail` → 0.7, `softfail` → 0.4, `pass` → 0.0.

**DKIM**: `fail` → 0.7.

**DMARC**: `fail` → 0.8. Strongest signal — requires alignment of From domain with SPF or DKIM.

**Display name spoofing**: If the display name contains a known brand but the envelope address domain does not match that brand, score 0.85. Catches "PayPal Security \<attacker@gmail.com\>".

Final layer score combines triggered checks probabilistically so multiple medium-strength failures compound into a high header risk.

### 6.4 Layer 4 — Visual Analyzer (GPT-4o Vision)

Analyzes a screenshot of the loaded page to detect visual brand impersonation.

**Screenshot capture**: `chrome.tabs.captureVisibleTab()` in the extension service worker. Built-in Chrome API, no Playwright. Returns base64 JPEG.

**Backend endpoint** `POST /analyze/visual`: receives base64 image + URL, sends to GPT-4o Vision (full model, not mini — vision requires it), returns `LayerResult`, patches `visual_*` columns on the existing scan row.

**Visual dimensions scored 0–10:**
- *login_form_present* — visible credential input fields on the page
- *brand_impersonation* — visual imitation of a known brand (logos, colors, layout)
- *trust_signal_abuse* — padlock icons, official seals, security badges used to manufacture false legitimacy
- *url_visual_mismatch* — visual design suggests a brand the URL does not belong to (most powerful signal)

**Dimension weights**: url_visual_mismatch 40%, brand_impersonation 30%, login_form_present 20%, trust_signal_abuse 10%.

**Timing**: Visual layer runs asynchronously after the initial Phase 1 response. Does not block the user from seeing initial results.

**Cost**: ~$0.002 per image. 100 evaluation scans ≈ $0.20.

**Failure handling**: omit from ensemble if unavailable. Never block on this layer.

### 6.5 Ensemble Scorer

Combines all four layer scores. Layers inapplicable to the current scan type are excluded and their weights redistributed proportionally.

| Layer | Weight | Applies to |
|---|---|---|
| URL RF + Reputation | 30% | URL scans only |
| Email RF Model | 30% | Email scans only |
| NLP | 35% | URL and email scans |
| Headers | 20% | Email scans when raw headers are provided |
| Layer 4 — Visual | 15% | extension_url only (when screenshot available) |

**Verdict thresholds**: ≥ 70 → phishing, 40–69 → suspicious, < 40 → clean.

**Reason aggregation**: collect all reasons from all layers, rank by layer score, return top 3.

### 6.6 Pipeline Orchestrator

URL scans:

```
asyncio.gather(
    analyze_url(request.url),
    analyze_nlp(request.url),
)
```

Email scans:

```
asyncio.gather(
    analyze_email_rf(request),
    analyze_nlp(subject + body),
    _run_headers(raw_headers, sender)  # only when raw_headers is provided
)
```

Visual analysis always runs as a separate async follow-up, never blocking the initial response.

Expected latency for initial response: 2–4 seconds. Visual follow-up: additional 3–6 seconds.

### 6.7 Preliminary Evaluation

At end of Week 2: test URL detection against 100 PhishTank URLs + 100 Tranco legitimate URLs, and test email detection against a held-out split of `phishing_email.csv`. Compute accuracy, precision, recall, F1, ROC-AUC, and confusion matrices. Visual analysis is added in Week 4.

---

## 7. Week 3 — React Dashboard

Goal: a non-technical user can register, log in, scan a URL or email, and read a clear result with per-layer explanations.

### Setup

Vite React-TS. Tailwind CSS. Axios. TanStack React Query. React Router.

### Auth Context (`context/AuthContext.tsx`)

Holds current user and token state. On mount, reads JWT from `localStorage`, calls `GET /auth/me` to validate. On failure, clears storage and redirects to login. Exposes `login(token)`, `logout()`, `currentUser`.

### Axios Client (`api/client.ts`)

Single instance, base URL from `VITE_API_URL`. Request interceptor injects `Authorization: Bearer <token>`. Response interceptor catches 401 and triggers logout. Timeout: 20 seconds.

### Page: Login (`/login`)

Email and password fields. Calls `POST /auth/login`, stores token via auth context, redirects to `/`. Accessible without a token.

### Page: Register (`/register`)

Full name, email, password, confirm password. Client-side validation: matching passwords, 8-char minimum, valid email format. Calls register then immediately logs in, redirects to `/`.

### Protected Route Component

Checks `AuthContext` for a current user. Redirects to `/login` if none. Wraps all authenticated pages.

### Page: Analyzer (`/`)

**Input area**: tab switcher — "Check URL" / "Analyze Email". URL tab: text input + button. Email tab: Subject, Sender, Body textarea, collapsible headers textarea. Loading state with spinner while awaiting response (note that analysis takes a few seconds).

**Results area**:
- Score gauge: SVG arc, green < 40, yellow 40–70, red > 70
- Verdict badge: colored pill with icon
- Reason cards: one per top reason, tagged with layer source (URL+RF / Email RF / NLP / Headers / Visual)
- Layer breakdown: expandable accordion, each layer's individual score and reasons
- Visual analysis panel: URL scans only — renders after async Phase 2 result arrives. Shows screenshot thumbnail, visual score, and visual reasons.
- False positive button: "Report incorrect result" — POSTs scan_id and user verdict to `/feedback`.

### Page: History (`/history`)

Stats bar: total scans, phishing blocked, suspicious, clean. Paginated table: type icon, input (truncated), risk score (colored), verdict badge, timestamp. Row expansion shows full layer breakdown. Filter bar: by verdict, by scan type.

---

## 8. Week 4 — Browser Extension & Evaluation

Goal: extension warns in real time on a PhishTank URL using the local ONNX model, visual analysis fires after page load, full evaluation complete.

### 8.1 Extension Setup

Vite React-TS. CRXJS Vite plugin for MV3 bundling. Copy `model_a.onnx` into `extension/models/`. Install `onnxruntime-web` for in-extension ONNX inference.

Permissions in manifest: `storage`, `activeTab`, `scripting`, `tabs`. Host permissions: `<all_urls>`. `activeTab` is required for `captureVisibleTab()`.

### 8.2 Authentication in the Extension

Popup shows a "Connect Account" screen on first use. User pastes JWT from the dashboard. Stored in `chrome.storage.local` under `auth_token`. Logout button clears storage and shows the connect screen again.

### 8.3 Service Worker — Phase 1 (Local Model A + Backend Layers 2)

On every `chrome.tabs.onUpdated` completion for an HTTP URL:

1. Read auth token from `chrome.storage.local`. If none, skip.
2. Load `model_a.onnx` using `onnxruntime-web`. Extract the 11 Tier 1+2 features from the URL string. Run inference locally. Get phishing probability score.
3. Concurrently POST to `POST /analyze/url` for Layers 2 (NLP) and reputation API checks.
4. Merge local Model A score with backend response into combined result.
5. Store result in `chrome.storage.local` keyed by tab ID.
6. Set badge: score number, green/yellow/red by verdict.
7. If suspicious or phishing: inject warning banner via `chrome.scripting.executeScript`.

Note: For features requiring DOM access (`AnchorURL`, `LinksInScriptTags`, `RequestURL`, `ServerFormHandler`), the content script extracts them from the rendered page and passes them to the service worker via `chrome.runtime.sendMessage` before the model runs. The service worker waits for this message with a 2-second timeout — if it doesn't arrive, substitute neutral values (0) for those features.

### 8.4 Service Worker — Phase 2 (Visual Analysis)

After Phase 1, if verdict is suspicious or above:

1. Capture screenshot: `chrome.tabs.captureVisibleTab(null, { format: "jpeg", quality: 60 })`.
2. POST base64 image + URL to `POST /analyze/visual` with Bearer token.
3. Merge visual result with stored Phase 1 result. Recompute ensemble score.
4. Update `chrome.storage.local` with merged result.
5. Send message to popup via `chrome.runtime.sendMessage` to re-render.
6. If verdict upgraded (suspicious → phishing), replace warning banner with upgraded version.

### 8.5 Warning Banner

Fixed-position div, z-index 2147483647. Red for phishing, amber for suspicious. Displays risk score, verdict, first reason. Dismiss button. Duplicate prevention check. Phase 2 upgrade removes Phase 1 banner and injects a new one.

### 8.6 Popup

Three states: connect screen (no token), loading, result. Shows score, verdict, reasons. "Checking visual similarity..." indicator while Phase 2 is pending. Updates in place when Phase 2 arrives via `chrome.runtime.onMessage`. Link to full dashboard.

### 8.7 Formal Evaluation

**Dataset**: 100 phishing URLs from PhishTank + 100 legitimate URLs from Tranco Top 1M (entries 500–600).

**Metrics**: Precision, Recall, F1 Score per configuration.

**Ablation study — six configurations:**

| Configuration | Features used | Environment | Precision | Recall | F1 |
|---|---|---|---|---|---|
| Model A only (Tier 1+2) | 11 features | Extension (local) | measured | measured | measured |
| Model B only (all features) | 13 features | Server | measured | measured | measured |
| NLP layer only | GPT-4o-mini | Server | measured | measured | measured |
| Visual layer only | GPT-4o Vision | Extension+Server | measured | measured | measured |
| URL layers without visual | URL RF + reputation + NLP | Server | measured | measured | measured |
| Email layers | Email RF + NLP + Headers | Server | measured | measured | measured |
| Full ensemble (all layers) | All | Both | measured | measured | measured |

The Model A vs Model B row directly quantifies the privacy-accuracy tradeoff. The full ensemble row is the headline result. Both are primary findings for the report.

---

## 9. Dependencies & API Keys

### ML Training (`ml/pyproject.toml`)

| Package | Purpose |
|---|---|
| `scikit-learn` | RandomForestClassifier training and evaluation |
| `skl2onnx` | Export sklearn model to ONNX format |
| `pandas` | Dataset loading and feature engineering |
| `numpy` | Numerical operations |
| `matplotlib` / `seaborn` | Evaluation plots (confusion matrix, ROC, feature importance) |
| `joblib` | Save/load URL and email RF pickle artifacts |

### Backend (`backend/pyproject.toml`)

| Package | Purpose |
|---|---|
| `fastapi` | Web framework |
| `uvicorn[standard]` | ASGI server |
| `pydantic` | Request/response validation |
| `sqlalchemy` | ORM |
| `psycopg2-binary` | PostgreSQL driver |
| `python-dotenv` | Load `.env` variables |
| `httpx` | Async HTTP client for external APIs |
| `openai` | OpenAI SDK (NLP + Vision layers) |
| `python-jose[cryptography]` | JWT encoding and decoding |
| `passlib[bcrypt]` | Password hashing |
| `python-whois` | WHOIS domain age lookups |
| `python-multipart` | `.eml` file uploads + OAuth2 form login |
| `python-Levenshtein` | Edit distance for typosquatting |
| `joblib` | Load URL and email RF pickle artifacts |

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
| `onnxruntime-web` | Run Model A ONNX file locally in the service worker |

### API Keys Required

| Service | Where to obtain | Free tier |
|---|---|---|
| Google Safe Browsing API v4 | Google Cloud Console → Enable Safe Browsing API → Create API key | 10,000 requests/day |
| OpenAI API | platform.openai.com → API keys | Pay-as-you-go. NLP ~$0.02 for 200 scans. Vision ~$0.20 for 100 scans. |

URLhaus and python-whois require no keys.

### Environment Variables (`.env`)

```
DATABASE_URL=postgresql://...@neon.tech/phishshield?sslmode=require
OPENAI_API_KEY=sk-...
GOOGLE_SAFE_BROWSING_KEY=AIza...
JWT_SECRET_KEY=<random 32+ character string, generate once, never change>
JWT_ALGORITHM=HS256
JWT_EXPIRY_DAYS=7
```

---

## 10. Deployment

Local deployment is sufficient for the demo. For a persistent live URL:

**Backend → Railway**: Python natively supported, direct Neon integration, free tier. Set all environment variables in Railway dashboard. Copy `model_b.pkl` and `email_rf_model.pkl` into `backend/models/` before pushing — Railway deploys from the repo, so runtime model files must be committed or fetched during build. FastAPI docs at `/docs` serve as API documentation for the report appendix.

**Frontend → Vercel**: Connect GitHub repo, set `VITE_API_URL` to Railway URL. Auto-deploys on push.

**Extension**: After backend deployment, update `API_BASE` in the service worker to the Railway URL. Rebuild with `npm run build`. Reload unpacked in `chrome://extensions`. Unpacked loading is sufficient — Chrome Web Store submission is not required for a university project.
