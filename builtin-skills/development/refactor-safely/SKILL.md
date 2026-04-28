---
name: refactor-safely
description: Refactor without behavior drift by establishing baseline checks, moving in small steps, and verifying after each risky boundary.
---

# Refactor Safely

## When To Use

- Code needs cleanup, decomposition, renaming, or structural movement.
- Behavior should remain unchanged.
- The target area has limited tests or hidden integration points.

## Workflow

1. Define the behavior that must not change.
2. Run or create a baseline check before editing.
3. Make one mechanical change at a time.
4. Preserve public APIs until callers are migrated.
5. Search for call sites and generated references before deleting.
6. Verify after each risky boundary, not only at the end.

## Preferred Tools

- `as_code_outline`
- `as_file_search_text`
- `as_project_verify`
- `as_file_patch`
- `as_git_controller`

## Output

- invariant behavior
- refactor steps
- changed boundaries
- verification
- remaining risks
