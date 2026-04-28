---
name: computer-use-operator
description: Operate local desktop apps for short direct tasks by focusing windows, invoking controls, using keyboard or clipboard input, and confirming risky actions.
---

# Computer Use Operator

## When To Use

- User asks to control a local app, window, dialog, or desktop workflow.
- The task requires keyboard, mouse, clipboard, screenshot, or window tools.
- A browser tool is unavailable or not sufficient.

## Workflow

1. Observe the foreground window and capture a screenshot when useful.
2. Prefer clipboard and keyboard shortcuts over fragile coordinate clicks.
3. Use `as_input_controller` `action="help"` before guessing operator/key names, sequence syntax, or fallback options.
4. Start with one reasonable input burst in a single tool call when the app is likely to accept it, then verify at the end first.
5. If that fails, split the work by operation-sized chunks and verify after each chunk. Only fall back to per-input verification after chunked recovery also fails.
6. Use `as_vision_ocr` for exact text or numeric readouts, `as_vision_target` for approximate coordinates or bounds of buttons, sliders, icons, and labels, `as_vision_focus` for local UI-state questions, and `as_vision_recognize` for broader scene understanding.
7. Start with the default fast path on the vision tools. Only retry with `fast=false` if the fast answer is incomplete, clearly wrong, or too uncertain.
8. If precise clicking is hard, inspect controls instead of guessing more coordinates. Use `invoke_control` for actionable UIA controls, `send_message` for Win32 child-window controls with message hints, and `as_vision_target` only when the app exposes no usable controls at all.
9. If the target only accepts low-level input, switch to `as_input_controller` `action="key_event"` instead of retrying the same failed SendKeys pattern.
10. If pointer placement matters, use `include_cursor=true` screenshots plus the latest mouse or drag result fields to compare relative and absolute pointer position before retrying.
11. If a small UI area is hard to read, use `as_screenshot_capture(source="region")` for a tighter crop before acting again.
12. For hardware-control tasks such as fan curves, clocks, or temperatures, prefer `as_system_info(fields=...)` or `field_list=[...]` to verify the exact telemetry you changed instead of relying only on the visible UI when the provider data is available.
13. Use concrete waits after launching apps or changing windows.
14. Keep pointer actions minimal and reversible, but use richer down/up/drag controls when the workflow genuinely needs held buttons or smoother motion.
15. If the normal desktop tools still cannot express the interaction on Windows, write a small AutoHotkey v2 script and run it through `as_input_controller(action="autohotkey_script")` as a last resort. Prefer the injected `AgenticWindowClick` and `AgenticWindowDrag` helpers instead of manual screen math.
16. Stop before destructive actions, purchases, trades, sends, or publishes unless explicitly confirmed.
17. Report the final visible state and any uncertainty.

## Preferred Tools

- `as_window_controller`
- `as_clipboard_controller`
- `as_input_controller`
- `as_screenshot_capture`
- `as_vision_ocr`
- `as_vision_target`
- `as_vision_focus`
- `as_vision_recognize`

## Output

- observed app
- actions taken
- final state
- confirmation points
