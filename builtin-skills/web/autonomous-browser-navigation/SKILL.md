---
name: autonomous-browser-navigation
description: Navigate websites autonomously with Agentic Studio's web tools by combining targeted search, browser_script observe-act loops, and browserAgent ref snapshots instead of driving a local browser window.
---

# Autonomous Browser Navigation

## When To Use

- The task is about navigating websites, following links, searching inside a site, or completing a bounded multi-step web workflow.
- The user wants browser autonomy through Agentic Studio's own web tools rather than through a specific installed browser window.
- The target site is easier to inspect with a headless browser session than with raw HTTP alone.

## Workflow

1. If the goal is discovery, start with `as_multi_website_search` for supported sites or `as_web_search` for broad discovery before you open a browser session.
2. Use `as_web_extract(action="browser_script")` for multi-step browsing. Prefer node-mode scripts that use the injected `helpers.browserAgent` object instead of page-only scripts when you need repeated observe-act cycles.
3. Inside `browser_script`, follow the browserAgent loop:
   - `await helpers.browserAgent.snapshotPage({ limit })`
   - inspect the returned `snapshotText` and `elements`
   - `clickRef`, `typeRef`, `scroll`, `press`, or `navigate`
   - call `snapshotPage` again after page-changing actions
4. Re-snapshot after navigation. Refs such as `e1`, `e2`, and `e3` are only valid for the current DOM state.
5. Prefer site-native URLs or `as_multi_website_search` over general `site:` search fallbacks when the site has first-class support.
6. Keep each browser script bounded: start at one URL, complete one concrete objective, and return the final page state plus the evidence you used.
7. If the user explicitly asks to use Chrome, Edge, Firefox, Brave, Safari, Opera, Vivaldi or another installed browser on their machine, stop using this skill and switch to `desktop/vision-guided-computer-use` instead. That is a local-window automation task, not a headless web-tool task.
8. Stop to confirm intent before logins, purchases, posts, sends, deletes, or account changes unless the user already made that intent explicit.

## Example Pattern

```js
const { browserAgent } = helpers;

const first = await browserAgent.snapshotPage({ limit: 25 });
const searchBox = first.elements.find((entry) => entry.role === "textbox" || entry.role === "searchbox");
if (!searchBox) throw new Error("No search field was found on the page.");

await browserAgent.typeRef(searchBox.ref, "browser automation", { pressEnter: true, waitAfterMs: 1200 });
await browserAgent.waitForIdle(8000);

const second = await browserAgent.snapshotPage({ limit: 30 });
return {
  start: { url: first.url, title: first.title },
  end: { url: second.url, title: second.title },
  snapshotText: second.snapshotText,
  elements: second.elements,
};
```

## Preferred Tools

- `as_multi_website_search`
- `as_web_search`
- `as_web_extract`
- `as_http_wait`
- `as_agent_task`

## Output

- starting URL or search path
- key snapshots used to choose actions
- actions taken in the browser session
- final URL and page title
- formatted excerpt of search results
- extracted page data or stop reason
