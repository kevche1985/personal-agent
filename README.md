# Personal AI Agent

A self-hosted personal AI assistant for task management, budgeting, and bank statement analysis.

**Features:**
- **Tasks** — Create, track, and get reminded about tasks via WhatsApp/Telegram
- **Budget** — Set category limits, log expenses, receive over-budget alerts
- **Statement Analysis** — Upload PDF bank/credit card statements; get AI-powered expense detection and savings recommendations
- **Conversational Interface** — Natural language commands from any messaging app via OpenClaw
- **Google Calendar Sync** — Bidirectional task/event sync

---

## Quick Start (Docker Compose)

```bash
git clone https://github.com/kevche1985/personal-agent.git && cd personal-agent
cp .env.example .env          # fill in ANTHROPIC_API_KEY and other keys
docker compose up -d          # starts app, db, redis, openclaw
```

- **Dashboard:** http://localhost:3000 (frontend via nginx) or http://localhost:5173 (Vite dev server)
- **OpenClaw onboarding:** http://localhost:18789 — pair WhatsApp, Telegram, etc.

---

## Environment Variables

See `.env.example` for all required variables. Minimum required:

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key for AI features |
| `JWT_SECRET` | Random string ≥16 chars for JWT signing |
| `OPENCLAW_HOOKS_TOKEN` | Shared secret between backend and OpenClaw |

Optional (for Google Calendar sync):

| Variable | Description |
|---|---|
| `GOOGLE_CLIENT_ID` | Google OAuth2 client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth2 client secret |
| `GOOGLE_REDIRECT_URI` | OAuth callback (default: http://localhost:3000/api/calendar/callback) |

---

## API Reference

### Tasks
```
GET    /api/tasks               List tasks (filter: status, priority, category)
GET    /api/tasks/stats         Task counts by status
POST   /api/tasks               Create task
PATCH  /api/tasks/:id           Update task
DELETE /api/tasks/:id           Delete task
```

### Budget
```
GET  /api/budget/limits         List budget limits
PUT  /api/budget/limits         Set/update a limit
GET  /api/budget/summary        Current month spending vs limits
GET  /api/budget/categories     Available categories
```

### Expenses
```
GET    /api/expenses            List expenses (filter: category, from, to)
POST   /api/expenses            Log expense
DELETE /api/expenses/:id        Delete expense
GET    /api/expenses/monthly-totals  Totals by month and category
```

### Statements
```
POST   /api/statements/upload               Upload PDF statement
GET    /api/statements                      List all statements
GET    /api/statements/:id/report           AI improvement report
GET    /api/statements/:id/transactions     Parsed transactions
GET    /api/statements/:id/findings         Detected issues
PATCH  /api/statements/findings/:id         Accept or dismiss a finding
GET    /api/statements/compare?ids=a,b      Month-over-month comparison
```

### Chat
```
POST /api/chat     { messages: [{ role, content }] } → { reply }
```

### Calendar
```
GET /api/calendar/auth       → { url } (Google OAuth redirect URL)
GET /api/calendar/callback   OAuth code exchange
GET /api/calendar/events     Upcoming events
```

---

## OpenClaw Setup

OpenClaw is the notification gateway — it handles delivery to WhatsApp, Telegram, Discord, and 20+ other channels.

1. Start OpenClaw: `docker compose up openclaw -d`
2. Visit http://localhost:18789 and follow the onboarding wizard
3. Pair WhatsApp by scanning the QR code, or add your Telegram bot token
4. The `personal-agent` skill is pre-installed in `openclaw-config/workspace/skills/`

**Two-way commands from any channel:**
- `log $50 groceries` — logs expense
- `show my tasks` — lists pending tasks
- `show my budget` — monthly budget status
- `mark done [task name]` — completes a task
- *Attach a PDF* — triggers statement analysis

---

## Local Native Install (No Docker)

See [docs/LOCAL_INSTALL.md](docs/LOCAL_INSTALL.md) for PostgreSQL, Redis, Node.js, and OpenClaw setup without Docker.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend API | Node.js 20 + Express |
| Database | PostgreSQL 16 |
| Cache / Queue | Redis 7 |
| AI | Anthropic Claude API (claude-sonnet-4-6) |
| PDF Parsing | pdf-parse |
| Notifications | OpenClaw Gateway |
| Frontend | React 18 + Tailwind CSS + Recharts + Vite |
| Deployment | Docker Compose |
