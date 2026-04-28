---
name: per-app-automation-guidance
description: Prefer this for single-app desktop automation when Per-App Automation Guidance is enabled. It concentrates supported-app notes and app-focused interaction strategy so generic desktop tools stay lean.
---

# Per-App Automation Guidance

## When To Use

- The task is about operating one specific local app window rather than a broad desktop workflow.
- The app state must be observed and adjusted repeatedly inside the same window.
- `as_skill_recommend` surfaced this skill because Per-App Automation Guidance is enabled.

## Workflow

1. Resolve and focus the exact app window with `as_window_controller`.
2. Capture the current visible state with `as_screenshot_capture`.
   - If the user asked what the app says, asked to read a visible value, or asked to show the result, plan to embed a confirming screenshot before your final answer unless they explicitly said not to.
3. Prefer app-local verification before broader OCR guesses:
   - On Windows, use `as_window_controller(action="controls")` first. It returns UIA controls plus Win32 child-window controls when the app exposes sub-windows without useful UIA.
   - When you only need one or a few readings, filter `controls` with `automation_id`, `control_name`, or `control_type` plus a small `limit` instead of dumping the whole tree.
   - Those filters can be passed as a comma-separated string or JSON array string, so prefer one compact `controls` call that asks for multiple known fields when that saves context.
   - Otherwise use `as_vision_ocr` for exact text or numeric readouts, `as_vision_target` when you need approximate coordinates or bounds for buttons, sliders, icons, or labels, `as_vision_focus` for local UI-state questions, or `as_vision_recognize` only when you need broader scene understanding.
   - If you inspect controls with a custom `max_depth`, reuse that same `max_depth` or a larger one when invoking one of those controls or sending a direct Win32 message.
4. Start with the default fast path on the vision tools. Only retry with `fast=false` if the fast answer is incomplete, clearly wrong, or too uncertain.
5. Before sending keys, call `as_input_controller(action="help")` if you are unsure about valid key names, mouse actions, sequence formats, or AutoHotkey helper behavior.
6. Prefer deterministic operations over pixel guessing:
   - named control invocation or Win32 `send_message` before repeated coordinate clicks
   - keyboard shortcuts before fragile pointer work
   - clipboard paste before long simulated typing when paste is accepted
   - `as_vision_target` before repeated blind coordinate estimates when the app is custom-drawn
7. Escalate input effort in stages instead of starting at the slowest debugging loop:
   - first try one reasonable input burst in a single tool call, then verify at the end
   - if that fails, split the work by operation-sized chunks and verify after each chunk
   - if that still fails, fall back to individual input calls and verify after every call until you find the failing input
8. Keep input bursts short enough to reason about, but prefer one short burst over many tiny calls when the app is likely to accept it.
9. If ordinary dispatch keeps failing on Windows, use `as_input_controller(action="key_event")` first, then `action="autohotkey_script"` only as a last resort.

## Supported Apps

### Calculator

