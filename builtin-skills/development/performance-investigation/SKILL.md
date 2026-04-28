---
name: performance-investigation
description: Investigate slowness with measurement first, isolate bottlenecks, and verify improvements against a baseline.
---

# Performance Investigation

## When To Use

- User reports slowness, high CPU, high memory, latency, or timeouts.
- A proposed optimization lacks measurement.
- A change might improve one path while regressing another.

## Workflow

1. Define the user-visible performance target.
2. Capture a baseline with the smallest repeatable benchmark or log.
3. Identify whether the bottleneck is CPU, memory, IO, network, database, rendering, or startup.
4. Inspect hot paths and avoid premature rewrites.
5. Make one optimization at a time.
6. Rerun the same baseline and compare before/after.

## Preferred Tools

- `as_run_shell_command`
- `as_process_controller`
- `as_project_verify`
- `as_code_outline`
- `as_file_search_text`

## Output

- target
- baseline
- suspected bottleneck
- change
- before and after result
- tradeoffs
