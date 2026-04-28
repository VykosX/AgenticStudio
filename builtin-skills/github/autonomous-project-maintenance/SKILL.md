---
name: autonomous-project-maintenance
description: Scan a GitHub-backed project, create tasks, make focused fixes, verify locally, and prepare clean commits or pushes with user-safe checkpoints.
---

# Autonomous Project Maintenance

## When To Use

- User wants the agent to maintain a repository, scan for issues, fix bugs, or prepare a push.
- Work can proceed through local git and verification tools.
- Multiple small issues should be tracked rather than held in chat.

## Workflow

1. Inspect repository status and do not overwrite unrelated local changes.
2. Analyze project structure, likely verification commands, and current issues.
3. Create task records for independent fixes.
4. Work one focused fix at a time and verify each change.
5. Review diffs before committing.
6. Push only after the user has authorized publishing or the workflow explicitly allows it.

## Preferred Tools

- `as_git_controller`
- `as_project_analyze`
- `as_project_bug_scan`
- `as_agent_task`
- `as_project_verify`

## Output

- repo state
- task list
- fixes made
- verification
- commit or push status
