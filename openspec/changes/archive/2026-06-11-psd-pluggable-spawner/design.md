## Context

`SubagentDeterministicTool` in `packages/pi-subagents-deterministic/src/tools/deterministic.ts` currently has a hard-coded dependency on `SubagentsService` from `@gotgenes/pi-subagents`. The constructor accepts `svc: SubagentsService | undefined`, and `execute()` calls `this.svc.spawn(agentType, prompt, options)` directly.

When `pi-tmux-sessionizer` (PTS) is installed alongside PSD, PTS needs to override this spawn mechanism with its tmux-based spawner. Without a plugin point, the only options are name-collision (each registers `subagent` — only one wins) or modifying PSD source — which violates the decoupling principle.

This change adds a `Spawner` interface and `setSpawner()` method, letting PTS inject its spawner without PSD knowing about PTS at all. PSD controls the interface contract.

## Goals / Non-Goals

**Goals:**
- Add a `Spawner` interface that abstracts the spawn operation: `spawn(agentType, prompt, options) => agentId`
- Add `setSpawner(spawner)` on `SubagentDeterministicTool` so PTS (or any extension) can inject its own spawner
- Default spawner wraps the existing `SubagentsService.spawn()` — zero behavior change when no custom spawner is set
- Export `Spawner` type and `setSpawner` function from PSD's public API (`src/index.ts`)
- Both PSD and PTS remain installable standalone — no new dependencies introduced

**Non-Goals:**
- Not changing PSD's existing tool registration or execute() logic flow
- Not modifying pi-subagents source
- Not adding lifecycle events or observer patterns for spawn events
- Not changing the `SpawnOptions` type (it already fits both in-process and tmux use cases)

## Decisions

### Decision 1: Interface shape — string | Promise<string> to support both sync and async

**Chosen**: `Spawner` interface with a `spawn()` method that returns `string | Promise<string>`:

```typescript
export interface Spawner {
  spawn(agentType: string, prompt: string, options: SpawnOptions): string | Promise<string>;
}
```

