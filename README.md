# Rayeva AI Modules
### AI Systems Assignment — Full Stack / AI Intern

> AI-powered modules for sustainable commerce: catalog intelligence, B2B proposals, impact reporting, and WhatsApp support.

---

## Modules Implemented

| Module | Status | Description |
|--------|--------|-------------|
| **Module 1** — AI Catalog Tagger | ✅ Full | Auto-assigns category, sub-category, 5–10 SEO tags, sustainability filters |
| **Module 2** — B2B Proposal Generator | 📝 Outline | Budget-aware product mix, cost breakdown, CSR impact narrative (mock implementation provided in code) |
| **Module 3** — Impact Report Generator | 📝 Outline | Plastic/carbon metrics (deterministic) + human narrative (AI) (mock implementation provided in code) |
| **Module 4** — WhatsApp Support Bot | ✅ Full | Intent classification, order lookup, escalation logic, Twilio-ready |

---

## Architecture Overview

```
rayeva/
├── src/
│   ├── index.js                    # Express entry point
│   ├── db/schema.js                # SQLite schema + seed data
│   ├── utils/
│   │   ├── ai-client.js            # Anthropic wrapper — all AI calls route through here
│   │   └── validators.js           # Zod schemas for all AI outputs
│   ├── middleware/index.js         # Logging, error handling, env validation
│   └── modules/
│       ├── catalog/                # Module 1
│       ├── proposal/               # Module 2
│       ├── impact/                 # Module 3
│       └── whatsapp/               # Module 4
├── tests/run-all.js                # Integration test suite
├── .env.example
└── package.json
```

### Key Architecture Decisions

**1. Single AI client (`utils/ai-client.js`)**
Every AI call goes through one function using the **Groq SDK** and `llama-3.3-70b-versatile`. This gives us centralised logging, token tracking, retry logic (extendable), and a single place to swap models or add rate limiting. No module talks to Groq directly.

**2. AI for language, code for math**
The clearest example: Module 3 computes plastic saved and carbon avoided using product-specific lookup tables. AI gets the numbers handed to it and writes the narrative. The AI output is then *overridden* with our deterministic values before storage — so a hallucinated number can never enter the database.

**3. Zod validation on every AI output**
Every module has a schema. If Llama's JSON doesn't match it, the request fails cleanly with a specific error rather than silently storing garbage. This is how AI modules behave reliably in production.

**4. Separation of concerns**
- Business logic (what products exist, what orders are active, what the return policy says) lives in the service layer
- AI is called with business-grounded context — never asked to invent data
- Routes handle HTTP concerns only

---

## API Endpoints

### Module 1: Catalog Tagger
```
POST /api/catalog/tag
Body: { product_id, name, description, price }

POST /api/catalog/bulk-tag
(Tags all untagged products in DB)

GET /api/catalog/:productId
GET /api/catalog
```

### Module 2: B2B Proposals
```
POST /api/proposals/generate
Body: { client_name, team_size, use_case, budget_limit, preferences }

GET /api/proposals
GET /api/proposals/:id
```

### Module 3: Impact Reports
```
POST /api/impact/generate/:orderId
GET  /api/impact/:orderId
```

### Module 4: WhatsApp Support
```
POST /api/whatsapp/webhook    ← Twilio sends here
POST /api/whatsapp/test       ← Manual testing (no Twilio needed)
GET  /api/whatsapp/history/:phone
```

### Admin / Observability
```
GET /health
GET /api/logs    ← All AI prompt/response logs with token counts
```

---

## Sample Outputs

### Module 1 — Catalog Tag
```json
{
  "product_id": "P001",
  "product_name": "Bamboo Toothbrush Pack (4)",
  "primary_category": "Personal Care",
  "sub_category": "Oral Care",
  "seo_tags": [
    "bamboo toothbrush india",
    "plastic free toothbrush",
    "eco friendly oral care",
    "biodegradable toothbrush pack",
    "sustainable dental care",
    "BPA free toothbrush",
    "zero waste bathroom",
    "green toothbrush set"
  ],
  "sustainability_filters": ["plastic-free", "biodegradable", "zero-waste"],
  "confidence_score": 0.96
}
```

### Module 2 — B2B Proposal (excerpt)
```json
{
  "client_name": "GreenTech Solutions Pvt Ltd",
  "budget_limit": 25000,
  "product_mix": [
    {
      "product_id": "P001",
      "name": "Bamboo Toothbrush Pack (4)",
      "quantity": 15,
      "unit_price": 299,
      "subtotal": 4485,
      "rationale": "High-visibility daily use item — maximises employee touchpoint with brand's sustainability commitment"
    }
  ],
  "cost_breakdown": { "subtotal": 19200, "gst": 3456, "shipping": 0, "total": 22656 },
  "within_budget": true,
  "impact_positioning": "This procurement eliminates an estimated 18,000 single-use plastic items annually across your team..."
}
```

