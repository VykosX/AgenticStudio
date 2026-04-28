---
name: pull-request-autofix-loop
description: Iterate on a PR-style change by reading diffs, running checks, fixing failures, documenting verification, and preparing reviewer-ready output.
---

# Pull Request Autofix Loop

## When To Use

- A branch or PR needs fixes before review.
- CI, tests, lint, docs, or code review findings need iterative cleanup.
- The agent should work autonomously but keep changes reviewable.

## Workflow

1. Read branch status, diff, and recent commits.
2. Run the most relevant checks and capture failures.
3. Fix one root cause per iteration.
4. Re-run the failing check and then the closest broader verification.
5. Keep commits or staged changes scoped and explainable.
6. Produce a PR-ready summary with tests run and residual risk.

## Preferred Tools

- `as_git_controller`
- `as_project_verify`
- `as_project_bug_scan`
- `as_run_shell_command`

## Output

- starting branch state
- failures fixed
- verification
- remaining findings
- PR summary
