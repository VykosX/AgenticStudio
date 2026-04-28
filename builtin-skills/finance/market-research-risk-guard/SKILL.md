---
name: market-research-risk-guard
description: Research markets or online trading tasks with source checks, risk framing, and a hard stop before placing real trades.
---

# Market Research Risk Guard

## When To Use

- User asks about stocks, commodities, crypto, brokers, portfolios, prices, or trading online.
- Current market data, news, or account actions may matter.
- Desktop or browser automation could place a real order.

## Workflow

1. Treat market data as time-sensitive and verify current prices or news from reliable sources.
2. Separate factual market information from investment advice.
3. Identify the user's requested action: research, watchlist, paper trade, order draft, or real order.
4. Never click buy, sell, submit, confirm, transfer, or leverage controls without explicit user confirmation at that final step.
5. Record assumptions, timestamps, ticker symbols, quantities, and risk notes.
6. Encourage the user to verify with their broker and consider professional advice for financial decisions.

## Preferred Tools

- `as_web_search`
- `as_http_request`
- `as_web_extract`
- `as_screenshot_capture`
- `as_clipboard_controller`
- `as_agent_task`

## Output

- data timestamp
- sources
- factual summary
- risk notes
- confirmation checkpoint
