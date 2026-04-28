---
name: local-backup-and-restore
description: Back up local folders or project assets with manifests, compression, hash checks, and restore notes.
---

# Local Backup And Restore

## When To Use

- User wants to back up files before cleanup, migration, media conversion, or risky edits.
- A folder should be archived with restore confidence.
- The task is local and should not rely on cloud services by default.

## Workflow

1. Identify source folders, exclusions, destination, and retention expectations.
2. Create a manifest with file counts, sizes, and hashes for critical files.
3. Compress or copy into a timestamped backup location.
4. Verify the backup exists and can be listed or extracted.
5. Document restore steps.
6. Do not delete originals until the backup is verified and the user approves cleanup.

## Preferred Tools

- `as_file_tree`
- `as_file_hash`
- `as_archive`
- `as_file_write`

## Output

- backup scope
- backup path
- manifest
- verification
- restore steps
