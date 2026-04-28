---
name: image-batch-conversion
description: Convert image batches safely with format, size, metadata, naming, and destination checks.
---

# Image Batch Conversion

## When To Use

- User wants images converted to PNG, JPG, WebP, TIFF, or another supported format.
- A folder contains many images requiring consistent output names.
- Originals should remain untouched unless explicitly removed later.

## Workflow

1. Identify source formats, dimensions, and target format.
2. Create or confirm an output directory.
3. Convert a small sample first when quality or transparency matters.
4. Use naming rules to avoid collisions and preserve source traceability.
5. Verify output files exist and inspect a representative result.
6. Keep originals until the user confirms cleanup.

## Preferred Tools

- `as_image_identify`
- `as_image_convert`
- `as_file_create`
- `as_file_rename`
- `as_file_list`

## Output

- source profile
- target settings
- converted files
- verification
- cleanup recommendation
