---
name: test-first-change
description: Drive behavior changes with a failing test first, then the smallest implementation and a final regression pass.
---

# Test First Change

## When To Use

- Adding behavior, fixing a bug, or refactoring behavior-sensitive code.
- A missing regression test would let the issue return.
- User asks for high-confidence implementation.

## Workflow

1. Identify one behavior to prove.
2. Add or update a focused test before production code when feasible.
3. Run the test and confirm it fails for the expected reason.
4. Make the smallest implementation change that passes.
5. Run the focused test and the closest broader regression check.
6. Refactor only while keeping tests green.

## Preferred Tools

- `as_project_verify`
- `as_python_run_tests`
- `as_run_shell_command`
- `as_file_read`
- `as_file_patch`

## Output

- behavior under test
- red result
- implementation
- green result
- broader verification
