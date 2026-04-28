---
name: date-time-calculation
description: Use deterministic date/time tooling for timezone conversion, durations, weekdays, leap years, schedule math, and timestamp formats.
---

# Date Time Calculation

## When To Use

- User asks about weekdays, elapsed time, deadlines, schedules, time zones, Unix timestamps, Excel serial dates, Julian days, or leap years.
- A file, media, automation, or release workflow depends on exact calendar math.
- Guessing from memory would risk a wrong date.

## Workflow

1. Identify the source date format and source timezone.
2. Use `as_date_math` for parsing, conversion, arithmetic, or comparison.
3. Specify target timezone when presenting local times.
4. Check leap-year, month length, ISO week, and daylight-saving-sensitive cases with the tool.
5. Include the timezone and timestamp format in the answer.

## Preferred Tools

- `as_date_math`
- `as_task_controller`
- `as_file_set_times`
- `as_file_rename`

## Output

- input interpreted
- timezone used
- computed result
- calendar notes
