# Personal Agent Skill

This skill connects OpenClaw to the Personal AI Agent backend, enabling two-way task management, expense logging, and budget queries from any messaging channel.

## Description

The Personal Agent is a task, budget, and statement analysis assistant. Use this skill to interact with it from WhatsApp, Telegram, Discord, or any other connected channel.

## Tools

### send_task_reminder
Send a task reminder notification to the user.

**Trigger:** Fired by OpenClaw cron on task reminder_at time.

```http
POST http://backend:3000/api/agent/message
Authorization: Bearer ${OPENCLAW_HOOKS_TOKEN}
Content-Type: application/json

{
  "text": "Reminder: {{task.title}}",
  "channel": "{{channel}}",
  "from": "system"
}
```

---

### query_tasks
List the user's current tasks.

**Trigger phrases:** "show my tasks", "what are my tasks", "list tasks"

```http
GET http://backend:3000/api/tasks?status=pending
Authorization: Bearer ${OPENCLAW_HOOKS_TOKEN}
```

**Response format:** Send each task as a line: `• [status] Title (due DATE)`

---

### log_expense
Log an expense from a chat message.

**Trigger phrases:** "log $X", "spent $X on Y", "add $X to Z category"

```http
POST http://backend:3000/api/expenses
Authorization: Bearer ${OPENCLAW_HOOKS_TOKEN}
Content-Type: application/json

{
  "category": "{{extracted_category}}",
  "amount_cents": {{amount_in_cents}},
  "merchant": "{{extracted_merchant}}",
  "expense_date": "{{today_iso}}"
}
```

---

### get_budget_status
Show the user's current monthly budget status.

**Trigger phrases:** "show my budget", "how much left in X", "budget status"

```http
GET http://backend:3000/api/budget/summary
Authorization: Bearer ${OPENCLAW_HOOKS_TOKEN}
```

---

### send_budget_alert
Deliver a budget warning or exceeded alert.

**Trigger:** Fired by the backend budget monitor when a category hits 75% or 100%.

```http
POST http://backend:3000/api/agent/message
Authorization: Bearer ${OPENCLAW_HOOKS_TOKEN}
Content-Type: application/json

{
  "text": "{{alert_message}}",
  "channel": "all",
  "from": "system"
}
```

---

### send_statement_summary
Send a statement analysis completion notification.

**Trigger:** Fired by the backend after statement processing completes.

```http
POST http://backend:3000/api/agent/message
Authorization: Bearer ${OPENCLAW_HOOKS_TOKEN}
Content-Type: application/json

{
  "text": "{{summary_message}}",
  "channel": "all",
  "from": "system"
}
```

---

## Inbound Message Handler

All user messages from any channel are forwarded to the backend's conversational NLP endpoint:

```http
POST http://backend:3000/api/agent/message
Authorization: Bearer ${OPENCLAW_HOOKS_TOKEN}
Content-Type: application/json

{
  "text": "{{user_message}}",
  "channel": "{{source_channel}}",
  "from": "{{user_id}}"
}
```

The backend uses Claude AI to understand the intent and execute the appropriate action, then returns a reply that OpenClaw delivers back to the user in the same channel thread.

## Supported Commands (Natural Language)

| Example message | Action |
|---|---|
| "Mark done Buy groceries" | Marks matching task complete |
| "Snooze this 2 days" | Snoozes last reminded task |
| "Log $45 groceries" | Creates expense: Food & Groceries $45 |
| "Show my budget" | Returns monthly budget summary |
| "How much is left in Entertainment?" | Returns Entertainment budget status |
| "What tasks are overdue?" | Lists overdue tasks |
| "Create task: Call dentist tomorrow" | Creates task with due date |

## Setup

1. Copy this file to `~/.openclaw/workspace/skills/personal-agent/SKILL.md`
2. Restart OpenClaw: `openclaw restart`
3. The skill is automatically discovered on next startup.
4. Pair your channels via `openclaw onboard` or http://localhost:18789
