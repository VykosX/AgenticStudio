---
name: systematic-debugging
description: Investigate failures scientifically by reproducing, tracing evidence, forming one hypothesis, and fixing only after root cause is understood.
---

# Systematic Debugging

## When To Use

- A test, build, integration, or runtime behavior fails.
- Previous fixes did not work.
- The tempting solution is a guess.

## Workflow

1. Read the full error, logs, stack trace, and affected files.
2. Reproduce the failure with the smallest reliable command or scenario.
3. Check recent changes, config, dependencies, and environment assumptions.
4. Trace data flow across boundaries until the bad value or state first appears.
5. Compare against a working pattern in the same codebase.
6. Form one root-cause hypothesis and test it with the smallest change.
7. Add or run a regression check before declaring success.

## Preferred Tools

- `as_project_bug_scan`
- `as_project_verify`
- `as_run_shell_command`
- `as_file_search_text`
- `as_code_outline`

## Output

- symptom
- reproduction
- evidence
- root cause
- fix
- verification
