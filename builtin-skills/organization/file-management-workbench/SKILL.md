---
name: file-management-workbench
description: Organize, rename, deduplicate, classify, extract, and curate local files across downloads folders, archives, documents, media libraries, and general file collections.
---

# File Management Workbench

## When To Use

- User wants to clean, sort, classify, rename, deduplicate, or curate local files.
- The source is a downloads folder, archive inbox, document library, photo/audio/video library, or scattered local collection.
- File movement or renaming should be previewed and undoable.

## Workflow

1. Pick a mode: `downloads_triage`, `advanced_rename`, `duplicate_cleanup`, `archive_inbox`, `document_library`, `media_library`, or `local_library`.
2. Inspect a representative sample before proposing moves, deletes, or names.
3. Use metadata, hashes, file type, timestamps, and folder context to classify files.
4. Use `as_file_rename` for filename/folder normalization and batch rename rules.
5. Use `file_list` for explicit batches or `folder_list` with `file_pattern` and `folder_recursive` when one tool call should process many matching files.
6. Use reorganization plans for moves: plan, preview, then apply.
7. Use hash-based duplicate detection before deleting or trashing duplicates.
8. Extract archives only after listing contents and checking for traversal/link risks.
9. Prefer preview mode first for destructive, recursive, or large batch operations.

## Preferred Tools

- `as_file_list`
- `as_file_tree`
- `as_file_stat`
- `as_file_hash`
- `as_file_find_duplicates`
- `as_file_resolve_duplicates`
- `as_file_rename`
- `as_file_organize`
- `as_file_organize`
- `as_file_organize`
- `as_archive`
- `as_metadata_read`
- `as_date_math`

## Output

- mode used
- sample inspected
- classification rules
- rename rules
- move plan
- duplicate policy
- preview summary
- applied changes and undo path
