---
name: structured-data-cleaning
description: Clean CSV, JSON, YAML, or database-derived data by validating shape, preserving originals, and documenting transformations.
---

# Structured Data Cleaning

## When To Use

- User asks to normalize, merge, validate, query, or transform structured data.
- Data quality issues may affect downstream work.
- A cleaning step should be reproducible.

## Workflow

1. Inspect schema, row count, columns, keys, and sample records.
2. Keep source files unchanged unless explicitly asked.
3. Define transformations before applying them.
4. Validate output format and record counts.
5. Spot-check edge cases, missing values, duplicates, and type coercion.
6. Document what changed.

## Preferred Tools

- `as_tabular_data`
- `as_structured_data`

## Output

- input profile
- transformations
- output path or result
- validation
- caveats
