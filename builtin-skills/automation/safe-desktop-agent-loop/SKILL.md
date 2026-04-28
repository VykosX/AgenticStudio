---
name: safe-desktop-agent-loop
description: Run recoverable desktop observe-act loops with screenshots, waits, checkpoints, and bounded input when the automation may need retries or resumption.
---

# Safe Desktop Agent Loop

## When To Use

- Desktop automation requires multiple observe-act cycles.
- The agent must wait for visual or process state.
- A long-running GUI task should be recoverable.

## Workflow

1. Create an agent task record with the objective and stop conditions.
2. Observe process, window, and screenshot state before acting.
3. Start with one bounded action or short input burst, then wait for a concrete signal and verify at the end of that burst first.
4. If that fails, split the work into operation-sized chunks and verify after each chunk. Only fall back to per-input verification after chunked recovery also fails.
5. If the agent is guessing coordinates or key names, switch to tool help, window control inspection, `as_vision_target`, region screenshots, or a more deterministic action instead of repeating the same tactic.
6. If standard typing or hotkeys fail, switch to lower-level input such as `as_input_controller(action="key_event")` rather than looping on the same SendKeys pattern.
7. If the normal desktop tools still cannot express the workflow on Windows, write a small AutoHotkey v2 script and run it through `as_input_controller(action="autohotkey_script")` instead of flailing with repeated guesses.
8. Append progress after every meaningful state change.
9. Stop on unexpected windows, login prompts, payments, deletes, sends, or security warnings.
10. Resume from task state if interrupted.

## Preferred Tools

- `as_agent_task`
- `as_window_controller`
- `as_screenshot_capture`
- `as_vision_target`
- `as_input_controller`
- `as_process_controller`
- `as_sleep`

## Output

- task state
- observation
- action
- wait signal
- stop reason
