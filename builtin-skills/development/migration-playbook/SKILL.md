---
name: migration-playbook
description: Plan and execute migrations with inventory, compatibility windows, data safety, rollout checkpoints, and rollback paths.
---

# Migration Playbook

## When To Use

- Moving frameworks, schemas, storage layouts, APIs, config, or file organization.
- Work has ordering dependencies or rollback risk.
- Users or persisted data may be affected.

## Workflow

1. Inventory old shape, new shape, and all consumers.
2. Define a compatibility window or explicit cutover.
3. Write migration steps that can be paused and resumed.
4. Add validation before destructive cleanup.
5. Keep rollback or restore instructions close to the change.
6. Remove old paths only after verification passes.

## Preferred Tools

- `as_file_tree`
- `as_file_search_text`
- `as_structured_data`
- `as_project_verify`
- `as_file_operations_log`

## Output

- migration scope
- ordered steps
- compatibility plan
- validation
- rollback
