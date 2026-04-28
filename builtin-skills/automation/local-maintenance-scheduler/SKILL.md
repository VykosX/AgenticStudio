---
name: local-maintenance-scheduler
description: Create and manage scheduled local maintenance tasks with clear commands, scope, logs, and safety gates.
---

# Local Maintenance Scheduler

## When To Use

- User wants recurring cleanup, backup, indexing, downloads, or health checks.
- A local task should run later or repeatedly.
- Scheduling commands or services could affect the machine.

## Workflow

1. Define exact task purpose, schedule, command, working directory, and expected output.
2. Prefer dry-run or preview mode before scheduling mutating work.
3. Create the scheduled task only after the user confirms the scope.
4. Record where logs and outputs will live.
5. List the scheduled task after creation to verify it exists.
6. Provide disable or delete instructions.

## Preferred Tools

- `as_task_controller`
- `as_task_controller`
- `as_task_controller`
- `as_task_controller`
- `as_process_controller`
- `as_file_write`

## Output

- schedule
- command
- verification
- log path
- removal path
