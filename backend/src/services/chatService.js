import { anthropic, MODEL } from '../config/anthropic.js';
import { AppError } from '../utils/AppError.js';
import { agentTools } from '../llm/tools.js';
import { SYSTEM_PROMPT } from '../llm/prompts.js';
import * as taskService from './taskService.js';
import * as expenseService from './expenseService.js';
import * as budgetService from './budgetService.js';
import { floatToCents } from '../utils/dateHelpers.js';

async function executeTool(name, input) {
  switch (name) {
    case 'create_task': {
      const task = await taskService.createTask(input);
      return `Task created: "${task.title}" (ID: ${task.id})`;
    }
    case 'list_tasks': {
      const tasks = await taskService.listTasks(input);
      if (!tasks.length) return 'No tasks found.';
      return tasks.map((t) => `• [${t.status}] ${t.title}${t.due_date ? ` (due ${new Date(t.due_date).toLocaleDateString()})` : ''}`).join('\n');
    }
    case 'complete_task': {
      const result = await taskService.completeTask(input.task_id);
      if (result.next_due) {
        return `Done! Next occurrence: ${new Date(result.next_due).toLocaleDateString()}.`;
      }
      return `Task marked as completed.`;
    }
    case 'snooze_task': {
      const days = input.days || 1;
      const task = await taskService.getTask(input.task_id);
      const newReminder = new Date();
      newReminder.setDate(newReminder.getDate() + days);
      await taskService.updateTask(input.task_id, { reminder_at: newReminder.toISOString() });
      return `Reminder snoozed ${days} day(s).`;
    }
    case 'log_expense': {
      const expense = await expenseService.createExpense({
        category: input.category,
        amount_cents: floatToCents(input.amount),
        merchant: input.merchant,
        description: input.description,
        expense_date: input.expense_date || new Date().toISOString().slice(0, 10),
      });
      return `Expense logged: $${input.amount.toFixed(2)} in ${input.category}${input.merchant ? ` at ${input.merchant}` : ''}.`;
    }
    case 'get_budget_status': {
      const summary = await budgetService.getMonthSummary();
      if (!summary.length) return 'No budget data for this month.';
      const filtered = input.category
        ? summary.filter((s) => s.category.toLowerCase() === input.category.toLowerCase())
        : summary;
      return filtered.map((s) => {
        const spent = `$${(s.spent_cents / 100).toFixed(2)}`;
        const limit = s.monthly_limit_cents ? ` / $${(s.monthly_limit_cents / 100).toFixed(2)} limit` : '';
        const pct = s.monthly_limit_cents ? ` (${Math.round((s.spent_cents / s.monthly_limit_cents) * 100)}%)` : '';
        return `• ${s.category}: ${spent}${limit}${pct}`;
      }).join('\n');
    }
    default:
      return `Unknown tool: ${name}`;
  }
}

export async function chat(messages) {
  const history = messages.map((m) => ({ role: m.role, content: m.content }));

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      tools: agentTools,
      messages: history,
    });

    if (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use');
      const toolResults = [];

      for (const block of toolUseBlocks) {
        const result = await executeTool(block.name, block.input);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: result,
        });
      }

      const followUp = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        tools: agentTools,
        messages: [
          ...history,
          { role: 'assistant', content: response.content },
          { role: 'user', content: toolResults },
        ],
      });

      const text = followUp.content.find((b) => b.type === 'text');
      return text?.text || 'Done.';
    }

    const text = response.content.find((b) => b.type === 'text');
    return text?.text || 'Done.';
  } catch (err) {
    if (err.status === 429) throw new AppError('AI rate limited. Please wait a moment.', 429);
    throw err;
  }
}

export async function handleInboundMessage(text, channel, from) {
  const messages = [{ role: 'user', content: text }];
  const reply = await chat(messages);
  return reply;
}
