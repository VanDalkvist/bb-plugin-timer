# bb-plugin-timer — Floating Timer for BB IDE

Run floating focus timers, custom sprints, and pomodoro blocks anywhere in BB.

## Capabilities

- **App-wide Overlay (`slots.experimental_appOverlay`)**: Floating overlay accessible across all BB windows, projects, and threads.
- **Two Display Modes**:
  - **Compact Pill**: Subtle floating pill displaying active countdown (e.g. `⏱️ Review 24:12`) and pulsing alert on completion.
  - **Expanded Card**: Full management window with large digital timers, progress bars, +1m/+5m quick-adjust buttons, pause, reset, and delete.
- **Drag & Drop**: Freely reposition both the pill and the expanded window. Position is persisted in `localStorage`.
- **Parallel Multi-Timers**: Run multiple independent timers at once with custom labels.
- **Quick Presets**: Instant start presets for `1m`, `5m`, `10m`, `15m`, `25m` (pomodoro), `45m`, and `60m`, plus custom duration input.
- **Audio Chime (Web Audio API)**: Self-contained harmonic chime on timer completion with instant mute toggle.
- **Thread Header Action (`slots.experimental_threadHeaderAction`)**: Live timer display in thread header for 1-click toggling.
- **Sidebar Nav Panel (`slots.navPanel`)**: Full-page dashboard at `/plugins/timer/timers`.
- **CLI & Agent Skill (`bb timer`)**: Complete CLI tool and skill for agents and terminals.

## CLI Usage

```bash
# List all timers
bb timer list

# Start a 25-minute timer with a label
bb timer add 25 "Pomodoro: PR review"

# Start a 5-minute break
bb timer add 5 "Tea break"

# Pause / Resume
bb timer pause <id>
bb timer start <id>

# Reset to initial duration
bb timer reset <id>

# Delete timer
bb timer remove <id>

# Clear completed
bb timer clear
```

## Architecture & Code Quality

- `src/domain/timer.ts`: Pure deterministic time calculation (`targetEndAt`), progress math, and formatting. Immune to background tab throttling or system sleep.
- `src/services/timer-service.ts`: Service layer managing SQLite KV storage (`bb.storage.kv`) and realtime broadcasts (`bb.realtime`).
- `server.ts`: Backend RPC contracts (`defineRpcContract`) and CLI registration (`bb.cli.register`).
- `app.tsx`: Frontend registration for App-wide overlay, Thread Header Action, and Nav Panel.
- Adheres to architecture rules AP-010 through AP-032.

## Testing & Build

```bash
npm test         # Run unit and contract tests via node:test
bb plugin build  # Build server and app bundles into dist/
```
