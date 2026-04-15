# AgenticVR
## Multi-Tenant Agentic IVR Platform
### Product Requirements & Technical Architecture Document

---

**Version:** 1.0  
**Date:** April 2026  
**Status:** CONFIDENTIAL — FOR DEVELOPMENT USE ONLY

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Vision & Goals](#2-product-vision--goals)
3. [System Architecture](#3-system-architecture)
4. [The Gate Engine](#4-the-gate-engine)
5. [Customer Authentication & Access Tiers](#5-customer-authentication--access-tiers)
6. [Conversation Flow Designer](#6-conversation-flow-designer)
7. [Content Studio](#7-content-studio)
8. [Token Management](#8-token-management)
9. [Analytics Suite](#9-analytics-suite)
10. [QA & Supervisor Module](#10-qa--supervisor-module)
11. [Role-Based Access Control](#11-role-based-access-control-rbac)
12. [Data Security & Privacy](#12-data-security--privacy)
13. [Multi-Tenant Model](#13-multi-tenant-model)
14. [Asterisk / IVR Integration (Phase 2)](#14-asterisk--ivr-integration-phase-2)
15. [POC Scope & Deliverables](#15-poc-scope--deliverables)
16. [Development Roadmap](#16-development-roadmap)
17. [Glossary](#17-glossary)
18. [AI Provider Integrations & API Key Management](#18-ai-provider-integrations--api-key-management)

---

## 1. Executive Summary

AgenticVR is a multi-tenant, cloud-native Agentic IVR (Interactive Voice Response) platform designed to automate customer conversations across industries including banking, asset management, insurance, manufacturing, and retail.

The platform is built on the principle that **AI should be the last resort — not the first**. A layered gate engine handles the majority of customer queries through deterministic logic (canned responses, FAQ cache, keyword filtering) before engaging the AI. This dramatically reduces operational cost while maintaining a high-quality, human-feeling customer experience.

AgenticVR is channel-agnostic. The core engine powers web chat, IVR telephony (via Asterisk), and future channels such as WhatsApp and SMS — all from a single platform.

### 1.1 Key Differentiators

- **Multi-tenant SaaS** — one platform, unlimited clients, each fully isolated
- **Gate-first architecture** — AI called only when deterministic logic cannot resolve
- **Visual flow designer** — non-technical staff build and manage conversation flows
- **Bilingual by design** — English and Urdu supported natively throughout
- **Tiered customer authentication** — public, soft-validated, and fully authenticated tiers
- **Sensitive data protection** — card numbers, PINs, and account data never reach external AI APIs
- **Full analytics suite** — business and technical intelligence with QA review workflow
- **Role-based access control** — granular permissions from Super Admin to Viewer

### 1.2 Target Market

| Industry | Primary Use Cases | Key Services |
|---|---|---|
| Banking | Account services, card management | Balance, block card, transfers |
| Asset Management | Fund inquiries, portfolio info | NAV, statements, withdrawals |
| Insurance | Policy info, claims | Premium inquiry, claim status |
| Manufacturing | Orders, delivery, pricing | Order status, bulk pricing |
| Retail | Product info, complaints | Stock, returns, offers |

---

## 2. Product Vision & Goals

> *"Deploy once. Serve any business. Let AI handle the unknown."*

AgenticVR eliminates the need to build custom IVR systems per client. A single platform engine is configured — not re-coded — for each new business. The AI layer provides intelligent fallback handling while the deterministic layer ensures speed, cost efficiency, and predictability.

### 2.1 Core Goals

1. Reduce AI token consumption to under 15% of total conversation turns
2. Enable non-technical staff to build and manage flows without developer involvement
3. Ensure zero sensitive customer data exposure to external AI APIs
4. Support full bilingual conversations in English and Urdu
5. Provide actionable analytics at both business and technical levels
6. Support Asterisk/IVR integration as a future channel with zero core changes

### 2.2 What AgenticVR Is NOT

- Not a replacement for human agents — it is an intelligent routing and self-service layer
- Not a general-purpose chatbot — it is strictly business-context restricted per tenant
- Not an always-on AI — AI is a fallback, not the primary engine

---

## 3. System Architecture

### 3.1 High-Level Architecture

AgenticVR follows a serverless, multi-tenant architecture deployed on Vercel (frontend and API functions) with Upstash Redis for session state, MongoDB Atlas for persistent storage, and an external LLM API (Groq/Claude) for AI fallback.

```
┌──────────────────────────────────────────────────────────────┐
│                       CLIENT CHANNELS                        │
│          Web Chat    │    IVR (Asterisk)    │    WhatsApp     │
└──────────────────────┬───────────────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────────────┐
│               AGENTICVR CORE ENGINE (Serverless)             │
│                                                              │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│   │   Tenant     │  │    Gate      │  │     Token        │  │
│   │  Resolver    │  │   Engine     │  │    Manager       │  │
│   └──────────────┘  └──────────────┘  └──────────────────┘  │
│                                                              │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│   │   Session    │  │   Response   │  │   Analytics      │  │
│   │   Manager    │  │   Resolver   │  │    Logger        │  │
│   └──────────────┘  └──────────────┘  └──────────────────┘  │
└──────────────────────┬───────────────────────────────────────┘
            ┌──────────┼──────────┬─────────────┐
            │          │          │             │
       Upstash      MongoDB    LLM API      Client
       Redis        Atlas      (Groq /      Config
      (Sessions)  (Persistent)  Claude)      (JSON)
```

### 3.2 Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | HTML/CSS/JS → React | Chat UI, admin portal, flow designer |
| API | Node.js Serverless (Vercel) | Business logic, gate engine, routing |
| Session State | Upstash Redis | Conversation state per active session |
| Database | MongoDB Atlas | Conversations, tenants, analytics, QA |
| AI / LLM | Groq (POC) / Claude API | Gate 4 fallback AI responses |
| Hosting | Vercel (Serverless) | Zero-config deploy, auto-scale |
| IVR (Phase 2) | Asterisk + FastAGI | Telephony channel integration |

### 3.3 Folder Structure

```
/agenticvr
├── /api                        ← Serverless API functions
│   ├── chat.js                 ← Main conversation handler
│   ├── session.js              ← Session CRUD
│   ├── tokens.js               ← Token tracking
│   └── analytics.js            ← Analytics endpoints
│
├── /engine                     ← Core logic modules
│   ├── tenantResolver.js       ← Identify and load tenant config
│   ├── gateEngine.js           ← 4-gate decision engine
│   ├── tokenManager.js         ← Budget tracking and enforcement
│   ├── sessionManager.js       ← Redis session state
│   ├── responseResolver.js     ← Canned vs AI response routing
│   └── analyticsLogger.js      ← Log every turn to MongoDB
│
├── /clients                    ← Per-tenant configuration
│   ├── xyz_bank.json
│   ├── abc_asset.json
│   └── nat_cement.json
│
├── /flows                      ← Saved flow definitions (JSON)
│
├── /canned                     ← Pre-recorded/canned responses
│   ├── /common                 ← Shared across tenants
│   └── /xyz_bank               ← Tenant-specific audio files
│
├── /public                     ← Static frontend assets
├── /admin                      ← Admin portal pages
└── vercel.json                 ← Deployment config
```

### 3.4 Tenant Configuration Schema

```json
{
  "client_id": "xyz_bank_01",
  "name": "XYZ Bank",
  "industry": "banking",
  "system_prompt": "You are a helpful assistant for XYZ Bank. Only answer questions related to banking, accounts, cards, loans, and branch information. Politely decline anything else.",
  "allowed_keywords": ["balance", "card", "transfer", "account", "block", "activate", "loan", "branch"],
  "faq": {
    "branch timings": "Our branches are open Monday to Saturday, 9:00 AM to 5:00 PM.",
    "contact": "You can reach us at 0800-XYZ-BANK."
  },
  "canned_responses": {
    "greeting": "Welcome to XYZ Bank! How can I help you today?",
    "out_of_scope": "I can only assist with XYZ Bank related queries.",
    "fallback": "Let me connect you with our team.",
    "goodbye": "Thank you for contacting XYZ Bank. Have a great day!"
  },
  "token_limit_monthly": 500000,
  "token_consumed": 0,
  "max_tokens_per_response": 150,
  "language_default": "en",
  "languages_supported": ["en", "ur"],
  "auth_method": "pin",
  "auth_endpoint": "https://internal.xyzbank.com/api/validate"
}
```

---

## 4. The Gate Engine

The Gate Engine is the central intelligence of AgenticVR. Every incoming customer message passes through four gates in sequence. Each gate attempts to resolve the query at zero or minimal cost. AI is only engaged when all preceding gates fail to resolve.

### 4.1 Gate Decision Flow

```
Incoming Customer Message
        │
        ▼
┌──────────────────────┐
│  GATE 1 — FAQ Cache  │──── HIT ────▶  Canned / cached response   (0 tokens)
└──────────┬───────────┘
           │ MISS
           ▼
┌──────────────────────┐
│ GATE 2 — Keyword     │──── FAIL ───▶  Out-of-scope message        (0 tokens)
│   Topic Filter       │
└──────────┬───────────┘
           │ PASS
           ▼
┌──────────────────────┐
│ GATE 3 — Auth Check  │──── NEEDED ─▶  Trigger PIN / OTP           (0 tokens)
└──────────┬───────────┘
           │ CLEAR
           ▼
┌──────────────────────┐
│  GATE 4 — AI Call    │──── RESULT ─▶  Cache result, deduct tokens (300–500)
└──────────────────────┘
```

### 4.2 Gate Descriptions

#### Gate 1 — FAQ Cache

Checks the incoming message against pre-loaded FAQ key-value pairs for the tenant. If a match is found, the cached answer is returned immediately with zero AI invocation. The cache is populated from two sources:

- Manually entered FAQs in the Content Studio
- AI-generated answers stored after first generation (auto-caching)

#### Gate 2 — Keyword / Topic Filter

Checks whether the customer message contains any word from the tenant's defined `allowed_keywords` list. If no match is found, the query is considered out of scope and a polite decline message is returned. This gate prevents the AI from ever seeing irrelevant queries — e.g., a bank customer asking about astronomy.

```javascript
// Gate 2 implementation
function isInScope(customerText, allowedKeywords) {
  const lower = customerText.toLowerCase();
  return allowedKeywords.some(keyword => lower.includes(keyword));
}

if (!isInScope(customerText, tenant.allowed_keywords)) {
  return cannedResponse('out_of_scope'); // 0 tokens
}
```

#### Gate 3 — Authentication Tier Check

If the detected intent requires sensitive data (balance, card operations, transaction history), the gate checks the current session's `validation_status`. If the customer is not fully validated, a PIN or OTP challenge is issued. The PIN is verified entirely within the tenant's own infrastructure — the raw value never reaches AgenticVR or any external AI service.

#### Gate 4 — AI Fallback

Only reached when Gates 1–3 cannot resolve the query. The AI is called with a sanitised prompt containing:

- The tenant's system prompt (restricted to business context)
- The last 3–4 conversation turns only (not full history)
- The customer's current message

The response is returned to the customer and stored in the FAQ cache for future identical queries. Token consumption is logged immediately after the call completes.

### 4.3 Expected Gate Distribution

| Gate | Expected % | Token Cost | Notes |
|---|---|---|---|
| Gate 1 — FAQ Cache | 45–55% | 0 | Grows over time as cache fills |
| Gate 2 — Blocked | 10–15% | 0 | Out-of-scope queries |
| Gate 3 — Auth Flow | 15–20% | 0 | Pre-recorded prompts only |
| Gate 4 — AI | 10–15% | 300–500 | Target: keep below 15% |

### 4.4 System Prompt Optimisation

The system prompt is sent with every AI call and consumes tokens on every invocation. Keeping it tight is critical at scale.

```
800 token system prompt × 1,000 calls = 800,000 tokens (instructions alone)
200 token system prompt × 1,000 calls = 200,000 tokens

Savings: 600,000 tokens just from trimming the prompt.
```

AgenticVR enforces a maximum system prompt character limit per tenant and displays a prompt efficiency score in the admin portal.

---

## 5. Customer Authentication & Access Tiers

Every incoming conversation is assigned a tier based on what the platform knows about the customer before any message is exchanged. Tiers upgrade during the session as validation is completed. Once validated, the session remains validated for its entire duration — the customer is never asked to re-authenticate mid-conversation.

### 5.1 Tier Definitions

| Tier | Trigger | Access Level | Examples |
|---|---|---|---|
| Tier 1 — Public | Any caller | Non-sensitive info only | Branch hours, product info, offers, general FAQs |
| Tier 2 — Registered | Phone number matched in CRM | Personalised greeting, account existence confirmed | "Welcome back, Ahmed" — no sensitive data yet |
| Tier 3 — Validated | PIN / OTP verified | Full sensitive data access | Balance, card block/activation, transactions, transfers |

### 5.2 What We Know Before the First Message

```
When a conversation starts, AgenticVR already knows:
├── Which tenant (from DID / subdomain / API key)
├── Customer phone number (from caller ID or login)
├── Is the phone number registered in this tenant's system?
├── Customer's preferred language (if previously stored)
└── Current session tier (starts at Tier 1 or 2)
```

### 5.3 Validation Flow

When a Tier 3 service is requested and the session is not yet validated:

1. System plays pre-recorded prompt: *"For your security, please enter your 4-digit PIN."*
2. Customer enters PIN via keypad (DTMF) or typed input (web chat)
3. PIN is validated entirely within the tenant's own authentication service
4. Result returned to AgenticVR as `validation: true` or `validation: false` only
5. On success: session tier upgrades to 3, all Tier 3 services unlocked for session duration
6. On failure: customer warned, attempt count incremented
7. After 3 failed attempts: session locked, transfer to human agent

### 5.4 Security Constraints

- PIN value is never transmitted to AgenticVR engine or any AI API
- Card numbers are stored only in the tenant's core banking system
- AI receives only sanitised results: `"validation: passed"`, `"balance: PKR 45,230"`
- Full card numbers masked to last 4 digits in all responses and logs
- Session token expires after conversation ends or 15 minutes of inactivity

### 5.5 Session State Object

```javascript
session = {
  // Known from start
  tenant_id: "xyz_bank_01",
  phone_hash: "sha256(923001234567)",   // hashed — never raw
  language: null,                        // set after first prompt

  // Discovered silently
  is_registered_customer: true,

  // Built during conversation
  validation_status: "none",             // none | phone_matched | fully_validated
  validation_attempts: 0,
  current_tier: 1,                       // upgrades to 3 after PIN

  // Conversation context
  history: [],                           // last 4 turns only sent to AI
  intent_history: [],

  // Token control
  tokens_used_this_session: 0,

  // Timing
  started_at: "2026-04-12T10:24:00Z",
  last_activity: "2026-04-12T10:25:10Z"
}
```

---

## 6. Conversation Flow Designer

The Flow Designer is a visual, drag-and-drop tool that allows non-technical client staff to build, manage, and publish their entire conversation experience without writing code. It is the primary interface for configuring what AgenticVR says and how it behaves for each tenant.

### 6.1 Canvas & Node Concept

Flows are built on an infinite canvas. **Nodes** (boxes) represent individual steps in the conversation. **Connections** (arrows) represent transitions between steps based on customer responses or outcomes. Nodes can be dragged, dropped, connected, enabled, disabled, and configured independently of each other.

```
[Start] ──▶ [Greeting] ──▶ [Language Select] ──▶ [Main Menu]
                                                       │
              ┌────────────────┬────────────────┬──────┘
              │                │                │
        [Products]       [Account Svcs]     [Support]
              │                │                │
       [Product List]    [Auth Node]      [Transfer Agent]
              │                │
       [Product Detail]  [Balance Fetch]
```

### 6.2 Node Types

#### Content Nodes

| Node Type | Description | Key Configuration |
|---|---|---|
| Greeting Node | Opening message at conversation start | Text EN/UR, audio file upload |
| Language Select | Prompt customer to choose language | Options list, default language |
| Menu Node | Present numbered or spoken options | Up to 9 options, each with sub-flow link |
| Information Node | Display static content | Rich text EN/UR |
| Product List Node | Show products from catalog | Category filter, sort order |
| Product Detail Node | Show specific product information | Product ID, display fields |
| Goodbye Node | Closing message and session end | Text EN/UR, audio file |

#### Action Nodes

| Node Type | Description | Key Configuration |
|---|---|---|
| Auth Node | Trigger PIN or OTP validation | Method (PIN/OTP), max attempts, lockout action |
| Data Fetch Node | Pull data from core banking or CRM | API endpoint, field mapping, timeout |
| Transfer Node | Hand conversation to human agent | Extension, queue, transfer message |
| Callback Node | Schedule a callback for the customer | Time slots, confirmation message |

#### Logic Nodes

| Node Type | Description | Key Configuration |
|---|---|---|
| Condition Node | Branch based on session variable | Variable, operator, value, true/false paths |
| Intent Matcher | Detect customer intent from free text | Intent list, confidence threshold |
| Tier Check Node | Route based on current auth tier | Required tier, upgrade prompt |
| Sub-Flow Link | Jump to another saved flow | Target flow ID, return behaviour |

### 6.3 Node Properties

Every node has four configuration tabs:

- **Content Tab** — response text in English and Urdu, audio file upload, fallback text if no audio available
- **Behaviour Tab** — enable/disable toggle, scheduled activation dates (from/to), auth requirement, timeout action, max retry count
- **Connections Tab** — success path, failure path, timeout path, no-match path
- **Analytics Tab** (read-only) — trigger count today, drop rate at this node, average time spent

### 6.4 Enable / Disable & Scheduling

Any node can be toggled on or off at any time without deleting it. Disabling a node causes the flow to skip it or route through its configured fallback path.

Scheduling allows nodes to activate and deactivate automatically — ideal for:

- Seasonal promotions and Ramadan offers
- Holiday or reduced-hours messaging
- Temporary service suspensions
- Time-limited product campaigns

### 6.5 Sub-Flow Linking & Reusability

Flows are modular. A "Product Catalog" flow, an "Authentication" flow, and a "Support" flow can each be built independently and linked from any menu node. Updating a shared sub-flow updates every entry point that references it simultaneously — with no need to redesign individual flows.

### 6.6 Flow Versioning

- Every published flow is versioned (v1, v2, v3...)
- Draft mode allows editing without affecting live conversations
- One-click rollback to any previous published version
- Change log shows who edited what and when
- Flows must be explicitly published — drafts never affect live traffic

---

## 7. Content Studio

The Content Studio is where tenant staff manage all knowledge and information that powers the IVR. It operates independently from the Flow Designer — content managers can update products, FAQs, and documents without touching any flow configuration.

### 7.1 Product Catalog Manager

Supports manual entry or bulk upload via Excel/CSV. Each product entry includes:

- Name in English and Urdu
- Description in English and Urdu
- Category and sub-category
- Key features list
- Price, rate, or eligibility criteria
- Enable/disable toggle (hidden from IVR immediately when disabled)
- Tags for search and intent matching

Products are automatically available in Product List and Product Detail nodes once added. Disabling a product in the catalog immediately hides it from all flows without any flow redesign required.

#### Supported Upload Formats

| Format | Notes |
|---|---|
| Excel (.xlsx) | Template provided. Columns auto-mapped. |
| CSV | UTF-8 encoded. Supports Urdu text. |
| Manual entry | Field-by-field form in admin portal |

### 7.2 FAQ Manager

FAQs are the primary source for Gate 1 cache lookups. Each FAQ entry includes:

- Question variants (multiple ways a customer might ask the same thing)
- Answer in English
- Answer in Urdu
- Category / topic tag
- Enable/disable toggle
- Usage count (read-only analytics — how often triggered)

### 7.3 Document & Knowledge Base

Supports upload of PDF, Word, and Excel files. The system extracts and indexes content automatically. Indexed documents are used by the AI (Gate 4) when generating responses, ensuring answers are grounded in the tenant's actual documentation rather than general AI knowledge.

- Per-document enable/disable
- Version control — upload a new version, previous version is archived
- Extraction preview — review extracted content before activating
- Scope tags — assign documents to specific topics or flows

### 7.4 Bilingual Content Rules

- All customer-facing content requires both English and Urdu versions
- If Urdu version is missing, system falls back to English and flags the entry for completion
- Language is determined by customer selection at conversation start
- Language preference is stored in session and remains consistent throughout

---

## 8. Token Management

Token management ensures that AI costs are controlled, predictable, and fairly allocated per tenant. The system tracks every token consumed, enforces monthly budgets, and provides real-time visibility to both tenant admins and the platform team.

### 8.1 Token Budget Per Tenant

Each tenant is assigned a monthly token allowance as part of their service plan. The token ledger tracks all consumption against this allowance in real time.

### 8.2 Pre-Call Budget Check

Before every Gate 4 AI call, the token manager performs a budget check. If the remaining balance is insufficient, the AI call is skipped and a graceful fallback response is used — the customer is never left hanging mid-conversation.

```javascript
async function canCallAI(tenantId, estimatedTokens) {
  const remaining = await getRemainingTokens(tenantId);
  if (remaining <= 0) {
    return { allowed: false, reason: 'budget_exhausted' };
  }
  if (remaining < estimatedTokens) {
    return { allowed: false, reason: 'insufficient_balance' };
  }
  return { allowed: true };
}
```

### 8.3 Token Estimation

Before each AI call, tokens are estimated to check budget:

```javascript
function estimateTokens(systemPrompt, history, userMessage) {
  // Rule of thumb: 1 token ≈ 4 characters
  const inputTokens = Math.ceil(
    (systemPrompt.length + JSON.stringify(history).length + userMessage.length) / 4
  );
  const outputTokens = 150; // max_tokens cap
  return inputTokens + outputTokens;
}
```

### 8.4 Alert Thresholds

| Threshold | Action | Recipients |
|---|---|---|
| 50% consumed | Info notification | Tenant Admin dashboard |
| 80% consumed | Warning alert | Tenant Admin — email + SMS + dashboard |
| 95% consumed | Critical alert | Tenant Admin + Platform Super Admin |
| 100% consumed | AI disabled | Gate 4 bypassed — fallback to human transfer only |

### 8.5 Token Ledger Schema

```javascript
// Every AI call logged immediately after completion
{
  log_id: "uuid",
  tenant_id: "xyz_bank_01",
  session_id: "sess_7f3a9b",
  conversation_id: "conv_abc123",
  timestamp: "2026-04-12T10:25:00Z",
  gate: "gate_4_ai",
  input_tokens: 320,
  output_tokens: 95,
  total_tokens: 415,
  cost_usd: 0.0008,
  monthly_consumed_after: 12815,
  topic_category: "account_inquiry"
}
```

---

## 9. Analytics Suite

The Analytics Suite provides comprehensive intelligence across technical performance, business outcomes, and quality metrics. All analytics are scoped per tenant with configurable date range filtering. Platform Super Admins can view aggregate analytics across all tenants.

### 9.1 Conversation Data Model

Every conversation is stored as a structured document containing:

```javascript
{
  // Identity
  conversation_id: "conv_abc123",
  tenant_id: "xyz_bank_01",
  session_id: "sess_7f3a9b",
  channel: "web",                      // web | ivr | whatsapp
  language: "en",

  // Timeline
  started_at: "2026-04-12T10:24:00Z",
  ended_at: "2026-04-12T10:27:30Z",
  duration_seconds: 210,

  // Outcome
  resolution_status: "resolved",        // resolved | transferred | dropped | timeout
  transfer_reason: null,

  // Turns (every exchange)
  turns: [
    {
      turn_id: "turn_001",
      timestamp: "2026-04-12T10:24:18Z",
      speaker: "customer",
      input_text: "What are your branch timings?",
      response_text: "Our branches are open Monday to Saturday...",
      gate_used: "gate_1_faq",
      intent_detected: "branch_hours_inquiry",
      topic_category: "branch_info",
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
      response_time_ms: 42,
      was_blocked: false,
      auth_triggered: false
    }
  ],

  // Aggregates (computed on save)
  total_turns: 6,
  total_tokens: 415,
  total_cost_usd: 0.0008,
  ai_turns_count: 1,
  blocked_count: 1,
  topics_discussed: ["branch_info", "account_inquiry"],

  // QA (filled post-conversation by supervisor)
  qa: {
    reviewed_by: "supervisor_001",
    reviewed_at: "2026-04-12T11:00:00Z",
    accuracy_score: 4,
    quality_score: 5,
    tone_score: 4,
    resolution_score: 5,
    overall_score: 4.5,
    flags: [],
    notes: "Clean interaction. Balance inquiry handled well.",
    corrected_answer: null
  }
}
```

### 9.2 Analytics Dimensions

#### Volume & Traffic

- Total conversations by hour, day, week, month, year
- Peak hour heatmap — visual map of busiest times
- Channel breakdown (web, IVR, WhatsApp)
- Language distribution (EN vs UR)
- Period-over-period trend comparison (this week vs last week)

#### Topic Intelligence

- Top topics today, this week, this month
- Topic trend over time — detect emerging issues early
- Topic frequency by language
- Topic frequency by time of day
- Seasonal patterns — identify recurring spikes by month
- New/emerging topics not yet in FAQ cache (opportunity signal)

#### Token Economics

- Total tokens consumed (any period, any scope)
- Cost per conversation (average)
- Cost breakdown per tenant (for billing)
- Which topic or service consumes most tokens
- Gate efficiency ratio — % of conversations resolved without AI
- Token trend over time
- Projected month-end cost based on current burn rate

#### Gate Performance

- Gate funnel: % of conversations resolved at each gate
- Cache hit rate trend — should improve as FAQ cache grows over time
- Block rate — % of queries outside allowed scope
- Auth trigger rate — % requiring PIN/OTP validation
- AI call rate — target below 15%
- Gate bypass attempts (repeated out-of-scope queries in same session)

#### Quality & Accuracy (QA)

- Average accuracy, quality, tone, and resolution scores by period
- Score distribution histogram
- Flag category breakdown — most common issue types
- Supervisor review completion rate
- QA score trend over time
- Correlation between gate used and QA score

#### Resolution Intelligence

- Self-service resolution rate (resolved without human transfer)
- Transfer rate and transfer reasons breakdown
- Average turns to resolution by topic
- Drop rate — customer abandoned conversation
- First contact resolution rate

#### Customer Behaviour

- Repeat caller analysis — same issue across multiple sessions
- Language switch rate during conversation
- Average session duration by topic
- Most common conversation paths (flow traversal analysis)
- Drop-off nodes — where do customers abandon most often?

#### Tenant Comparison (Platform Level Only)

- Which tenant has highest AI usage?
- Which tenant's FAQ cache needs updating?
- Which tenant has the worst resolution rate?
- Token consumption per tenant (for billing review)
- QA scores per tenant

### 9.3 Dashboard Pages

| Dashboard | Primary Audience | Key Metrics |
|---|---|---|
| Overview | All roles | Live today + trends + active conversations |
| Conversations | Supervisor, Admin | Searchable transcript list + full viewer |
| Topics | Admin, MIS | Topic frequency, trends, emerging issues |
| Token Economics | Admin, MIS | Cost breakdown, gate efficiency, projections |
| Quality (QA) | Supervisor | Review queue, scores, flags, corrections |
| Gate Analytics | Admin, MIS | Funnel performance, cache hit rate |
| Tenant Reports | Tenant Admin | Full per-tenant deep dive |
| Platform Overview | Super Admin | Cross-tenant aggregated view |

### 9.4 Automated Alerts

| Alert | Trigger | Severity |
|---|---|---|
| Token budget 80% consumed | Per tenant | Warning |
| AI call rate spikes above threshold | Per tenant | Warning |
| New topic appearing frequently (not in FAQ) | Per tenant | Info |
| QA score drops below baseline | Per tenant | Warning |
| Transfer rate increasing trend | Per tenant | Info |
| Cache hit rate improving | Per tenant | Positive / Info |

---

## 10. QA & Supervisor Module

The QA module allows supervisors to review, score, and correct AI-generated conversations. This creates a continuous improvement loop where low-quality responses are identified, corrected, and fed back into the system as improved FAQ entries or updated system prompts.

### 10.1 Review Queue

Conversations are surfaced to the review queue based on configurable triggers:

- All AI-generated responses (Gate 4 calls)
- All conversations that ended in human transfer
- Conversations with duration above defined threshold
- Random sample for ongoing quality monitoring
- Manually flagged by any user

### 10.2 Scoring Dimensions

| Dimension | Scale | Description |
|---|---|---|
| Accuracy | 1–5 | Was the information provided factually correct? |
| Quality | 1–5 | Was the response well phrased and clear? |
| Tone | 1–5 | Was the response warm and professional? |
| Resolution | 1–5 | Was the customer's issue actually resolved? |
| Overall Score | Computed | Weighted average of all four dimensions |

### 10.3 Flag Categories

- **Wrong answer** — factually incorrect response given
- **Missed intent** — system misunderstood what the customer wanted
- **Too long** — response not suitable for phone/IVR context
- **Too short** — insufficient information provided
- **Inappropriate tone** — response felt cold, rude, or robotic
- **Security risk** — concern about sensitive information handling

### 10.4 Supervisor Workflow

```
1. Open Review Queue
2. Filter by: All | AI Calls | Transfers | Low Score | Flagged
3. Click conversation → full transcript with gate tags per turn
4. Score each dimension (1–5)
5. Add flags if needed
6. Write corrected answer (optional but encouraged)
7. Submit review
8. Corrected answer → auto-added to FAQ cache
```

### 10.5 Correction Corpus

When a supervisor provides a corrected answer, it is:

1. Immediately stored in the FAQ cache (correct answer served next time, no AI cost)
2. Accumulated in the correction corpus dataset
3. Available for future model fine-tuning or system prompt improvement

Over time, this corpus becomes a valuable proprietary dataset that continuously improves accuracy and reduces AI dependency.

---

## 11. Role-Based Access Control (RBAC)

AgenticVR implements a two-level RBAC model: Platform Level (across all tenants) and Tenant Level (within a single tenant). Permissions are additive — roles grant access, never restrict beyond their defined scope.

### 11.1 Platform-Level Roles

| Role | Permissions |
|---|---|
| **Super Admin** | Full access to all tenants, platform settings, billing, user management, and all analytics |
| **Platform Support** | View-only access to all tenants for troubleshooting. No financial or configuration access. |

### 11.2 Tenant-Level Roles

| Role | Module Access | Capabilities |
|---|---|---|
| **Tenant Admin** | All | Full access within their tenant. Manage all users, flows, content, analytics, and token budgets. |
| **Flow Designer** | Flows, Content | Build and edit flows, manage content and products, view own activity. |
| **Content Manager** | Content only | Upload and manage products, FAQs, documents. Enable/disable content. No flow or analytics access. |
| **Supervisor (QA)** | Conversations, QA | View all transcripts, score and review conversations, flag issues, write corrections. No flow or content access. |
| **MIS / Analyst** | Analytics only | View all analytics dashboards, export reports. Aggregated data only — no individual transcripts. |
| **Viewer** | Dashboard (read-only) | Overview dashboard only. No sensitive data, no actions. |

### 11.3 Permission Matrix

| Feature | Super Admin | Tenant Admin | Flow Designer | Content Mgr | Supervisor | MIS Analyst | Viewer |
|---|---|---|---|---|---|---|---|
| Manage tenants | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage users | ✅ | ✅ (own) | ❌ | ❌ | ❌ | ❌ | ❌ |
| Flow designer | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Content studio | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| View transcripts | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| QA review | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Analytics | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ (read) |
| Token / billing | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

### 11.4 Audit Log

All actions performed by all users are written to an immutable audit log including: user ID, role, action type, affected resource, timestamp, and IP address. Audit logs are accessible to Super Admin and Tenant Admin only and cannot be deleted or modified.

---

## 12. Data Security & Privacy

AgenticVR is designed from the ground up to handle sensitive financial and personal customer data. The core security principle is **data minimisation**: external services (including AI APIs) receive only what is strictly necessary to perform their function.

### 12.1 Sensitive Data Classification

| Class | Data Types | Handling Rule |
|---|---|---|
| 🔴 RED | Full card PAN, PIN, CVV, OTP values, passwords | Never transmitted to AgenticVR engine or any external API. Validated entirely within tenant infrastructure. |
| 🟡 AMBER | Account balance, transaction amounts, full account numbers | Fetched from tenant core banking. Transmitted to AI only as sanitised result strings. Never cached or stored in AI context. |
| 🟢 GREEN | Intent, session ID, tenant ID, language, gate results | Flows freely. These are operational signals, not customer data. |

### 12.2 What the AI Actually Receives

```javascript
// ❌ WRONG — never do this
const prompt = `
  Customer card number is 4111111111111111
  PIN entered: 1234
  Please confirm card block.
`;

// ✅ CORRECT — AI only needs this
const prompt = `
  Customer has requested card block.
  Identity validation: passed
  Card on file: ending 1111
  Please confirm and respond to customer.
`;
```

### 12.3 Logging Policy

**Log these:**
- Session ID, intent detected, gate used, action taken, timestamp, result (success/fail), tokens consumed

**Never log these:**
- PIN or password values
- Full card numbers (PAN)
- CVV values
- OTP values
- Raw AI prompts if they contain any of the above

Account numbers in logs are masked to last 4 digits only.

### 12.4 Data Retention

- Conversation logs: configurable per tenant (default 90 days)
- Token ledger: 13 months (for annual billing comparison)
- Audit logs: 24 months minimum
- QA correction corpus: indefinite (valuable training asset)

### 12.5 Compliance Targets

- **PCI-DSS** — card data isolation ensures cardholder data never enters AgenticVR systems
- **SBP Data Localisation** — customer data stored within Pakistan-region cloud infrastructure
- **Data minimisation** — applied at every AI prompt boundary

---

## 13. Multi-Tenant Model

AgenticVR is a single codebase serving multiple client businesses. Each tenant is fully isolated in configuration, data, and access while sharing the same underlying infrastructure. New tenants are onboarded through configuration — no code changes required.

### 13.1 Tenant Identification

Tenants are identified at the start of each conversation by one of:

- **DID** (Direct Inward Dialing) number — for IVR/telephony channel
- **Tenant subdomain** — for web channel (e.g., `xyzbank.agenticvr.com`)
- **API key** — for direct API integrations

### 13.2 Data Isolation

- Each tenant's conversations, analytics, users, and content are stored in isolated collections tagged by `tenant_id`
- No cross-tenant data access is possible at the application layer
- Tenant Admins can only see and manage their own tenant's data

### 13.3 Onboarding a New Tenant

1. Super Admin creates tenant record and assigns `client_id`
2. Tenant Admin account created and invitation email sent
3. Tenant Admin configures business info, system prompt, allowed keywords
4. Content Manager uploads products, FAQs, and documents
5. Flow Designer builds conversation flows in the Flow Designer
6. Supervisor is trained on the QA review workflow
7. Test conversations run with mock/dummy data
8. Flow published to live — tenant is active

---

## 14. Asterisk / IVR Integration (Phase 2)

AgenticVR is designed as a channel-agnostic engine. The core logic (gate engine, session management, token management, analytics) operates identically regardless of channel. Asterisk integration adds a telephony input/output layer without modifying any core engine code.

### 14.1 Integration Architecture

```
Incoming Call
    │
    ▼
Asterisk PBX
    │  (FastAGI call)
    ▼
AgenticVR FastAGI Script
    │  (HTTP to core engine)
    ▼
AgenticVR Core Engine
    │  (same gate engine as web)
    ▼
Response resolved
    │
    ├── Pre-recorded WAV  ──▶ Asterisk plays file
    ├── Stitched audio    ──▶ Asterisk plays parts
    └── TTS generated     ──▶ Asterisk plays TTS output
```

### 14.2 Audio Response Strategy

| Response Type | Method | Example |
|---|---|---|
| Fixed greetings and menus | Pre-recorded WAV (voice artist) | "Welcome to XYZ Bank" |
| Static FAQs | Pre-recorded WAV | "Our hours are 9 to 5" |
| Dynamic data (balance, NAV) | Audio stitching | "Your balance is" + TTS number |
| AI-generated responses | TTS (Google Polly / ElevenLabs) | Complex or novel queries |

### 14.3 Pre-Recorded Audio File Structure

```
/canned
├── /common
│   ├── welcome_en.wav
│   ├── welcome_ur.wav
│   ├── please_hold.wav
│   ├── transferring.wav
│   └── goodbye.wav
│
└── /xyz_bank
    ├── greeting_en.wav       "Welcome to XYZ Bank!"
    ├── greeting_ur.wav       "ایکس وائی زیڈ بینک میں خوش آمدید"
    ├── pin_prompt_en.wav     "Please enter your 4-digit PIN"
    ├── pin_prompt_ur.wav     "براہ کرم اپنا 4 ہندسوں کا PIN درج کریں"
    ├── branch_hours_en.wav   "Our branches are open Monday to Saturday..."
    └── out_of_scope_en.wav   "I can only assist with banking queries"
```

### 14.4 Human Touch Guidelines

- All tenant greetings and menus recorded by a real voice artist — not TTS
- Use conversational language: *"Let me check that for you"* not *"Processing request"*
- Include filler phrases during data fetch: *"One moment please..."* (pre-recorded)
- Use customer name when available: *"Welcome back, Ahmed"*
- Clearly identify as automated but in a warm, friendly manner:
  > *"I'm an automated assistant, but I'm here to help. Say 'agent' at any time to speak with someone."*

---

## 15. POC Scope & Deliverables

The POC is a web-based application demonstrating the core engine logic before Asterisk telephony integration. The goal is to validate all key technical concepts with realistic demo data before full production development begins.

### 15.1 POC Technical Stack

| Layer | Technology | Cost |
|---|---|---|
| Frontend | HTML/CSS/JavaScript | Free |
| Backend | Node.js Serverless (Vercel) | Free tier |
| Session State | Upstash Redis | Free tier (10K req/day) |
| Database | MongoDB Atlas | Free tier (512MB) |
| AI / LLM | Groq API (Llama 3) | Free tier |
| Hosting | Vercel | Free tier |
| **Total** | | **$0** |

### 15.2 POC Feature Scope

| Feature | Phase | Notes |
|---|---|---|
| Multi-tenant switching (Bank, Asset Mgmt, Cement) | POC | 3 demo tenants |
| Gate engine — all 4 gates | POC | Full logic implemented |
| Token tracking and budget enforcement | POC | Per tenant, live meter in UI |
| Authentication tier simulation | POC | Mock PIN validation |
| Bilingual (EN/UR) | POC | Language toggle in UI |
| Canned vs AI response routing | POC | Gate tag visible per message |
| Analytics dashboard | Phase 2 | After POC validation |
| Flow designer | Phase 2 | After POC validation |
| Asterisk IVR integration | Phase 3 | After full platform built |

### 15.3 POC Success Criteria

1. Gate engine correctly routes to the appropriate gate for all test scenarios
2. AI is not called for out-of-scope or FAQ-matched queries
3. Token counter accurately reflects consumption per tenant
4. Switching tenant completely changes system prompt, FAQ, and keyword list
5. Auth tier upgrades correctly during session after PIN simulation
6. Out-of-scope queries (e.g., non-business topics) are blocked at Gate 2

### 15.4 Demo Tenants for POC

| Tenant | Industry | Key Test Scenarios |
|---|---|---|
| XYZ Bank | Banking | Balance inquiry, card block, branch hours, out-of-scope |
| ABC Asset Mgmt | Finance | NAV inquiry, fund info, portfolio, out-of-scope |
| National Cement | Manufacturing | Product pricing, order info, delivery, out-of-scope |

---

## 16. Development Roadmap

| Phase | Title | Key Deliverables | Estimate |
|---|---|---|---|
| **Phase 1** | POC | Web chat UI, gate engine (all 4 gates), token tracking, multi-tenant switching, auth tier simulation, bilingual toggle | 2–3 weeks |
| **Phase 2** | Platform Core | Flow designer, content studio, RBAC, conversation logger, QA module, analytics dashboards, admin portal | 8–12 weeks |
| **Phase 3** | IVR Channel | Asterisk integration, FastAGI scripts, pre-recorded audio management, audio stitching, TTS fallback, IVR-specific analytics | 4–6 weeks |
| **Phase 4** | Production | Production infrastructure, billing module, SLA monitoring, multi-region support, fine-tuning pipeline, enterprise features | Ongoing |

### 16.1 Phase 1 — POC Milestones

- [ ] Node.js project setup with Vercel config
- [ ] Tenant config loader (JSON-based)
- [ ] Gate 1: FAQ cache lookup
- [ ] Gate 2: Keyword filter
- [ ] Gate 3: Auth simulation
- [ ] Gate 4: AI call (Groq API)
- [ ] Token tracker (Upstash Redis)
- [ ] Session manager (Upstash Redis)
- [ ] Chat UI (HTML/CSS/JS)
- [ ] Tenant switcher in UI
- [ ] Token meter and gate activity panel in UI
- [ ] Analytics logger (MongoDB)
- [ ] POC demo with all 3 test tenants

---

## 17. Glossary

| Term | Definition |
|---|---|
| **Agentic AI** | An AI system that perceives context, decides on actions, uses tools, and loops until a goal is resolved — rather than simply responding to a single prompt |
| **Gate Engine** | The four-layer decision system that routes each customer message to the cheapest appropriate resolution method |
| **Tenant** | A single client business using the AgenticVR platform (e.g., XYZ Bank is one tenant) |
| **DTMF** | Dual-Tone Multi-Frequency — the tones produced when pressing telephone keypad buttons |
| **FAQ Cache** | A key-value store of pre-answered questions used by Gate 1 to resolve queries without AI |
| **Canned Response** | A pre-written or pre-recorded response for a known, fixed scenario |
| **Audio Stitching** | Combining a pre-recorded phrase with dynamically generated speech — e.g., "Your balance is" + TTS number |
| **TTS** | Text-to-Speech — converting written text to spoken audio using a voice synthesis service |
| **STT** | Speech-to-Text — converting spoken audio to written text using a transcription service |
| **RAG** | Retrieval Augmented Generation — enhancing AI responses by injecting relevant documents into the prompt context |
| **RBAC** | Role-Based Access Control — a permission system where access rights are granted based on a user's assigned role |
| **AGI / FastAGI** | Asterisk Gateway Interface — a protocol for external applications to control Asterisk call flow |
| **DID** | Direct Inward Dialing — a phone number assigned to a specific tenant or service queue |
| **Token** | The unit of text processed by an AI model — approximately 4 characters or 0.75 words. Both input and output tokens count toward consumption |
| **Sub-flow** | A reusable, self-contained conversation flow that can be linked from multiple parent flows |
| **Correction Corpus** | The accumulated dataset of supervisor-corrected AI responses, used for improving system prompts and future model fine-tuning |
| **PAN** | Primary Account Number — the full 16-digit card number (classified RED, never transmitted externally) |
| **SBP** | State Bank of Pakistan — the central bank whose data localisation rules govern storage of customer financial data |

---

## 18. AI Provider Integrations & API Key Management

AgenticVR is designed as a **provider-agnostic platform**. Every AI service layer — LLM, STT, and TTS — supports multiple providers simultaneously. Tenant Admins can configure which provider and which specific model or voice to use for each layer. This eliminates single-provider dependency, enables cost optimisation, and allows each client to use the best-fit service for their language and use case.

---

### 18.1 Multi-Key Architecture

Each provider slot supports **multiple API keys** configured in rotation. This solves the rate limit problem on free tiers — when one key hits its limit, the system automatically falls over to the next key in the pool.

```javascript
// Provider config structure per tenant
{
  "llm": {
    "provider": "groq",
    "model": "llama-3.3-70b-versatile",
    "keys": [
      { "key": "gsk_key1...", "label": "Key 1", "active": true },
      { "key": "gsk_key2...", "label": "Key 2", "active": true },
      { "key": "gsk_key3...", "label": "Key 3", "active": true }
    ],
    "rotation_strategy": "round_robin"  // round_robin | fallback | least_used
  },
  "stt": {
    "provider": "groq",
    "model": "whisper-large-v3-turbo",
    "keys": [...]
  },
  "tts": {
    "provider": "upliftai",
    "voice_id": "v_meklc281",
    "keys": [...]
  }
}
```

#### Key Rotation Strategies

| Strategy | Description | Best For |
|---|---|---|
| `round_robin` | Distributes calls evenly across all keys | Maximising free tier total capacity |
| `fallback` | Uses Key 1 until exhausted, then Key 2 | Predictable billing on paid tiers |
| `least_used` | Always picks the key with most remaining quota | Even wear across keys |

---

### 18.2 LLM Providers

#### Groq ⭐ Recommended for POC & Production

Groq is an AI inference company that built custom chips called LPUs (Language Processing Units) specifically designed to run large language models fast — delivering 500+ tokens per second on some models, which is an order of magnitude beyond most hosted APIs.

**Why Groq for AgenticVR:**
- Fastest inference available — critical for real-time IVR where latency matters
- Generous free tier — no credit card required
- Supports both LLM (conversation) and STT (Whisper) in one platform
- OpenAI-compatible API — easy to swap without code changes

**Current Models on Groq (2026):**

| Model | Best For | Context | Speed |
|---|---|---|---|
| `llama-3.3-70b-versatile` | Main Gate 4 AI — best quality | 128K | Very fast |
| `llama-3.1-8b-instant` | Cheap classifier (Gate 2.5) | 128K | Extremely fast |
| `openai/gpt-oss-120b` | Complex reasoning, complaints | 128K | Fast |
| `qwen/qwen3-32b` | Multilingual (Urdu context) | 128K | Fast |
| `whisper-large-v3-turbo` | STT — fast + accurate | Audio | Very fast |
| `whisper-large-v3` | STT — highest accuracy | Audio | Fast |

**Free Tier Limits (per key):**

LLaMA 3.3 70B on the free plan provides approximately 6,000 tokens per minute and 500,000 tokens per day. LLaMA 3.1 8B has higher limits due to its smaller size, typically 30,000 tokens per minute.

```
Strategy: Configure 3–5 Groq keys per tenant
3 keys × 500,000 tokens/day = 1,500,000 tokens/day FREE
More than sufficient for POC and early production
```

**Groq API Integration:**
```javascript
const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'llama-3.3-70b-versatile',
    messages: [...conversationHistory],
    max_tokens: 150,
    temperature: 0.7
  })
});
```

---

#### Claude (Anthropic) — Recommended for Production Quality

Best for complex, nuanced conversations, complaint handling, and situations where response quality is the priority over speed.

```javascript
// Claude API
const response = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 150,
    system: systemPrompt,
    messages: conversationHistory
  })
});
```

---

#### OpenAI — Optional Fallback

Widely supported, large model selection, but more expensive than Groq for equivalent performance. Use as tertiary fallback only.

---

#### Recommended LLM Strategy

```
Gate 2.5 (cheap classifier):  Groq llama-3.1-8b-instant   ← nearly free, very fast
Gate 4 (main AI):             Groq llama-3.3-70b-versatile ← free tier, fast
Gate 4 (high quality mode):   Claude claude-sonnet-4       ← paid, best quality
Gate 4 (multilingual/Urdu):   Groq qwen/qwen3-32b          ← better multilingual
```

---

### 18.3 STT (Speech-to-Text) Providers

STT is used in Phase 2 (Asterisk/IVR) to convert caller speech to text before feeding into the gate engine.

#### Groq Whisper ⭐ Recommended

Whisper Large v3 Turbo is ideal for applications requiring rapid multilingual speech recognition, such as real-time customer service chatbots that need to quickly transcribe customer inquiries.

| Model | Languages | Speed | Accuracy |
|---|---|---|---|
| `whisper-large-v3-turbo` | 99 languages incl. Urdu | Very fast | High |
| `whisper-large-v3` | 99 languages incl. Urdu | Fast | Highest |

```javascript
// Groq Whisper STT
const formData = new FormData();
formData.append('file', audioBuffer, 'audio.wav');
formData.append('model', 'whisper-large-v3-turbo');
formData.append('language', 'ur');  // or 'en'
formData.append('response_format', 'json');

const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${apiKey}` },
  body: formData
});
```

**Advantage:** Same Groq key pool used for both LLM and STT — simplifies key management.

---

#### ElevenLabs STT — Alternative

ElevenLabs offers realtime or batch Speech to Text for any platform. Good option if already using ElevenLabs for TTS — single platform, single billing relationship.

---

#### Google Cloud STT — Enterprise Option

Robust, proven, supports Urdu, higher cost. Recommended for enterprise tenants with SLA requirements.

---

### 18.4 TTS (Text-to-Speech) Providers

TTS converts AI-generated or canned text responses to spoken audio for the IVR channel (Phase 2). For web chat, text responses are returned directly.

#### Uplift AI — ⭐ Strongly Recommended for Urdu

Uplift AI has trained a family of AI models called Orator that speaks Pakistani languages with human-like realism. Orator sets a new standard in Pakistani speech synthesis, outperforming all competitors, including OpenAI, ElevenLabs, and Microsoft, in user preference evaluations — all while being 60 times more cost-effective.

This is the **most important TTS choice for AgenticVR** given our Urdu-first market.

**Why Uplift AI:**
- Built specifically for Urdu, Sindhi, Balochi — not an afterthought
- Trained on authentic Pakistani speech data — correct accent, pronunciation, naturalness
- Founded by former Apple Siri and Amazon Alexa engineers who built their own voice datasets from the ground up, recording voice data from textile mills to farmlands.
- Already used by Khan Academy for thousands of Urdu educational videos
- Proven in banking context — Uplift AI's technology is already finding traction in banking, enabling voice-driven account access, bill payments, and balance checks.
- WebSocket streaming API — low latency for real-time IVR

**Uplift AI Available Languages:**
- Urdu ✅ (production-ready)
- Sindhi ✅
- Balochi ✅
- Punjabi 🔜 (coming soon)
- Pashto 🔜 (coming soon)

**Uplift AI TTS Integration:**
```javascript
// Uplift AI — WebSocket streaming (low latency)
const { io } = require('socket.io-client');

const socket = io('wss://api.upliftai.org/tts/stream', {
  auth: { token: 'sk_api_your_key_here' },
  transports: ['websocket']
});

socket.emit('synthesize', {
  text: 'آپ کا بیلنس پچاس ہزار روپے ہے',
  voice_id: 'v_meklc281',       // Urdu professional voice
  language: 'ur',
  format: 'pcm'                  // PCM for direct Asterisk use
});

socket.on('audio_chunk', (chunk) => {
  // Stream audio chunk to Asterisk / caller
});
```

**Voice Selection in Admin Portal:**

Tenant Admins can browse and preview available Uplift AI voices in the portal before selecting one for their tenant. Each voice has a name, sample audio, gender, and tone descriptor.

---

#### ElevenLabs TTS — Recommended for English

For real-time applications, ElevenLabs Flash v2.5 provides ultra-low 75ms latency, while Multilingual v2 delivers the highest quality audio with more nuanced expression.

Best for English-language responses where voice quality and expressiveness matter.

| Model | Latency | Quality | Best For |
|---|---|---|---|
| Flash v2.5 | 75ms | Good | Real-time IVR, low latency |
| Multilingual v2/v3 | Higher | Excellent | Pre-recorded quality, non-realtime |

ElevenLabs' free tier provides 10,000 credits per month, covering roughly 10 minutes of high-quality TTS or approximately 20 minutes using the Flash model.

```javascript
// ElevenLabs TTS
const response = await fetch(
  `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`, {
  method: 'POST',
  headers: {
    'xi-api-key': apiKey,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    text: responseText,
    model_id: 'eleven_flash_v2_5',   // low latency for IVR
    voice_settings: { stability: 0.5, similarity_boost: 0.75 }
  })
});
```

---

#### Google Cloud TTS / Amazon Polly — Enterprise Fallback

Both support Urdu but with lower naturalness than Uplift AI. Use as emergency fallback when primary TTS is unavailable.

---

#### Recommended TTS Strategy

```
Urdu responses:     Uplift AI Orator     ← best Urdu quality by far
English responses:  ElevenLabs Flash     ← best English quality + low latency
Fallback (any):     Google Cloud TTS     ← always available, acceptable quality
Numbers/amounts:    Groq Whisper TTS     ← for stitching dynamic values
```

---

### 18.5 Provider & Voice Management Console

This is a dedicated admin module — accessible to Tenant Admin and Flow Designer roles — that provides full control over every AI provider layer. It covers four areas: **Voice Studio**, **Key Manager**, **Key Activity Log**, and **Cost Intelligence**.

---

#### 18.5.1 Voice Studio

The Voice Studio is where an admin selects voices, previews them, configures speech parameters, and assigns them to languages and conversation modes. It is the single place where all TTS configuration lives.

**Voice Selection Workflow:**

```
1. Admin opens Voice Studio
2. Selects TTS Provider (Uplift AI / ElevenLabs / Google / OpenAI / Polly)
3. System fetches available voices from that provider's API using the stored key
4. Admin filters by: Language | Gender | Tone/Style
5. Admin clicks ▶ Preview — plays a sample sentence in that voice
6. Admin configures voice parameters (speed, pitch, stability)
7. Admin assigns the voice to a language slot (EN / UR)
8. Save — voice goes live for all new conversations
```

**Voice Listing View (per provider):**

```
┌──────────────────────────────────────────────────────────────┐
│  VOICE STUDIO — XYZ Bank                                     │
│                                                              │
│  Provider: [Uplift AI ▼]    Language: [Urdu ▼]              │
│  Filter:  Gender [All ▼]   Tone [All ▼]   [Search voices]   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 🎙 Aisha        Female | Professional | Urdu         │   │
│  │ ▶ [Play Sample]  "آپ کا بیلنس پچاس ہزار روپے ہے"    │   │
│  │ Speed [────●───] Stability [──────●─]                │   │
│  │                              [✅ Selected for UR]    │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 🎙 Bilal        Male | Formal | Urdu                 │   │
│  │ ▶ [Play Sample]  "آپ کا بیلنس پچاس ہزار روپے ہے"    │   │
│  │ Speed [───●────] Stability [────●────]               │   │
│  │                              [Select for UR]         │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 🎙 Zara         Female | Warm | Urdu                 │   │
│  │ ▶ [Play Sample]  "آپ کا بیلنس پچاس ہزار روپے ہے"    │   │
│  │ Speed [────●───] Stability [───●─────]               │   │
│  │                              [Select for UR]         │   │
│  └──────────────────────────────────────────────────────┘   │
├──────────────────────────────────────────────────────────────┤
│  Provider: [ElevenLabs ▼]   Language: [English ▼]           │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 🎙 Rachel       Female | Neutral | EN                │   │
│  │ ▶ [Play Sample]  "Your account balance is..."        │   │
│  │ Model: [Flash v2.5 ▼]    Speed [────●───]            │   │
│  │                              [✅ Selected for EN]    │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

**Voice Parameters (configurable per voice):**

| Parameter | Range | Description |
|---|---|---|
| Speed | 0.5x – 2.0x | How fast the voice speaks |
| Pitch | -20 to +20 | Voice pitch adjustment |
| Stability | 0.0 – 1.0 | Consistency vs expressiveness |
| Similarity | 0.0 – 1.0 | How closely it matches the original voice |
| Style | 0.0 – 1.0 | Emotional expressiveness level |

**Conversation Mode Assignment:**

Different modes can use different voices — matching the emotional tone to the context:

| Mode | Voice Style | Example Use |
|---|---|---|
| `greeting` | Warm, welcoming | Opening message |
| `information` | Neutral, clear | FAQ answers, product info |
| `alert` | Firm, authoritative | Security warnings |
| `validation` | Calm, reassuring | PIN prompt, identity check |
| `farewell` | Friendly | Closing message |
| `error` | Patient, helpful | "I didn't catch that" |
| `transfer` | Professional | Handing to human agent |

Each mode independently assignable to any available voice. For example: greeting uses Zara (warm), validation uses Aisha (professional), farewell uses Zara (warm) again.

**Preview with Custom Text:**

Admin can type any custom sentence — including Urdu text — and hear it played back in the selected voice before confirming. This is critical for verifying correct pronunciation of brand names, amounts, and product names.

```
[Custom Preview Text Input]
آپ کا کارڈ بلاک ہو گیا ہے

[▶ Play Preview]  Provider: Uplift AI  Voice: Aisha  Speed: 1.0x
```

---

#### 18.5.2 Key Manager

The Key Manager handles all API keys across all providers for the tenant. Keys can be added, tested, activated, deactivated, and removed without touching any code.

**Key Manager UI:**

```
┌──────────────────────────────────────────────────────────────┐
│  KEY MANAGER — XYZ Bank                                      │
├────────────────────────────────────────────────────────────  │
│  GROQ  (LLM + STT)                        [+ Add Key]        │
│                                                              │
│  Key 1  gsk_...a3b9  Main key             ✅ Active          │
│         Last used: 2 mins ago             [Test] [Disable]   │
│         Today: 412,000 / 500,000 tokens   82% used  ████░   │
│                                                              │
│  Key 2  gsk_...f7c2  Backup 1             ✅ Active          │
│         Last used: 14 mins ago            [Test] [Disable]   │
│         Today: 38,000 / 500,000 tokens    8% used   █░░░░   │
│                                                              │
│  Key 3  gsk_...9d1e  Backup 2             ✅ Active          │
│         Last used: 1 hour ago             [Test] [Disable]   │
│         Today: 0 / 500,000 tokens         0% used   ░░░░░   │
│                                                              │
│  Rotation Strategy: [Round Robin ▼]                          │
├────────────────────────────────────────────────────────────  │
│  UPLIFT AI  (TTS — Urdu)                  [+ Add Key]        │
│                                                              │
│  Key 1  sk_upl_...b2a1   Primary         ✅ Active           │
│         Last used: 5 mins ago             [Test] [Disable]   │
│         This month: 2,340 / 10,000 chars  23% used  ██░░░   │
│                                                              │
├────────────────────────────────────────────────────────────  │
│  ELEVENLABS  (TTS — English)              [+ Add Key]        │
│                                                              │
│  Key 1  sk_el_...77ff    Primary         ✅ Active           │
│         Last used: 12 mins ago            [Test] [Disable]   │
│         This month: 8,200 / 10,000 chars  82% used  ████░   │
│                                                              │
│  Key 2  sk_el_...3ac8    Backup          ✅ Active           │
│         Last used: Never                  [Test] [Disable]   │
│         This month: 0 / 10,000 chars      0%  used  ░░░░░   │
└──────────────────────────────────────────────────────────────┘
```

**Key Test Flow:**

When admin clicks **[Test]** on any key:

```
1. System sends a minimal test request to the provider API
   (e.g., 10-token LLM call, 1-second silence for STT, 3-word TTS)
2. Measures response time
3. Returns result within 2-3 seconds:

   ✅ Key Valid  —  Response: 280ms  —  Provider: Groq  —  Model: llama-3.3-70b
   ❌ Key Invalid — Error: 401 Unauthorized
   ⚠️ Key Limited — Error: 429 Rate Limit (resets in 43 seconds)
```

Test results are logged to the activity log automatically.

---

#### 18.5.3 Key Activity Log

Every API key interaction is logged with full detail. This provides an immutable audit trail for cost analysis, debugging, and security review.

**Log Entry Schema:**

```javascript
{
  log_id: "log_8f3a2b",
  tenant_id: "xyz_bank_01",
  timestamp: "2026-04-12T10:25:00.342Z",
  provider: "groq",
  key_id: "key_1",
  key_label: "Main key",
  action_type: "llm_call",           // llm_call | stt_call | tts_call | key_test | key_rotation
  model: "llama-3.3-70b-versatile",
  session_id: "sess_7f3a9b",
  conversation_id: "conv_abc123",
  gate: "gate_4",
  input_tokens: 320,
  output_tokens: 95,
  total_tokens: 415,
  audio_seconds: null,               // for STT/TTS calls
  characters_used: null,             // for TTS calls
  response_time_ms: 285,
  status: "success",                 // success | rate_limited | error | invalid_key
  error_code: null,
  cost_usd: 0.000166,
  cost_pkr: 0.046                    // converted at current rate
}
```

**Activity Log UI:**

```
┌──────────────────────────────────────────────────────────────┐
│  KEY ACTIVITY LOG                                            │
│  Filter: [All Providers ▼] [All Keys ▼] [Today ▼] [Export]  │
├───────────┬──────────┬───────────┬────────┬────────┬────────┤
│ Time      │ Provider │ Key       │ Type   │ Tokens │ Cost   │
├───────────┼──────────┼───────────┼────────┼────────┼────────┤
│ 10:25:00  │ Groq     │ Key 1     │ LLM    │ 415    │ $0.000 │
│ 10:24:45  │ Groq     │ Key 2     │ LLM    │ 0      │ $0.000 │
│           │          │           │ BLOCKED│        │        │
│ 10:24:18  │ Groq     │ Key 1     │ LLM    │ 0      │ $0.000 │
│           │          │           │ FAQ HIT│        │        │
│ 10:24:01  │ Uplift   │ Key 1     │ TTS    │ —      │ $0.001 │
│           │          │ (UR)      │ 42 ch  │        │        │
│ 10:23:55  │ Groq     │ Key 1     │ KEY    │ —      │ $0.000 │
│           │          │           │ TEST ✅│        │        │
└───────────┴──────────┴───────────┴────────┴────────┴────────┘
```

---

#### 18.5.4 Cost Intelligence Dashboard

This is the financial brain of the platform. It answers: **what did each AI call actually cost, which provider is most expensive, and where is money being wasted.**

**Cost Tracking Per Call:**

```javascript
// Real-time cost calculation using provider pricing tables
function calculateCost(provider, model, inputTokens, outputTokens, chars, audioSeconds) {
  const pricing = PROVIDER_PRICING[provider][model];
  return {
    input_cost:  (inputTokens  / 1_000_000) * pricing.input_per_million,
    output_cost: (outputTokens / 1_000_000) * pricing.output_per_million,
    tts_cost:    chars ? (chars / 1_000_000) * pricing.chars_per_million : 0,
    stt_cost:    audioSeconds ? audioSeconds * pricing.per_second : 0,
    total_usd:   /* sum of above */,
    total_pkr:   /* converted at live exchange rate */
  };
}
```

**Provider Pricing Table (maintained by platform, updated regularly):**

| Provider | Type | Model | Cost (per million) | Free Tier |
|---|---|---|---|---|
| Groq | LLM Input | llama-3.3-70b | $0.59 | 500K tok/day |
| Groq | LLM Output | llama-3.3-70b | $0.79 | included |
| Groq | LLM Input | llama-3.1-8b | $0.05 | 500K tok/day |
| Groq | STT | whisper-large-v3-turbo | $0.04/hr audio | included |
| Uplift AI | TTS | Orator (Urdu) | Contact for pricing | Limited |
| ElevenLabs | TTS | Flash v2.5 | ~$0.15/min | 10 min/mo |
| ElevenLabs | TTS | Multilingual v2 | ~$0.30/min | included |
| OpenAI | LLM Input | gpt-4o-mini | $0.15 | None |
| Google STT | STT | Standard | $0.006/min | 60 min/mo |
| Amazon Polly | TTS | Neural | $16/1M chars | 1M chars/mo |

**Cost Intelligence Views:**

```
COST BREAKDOWN — XYZ Bank — April 2026
─────────────────────────────────────────────────────────
Total AI Spend This Month:   $4.28  (PKR 1,190)
vs Last Month:               $6.12  ↓ 30% improvement

By Provider:
  Groq LLM          $1.82   42%  ████████░░
  Uplift AI TTS     $1.44   34%  ██████░░░░
  ElevenLabs TTS    $0.72   17%  ███░░░░░░░
  Google STT        $0.30    7%  █░░░░░░░░░

By Gate:
  Gate 4 (AI calls) $3.96   93%  Cost driver
  TTS generation    $0.32    7%
  Gate 1–3          $0.00    0%  ← Free gates working!

By Topic:
  Complaint handling    $1.20  — highest per-conversation cost
  Balance inquiry       $0.48  — moderate (mostly gate 1)
  Card operations       $0.36  — low (mostly pre-recorded)
  Product information   $0.12  — very low (FAQ cache)
  Out-of-scope blocked  $0.00  — free

Cost Per Conversation:  $0.004 avg
AI Call Rate:           12.3%  ← ✅ under 15% target
Cache Hit Rate:         54.2%  ← ✅ growing
```

**Quality vs Cost Matrix:**

This is the key insight report — showing which provider gives the best quality per dollar, using QA supervisor scores:

```
QUALITY vs COST ANALYSIS
─────────────────────────────────────────────────────────
Provider       QA Score  Cost/1K calls  Quality/$ Ratio
─────────────────────────────────────────────────────────
Groq Llama 70B    4.1       $0.59         6.9  ← Best value
Claude Sonnet     4.8       $3.00         1.6
OpenAI GPT-4o     4.5       $2.50         1.8
Groq Llama 8B     3.2       $0.05        64.0  ← Fast/cheap
                                               (use for classifier only)

TTS Quality vs Cost:
Uplift AI (UR)    4.9       $0.02/min    245   ← Best Urdu
ElevenLabs (EN)   4.7       $0.15/min     31   ← Best English
Google TTS        3.8       $0.04/min     95   ← Good fallback
─────────────────────────────────────────────────────────
💡 Recommendation: Use Groq 70B for Gate 4 (best value LLM)
   Use Groq 8B only for topic classifier (Gate 2.5)
   Uplift AI mandatory for Urdu TTS
```

**Projected Cost Report:**

```
COST PROJECTION — This Month
─────────────────────────────────────────────────────────
Day 12 of 30  —  40% through month
Spent so far:      $4.28
Daily burn rate:   $0.36/day
Projected month:   $10.72

If AI call rate drops to 10%:
  Projected saving: $1.20/month  ← add 20 more FAQs to cache

If Groq free keys added (2 more):
  Projected saving: $0.91/month  ← replace paid LLM calls

Budget remaining:   $45.72 of $50 monthly limit
Alert threshold:    $40.00 ← ⚠️ will be reached in 3 days
```

---

### 18.6 API Key Health Monitoring

```javascript
// Key health tracked per key
{
  key_id: "key_1",
  provider: "groq",
  label: "Key 1",
  status: "active",              // active | rate_limited | invalid | expired
  requests_today: 8234,
  tokens_today: 412000,
  daily_limit: 500000,
  tokens_remaining_today: 88000,
  last_429_at: null,             // last rate limit hit
  last_used_at: "2026-04-12T10:25:00Z",
  health_pct: 82                 // % of daily budget remaining
}
```

**Admin sees at a glance:**
- Which keys are healthy / rate-limited / invalid
- Daily usage per key
- Auto-alerts when a key hits 90% of its daily limit
- One-click test to verify a key is still valid

---

### 18.7 Provider Comparison Summary

| Provider | Type | Free Tier | Urdu Quality | Latency | Best For |
|---|---|---|---|---|---|
| **Groq** | LLM + STT | ✅ Very generous | Good (Whisper) | Fastest | POC + Production LLM |
| **Uplift AI** | TTS | Paid (low cost) | ⭐ Best in class | Low (WebSocket) | Urdu TTS — mandatory |
| **ElevenLabs** | TTS + STT | ✅ Limited (10 min) | Limited | 75ms (Flash) | English TTS |
| **Claude API** | LLM | ❌ Paid | Good | Medium | High quality responses |
| **OpenAI** | LLM + STT + TTS | ❌ Paid | Limited | Medium | Fallback |
| **Google Cloud** | STT + TTS | ✅ $300 credit | Acceptable | Medium | Enterprise fallback |
| **Amazon Polly** | TTS | ✅ 1M chars/mo | Acceptable | Low | Emergency fallback |

---

### 18.8 Suggested Stack by Phase

#### POC Phase (Zero Cost)
```
LLM:  Groq — llama-3.3-70b-versatile (free tier, 3 keys)
STT:  Groq — whisper-large-v3-turbo  (free tier, same keys)
TTS:  Not needed (web chat returns text only)
Cost: $0
```

#### Phase 2 — Platform with IVR
```
LLM:  Groq (free keys) → Claude API (paid, quality fallback)
STT:  Groq Whisper (free) → Google STT (enterprise fallback)
TTS:  Uplift AI (Urdu) + ElevenLabs Flash (English)
Cost: Low — primarily Uplift AI TTS per minute
```

#### Phase 3 — Production / Multi-tenant
```
LLM:  Groq paid tier (per tenant budget) + Claude for premium
STT:  Groq Whisper (primary) + Google (SLA backup)
TTS:  Uplift AI (Urdu) + ElevenLabs (English) + Polly (fallback)
Cost: Pay-per-use, passed through to tenant billing
```

---

*Document maintained by the AgenticVR product team. Update this document before beginning any new development phase.*

*For questions contact the product owner. For technical queries contact the lead developer.*

---

**AgenticVR v1.0 — April 2026 — CONFIDENTIAL**
