# Agentic Studio

Agentic Studio is a practical local tool suite for LM Studio agents. It gives a local model a safer, structured way to work with your files, code, browser-facing research, desktop, operating system, media, databases, memory, todos, and reusable skills for common operations. The goal is simple: expose enough local capability for serious agent work while keeping the tool list and underlying architecture understandable.

## What It Can Do

- Manage files: read, write, patch, rename, search, compare, hash, copy, move, delete, restore from trash, and organize folders.
- Work with projects: inspect code outlines, run verification, scan for bugs, format/lint/typecheck Python, compile C++, and fully utilize Git for versioning.
- Search and capture the web: perform general internet searches, image search, site-specific search across sources like GitHub, YouTube, npm, PyPI, arXiv, Anna's Archive, Libgen, MDN, and MSDN/Microsoft Learn, plus HTTP calls, page extraction, downloads, video downloads, torrent control, and Firecrawl-backed workflows.
- Handle data and media: query read-only databases, transform CSV/JSON/YAML, extract PDFs, inspect metadata, convert images, transform media, run vision OCR/image recognition against local files, extract MKV content, and work with archives.
- Automate the machine: list and control processes, services, scheduled tasks, ports, environment variables, clipboard, windows, screenshots, and keyboard/mouse input.
- Keep state: store memories, todos, durable agent tasks, and custom skills that survive chat context resets.
- Stay lean: switch between profiles so only the tools needed for a task are exposed, minimizing context usage and maintaining speeds.

## Tool Profiles

`minimal` is the default and includes profile/catalog/help plus skill discovery and skill management. When `Allow individual tool requests` is enabled, it also includes `as_request_tool` so the model can request one specific tool for the next turn without switching the whole profile.

When `Inform Agent of All Tools` is enabled, fresh conversations also receive a compact Agentic Studio inventory in the prompt preprocessor that lists each public tool name with its minimum profile, so the model can immediately choose `as_tool_help`, `as_request_tool`, or `as_set_tool_profile` without guesswork.

Other profiles expose focused sets:

- `file_management`: file operations, memory, todos, patching, search, compare, organization, and structured data.
- `web`: search, HTTP, extraction, downloads, and web automation.
- `research`: web tools plus memory, tasks, PDF, and data helpers.
- `data`: files, database queries, tabular/structured data, archives, PDFs, and date math.
- `development`: shell, Git, project verification, code intelligence, language helpers, dynamic tools, and patching.
- `desktop`: processes, ports, clipboard, windows, input, screenshots, waits, and local screenshot inspection through the vision helpers.
- `system_admin`: processes, services, tasks, registry, environment, ports, and system info.
- `automation`: watchers, processes, services, scheduled tasks, registry, waits, and durable task state.
- `multimedia`: archives, PDFs, metadata, media/image/MKV/vision helpers, downloads, duplicates, and organization.
- `balanced`: broad coding, files, web, data, math, and research.
- `full`: every public Agentic Studio tool.

If `as_request_tool` is available, prefer it for one-off access to a tool from another profile. If you expect ongoing work in that category, switch profiles with `as_set_tool_profile` instead. After either a tool request or a profile switch, wait until the next turn before calling newly exposed tools. Fresh chats start from the configured `Default Tool Profile`; manual switches persist only for the active conversation scope instead of becoming the new global default.

## Consolidated Controllers

Large tool families are intentionally grouped behind action-based controllers:

- `as_file_watch`, `as_file_organize`, `as_memory_controller`, `as_todo_controller`, `as_agent_task`, `as_environ_controller`, `as_process_controller`, `as_service_controller`, `as_task_controller`, `as_registry_controller` `as_window_controller`, `as_clipboard_controller`, `as_input_controller`, `as_git_controller`, `as_torrent_controller`, `as_dynamic_tool`, `as_skill`

When unsure about a controller schema, call `as_tool_help` with the tool name.

For desktop automation specifically:

