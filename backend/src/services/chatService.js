import Anthropic from '@anthropic-ai/sdk';
import axios from 'axios';
import { AppError } from '../utils/AppError.js';
import { agentTools } from '../llm/tools.js';
import { SYSTEM_PROMPT } from '../llm/prompts.js';
import * as taskService from './taskService.js';
import * as expenseService from './expenseService.js';
import * as budgetService from './budgetService.js';
import { floatToCents } from '../utils/dateHelpers.js';
import * as settingsService from './settingsService.js';
import { logger } from '../utils/logger.js';

// Convert Anthropic tool format → OpenAI function-calling format
function toOpenAITools(tools) {
  return tools.map((t) => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.input_schema },
  }));
}

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
      return result.next_due
        ? `Done! Next occurrence: ${new Date(result.next_due).toLocaleDateString()}.`
        : 'Task marked as completed.';
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
      await expenseService.createExpense({
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

// ── Anthropic ────────────────────────────────────────────────────────────────

async function chatWithAnthropic(history, model, apiKey) {
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model,
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    tools: agentTools,
    messages: history,
  });

  if (response.stop_reason === 'tool_use') {
    const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use');
    const toolResults = await Promise.all(
      toolUseBlocks.map(async (block) => ({
        type: 'tool_result',
        tool_use_id: block.id,
        content: await executeTool(block.name, block.input),
      }))
    );

    const followUp = await client.messages.create({
      model,
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      tools: agentTools,
      messages: [
        ...history,
        { role: 'assistant', content: response.content },
        { role: 'user', content: toolResults },
      ],
    });

    return followUp.content.find((b) => b.type === 'text')?.text || 'Done.';
  }

  return response.content.find((b) => b.type === 'text')?.text || 'Done.';
}

// ── OpenAI-compatible (Ollama, OpenRouter, OpenAI) ───────────────────────────

async function chatWithOpenAICompat(history, model, apiKey, baseUrl) {
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const endpoint = `${baseUrl.replace(/\/$/, '')}/v1/chat/completions`;
  const openaiMessages = [{ role: 'system', content: SYSTEM_PROMPT }, ...history];

  let data;
  try {
    ({ data } = await axios.post(
      endpoint,
      { model, messages: openaiMessages, tools: toOpenAITools(agentTools), max_tokens: 1500 },
      { headers }
    ));
  } catch (err) {
    // Model doesn't support tool calling — retry without tools
    const msg = err.response?.data?.error?.message || '';
    if (err.response?.status === 400 && /tool|function/i.test(msg)) {
      logger.warn({ model, msg }, 'Model does not support tools, retrying without');
      ({ data } = await axios.post(
        endpoint,
        { model, messages: openaiMessages, max_tokens: 1500 },
        { headers }
      ));
      return data.choices?.[0]?.message?.content || 'Done.';
    }
    throw err;
  }

  const choice = data.choices?.[0];
  if (!choice) throw new Error('No response from AI provider');

  if (choice.finish_reason === 'tool_calls') {
    const toolCalls = choice.message.tool_calls || [];
    const toolResults = await Promise.all(
      toolCalls.map(async (tc) => {
        const args = typeof tc.function.arguments === 'string'
          ? JSON.parse(tc.function.arguments)
          : tc.function.arguments;
        return {
          role: 'tool',
          tool_call_id: tc.id,
          content: await executeTool(tc.function.name, args),
        };
      })
    );

    const { data: followUp } = await axios.post(
      endpoint,
      { model, messages: [...openaiMessages, choice.message, ...toolResults], max_tokens: 1000 },
      { headers }
    );

    return followUp.choices?.[0]?.message?.content || 'Done.';
  }

  return choice.message?.content || 'Done.';
}

// ── Gemini ───────────────────────────────────────────────────────────────────

async function chatWithGemini(history, model, apiKey) {
  const contents = history.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }],
  }));

  const { data } = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      generationConfig: { maxOutputTokens: 1500 },
    }
  );

  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Done.';
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function chat(messages) {
  const history = messages.map((m) => ({ role: m.role, content: m.content }));
  const provider = await settingsService.getActiveProvider();
  const model = await settingsService.getActiveModel();

  logger.debug({ provider, model }, 'chat request');

  try {
    switch (provider) {
      case 'ollama': {
        const baseUrl = await settingsService.getOllamaBaseUrl();
        return await chatWithOpenAICompat(history, model, '', baseUrl);
      }
      case 'openrouter': {
        const apiKey = await settingsService.getApiKeyForProvider('openrouter');
        return await chatWithOpenAICompat(history, model, apiKey, 'https://openrouter.ai/api');
      }
      case 'openai': {
        const apiKey = await settingsService.getApiKeyForProvider('openai');
        return await chatWithOpenAICompat(history, model, apiKey, 'https://api.openai.com');
      }
      case 'gemini': {
        const apiKey = await settingsService.getApiKeyForProvider('gemini');
        return await chatWithGemini(history, model, apiKey);
      }
      case 'anthropic':
      default: {
        const apiKey = await settingsService.getAnthropicKey();
        return await chatWithAnthropic(history, model, apiKey);
      }
    }
  } catch (err) {
    const status = err.status ?? err.response?.status;
    if (status === 429) throw new AppError('AI rate limited. Please wait a moment.', 429);
    logger.error({ provider, model, err: err.message, response: err.response?.data }, 'chat error');
    throw err;
  }
}

export async function handleInboundMessage(text, channel, from) {
  return chat([{ role: 'user', content: text }]);
}
