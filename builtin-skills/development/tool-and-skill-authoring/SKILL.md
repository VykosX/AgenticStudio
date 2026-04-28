---
name: tool-and-skill-authoring
description: Create reusable local capabilities only when repetition or fragility justifies the abstraction, then validate them immediately.
---

# Tool And Skill Authoring

## When To Use

- Same workflow keeps repeating.
- A process is fragile enough to deserve a reusable tool or skill.
- User explicitly asks to create a skill or dynamic tool.

## Workflow

1. Keep the capability narrow.
2. Prefer scaffolding over blank-file invention.
3. Put durable workflow instructions in skills.
4. Put deterministic execution in tools.
5. Validate immediately after creation.

## Preferred Tools

- `as_skill_recommend`
- `as_skill`
- `as_dynamic_tool`

## Output

- capability created
- where it lives
- how it should be used
