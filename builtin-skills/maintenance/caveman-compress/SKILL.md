---
name: caveman-compress
description: Compress natural language files into a shorter caveman form to save prompt tokens while preserving code, URLs, commands, paths, headings, and structure.
---

# Caveman Compress

## When To Use

- User asks to compress a file or long markdown instruction to cavemean speak.
- Goal is to reduce input-token cost without losing technical meaning.

## Scope

- Good targets: `.md`, `.txt`, and extensionless prose-heavy files.
- Mixed prose plus code is okay, but only compress the prose.
- Do not use on source code, structured config, lockfiles, env files, or data files.

## Rules

### Remove

- articles
- filler
- pleasantries
- hedging
- redundant connective prose
- repeated examples that teach the same thing

### Preserve exactly

- fenced code blocks
- inline code
- URLs and markdown links
- file paths
- commands
- API names and library names
- proper nouns
- dates, versions, and numbers
- environment variables
- markdown headings
- bullet and numbered list structure
- tables and frontmatter structure

## Workflow

1. Confirm the file is a prose-friendly target.
2. Read the file.
3. Save a backup as `<filename>.original.md` before overwriting.
4. Compress natural-language sections only.
5. Leave uncertain code-like regions unchanged.
6. Write the compressed file back.
7. Re-read or diff if the file is important.

## Preferred Tools

- `as_file_read`
- `as_file_write`
- `as_file_copy_move`
- `as_file_patch`

## Boundaries

- Never compress source code files.
- Never alter content inside backticks or code fences.
- If unsure whether text is code or prose, leave it alone.