**Rationale**: The existing `SpawnOptions` type from `@gotgenes/pi-subagents` already carries everything needed: `model`, `thinkingLevel`, `description`, `inheritContext`, `maxTurns`, `foreground`. The union return type supports both synchronous spawners (default `SubagentsService.spawn()` returns `string`) and asynchronous spawners (PTS's tmux spawn returns `Promise<string>`). The union is backward-compatible — existing sync callers continue to work without change.

**Error semantics**: Spawners communicate errors by **throwing** (or returning a rejected promise for async spawners). This is consistent with `SubagentsService.spawn()` which already throws on failure, and lets the caller's `execute()` method catch and format the error message. Returning an error string indistinguishable from an agent ID is not acceptable.

**Pi-tmux-sessionizer (PTS) implements this interface**: When PTS is installed, it creates a `Spawner`-compatible object and passes it to PSD's `setSpawner()`. PTS's spawner returns `Promise<string>` (agent ID resolved after tmux window creation).

**Alternatives considered**:
- PSD-specific options type: decouples from pi-subagents types but duplicates fields. Rejected: unnecessary abstraction for MVP.
- `Promise<string>` only (no union): forces `SubagentsService.spawn()` into an unnecessary `Promise.resolve()` wrapper. Union is cleaner.

### Decision 2: `setSpawner()` setter — both subagent tools use the custom spawner

**Chosen**: Single `setSpawner()` method on `SubagentDeterministicTool` that affects both the `subagent` tool AND the `subagent_manual` tool. When a custom spawner is set, both tools route through it. When no custom spawner is set, both tools fall back to `SubagentsService.spawn()`.

```typescript
class SubagentDeterministicTool {
  private _spawner: Spawner;

  constructor(
    private readonly configDir: string,
    svc: SubagentsService | undefined,
  ) {
    this._spawner = svc ? { spawn: svc.spawn.bind(svc) } : defaultNoopSpawner;
  }

  setSpawner(spawner: Spawner): void {
    this._spawner = spawner;
  }
}
```

PSD's own extension entry point never calls `setSpawner()` — it's purely for external use. PTS imports PSD, creates a `Spawner`-compatible object, and calls `setSpawner(tmuxSpawner)` during its init.

**Alternatives considered**:
- Constructor parameter only (second optional arg): can't be called after construction — PTS loads after PSD in the extension lifecycle, so the setter must be callable post-construction.
- Only `subagent` tool uses custom spawner, `subagent_manual` stays on `svc.spawn()`: inconsistent UX. If PTS is providing the spawn mechanism, both tools should use it.

### Decision 3: Export path — `setSpawner` from package entry

**Chosen**: Export `Spawner` type and `setSpawner` function from `@r3b1s/pi-subagents-deterministic` at the package entry point:

```typescript
// src/index.ts
export { type Spawner, setSpawner } from "./tools/spawner";
```

PTS imports via:
```typescript
import { setSpawner } from "@r3b1s/pi-subagents-deterministic";
```

**Rationale**: Standard Node.js package export path. No internal path imports needed. PSD's `package.json` exports map already exposes `"./src/index.ts"` — adding exports to `package.json` formalizes the public API boundary.

### Decision 4: No-op default spawner when `svc` is undefined

**Chosen**: When `SubagentsService` is unavailable (`svc === undefined`) and no custom spawner has been set, `_spawner.spawn()` returns an error string. This preserves the existing behavior where PSD returns an error message when pi-subagents isn't loaded.

```typescript
const defaultNoopSpawner: Spawner = {
  spawn: () => {
    throw new Error("SubagentsService not available. Ensure @gotgenes/pi-subagents is loaded.");
  },
};
```

If PTS is installed, it calls `setSpawner()` before any tool invocation, replacing the no-op default. PSD never needs `SubagentsService` at all when PTS provides the spawner — PTS handles the entire spawn lifecycle.

### Decision 5: Register tools even when `svc` is undefined

**Chosen**: PSD's extension entry point SHALL register its tools (`subagent`, `subagent_manual`) regardless of whether `SubagentsService` is available. The `execute()` method handles the no-spawner case at call time (returns error). This is essential for composition: PTS provides the spawner via `setSpawner()`, and PSD's tools must be registered for PTS to route through them.

Current behavior (early return when `svc` is undefined) prevents PSD from registering any tools at all — making composition impossible even with a valid spawner.

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| **PTS loads before PSD and calls `setSpawner()` before PSD's tool exists** | PTS detects PSD via dynamic import and calls `setSpawner` lazily (on tool registration, not on extension load). If PSD isn't loaded yet, PTS retries or defers. |
| **`SpawnOptions` type changes in `@gotgenes/pi-subagents`** | PSD and PTS both depend on pi-subagents types. A type change would require updates in both — but that's a pre-existing coupling, not introduced by this change. |
| **PTS overrides PSD's spawner, then unloads** | Extensions don't unload mid-session in pi. If PTS were to be disabled, the spawner stays. Not a practical concern. |
| **Tool calls `execute()` before `setSpawner()` is called** | PTS extension init runs before any tool calls (extensions load at session start). When PTS is absent, no `setSpawner()` call happens and the default `SubagentsService` spawner is used — identical to current behavior. |

## Integration Contract with pi-tmux-sessionizer

When both `@r3b1s/pi-subagents-deterministic` (PSD) and `@r3b1s/pi-tmux-sessionizer` (PTS) are installed:

1. PTS detects PSD via dynamic import during its init and calls `setSpawner(tmuxSpawner)`.
2. `tmuxSpawner` implements PSD's `Spawner` interface (`spawn(agentType, prompt, options): string | Promise<string>`).
3. PSD routes all spawn calls through the custom spawner. `SubagentsService` is never called.
4. PSD skips registering `get_subagent_result` and `steer_subagent` — PTS provides those.
5. PTS captures `parentSessionId` at init time and bakes it into the spawner closure.

See `openspec/changes/pi-subagents-tmux/` for PTS design details.

## Open Questions

_(none resolved)_
