export const agentTools = [
  {
    name: 'create_task',
    description: 'Create a new task or reminder for the user',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Task title' },
        description: { type: 'string', description: 'Optional description' },
        priority: { type: 'string', enum: ['low', 'medium', 'high'] },
        due_date: { type: 'string', description: 'ISO 8601 datetime for first/next occurrence' },
        reminder_at: { type: 'string', description: 'ISO 8601 datetime for reminder' },
        category: { type: 'string' },
        is_recurring: { type: 'boolean', description: 'Set true for repeating tasks' },
        recurrence_pattern: { type: 'string', enum: ['daily', 'weekdays', 'weekly', 'monthly'], description: 'How often it repeats' },
        recurrence_interval: { type: 'number', description: 'Repeat every N units (default 1)' },
        recurrence_time: { type: 'string', description: 'Time of day HH:MM (e.g. "09:00")' },
      },
      required: ['title'],
    },
  },
  {
    name: 'list_tasks',
    description: 'List tasks, optionally filtered by status or priority',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'cancelled'] },
        priority: { type: 'string', enum: ['low', 'medium', 'high'] },
      },
    },
  },
  {
    name: 'complete_task',
    description: 'Mark a task as completed',
    input_schema: {
      type: 'object',
      properties: { task_id: { type: 'string' } },
      required: ['task_id'],
    },
  },
  {
    name: 'log_expense',
    description: 'Log a new expense',
    input_schema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'One of the budget categories' },
        amount: { type: 'number', description: 'Amount in dollars' },
        merchant: { type: 'string' },
        description: { type: 'string' },
        expense_date: { type: 'string', description: 'ISO date (YYYY-MM-DD). Defaults to today.' },
      },
      required: ['category', 'amount'],
    },
  },
  {
    name: 'get_budget_status',
    description: "Get the user's current budget status for the month",
    input_schema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'If omitted, returns all categories' },
      },
    },
  },
  {
    name: 'snooze_task',
    description: 'Snooze a task reminder by N days',
    input_schema: {
      type: 'object',
      properties: {
        task_id: { type: 'string' },
        days: { type: 'number', default: 1 },
      },
      required: ['task_id'],
    },
  },
];
