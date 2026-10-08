---
name: timer
description: Manage floating focus timers and pomodoro sessions with the `bb timer` CLI. Use when the user asks to start, check, pause, reset, or list timers, or set a timer for a specific duration or task.
---

# Timers and Focus Sessions

The Floating Timer plugin manages floating timers in BB IDE with live overlays, audio/visual alerts, and multi-timer support.

## Commands

| Command | Effect |
| --- | --- |
| `bb timer list` | Show all timers with their id, status, remaining time, and title. |
| `bb timer add <minutes> [name]` | Create and start a timer for N minutes with an optional title. |
| `bb timer pause <id>` | Pause a running timer. |
| `bb timer start <id>` | Resume or start a timer. |
| `bb timer reset <id>` | Reset a timer back to its initial full duration. |
| `bb timer remove <id>` | Delete a timer. |
| `bb timer clear` | Clear all completed timers. |

## Examples

```bash
# Start a 25-minute Pomodoro timer
bb timer add 25 "Помидорка: ревью кода"

# Start a 5-minute tea break
bb timer add 5 "Чай"

# List active timers
bb timer list

# Pause a timer
bb timer pause 3a1b4c5d
```

## Rules

- Always check `bb timer list` before modifying timers by ID.
- The UI floating overlay and thread header display active countdowns in real-time.
