---
name: form-filling-automation
description: Fill repetitive local or web forms using validated source data, clipboard insertion, screenshots, and a final submit checkpoint.
---

# Form Filling Automation

## When To Use

- User asks to enter repeated data into forms, admin panels, or desktop apps.
- Data comes from CSV, JSON, clipboard, or local notes.
- Submission has external effects.

## Workflow

1. Validate source data shape before interacting with the form.
2. Fill a single record first and verify field mapping.
3. Use clipboard paste and keyboard navigation where possible.
4. Capture screenshots or page state at checkpoints.
5. Stop before final submit unless the user explicitly approved the batch.
6. Log completed, skipped, and failed records.

## Preferred Tools

- `as_tabular_data`
- `as_structured_data`
- `as_clipboard_controller`
- `as_input_controller`
- `as_screenshot_capture`
- `as_agent_task`

## Output

- source records
- field mapping
- completed count
- skipped records
- confirmation status
