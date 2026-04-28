---
name: secret-hygiene
description: Prevent credential leaks by scanning changes, avoiding plaintext display, using env/config boundaries, and documenting safe setup.
---

# Secret Hygiene

## When To Use

- Handling API keys, tokens, credentials, connection strings, private keys, or user secrets.
- Updating config, env files, CI, or auth-related docs.
- Reviewing diffs before commit or release.

## Workflow

1. Search diffs and config for secret-like values before committing.
2. Do not print plaintext secrets in responses, logs, or summaries.
3. Prefer environment variables, secret stores, or documented local setup.
4. Add `.gitignore` or sample env files where needed.
5. Rotate credentials if a real secret was exposed.
6. Verify docs tell users where to place secrets without including values.

## Preferred Tools

- `as_git_controller`
- `as_file_search_text`
- `as_environ_controller`
- `as_file_read`
- `as_project_verify`

## Output

- scan result
- files changed
- safe configuration path
- rotation recommendation if needed