- `as_input_controller(action="help")` returns valid key names, operator guidance, richer mouse actions, lower-level `key_event` fallback guidance, and accepted sequence step shapes.
- Windows keyboard sequences now run from temporary script files instead of inline command strings, which avoids the old command-line length ceiling for moderate multi-step batches.
- `as_input_controller` now exposes macro-like mouse affordances including left/right/middle click, double/triple click, explicit button down/up, smooth pointer motion, configurable drag timing, and horizontal or vertical scroll.
- `as_input_controller(action="key_event")` gives Windows a lower-level key dispatch path with explicit `press`/`down`/`up`, modifier lists, and repeat counts when SendKeys is unreliable.
- `as_input_controller(action="autohotkey_script")` provides a Windows-only AutoHotkey v2 fallback for stubborn or unusually complex desktop automation. The plugin auto-discovers common installs under `C:\Program Files\AutoHotkey`, runs scripts headlessly with runtime errors returned in the tool result, and injects window-relative helpers such as `AgenticWindowMouseMove`, `AgenticWindowClick`, and `AgenticWindowDrag` when a target window is supplied.
- `as_input_controller` mouse and drag actions accept `coordinate_space="window"` so models can use window-relative coordinates instead of raw screen math.
- `as_window_controller(action="controls")` returns a hybrid Windows control inventory: UI Automation controls plus Win32 child-window controls when present, including absolute and window-relative bounds, centers, and Win32 message hints.
- `as_window_controller(action="invoke_control")` activates a matching UIA control when UI Automation can reach it, and `action="send_message")` dispatches direct Win32 messages to child-window controls by returned handle when message-based control is a better fit than mouse input.
- `as_system_info` supports `fields` or `field_list` for compact targeted queries such as username, CPU model, GPU temperatures, fan speeds, or drive usage, `help=true` to list valid descriptors, and `help="pattern"` to filter descriptors like `cpu`, `temp`, or `fan`, while `detailed="maximum"` preserves the full LibreHardwareMonitor hardware and sensor snapshot when that provider is configured.

## Output Compaction

- Caveman mode now reinforces itself after tool calls with a compact reminder string, but discovery helpers avoid caveman rewriting where it would hurt retrieval quality. In particular, `as_skill_recommend` and goal-based `as_tool_help` keep their normal wording.
- Verbose command-backed tools now keep full long `stdout` and `stderr` in workspace-relative `reports/command-outputs/...` log files and return only compact previews plus the relative log path in the tool result.
- When a tool returns a `reportPath`, `stdoutPath`, or `stderrPath`, the agent should not dump the whole file back into context. Search it first with `as_file_search_text`, then read only small matching slices with `as_file_read(offset, length)`.
- `as_file_tree`, `as_file_list`, and `as_file_metadata` now default to `detail="compact"` so they return relative paths and lighter metadata by default. Use `detail="full"` or `detail="max"` only when the extra structure is actually needed.
- `as_download_video` now defaults to `detail="compact"` and returns a short download summary plus any generated log paths instead of dumping large yt-dlp output back into the chat context.
- `as_web_search`, `as_web_image_search`, `as_project_bug_scan`, `as_dynamic_tool`, `as_media_probe`, and `as_mkv_info` now also default to compact result shapes, with report spill paths when the structured payload would otherwise bloat context.

## Batch File Selection

File-facing tools support batch targets. Use the original single path parameter for one file, or pass `file_list` for explicit paths and `folder_list` for folders whose matching files should be enumerated. Folder enumeration is handled by one shared helper with:

- `file_pattern`: JavaScript regular expression matched against workspace-relative paths and basenames
- `file_pattern_flags`: standard RegExp flags such as `i`
- `folder_recursive`: whether folder enumeration walks subfolders
- `file_limit`: maximum enumerated targets

This applies across direct file operations, text/code patching, reads/writes, hashes/stats, duplicate tools, metadata/media/image/MKV/PDF helpers, structured/tabular data helpers, and code outlines.

## Optional Aliases

