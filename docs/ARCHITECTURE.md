# Architecture

This document is the maintenance map for `agentic-studio`.

## High-level shape

The plugin is organized around one central tools provider plus a set of tool modules:

- `src/index.ts`
  - plugin entrypoint
- `src/config.ts`
  - LM Studio plugin configuration schema
- `src/shared/providerCore.ts`
  - shared runtime wiring, helper registry, command execution helpers, and tool registration orchestration
- `src/shared/providerCatalog.ts`
  - tool documentation discovery, profile filtering, category inference, and recommendation logic
- `src/shared/providerState.ts`
  - persisted profile state, LM Studio conversation lookup, and storage-path resolution
- `src/shared/providerFilesystem.ts`
  - filesystem helpers, shared batch file target resolution, CSV utilities, diff helpers, operation log handling, and trash support
- `src/shared/providerSkills.ts`
  - built-in skill discovery, custom skill discovery, skill reads, and compact built-in prompt loading
- `src/shared/providerCommands.ts`
  - command execution, runtime lookup, command policy, Firecrawl helpers, and Windows environment refresh
- `src/shared/providerUtils.ts`
  - shared normalization, JSON parsing, quoting, truncation, and formatting helpers
- `src/promptPreprocessor.ts`
  - built-in skill prompt injection plus optional first-turn compact tool inventory injection so fresh conversations can see each public tool name and its minimum profile
- `src/tools/*.ts`
  - grouped tool registrations by domain

## Tool modules

- `src/tools/files.ts`
  - internal workspace file operations, trash, reorganization, watches, advanced rename, and consolidated `as_file_patch`
- `src/tools/consolidated.ts`
  - public controller layer for file copy/create/search/compare/watch/organize, memory/todo/env/process/service/task/registry/window/clipboard/input controllers, `ax_*` aliases, and public-surface filtering
- `src/tools/dataMedia.ts`
  - consolidated structured/tabular/database/archive tools, PDF, metadata, media helpers, and LM Studio vision-backed OCR/recognition tools
- `src/tools/web.ts`
  - HTTP, search, multi-site search, backend-aware browser extraction, download, torrent control, and Deno-backed web automation
- `src/tools/development.ts`
  - shell, project verification, code outline, Python/C++, `as_git_controller`, and `as_dynamic_tool`
- `src/tools/desktopAutomation.ts`
  - internal process, port, service, env/registry, scheduling, window, input, clipboard, screenshot, Win32 child-control inventory, and direct message-dispatch implementations used by the controller layer
- `src/tools/stateful.ts`
  - memory, todos, `as_agent_task`, `as_skill_recommend`, and consolidated custom skill lifecycle tools
- `src/tools/meta.ts`
  - profile switching, individual tool requests, catalog discovery, and tool-help surfaces
- `src/tools/mathAndUnits.ts`
  - exact math, date/time math, and unit conversion helpers
- `src/tools/systemInfo.ts`
  - machine and runtime inspection
- `src/tools/downloadVideo.ts`
  - yt-dlp wrapper

## Registration flow

1. `src/index.ts` calls the provider factory.
2. `providerCore.ts` builds the shared tool context.
3. Each tool module receives that context and pushes tool definitions into one list.
4. `src/tools/consolidated.ts` adds the public controller layer and removes superseded one-off tools from the public surface.
5. `providerCatalog.ts` filters the remaining public tools by the active profile.
6. LM Studio receives only the tools allowed for that chat's current profile, plus any individually requested tools when that feature is enabled.

When adding a tool, update all three places that matter:

1. the registering module in `src/tools/*.ts`
2. profile membership in `src/shared/providerCatalog.ts`
3. public-surface filtering in `src/tools/consolidated.ts` if it replaces older tool names
4. README inventory if the tool is user-facing

If the tool changes workflow discovery, also update `recommendToolsForGoal()`.

For multimodal workflows, keep a sharp distinction between rendering and perception:

- `as_file_embed`
  - formats a file into markdown for the chat transcript
- `as_vision_ocr` / `as_vision_recognize`
  - send local image bytes to the currently loaded LM Studio multimodal model for actual pixel analysis

That distinction matters because LM Studio can render a tool-emitted image embed in the UI without necessarily feeding those pixels back into the model as multimodal input.

## Storage model

### Global plugin state

Everything plugin-managed lives under:

- `~/.cache/lm-studio/plugin-data/vykosx/agentic-studio`

Important subdirectories:

- `state/`
  - persisted tool-profile selection plus individually requested extra tools, with fresh chats falling back to config defaults and manual overrides scoped to the active conversation group
