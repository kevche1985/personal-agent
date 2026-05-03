ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS recurrence_pattern TEXT CHECK (
    recurrence_pattern IN ('daily','weekdays','weekly','monthly')
  ),
  ADD COLUMN IF NOT EXISTS recurrence_interval INTEGER DEFAULT 1 CHECK (recurrence_interval >= 1),
  ADD COLUMN IF NOT EXISTS recurrence_days_of_week INTEGER[],
  ADD COLUMN IF NOT EXISTS recurrence_time TIME,
  ADD COLUMN IF NOT EXISTS recurrence_end_date DATE,
  ADD COLUMN IF NOT EXISTS last_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completion_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS task_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_date_completed DATE,
  note TEXT
);

CREATE INDEX IF NOT EXISTS task_completions_task_idx ON task_completions(task_id);
