---
name: docs-refresh
description: Keep documentation aligned with code by treating code as source of truth, updating changed behavior, and verifying examples.
---

# Docs Refresh

## When To Use

- Code behavior, tool inventory, config, or setup changed.
- README and architecture docs differ from implementation.
- User asks for documentation cleanup.

## Workflow

1. Inspect the implemented behavior first.
2. Update docs to match code, not the other way around.
3. Prefer concise user-facing descriptions over internal detail.
4. Refresh commands, paths, examples, and inventories affected by the change.
5. Remove stale claims instead of adding caveats around them.
6. Verify links and commands where practical.

## Preferred Tools

- `as_file_read`
- `as_file_search_text`
- `as_project_analyze`
- `as_project_verify`
- `as_file_patch`

## Output

- docs changed
- source of truth checked
- examples verified
- remaining stale areas
