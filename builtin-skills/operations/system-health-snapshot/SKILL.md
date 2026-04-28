---
name: system-health-snapshot
description: Collect a local system health snapshot covering processes, ports, services, environment, storage-oriented file signals, and follow-up tasks.
---

# System Health Snapshot

## When To Use

- User asks what is running, why a port is busy, or whether the local machine is healthy.
- Debugging needs process, service, port, or environment context.
- The agent should inspect without changing system state.

## Workflow

1. Read system and process state before killing or modifying anything.
2. Inspect ports, services, environment, and scheduled tasks relevant to the issue.
3. Identify obvious anomalies such as duplicate services, stuck processes, missing env vars, or busy ports.
4. Recommend safe next actions before mutating.
5. Create follow-up tasks for fixes requiring confirmation.
6. Report commands or tools used.

## Preferred Tools

- `as_system_info`
- `as_process_controller`
- `as_port_list`
- `as_service_controller`
- `as_task_controller`
- `as_environ_controller`

## Output

- system summary
- notable processes
- ports and services
- anomalies
- next actions
