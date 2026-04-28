---
name: video-download-archive
description: Download and archive online video or playlists with metadata, subtitles, thumbnails, folder naming, and post-download organization.
---

# Video Download Archive

## When To Use

- User asks to download videos, playlists, subtitles, thumbnails, or a channel subset.
- The content should be saved into a local archive rather than watched once.
- Naming, metadata, and folder structure matter.

## Workflow

1. Confirm the user has rights to download or archive the content.
2. Choose target folder, format, subtitles, thumbnails, and metadata options.
3. Download with bounded scope and clear output template.
4. Probe a sample file after download.
5. Rename or organize files into a stable archive structure.
6. Report failures, unavailable items, and retry candidates.

## Preferred Tools

- `as_download_video`
- `as_web_download`
- `as_media_probe`
- `as_metadata_read`
- `as_file_rename`
- `as_file_organize`

## Output

- download scope
- archive folder
- files saved
- verification
- retry list
