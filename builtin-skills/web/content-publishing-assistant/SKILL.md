---
name: content-publishing-assistant
description: Prepare, preview, and safely publish or update online content with explicit user approval before irreversible submission.
---

# Content Publishing Assistant

## When To Use

- User wants to draft, format, upload, schedule, or update online content.
- Browser or desktop automation may be needed.
- Publishing is user-visible or irreversible.

## Workflow

1. Draft or transform content locally first.
2. Validate links, formatting, images, metadata, and target account.
3. Use browser or desktop automation only after the target page is visible and understood.
4. Stop before final submit, purchase, delete, or publish unless the user explicitly confirms.
5. Capture the published URL or confirmation state.
6. Save a local copy of the final content when useful.

## Preferred Tools

- `as_web_extract`
- `as_clipboard_controller`
- `as_input_controller`
- `as_screenshot_capture`
- `as_file_write`

## Output

- draft content
- target destination
- pre-publish checks
- confirmation required
- published result
