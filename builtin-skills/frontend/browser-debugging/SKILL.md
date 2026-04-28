---
name: browser-debugging
description: Debug frontend runtime problems by reproducing in browser, checking console/network/state, and connecting symptoms to source code.
---

# Browser Debugging

## When To Use

- UI renders incorrectly, interaction fails, hydration breaks, or network calls error.
- A test passes but the browser still behaves incorrectly.
- User asks to inspect a local app.

## Workflow

1. Start or wait for the local server.
2. Reproduce the problem in the browser or with a targeted request.
3. Capture console, network, route, and state clues.
4. Trace the failing UI path back to component, data loader, or API code.
5. Fix the smallest root cause.
6. Recheck the page and run the closest automated check.

## Preferred Tools

- `as_http_wait`
- `as_port_wait`
- `as_web_extract`
- `as_project_verify`

## Output

- reproduction
- browser evidence
- source cause
- fix
- verification
