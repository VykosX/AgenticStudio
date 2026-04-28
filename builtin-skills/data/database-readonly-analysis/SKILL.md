---
name: database-readonly-analysis
description: Analyze SQLite, Postgres, or MySQL data with read-only queries, schema inspection, exported tables, and reproducible summaries.
---

# Database Readonly Analysis

## When To Use

- User asks to inspect data, answer questions, export tables, or validate records.
- SQL access should be read-only.
- The result should be reproducible or saved.

## Workflow

1. Confirm database type, connection scope, and read-only intent.
2. Inspect schema before writing analytical queries.
3. Query with limits first, then refine.
4. Avoid mutating statements, stored procedures, or side effects.
5. Export clean results to CSV or JSON when useful.
6. Document assumptions, filters, and row counts.

## Preferred Tools

- `as_database_query`
- `as_tabular_data`
- `as_structured_data`
- `as_file_write`

## Output

- schema notes
- queries run
- result summary
- exported path
- limitations
