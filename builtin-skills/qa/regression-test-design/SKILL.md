---
name: regression-test-design
description: Design tests that would have caught a bug or protect a changed behavior, emphasizing observable outcomes over implementation details.
---

# Regression Test Design

## When To Use

- Fixing a bug that could return.
- Changing behavior without enough coverage.
- Reviewing whether tests prove the important outcome.

## Workflow

1. Describe the failure or behavior in user-visible terms.
2. Identify the smallest stable seam to test.
3. Prefer real code and observable results over mock-only assertions.
4. Cover the edge case that failed and one nearby boundary.
5. Ensure the test fails on the old behavior if possible.
6. Keep the test readable enough to serve as documentation.

## Preferred Tools

- `as_file_read`
- `as_file_search_text`
- `as_project_verify`
- `as_python_run_tests`
- `as_run_shell_command`

## Output

- behavior protected
- test seam
- cases added
- red or baseline result
- final verification
