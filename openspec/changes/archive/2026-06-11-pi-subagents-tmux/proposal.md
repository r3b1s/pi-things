## Why

Current subagent execution is invisible — subagents run in-process with no way to observe their work in real-time. The parent TUI shows only sparse status widgets. Users want a full terminal window into subagent execution, with the ability to kill, steer, or simply watch. tmux is pi's recommended isolation substrate ("No sub-agents — Spawn pi instances via tmux") and the broader AI coding agent ecosystem has converged on tmux for multi-agent observability (shogun, herdr, Agent Deck, cmux).

## What Changes

- **New Pi extension `@r3b1s/pi-tmux-sessionizer`** — published as a pi package in this monorepo
- Registers a `subagent` tool that spawns subagents as real pi processes in background tmux windows
- One tmux session per parent pi session (`_pi-sub-<parentSessionId>`), one tmux window per subagent (underscore groups sessions together, prevents polluting user's own tmux namespace)
- Subagent runs `pi "prompt"` interactively — full TUI, auto-sends prompt, runs complete agentic turn loop
- Parent pi is completely tmux-oblivious — works without tmux installed on the parent side
- UX unchanged for users who never attach; optional `tmux attach -t _pi-sub-<id>` for full view
- Steering works naturally: type in the tmux window, or use `steer_subagent` tool (`tmux send-keys`)
- Completion detected by monitoring the subagent's session JSONL file; result extracted from last assistant message
- **Depends only on**: tmux CLI (no npm dependencies), pi CLI (already installed)

## Capabilities

### New Capabilities
- `tmux-subagent-spawning`: Spawn subagents as real pi processes in detached tmux windows. One tmux session per parent pi session, one window per subagent. Parent pi requires no tmux awareness. Composes with pi-subagents-deterministic via `setSpawner()` plugin point.
- `subagent-observability`: Users can attach to the tmux session (`tmux attach -t _pi-sub-<id>`) to see live subagent TUI output, tool calls, thinking, and progress. Standard tmux navigation (`C-b n`/`p`/`0-9`) between subagent windows. `remain-on-exit` preserves panes after manual kill.
- `subagent-external-control`: Users can kill subagents via `Ctrl+C` in the tmux window, or steer them by typing directly. The `steer_subagent` tool also works via `tmux send-keys`.
- `session-file-result-extraction`: Completion detected by monitoring the subagent's JSONL session file. Results extracted programmatically from the last assistant text message.

### Modified Capabilities
_(none — this is a new package with no existing specs)_

## Impact

- **New package**: `packages/pi-tmux-sessionizer/` in the pi-things monorepo
- **Dependencies**: `tmux` CLI (system dependency). `@r3b1s/pi-subagents-deterministic` (optional peer — for composition via `setSpawner()`). Pi SDK types as dev dependencies.
- **Composes with**: `pi-subagents-deterministic` via a `setSpawner()` plugin point. When both are installed, PSD handles deterministic model/effort routing while PTS handles tmux spawning. PTS has a one-way dependency on PSD (`setSpawner` interface). PTS is also fully standalone — reads `model-routing.yml` itself when PSD is absent.
- **Tool names**: PTS registers `get_subagent_result` and `steer_subagent`. When standalone, also registers `subagent`. When PSD is present, PSD's `subagent` tool wins (name collision) and routes through PTS's spawner.
- **No changes** to pi source, pi-subagents, pi-harness-cfg, or existing agent definitions
- **User must have tmux installed** for subagent spawning to work (graceful error if missing)
