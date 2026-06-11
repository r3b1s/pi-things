## Why

`SubagentDeterministicTool` hard-codes `SubagentsService.spawn()` as its only spawn mechanism. When `pi-tmux-sessionizer` (PTS) is installed alongside PSD, there's no way for PTS to inject its tmux-based spawner — PSD cannot delegate to PTS. This forces the user to choose between deterministic routing (PSD) and tmux observability (PTS), when they should have both.

## What Changes

- Add a `Spawner` interface to PSD that abstracts the spawn mechanism: `spawn(agentType, prompt, options) => agentId`
- Add a `setSpawner(spawner)` method on `SubagentDeterministicTool` so external extensions (PTS) can inject their own implementation
- The existing `SubagentsService.spawn()` call becomes the default spawner — no behavior change when PTS is absent
- Export the `Spawner` type and `setSpawner` function from PSD's public API
- No breaking changes — existing standalone usage is unaffected

## Capabilities

### New Capabilities
- `pluggable-spawner`: A `Spawner` interface and `setSpawner()` plugin point on `SubagentDeterministicTool`, allowing external extensions to replace the default subagent spawn mechanism without modifying PSD source.

### Modified Capabilities
_(none — this extends PSD's public API without changing existing behavior)_

## Impact

- **Modified package**: `packages/pi-subagents-deterministic/` in the pi-things monorepo
- **New exports**: `Spawner` type, `setSpawner()` function
- **No breaking changes**: standalone PSD behavior unchanged. `SubagentsService` remains the default.
- **PTS integration**: PTS calls `setSpawner(tmuxSpawner)` at boot, PSD routes spawns through it
- **No changes** to pi-subagents source, pi-harness-cfg, or agent definitions
