# Design Docs

This document captures the design intent for `agentic-studio`. The user-facing overview lives in the root `README.md`; this file is for maintainers.

## Design Goals

- Give LM Studio agents broad local capability without forcing them into raw shell usage.
- Keep the public tool surface compact through action-based controllers.
- Preserve powerful primitives behind profile selection, confirmations, and command policy gates.
- Make tool discovery self-correcting through `as_tool_catalog`, `as_tool_help`, and `as_skill_recommend`.
- Support Windows, Linux, and macOS with dynamic platform detection and explicit unsupported JSON when an action cannot sensibly work.
- Let repeated workflows become local skills instead of long repeated prompts.

## Public Surface Strategy

Agentic Studio now favors controller tools over one-off names. The old implementation helpers may still exist internally, but the public provider filters them out before LM Studio receives the tool list.

Primary controllers:

- Files: `as_file_copy_move`, `as_file_create`, `as_file_watch`, `as_file_organize`, `as_file_search`, `as_file_compare`, `as_file_patch`
- State: `as_memory_controller`, `as_todo_controller`, `as_agent_task`
- System: `as_environ_controller`, `as_process_controller`, `as_service_controller`, `as_task_controller`, `as_registry_controller`
- Desktop: `as_window_controller`, `as_clipboard_controller`, `as_input_controller`, `as_screenshot_capture`
- Development: `as_git_controller`, `as_dynamic_tool`, `as_project_*`, language helpers
- Data/web/media: `as_database_query`, `as_tabular_data`, `as_structured_data`, `as_archive`, `as_web_extract`, `as_multi_website_search`
- Skills: `as_skill_recommend` remains separate for discovery; `as_skill` handles lifecycle actions.

This keeps intent visible: pick the family, then pick `action`.

## Alias Layer

Aliases use the `ax_` prefix and are opt-in through `Enable Tool Aliases`.

They are not compatibility aliases for old `as_*` tools. They are small convenience tools for operations that local models commonly attempt directly, such as copying files, listing processes, typing text, or adding todos.

Rules:

- Catalog responses list aliases separately from normal tools.
- `as_tool_help` accepts alias names even when aliases are disabled.
- Alias help includes the underlying `as_*` controller call.
- If an alias implementation is reached while aliases are disabled, it returns the general controller schema call instead of doing work.

## Profiles

Profiles are the main anti-bloat mechanism:

- `minimal`: catalog/help/profile plus `as_skill` and `as_skill_recommend`, and optionally `as_request_tool` when individual tool requests are enabled
- `file_management`: file controllers, patching, state, structured data, and downloads
- `web`: web search, extraction, HTTP, downloads, and automation
- `research`: web plus memory, durable tasks, PDF, and data helpers
- `data`: files, database, tabular/structured data, archive, PDF, and date helpers
- `development`: shell, project verification, Git, code intelligence, languages, dynamic tools
- `desktop`: desktop observation/control, processes, ports, screenshots, waits
- `system_admin`: services, scheduled tasks, registry, env, processes, ports, system info
- `automation`: watchers, processes, services, scheduled tasks, registry, waits, durable tasks
- `multimedia`: archive, PDF, metadata, media/image/MKV, downloads, duplicates
- `balanced`: broad coding/research/data work
- `full`: all public tools

`full` should be treated as an explicit power-user profile, not the default.

## File Model

Filesystem tools remain workspace-scoped unless `Allow Full Filesystem Access` is enabled.

Important behaviors:

- `as_file_list` accepts `directory=":workspace_trash:"` to inspect plugin trash.
- `as_file_restore` restores trash items.
- `as_file_undo(index=0)` uses recent operation history, with index 0 meaning latest undoable operation.
- Direct file tools share batch target selection: `file_list` for explicit paths, `folder_list` for enumerated folders, `file_pattern`/`file_pattern_flags` for JavaScript regex filtering, `folder_recursive` for recursion, and `file_limit` for bounded enumeration.
- `as_file_search` handles recursive metadata criteria, wildcard names, regexes, extensions, sizes, dates, attributes, AND/OR joins.
- `as_file_compare` compares file sets by name, size, modified time, hash, or any combination.
- `as_file_patch` remains the single rich edit surface for text/code edits.

## Platform Model

The runtime uses `process.platform` and command availability rather than a user-selected OS field.

Current platform strategy:

- Windows: PowerShell, Win32 APIs, Task Scheduler, registry, Windows clipboard/window/input APIs.
- Linux: `ps`, `ss`, `systemctl`, `crontab`, `xdotool`, `wmctrl`, `wl-clipboard`, `xclip`, `xsel`, screenshot fallbacks.
- macOS: `ps`, `lsof`, `launchctl`, `crontab`, `osascript`, `pbcopy`/`pbpaste`, `screencapture`, optional `cliclick`.

Registry editing remains Windows-only because Linux/macOS do not have an equivalent system registry.

## Configuration Model

LM Studio settings are ordered by operational importance:

1. profile and alias controls
2. caveman prompt/result compaction
3. filesystem and execution safety
4. file/watch/media defaults
5. compiler selection
6. sub-agent settings
7. miscellaneous service settings
8. command overrides for external tools

Command whitelist and blacklist parsing supports JSON string arrays, quoted CSV, and newline-delimited entries so paths containing commas can be represented safely.

## Caveman Result Mode

`Caveman-ify Tool Results` rewrites selected agent-facing explanatory strings in JSON responses. It intentionally avoids literal content fields such as file reads, stdout, stderr, errors, diffs, database rows, and web bodies.

The intent is token reduction, not humor in user-visible artifacts.

Result rewriting now runs in one shared post-tool finalizer instead of at each individual `json()` call. That allows discovery-sensitive tools such as `as_skill_recommend` and goal-based `as_tool_help` to stay in normal language for retrieval quality, while still appending a short caveman reminder to keep the model from drifting out of mode after long tool chains.

Large command outputs are also compacted centrally: long `stdout` / `stderr` streams spill into relative files under `reports/command-outputs/...`, and tool results keep only previews plus the log paths.

## Discovery Model

- `as_tool_catalog(scope="own")`: public Agentic Studio tools for the requested/current profile.
- `as_tool_catalog(scope="enabled")`: Agentic Studio plus other enabled plugin tools.
- `as_tool_catalog(scope="disabled")`: tools found in disabled plugins.
- `as_tool_catalog(scope="all")`: enabled plus disabled.
- `as_tool_help(tool_name="...")`: specific schema, use cases, examples, and alias mapping.
- `as_skill_recommend`: skill discovery only, with guidance to create custom skills for repeated or multi-turn workflows.

## Maintenance Notes

Run `npm run verify` after changing tool registration, profiles, or built-in skills.

When adding a new public tool:

1. Prefer extending an existing controller action.
2. If a new standalone tool is justified, add it to the smallest matching profiles.
3. Update `recommendToolsForGoal()`.
4. Update `README.md`, `docs/ARCHITECTURE.md`, and this design doc if the public model changes.
5. Add or update smoke assertions for profile membership and deprecated-name absence.
