---
name: vision-guided-computer-use
description: Control local apps with screenshot-driven verification, OCR or vision checks, window focus, and bounded input loops when the UI must be observed after each step.
---

# Vision Guided Computer Use

## When To Use

- User wants the agent to operate a local app or desktop workflow on their behalf.
- The task requires seeing what is on screen before deciding what to click, type, or copy.
- Window titles, button labels, or app state may change during the workflow.

## Workflow

1. Identify or focus the correct app window with `as_window_controller`.
2. Capture the current visible state with `as_screenshot_capture`.
3. Use `as_vision_ocr` for exact visible text, numbers, equations, and display readouts, `as_vision_target` for approximate coordinates and bounds of buttons, sliders, icons, and labels, `as_vision_focus` for detailed UI-state or local-element questions, and `as_vision_recognize` only for broader scene understanding before acting.
4. Start with the default fast path on the vision tools. Only retry with `fast=false` if the fast answer is incomplete, clearly wrong, or too uncertain.
5. On Windows, use `as_window_controller` `action="controls"` before falling back to OCR alone. It now returns a hybrid inventory: UI Automation controls plus Win32 child-window controls when the app exposes sub-windows but not UIA. Filter by `automation_id`, `control_name`, or `control_type` plus a small `limit` when you only need one or a few readings, and prefer comma-separated or JSON-array string filters when that lets one call fetch multiple known controls.
6. Prefer keyboard shortcuts, clipboard operations, and deterministic window actions over fragile coordinate clicks.
7. Call `as_input_controller` with `action="help"` before inventing key names, operator names, or sequence formats.
8. Use `as_input_controller.delay_ms` instead of separate sleep calls when an input needs a short settle time.
9. Prefer `as_input_controller` `action="paste_text"` for exact text entry when the app accepts paste; use `action="type"` for apps where typed keystrokes are required.
10. Prefer `as_input_controller` `action="press"` with valid named keys from `action="help"` instead of guessed punctuation when the target app expects non-text keys.
11. Start with one reasonable input burst in a single tool call when the app is likely to accept it. Verify at the end first, not after every keystroke.
12. If an input result reports an empty combo, empty key dispatch, or anything else that suggests nothing was actually sent, treat it as failure immediately and verify before continuing.
13. If the one-shot attempt fails, split the work by operation-sized chunks and verify after each chunk. Only fall back to per-input verification after chunked recovery also fails.
14. If two coordinate clicks fail or the target is a specific button, slider, icon, or menu item, switch to `as_window_controller` `action="controls"` first. Use `action="invoke_control"` for actionable UIA controls, `action="send_message"` for Win32 child-window controls with `nativeWindowHandle` and `messageHints`, or `as_vision_target` when the app is custom-drawn and exposes no usable controls at all.
15. If you listed controls with a custom `max_depth`, reuse that same `max_depth` or a larger one when invoking one of those controls so the target stays in search scope.
16. Use `as_screenshot_capture` with `include_cursor=true` when the current pointer position matters. Compare the returned `windowRelativeCursor` with the latest mouse or drag result to judge how close the pointer really landed to the intended element.
17. Mouse and drag calls return `requestedCoordinates`, `resolvedCoordinates`, `targetWindowBounds`, and `windowRelativeCursor`. Use those values to reason about relative and absolute positioning before repeating another nearby click or drag.
18. If the full screenshot makes a small control hard to inspect, recapture with `as_screenshot_capture(source="region")`; on Windows prefer `coordinate_space="window"` for app-relative crops.
19. Use `as_input_controller` `action="key_event"` when normal press or hotkey dispatch is not being accepted reliably by the target app.
20. If the standard window, control, screenshot, and input tools still cannot express the needed interaction on Windows, write a small AutoHotkey v2 script and run it through `as_input_controller(action="autohotkey_script")` as a last resort. When you target a window, prefer the injected helpers such as `AgenticWindowMouseMove`, `AgenticWindowClick`, and `AgenticWindowDrag` instead of doing your own screen-coordinate math.
21. For pointer-sensitive workflows, use smooth drag or richer mouse actions instead of trying to approximate a held press with repeated clicks.
22. If the task needs a reset or clear action, prefer the app's explicit shortcut or named control over repeated backspace guesses, then verify the cleared state before continuing.
23. If the task depends on a value shown in the UI, verify the value from the new screenshot instead of assuming it changed correctly.
24. Stop for destructive actions, purchases, account changes, sends, publishes, or anything ambiguous unless the user already made that intent explicit.

## Preferred Tools

- `as_window_controller`
- `as_screenshot_capture`
- `as_vision_ocr`
- `as_vision_target`
- `as_vision_focus`
- `as_vision_recognize`
- `as_clipboard_controller`
- `as_input_controller`
- `as_sleep`

## Output

- observed app and window
- actions taken
- screenshots or image paths checked
- final visible state
- uncertainty or confirmation points
