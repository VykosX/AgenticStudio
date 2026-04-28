---
name: context-budgeting
description: Keep long work stable by limiting scope, summarizing durable state, and stopping before context quality degrades.
---

# Context Budgeting

## When To Use

- Work spans many files, phases, tool calls, or restarts.
- The user wants continuity across compaction or chat switching.
- Context is getting crowded and mistakes would be costly.

## Workflow

1. Capture the current objective and next irreversible decision.
2. Read targeted context instead of broad dumps.
3. Store durable state as memory, todos, or agent task records.
4. Summarize findings before moving to a new phase.
5. Prefer small verified increments over one huge batch.
6. If quality is degrading, checkpoint state and recommend resuming from the checkpoint.

## Preferred Tools

- `as_memory_controller`
- `as_todo_controller`
- `as_agent_task`
- `as_file_read`

## Output

- current state
- kept context
- deferred context
- next action
- resume note if needed
