---
name: release-readiness
description: Prepare a release by checking scope, versioning, changelog, build, tests, docs, migration notes, and rollback confidence.
---

# Release Readiness

## When To Use

- User asks to ship, publish, tag, merge, or prepare a release.
- A milestone appears complete but release risk is unknown.
- Build artifacts or docs must be consistent before distribution.

## Workflow

1. Confirm intended release scope and version.
2. Review diff, changelog, docs, manifest, and package metadata.
3. Run build and the closest test suite.
4. Check migrations, config changes, compatibility, and operational notes.
5. Prepare rollback or hotfix guidance.
6. Report go, no-go, or go-with-risk.

## Preferred Tools

- `as_git_controller`
- `as_project_verify`
- `as_file_read`
- `as_metadata_read`

## Output

- release scope
- checks run
- docs and version state
- risks
- release verdict
