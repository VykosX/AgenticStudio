---
name: web-capture-monitor
description: Archive, extract, monitor, and compare web pages or feeds using search, targeted site lookup, Firecrawl, browser capture, and local snapshots.
---

# Web Capture Monitor

## When To Use

- User wants to archive a page, extract structured content, monitor a page, or compare online changes.
- A page needs rendered capture, screenshots, MHTML/PDF/HTML export, or crawl/map behavior.
- Online content should be checked repeatedly or saved locally.

## Workflow

1. Pick a mode: `archive`, `extract`, `crawl`, `monitor`, or `site_search`.
2. Use `as_multi_website_search` for targeted public sites and `as_web_search` for broad discovery.
3. Use `as_web_extract` for visit, images, archive, Firecrawl, crawl, interact, or browser-script actions.
4. Save snapshots under a clear local folder with timestamps.
5. Compare new captures against previous captures before reporting changes.
6. For publishing or external side effects, require explicit confirmation before acting.
7. Record monitor state with `as_agent_task` when repeated checks are expected.

## Preferred Tools

- `as_multi_website_search`
- `as_web_search`
- `as_web_extract`
- `as_web_download`
- `as_file_patch`
- `as_agent_task`
- `as_date_math`

## Output

- mode used
- sources or pages checked
- captured artifacts
- extracted data
- changes found
- next monitor time
