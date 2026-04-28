---
name: schema-first-operation
description: For resource-creation workflows, establish scope, verify dependencies, discover schema, validate payloads, and summarize operations.
---

# Schema First Operation

## When To Use

- Creating or updating structured resources such as CI/CD pipelines, cloud objects, database records, policies, or templates.
- A payload schema is available and guessing fields would be risky.
- Dependencies like connectors, secrets, environments, or roles must exist first.

## Workflow

1. Establish account, project, environment, and target scope before listing or mutating.
2. Verify dependencies exist before referencing them.
3. Discover or read the schema before writing payloads.
4. Generate the smallest valid payload.
5. Validate using dry-run, lint, parser, or API feedback before applying.
6. Summarize created, updated, skipped, and failed resources.

## Preferred Tools

- `as_structured_data`
- `as_file_read`
- `as_http_request`
- `as_tabular_data`
- `as_todo_controller`

## Output

- scope
- dependencies
- schema source
- operation summary
- validation result
