---
name: file-watch-inbox-automation
description: Watch folders for new or changed files, classify them, and trigger bounded organization or processing steps.
---

# File Watch Inbox Automation

## When To Use

- A folder receives recurring downloads, screenshots, exports, logs, or media imports.
- User wants an automated local inbox workflow.
- The agent should detect changes before acting.

## Workflow

1. Create a watcher snapshot for the inbox folder.
2. Scan later for added, removed, and modified files.
3. Classify only new or changed files.
4. Preview rename, extraction, conversion, or move actions before applying.
5. Record actions in task output or memory for repeatability.
6. Keep automation bounded with limits and explicit stop conditions.

## Preferred Tools

- `as_file_watch`
- `as_file_watch`
- `as_file_organize`
- `as_file_rename`
- `as_agent_task`
- `as_sleep`

## Output

- watcher id
- detected changes
- planned actions
- applied actions
- next scan
