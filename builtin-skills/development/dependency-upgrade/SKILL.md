---
name: dependency-upgrade
description: Upgrade dependencies safely by reading changelogs, isolating version changes, running compatibility checks, and documenting risk.
---

# Dependency Upgrade

## When To Use

- User asks to update packages, SDKs, frameworks, runtimes, or lockfiles.
- A dependency change may alter APIs, build behavior, or security posture.
- Multiple packages need coordinated version movement.

## Workflow

1. Identify current versions, lockfile state, and package manager.
2. Prefer official release notes or migration docs for breaking changes.
3. Upgrade the smallest coherent set of packages.
4. Rebuild, run tests, and inspect type or lint failures.
5. Fix compatibility at call sites rather than suppressing errors.
6. Summarize version changes and residual risk.

## Preferred Tools

- `as_file_read`
- `as_web_search`
- `as_project_verify`
- `as_run_shell_command`
- `as_git_controller`

## Output

- upgraded packages
- source notes
- compatibility fixes
- verification
- rollback note
