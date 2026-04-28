---
name: api-contract-change
description: Change APIs, schemas, or interfaces with explicit producer-consumer mapping, compatibility decisions, and contract verification.
---

# API Contract Change

## When To Use

- Altering public functions, endpoints, schemas, events, CLI flags, or config keys.
- Multiple callers or consumers may depend on the shape.
- Backward compatibility is uncertain.

## Workflow

1. Identify producers, consumers, and persisted data affected by the contract.
2. Decide whether compatibility is required or a migration is acceptable.
3. Update schema, validation, types, docs, and examples together.
4. Add tests for old behavior if preserved and new behavior if changed.
5. Search for all call sites before removing old fields.
6. Document migration notes and version impact.

## Preferred Tools

- `as_file_search_text`
- `as_code_outline`
- `as_structured_data`
- `as_project_verify`
- `as_file_patch`

## Output

- contract changed
- affected consumers
- compatibility decision
- tests and docs
- migration notes
