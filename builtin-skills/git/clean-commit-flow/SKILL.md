---
name: clean-commit-flow
description: Move repository work through inspect, stage, commit, and publish steps with explicit checks between each step.
---

# Clean Commit Flow

## When To Use

- Repo changes need to be staged, committed, restored, stashed, or pushed.
- User wants structured git work instead of raw shell git.

## Workflow

1. Inspect with status and diff first.
2. Stage only the intended paths.
3. Re-check diff.
4. Commit with a precise message.
5. Publish only after verification when appropriate.
6. Use restore, reset, stash, or clean intentionally and visibly.

## Preferred Tools

- `as_git_controller`

## Output

- repo state before
- action taken
- repo state after