### Module 3 — Impact Report
```json
{
  "order_id": "ORD-2024-002",
  "plastic_saved_grams": 3200,
  "carbon_avoided_kg": 4.3,
  "local_sourcing_percentage": 67,
  "impact_statement": "With this order, you've replaced plastic that would outlast your next 50 birthdays — and kept your carbon footprint lighter than a 20km autorickshaw ride. Two-thirds of your products were made by Indian artisans and manufacturers, keeping money in local communities.",
  "breakdown": [
    { "product": "Recycled Steel Water Bottle 750ml", "plastic_saved_grams": 800, "carbon_avoided_kg": 2.5 },
    { "product": "Jute Shopping Bag Large", "plastic_saved_grams": 2400, "carbon_avoided_kg": 1.8 }
  ]
}
```

### Module 4 — WhatsApp Intent
```json
{
  "intent": "order_status",
  "order_id": "ORD-2024-001",
  "response": "Namaste! 🌿 Your order ORD-2024-001 has been delivered successfully. If you have any questions about the products or need help with anything, feel free to reach out!",
  "escalate": false,
  "escalation_reason": null
}
```

---

## AI Prompt Design

Each module uses a distinct prompting strategy:

### Module 1 — Constrained Classification
**Challenge:** LLMs are prone to inventing category names. We constrain by injecting the full taxonomy directly into the system prompt. The model can only pick from the list.

```
Available primary categories: Personal Care, Kitchen & Home, ...
Sub-categories: Personal Care → Oral Care, Skin Care, Hair Care...
```
This is a "closed-world assumption" pattern — the AI operates within a finite, predefined option set.

### Module 2 — Budget-Grounded Generation (Architecture Outline)
**Challenge:** Without grounding, the model invents products and prices. In a fully implemented version, we inject the live product catalogue from the database before calling the AI.

```
Available Product Catalogue:
- [P001] Bamboo Toothbrush Pack (4) | ₹299 | ...
- [P004] Recycled Steel Water Bottle | ₹799 | ...
```
The model can only recommend products that exist. Budget math is validated post-response. *Note: As per assignment instructions, this is provided as an architectural outline relying on a mock implementation.*

### Module 3 — Separation of Compute and Language (Architecture Outline)
**Challenge:** LLMs are unreliable at arithmetic. We compute all numbers in Node.js, then pass them as ground truth.

```
Pre-computed metrics (use these exact numbers):
- Total plastic saved: 3200g
- Total carbon avoided: 4.3kg
```
After the AI responds, we override its numeric fields with our computed values before storage. AI is used purely as a **language model**, not a calculator.

### Module 4 — Intent + Context Injection
**Challenge:** WhatsApp messages are ambiguous. We classify intent AND inject real order data so the AI can answer factually.

The system prompt defines a strict intent enum: `["order_status", "return_policy", "refund_request", ...]`. Business rules for escalation are explicit: refund + damage + urgency language → always escalate. The AI cannot choose not to escalate a refund request — the schema enforces it.

---

## Setup

```bash
git clone <repo>
cd rayeva
npm install
cp .env.example .env
# Add your GROQ_API_KEY to .env
npm start
```

**Run tests:**
```bash
npm test
```

**Test WhatsApp bot without Twilio:**
```bash
curl -X POST http://localhost:3000/api/whatsapp/test \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919876543210", "message": "What is the status of ORD-2024-001?"}'
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | ✅ | Groq API key |
| `GROQ_MODEL` | No | Default: `llama-3.3-70b-versatile` |
| `PORT` | No | Default: `3000` |
| `DB_PATH` | No | SQLite file path. Default: `./rayeva.db` |
| `TWILIO_ACCOUNT_SID` | Module 4 only | Twilio credentials for WhatsApp |
| `TWILIO_AUTH_TOKEN` | Module 4 only | |
| `TWILIO_WHATSAPP_FROM` | Module 4 only | Twilio sandbox number |

---

## Technical Choices

| Decision | Rationale |
|----------|-----------|
| **SQLite** | Zero-config, file-based — perfect for assignment scope. Swap to PostgreSQL in prod by changing the DB client |
| **Zod validation** | Runtime schema enforcement on AI outputs — catches hallucinations before they reach storage |
| **ES Modules** | Modern Node.js standard, cleaner imports |
| **No ORM** | Direct SQL for transparency and control at this scope |
| **Groq SDK** | Official SDK handles auth, retries, and high-speed generation with Llama 3.3. |

---

*Built for Rayeva AI Systems Assignment — Akshit, DTU*
