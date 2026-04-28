---
name: code-review
description: Review local or pull-request changes for correctness, security, regressions, tests, performance, and maintainability before shipping.
---

# Code Review

## When To Use

- User asks for a review, pre-push check, PR review, or second look.
- Changes are ready but need risk analysis before merge.
- A patch touches security, data, concurrency, or public contracts.

## Workflow

1. Get the diff summary before reading individual files.
2. Read changed files with surrounding context when the diff is not enough.
3. Prioritize bugs, security issues, behavior regressions, and missing tests.
4. Check edge cases: empty inputs, nulls, invalid paths, concurrency, stale config, cleanup, and error handling.
5. Keep findings specific with file and line references when available.
6. Separate blocking findings from suggestions.

## Preferred Tools

- `as_git_controller`
- `as_file_read`
- `as_file_search_text`
- `as_project_verify`

## Output

- findings by severity
- open questions
- tests run or missing
- approval or change recommendation
