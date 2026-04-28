---
name: document-extraction
description: Extract useful structured information from PDFs, archives, metadata, CSV, JSON, YAML, or mixed local documents with validation.
---

# Document Extraction

## When To Use

- User needs facts, tables, metadata, or summaries from local documents.
- Inputs include PDFs, archives, CSV, JSON, YAML, media metadata, or nested folders.
- Accuracy matters more than a pretty summary.

## Workflow

1. Identify file type, size, and expected output.
2. Extract text, metadata, or structured rows with the most specific tool.
3. Preserve source file names and page or row references when available.
4. Validate parsed JSON, YAML, or CSV before using it.
5. Summarize findings and note extraction gaps.
6. Avoid overwriting source files.

## Preferred Tools

- `as_pdf_extract_text`
- `as_archive`
- `as_metadata_read`
- `as_tabular_data`
- `as_structured_data`

## Output

- extracted fields
- source references
- validation result
- gaps