- Prefer `as_window_controller(action="controls")` to inspect readable controls such as expression or result text before relying on OCR alone.
- Read the display compactly with filtered controls such as `automation_id="[\"CalculatorResults\",\"CalculatorExpression\"]"` and a small `limit` when you want both fields in one call; do not try to invoke those text controls just to read them.
- If the user asked to see the result, screenshot the Calculator window and embed it after verification instead of only reporting the text value.
- If UIA is missing or incomplete, use `as_vision_ocr` to read the expression/result text directly and `as_vision_focus` for questions about which display element changed.
- Clear state explicitly and verify it really changed before entering a new expression. Prefer `escape` or the named `Clear` / `Clear entry` controls over `ctrl+a` or guessed delete behavior.
- Be careful with `invoke_control` name matches such as `Clear`; if the name is ambiguous, inspect controls first or use `escape` instead of accepting a partial match like `Clear all memory`.
- First attempt the expression in one tool call when the current mode is likely to accept it, for example `type("7*8+9/2.5=")` or a short `sequence`, then verify the final display.
- Remember that Calculator mode affects the meaning of that fast path: in Standard mode a one-shot expression still follows Standard Calculator behavior, while Scientific mode is the better target when the task requires normal operator precedence.
- If the one-shot attempt fails, split by operation-sized chunks such as `7*8=` and `9/2.5=` with verification after each chunk. Only fall back to per-key debugging after chunked input also fails.
- Prefer `as_input_controller(action="press")` with named keys such as `escape`, `enter`, `add`, `subtract`, `multiply`, `divide`, and `decimal` instead of guessed punctuation when the app ignores literal operator characters.
- If a key dispatch reports an empty combo or otherwise suggests nothing was actually sent, treat it as failure immediately and verify before trying the next input.
- If input silently fails, refocus the target window before the retry because the user may have interacted with the machine between calls.
- For memory or hamburger/menu interactions, prefer `invoke_control` on named buttons such as `Memory recall`, `Open memory flyout`, or `Open Navigation` before guessing click positions.
- Be deliberate about memory operations: `Memory store` saves the current value, `Memory add` adds to memory, and `Memory recall` recalls it. Verify the displayed value after each important memory action.
- If coordinate clicks keep missing small buttons such as menu entries or memory controls, switch to UIA controls or an AutoHotkey fallback instead of repeating nearby clicks.

### MSI Afterburner

- Expect `as_window_controller(action="controls")` to return no useful controls in many versions because MSI Afterburner often uses custom-drawn UI.
- Still call `as_window_controller(action="controls")` once before assuming the UI is fully custom-drawn, because some versions or skins expose child windows even when UIA is empty.
- Use `as_vision_target` to locate the specific slider handle, slider track end, value box, and Apply/checkmark control by window-relative image coordinates instead of asking a general vision tool for a prose description.
- Capture the window with `include_cursor=true` when you are debugging pointer placement. Reuse the returned `windowRelativeCursor` plus the latest mouse or drag result to understand where the pointer actually landed inside the window.
- For the Fan Speed workflow, first verify whether Auto fan mode is enabled and disable Auto before trying to drag the fan slider, because MSI Afterburner treats drags on disabled controls like window drags.
- After Auto is off, either drag the fan slider handle toward the target or click the numeric fan value field and type the desired value directly when that is more reliable than the slider.
- After setting the value and applying it, use `as_system_info(fields="gpu_fan_speeds_percent,gpu_fan_speeds_rpm,gpu_temperatures_c")` or `field_list=["gpu_fan_speeds_percent","gpu_fan_speeds_rpm","gpu_temperatures_c"]` to verify the hardware telemetry directly when LibreHardwareMonitor or another provider is available.
- After changing the value, verify the visible fan value again, and only then activate Apply.
- When you use mouse or drag input, compare `requestedCoordinates`, `resolvedCoordinates`, `targetWindowBounds`, and `windowRelativeCursor` before guessing a second nearby click.
- If a full-window screenshot makes the fan area too ambiguous, recapture a tight crop with `as_screenshot_capture(source="region", coordinate_space="window")` around the fan panel and run `as_vision_target` or `as_vision_ocr` on that crop instead of repeating the same guess on the full image.
- If Win32 child windows do exist for the target build or skin, prefer `as_window_controller(action="send_message")` with the returned `nativeWindowHandle` and `messageHints` before falling all the way back to raw pointer work.
- If you fall back to AutoHotkey, target the window with `window_id` so the wrapper injects `AgenticWindowId`, `AgenticWindowX`, `AgenticWindowY`, `AgenticWindowWidth`, `AgenticWindowHeight`, and helpers such as `AgenticWindowMouseMove`, `AgenticWindowClick`, `AgenticWindowDrag`, `MouseDown`, and `MouseUp`, and so runtime errors come back in the tool result instead of waiting on a dialog.

## Output

- target app
- verification path used
- actions taken
- confirmed visible result
- any remaining uncertainty
