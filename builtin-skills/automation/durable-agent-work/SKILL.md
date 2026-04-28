---
name: durable-agent-work
description: Coordinate long-running, parallel, or task-registry-backed automation with durable state, bounded loops, ownership, and progress recovery.
---

# Durable Agent Work

## When To Use

- Work should survive compaction, restarts, or long pauses.
- Multiple independent work streams need coordination.
- The agent needs a queue, task registry, or explicit ownership boundaries.

## Workflow

1. Pick a mode: `long_running`, `task_registry`, `parallel_coordination`, or `maintenance_queue`.
2. Create or update persistent records with `as_agent_task`.
3. Split work by ownership and avoid overlapping write scopes.
4. Process bounded batches and checkpoint after each meaningful unit.
5. Append outputs or blockers to task records instead of relying on chat history.
6. Use waits and health checks rather than blind sleeps when orchestrating local processes.
7. Mark tasks done only after verification or an explicit reason.

## Preferred Tools

- `as_agent_task`
- `as_todo_controller`
- `as_process_controller`
- `as_port_wait`
- `as_http_wait`
- `as_sleep`
- `consult_secondary_agent`

## Output

- mode used
- task registry changes
- ownership map
- progress
- blockers
- next queued task
