---
name: spreadsheet-csv-workflow
description: Read, query, clean, merge, and write CSV-style tabular data with validation and clear transformation notes.
---

# Spreadsheet CSV Workflow

## When To Use

- User has CSV exports, spreadsheet-like data, logs, contacts, transactions, or inventories.
- Data needs filtering, joining, aggregation, cleanup, or reformatting.
- The output should be saved as a clean CSV or JSON file.

## Workflow

1. Inspect headers, delimiter, row count, encoding symptoms, and missing values.
2. Query a small sample before transforming the whole file.
3. Define transformations explicitly.
4. Preserve the source file unless the user asks to overwrite.
5. Validate output row counts and key columns.
6. Report formulas or assumptions that could affect results.

## Preferred Tools

- `as_tabular_data`
- `as_structured_data`
- `as_file_hash`

## Output

- data profile
- query or transform
- output file
- validation
- caveats
