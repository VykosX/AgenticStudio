---
name: accessibility-audit
description: Audit UI changes for keyboard access, semantic structure, labels, focus, contrast, reduced motion, and screen-reader affordances.
---

# Accessibility Audit

## When To Use

- UI components, forms, dialogs, navigation, or interactive controls changed.
- User asks whether a screen is accessible.
- Visual polish may have introduced usability risk.

## Workflow

1. Check semantic elements before ARIA.
2. Verify every interactive element has keyboard access and visible focus.
3. Confirm inputs, icons, images, and buttons have accessible names.
4. Check heading order, landmark structure, and error messaging.
5. Validate contrast and reduced-motion behavior.
6. Add focused tests or documentation for tricky interactions.

## Preferred Tools

- `as_file_read`
- `as_file_search_text`
- `as_project_verify`
- `as_http_wait`
- `as_screenshot_capture`

## Output

- accessibility findings
- fixes made
- manual checks
- remaining risk
