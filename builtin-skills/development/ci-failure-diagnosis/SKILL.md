---
name: ci-failure-diagnosis
description: Diagnose failing CI by matching the remote failure to a local reproduction, separating infrastructure flake from code regression.
---

# CI Failure Diagnosis

## When To Use

- A build, test, lint, or deploy check fails in CI.
- The failure does not reproduce locally yet.
- User asks to fix a failing workflow or PR check.

## Workflow

1. Capture the failing job, command, platform, and exact log excerpt.
2. Identify whether the failing command exists locally.
3. Reproduce locally with the closest environment and flags.
4. Classify as code regression, missing dependency, environment drift, timeout, race, or flaky external service.
5. Fix the smallest root cause and rerun the relevant command.
6. If the issue is flaky, add stabilization or retry only with evidence.

## Preferred Tools

- `as_run_shell_command`
- `as_project_verify`
- `as_file_read`
- `as_file_search_text`
- `as_git_controller`

## Output

- failing check
- local reproduction
- classification
- fix
- verification
- CI-only risk