The `Enable Tool Aliases` setting exposes a small `ax_*` alias layer for common operations such as `ax_file_copy`, `ax_todo_add`, `ax_process_list`, and `ax_input_type`.

Aliases are convenience calls only. The catalog lists them separately from normal tools, and `as_tool_help` shows the matching controller call. If aliases are disabled, use the `as_*` controller form.

## Skills

Built-in skills are reusable workflows for planning, debugging, research, file organization, desktop work, security checks, media tasks, releases, and more. Use `as_skill_recommend` to find one, then `as_skill(action="read")` for the details.

When `Per-App Automation Guidance` is enabled, `as_skill_recommend` can also prefer the dedicated `desktop/per-app-automation-guidance` skill for single-app desktop tasks so supported-app notes stay concentrated in one place instead of bloating generic tool help.

For headless multi-step website work through Agentic Studio's own web tools, `as_skill_recommend` can prefer `web/autonomous-browser-navigation`. If the user instead asks for a specific installed browser window such as Chrome, Edge, or Firefox on their machine, recommendations fall back to the generic `desktop/vision-guided-computer-use` workflow.

If no built-in skill fits a repeated or multi-turn workflow, create a custom skill with `as_skill(action="scaffold")` and refine it over time.

## Vision Notes

`as_file_embed` is useful for rendering files into the chat transcript, but LM Studio does not currently treat tool-emitted markdown image embeds the same way it treats user-attached multimodal images. When the agent needs to actually read pixels from a screenshot or local image, prefer `as_vision_ocr` for transcription or `as_vision_recognize` for question answering.

For GUI workflows where pointer position matters, `as_screenshot_capture(include_cursor=true)` can render the current mouse cursor into the captured image and also returns cursor metadata in the tool result.

Windows mouse and drag actions also return `requestedCoordinates`, `resolvedCoordinates`, `targetWindowBounds`, and `windowRelativeCursor`, which makes it easier for agents to compare intended vs actual pointer placement before repeating a nearby click or drag.

For tighter visual inspection, `as_screenshot_capture(source="region")` captures a sub-rectangle directly, and on Windows it also accepts `coordinate_space="window"` plus a target `window_id` so the crop can be expressed relative to the app window instead of the full desktop.

The vision tools accept the same batch file targeting scheme as other file-facing tools, and they can also ingest image markdown from `as_file_embed` plus a clipboard image capture. For the intended workflow, see the built-in skills `media/vision-inspection-workflow` and `desktop/vision-guided-computer-use`.

## Configuration Highlights

Important settings include:

- `Default Tool Profile`
- `Inform Agent of All Tools`
- `Allow individual tool requests`
- `Enable Tool Aliases`
- `Per-App Automation Guidance`
- `Caveman Skill Profile`
- `Caveman-ify Tool Results`
- `Allow Full Filesystem Access`
- `Allow Automatic Execution`
- `Execution Policy`
- `Command Shell Whitelist` and `Command Shell Blacklist`
- `Browser Automation Backend`
- `Camofox Home Directory`
- `Firecrawl API Key`
- External command overrides for Python, Node, Deno, FFmpeg, yt-dlp, qBittorrent, Seerr, ExifTool, LibreHardwareMonitor, database CLIs, and related tools

Command whitelist/blacklist fields accept commas, newlines, quoted entries, or a JSON string array, so command paths containing commas can be represented safely.

## Safety Model

Agentic Studio prefers structured tools over shell commands. Filesystem access is workspace-scoped unless full filesystem access is enabled. Command-backed helpers honor automatic execution, test mode, execution policy, whitelist, and blacklist settings. Destructive file operations use plugin trash by default, and larger directory deletes require explicit confirmation.

Windows, Linux, and macOS are detected dynamically. Platform-specific features use the best available native implementation and return explicit unsupported JSON when a capability is not meaningful or available on the current OS.

## Developer Commands

```bash
npm run build
npm run smoke
npm run verify
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for maintenance notes and [docs/DESIGN_DOCS.md](docs/DESIGN_DOCS.md) for the longer design-oriented overview.
