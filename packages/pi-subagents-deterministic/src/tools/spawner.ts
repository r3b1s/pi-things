import type { SpawnOptions, SubagentsService } from "@gotgenes/pi-subagents";

/**
 * A Spawner abstracts the mechanism for launching a subagent.
 *
 * It is implemented by the default SubagentsService spawner and by
 * external extensions (e.g. pi-tmux-sessionizer) that provide their
 * own spawn mechanism (e.g. tmux windows).
 *
 * Return type is `string | Promise<string>` — supports both synchronous
 * spawners (SubagentsService returns string) and asynchronous spawners
 * (tmux spawner returns Promise<string>). Errors MUST be communicated by
 * throwing (or returning a rejected promise for async spawners).
 */
export interface Spawner {
  spawn(
    agentType: string,
    prompt: string,
    options: SpawnOptions,
  ): string | Promise<string>;
}

// ──────────────────────────────────────────────
// Module-level spawner store
// ──────────────────────────────────────────────

let _customSpawner: Spawner | undefined;

/**
 * Override the default spawn mechanism with a custom Spawner.
 *
 * Call this during extension initialization to inject an alternative
 * spawn mechanism (e.g. pi-tmux-sessionizer's tmux-based spawner).
 * When set, both `subagent` and `subagent_manual` tools route through
 * the custom spawner instead of SubagentsService.spawn().
 *
 * May be called multiple times — the most recent spawner wins.
 */
export function setSpawner(spawner: Spawner): void {
  _customSpawner = spawner;
}

/**
 * Return the effective Spawner for the current session.
 *
 * Resolution order:
 * 1. Custom spawner (set via setSpawner) — when PTS or similar is active
 * 2. SubagentsService wrapper — default when pi-subagents is loaded
 * 3. No-op spawner — throws a descriptive error
 */
export function getSpawner(svc: SubagentsService | undefined): Spawner {
  if (_customSpawner) return _customSpawner;
  if (svc) return { spawn: svc.spawn.bind(svc) };
  return {
    spawn: () => {
      throw new Error(
        "No spawn mechanism available. Install @gotgenes/pi-subagents or pi-tmux-sessionizer.",
      );
    },
  };
}

/**
 * Whether a custom spawner has been registered via setSpawner().
 */
export function hasCustomSpawner(): boolean {
  return _customSpawner !== undefined;
}

/**
 * Reset the custom spawner to unset state.
 *
 * Used by tests to isolate cases; not part of the public extension API.
 * External extensions should never call this mid-session.
 */
export function resetSpawner(): void {
  _customSpawner = undefined;
}
