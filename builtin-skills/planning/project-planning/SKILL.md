---
name: project-planning
description: Plan projects, phases, assumptions, and roadmaps with mode-specific guidance for discovery, phase review, plan-only work, and backward planning.
---

# Project Planning

## When To Use

- User asks for a plan, roadmap, phase breakdown, or plan review.
- The task is under-specified but can be advanced by inspecting context and stating assumptions.
- Execution should be paused because the user asked for planning only.

## Workflow

1. Pick a mode: `discovery`, `roadmap`, `phase_review`, or `plan_only`.
2. Inspect available local context before asking questions.
3. State assumptions explicitly and keep them easy to revise.
4. Work backward from the desired outcome into milestones and success checks.
5. Identify risks, dependencies, hidden decisions, and verification points.
6. If execution is not requested, stop at the plan and do not edit files.
7. If execution is requested, hand off to the smallest next implementation slice.

## Preferred Tools

- `as_tool_help`
- `as_file_tree`
- `as_file_search_text`
- `as_agent_task`
- `as_todo_controller`
- `as_memory_controller`

## Output

- mode used
- assumptions
- phased plan
- risks
- success checks
- next action
