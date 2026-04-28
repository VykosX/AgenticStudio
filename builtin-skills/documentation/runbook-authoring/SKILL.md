---
name: runbook-authoring
description: Write operational runbooks with symptoms, diagnostics, safe actions, rollback, escalation, and verification.
---

# Runbook Authoring

## When To Use

- A workflow needs repeatable operational instructions.
- Debugging or release knowledge should be reusable.
- User asks for a playbook, SOP, or recovery guide.

## Workflow

1. Define the scenario and owner.
2. List symptoms and how to confirm them.
3. Add diagnostic commands with expected signals.
4. Separate safe read-only checks from mutating recovery actions.
5. Include rollback and escalation criteria.
6. End with verification and cleanup.

## Preferred Tools

- `as_file_read`
- `as_run_shell_command`
- `as_process_controller`
- `as_service_controller`
- `as_port_list`

## Output

- runbook
- diagnostics
- recovery steps
- rollback
- verification
