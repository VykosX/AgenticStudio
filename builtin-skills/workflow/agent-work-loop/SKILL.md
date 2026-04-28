---
name: agent-work-loop
description: Run iterative agent work with planning, task state, verification, resumption, decision logging, and concise status reporting.
---

# Agent Work Loop

## When To Use

- Work spans multiple steps, tool calls, files, or sessions.
- The agent must resume from state, report batch progress, or record decisions.
- A bug or change needs plan-do-verify discipline.

## Workflow

1. Pick a mode: `plan_do_verify`, `resume`, `decision_log`, `bug_triage`, or `status_report`.
2. Load relevant task, todo, and memory state before continuing.
3. Plan the next small slice, then execute only that slice.
4. Verify the result with the smallest credible check.
5. Record decisions, blockers, skipped items, and remaining work in persistent state when useful.
6. Prefer `as_file_patch` for edits and `as_git_controller` for repository inspection.
7. Summarize completed, failed, skipped, and next steps without dumping raw logs.

## Preferred Tools

- `as_agent_task`
- `as_todo_controller`
- `as_todo_controller`
- `as_memory_controller`
- `as_memory_controller`
- `as_project_verify`
- `as_project_bug_scan`
- `as_file_patch`
- `as_git_controller`

## Output

- mode used
- current state
- work completed
- verification
- decisions
- remaining tasks