- `default/`
  - global memory/todo files and managed skills
- `builtin-skills/`
  - repo-shipped default skills organized by category, including the headless web workflow `web/autonomous-browser-navigation`
- `conversations/`
  - conversation-scoped state when LM Studio folders are involved
- `trash/`
  - plugin-managed trash
- `operations/`
  - undo/operation log
- `plans/`
  - reorganization plans
- `watchers/`
  - file watcher definitions
- `tools/`
  - dynamic Python-backed tools
- `workspaces/<hash>/`
  - persistent agent task registries

### Memory and todo resolution

`providerState.ts` intentionally resolves memory/todo storage like this:

- no active conversation: global
- top-level conversation with no parent folder: global
- nested conversation under a parent folder:
  - conversation file
  - parent `_shared` file
- explicit `global=true`: global regardless of chat nesting

That behavior is important and should not be changed casually.

## Safety model

Key guardrails:

- workspace path enforcement lives in `resolveInsideWorkspace()` in `providerCore.ts`
- multi-file tool targeting is centralized in `resolveBatchFileTargets()` in `providerFilesystem.ts`, covering `file_list`, `folder_list`, regex filtering, recursion, hidden-file handling, dedupe, and target limits
- optional full-filesystem mode is config-gated
- command execution is gated by `requireCommandExecution()`
- shell command policy and allow/deny behavior live in `providerCommands.ts`
- archive extraction validates output paths before writing
- SQL tools are read-only by construction through `as_database_query`
- Deno execution permissions are narrowed to the selected script and workspace
- consolidated controller tools intentionally expose broad capability behind one obvious entry point; agents should call `as_tool_help` for a specific controller before complex use
- platform-specific tools use dynamic platform and command discovery; actions return explicit unsupported JSON when the host OS or installed commands cannot support them
- `ax_*` aliases are opt-in through configuration and are filtered from the public tool list when disabled
- `as_system_info` supports targeted field reads through `fields` / `field_list`, descriptor discovery through `help=true` or `help="pattern"`, and its oversized LibreHardwareMonitor maximum snapshot is persisted through a temp file before parsing so raw provider data is not lost to stdout truncation
- command-backed tools now compact large `stdout` / `stderr` results into previews and spill full logs into workspace-relative `reports/command-outputs/...` files so agents can inspect them incrementally later
- when a tool returns a spill file path, the intended consumption pattern is search-first and partial-read-second: narrow with `as_file_search_text`, then inspect only the needed slices with `as_file_read(offset, length)`
- caveman result rewriting is centralized after tool execution so discovery-oriented helpers can stay plain-language while other tool results still carry a compact caveman reminder during caveman mode

## Validation and verification

Current validation entry points:

- `npm run build`
  - runs `scripts/validate-tool-context.cjs`
  - compiles the plugin with TypeScript
- `npm run smoke`
  - checks built profile membership and storage invariants
- `npm run verify`
  - build plus smoke checks

`scripts/validate-tool-context.cjs` now checks:

- shared context keys used without destructuring
- destructured keys missing from `sharedToolContext`
- unused destructured helpers
- unresolved identifiers in tool modules after stripping `@ts-nocheck` in memory

## Adding new tools cleanly

Recommended pattern:

1. Pick the most specific existing tool module.
2. Reuse shared helpers from `providerCore.ts` rather than reaching for new ad hoc shell code.
3. Keep parameters structured and bounded.
4. Add a short description that explains the tool's intent, not just the implementation detail.
5. Wire the tool into one or more profiles.
6. Update recommendation logic if the tool should be discoverable by goal.
7. Update README if the tool is part of the public surface.
8. Run `npm run verify`.

## Known design choices

- Many tool modules are still `// @ts-nocheck` to keep iteration velocity high with the LM Studio SDK surface.
- Because of that, the repo relies on targeted runtime-safe helper design plus custom validation scripts instead of pure TypeScript strictness.
- Dynamic tools and managed skills are plugin-state assets, not workspace files.
- `balanced` is intentionally the "serious default work" profile and includes math/unit conversion, while `minimal` stays narrow.
- `minimal` includes `as_skill` and `as_skill_recommend` so agents can discover or create reusable workflows without switching profiles.
- When `Allow individual tool requests` is enabled, `minimal` also includes `as_request_tool` so agents can request one tool for the next turn without switching the entire profile.
- Legacy one-off names can remain as internal implementation helpers, but they should not appear in the public tool surface or profiles.
