## ADDED Requirements

### Requirement: Spawner interface definition
PSD SHALL export a `Spawner` interface with a single `spawn(agentType: string, prompt: string, options: SpawnOptions): string | Promise<string>` method. The `SpawnOptions` type SHALL be the same type used by `@gotgenes/pi-subagents`' `SubagentsService.spawn()`. The union return type accommodates both synchronous spawners (`SubagentsService`) and asynchronous spawners (`pi-tmux-sessionizer` tmux spawner).

#### Scenario: Spawner type is exported
- **WHEN** a third-party extension imports `{ type Spawner }` from `@r3b1s/pi-subagents-deterministic`
- **THEN** the exported type is a callable interface with the `spawn` method signature

### Requirement: Default spawner wraps SubagentsService
When `setSpawner()` has not been called, `SubagentDeterministicTool.execute()` SHALL behave identically to current behavior — resolving config from `model-routing.yml` and calling `SubagentsService.spawn()`.

#### Scenario: No custom spawner set
- **WHEN** PSD is loaded without PTS and no `setSpawner()` call has been made
- **THEN** the tool spawns subagents via `SubagentsService.spawn()` as before
- **AND** the result is identical to pre-change behavior

### Requirement: setSpawner overrides default spawner
PSD SHALL export a `setSpawner(spawner: Spawner): void` function. When called, all subsequent invocations of `SubagentDeterministicTool.execute()` SHALL use the provided spawner instead of `SubagentsService.spawn()`.

#### Scenario: PTS sets custom spawner
- **WHEN** PTS imports `{ setSpawner }` from `@r3b1s/pi-subagents-deterministic` and calls `setSpawner(tmuxSpawner)`
- **THEN** PSD's `subagent` tool routes spawn calls through `tmuxSpawner.spawn()`
- **AND** `SubagentsService.spawn()` is NOT called

#### Scenario: setSpawner called multiple times
- **WHEN** `setSpawner()` is called more than once
- **THEN** the most recent spawner replaces the previous one
- **AND** no error is thrown

### Requirement: subagent_manual uses custom spawner
When a custom spawner has been set via `setSpawner()`, the `subagent_manual` tool SHALL also route through the custom spawner, not through `SubagentsService.spawn()`. This ensures consistent behavior between the two subagent tools.

#### Scenario: subagent_manual with PTS spawner
- **WHEN** PTS has called `setSpawner(tmuxSpawner)` and the LLM calls `subagent_manual(prompt="task", model="haiku")`
- **THEN** the call routes through the custom spawner (PTS), not `SubagentsService.spawn()`

### Requirement: No-op spawner when neither SubagentsService nor custom spawner available
When `SubagentsService` is not available AND no custom spawner has been set, `spawn()` SHALL return an error message indicating that no spawn mechanism is available.

#### Scenario: Neither PTS nor SubagentsService available
- **WHEN** neither `@gotgenes/pi-subagents` nor `pi-tmux-sessionizer` is installed
- **THEN** calling the `subagent` tool returns an error: "No spawn mechanism available. Install @gotgenes/pi-subagents or pi-tmux-sessionizer."
- **AND** no subagent is spawned

### Requirement: setSpawner accessible before tool invocation
The `setSpawner()` function SHALL be callable at any point after PSD is loaded, including during extension initialization (before any `subagent` tool call is made).

#### Scenario: PTS calls setSpawner during init
- **WHEN** PTS extension init runs and calls `setSpawner(tmuxSpawner)` before any tool invocation
- **THEN** the spawner is registered and ready for the first `subagent` tool call
