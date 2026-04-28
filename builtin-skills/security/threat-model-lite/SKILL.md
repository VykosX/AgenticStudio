---
name: threat-model-lite
description: Quickly threat-model a change by identifying assets, trust boundaries, abuse cases, controls, and verification gates.
---

# Threat Model Lite

## When To Use

- Changing auth, permissions, file access, network access, payments, user data, automation, or plugin execution.
- A feature expands what the agent or app can do.
- User asks whether a design is safe.

## Workflow

1. Identify assets and user data at risk.
2. Draw trust boundaries in text: user input, filesystem, network, secrets, tools, external services.
3. List realistic abuse cases, not abstract fears.
4. Map each abuse case to a prevention, detection, or recovery control.
5. Add verification gates for the highest-risk controls.
6. Call out accepted risk explicitly.

## Preferred Tools

- `as_file_read`
- `as_code_outline`
- `as_file_search_text`
- `as_project_verify`
- `as_memory_controller`

## Output

- assets
- boundaries
- abuse cases
- controls
- verification
- accepted risk
