## 1. Spawner interface and exports

- [x] 1.1 Create `src/tools/spawner.ts` with `Spawner` interface definition (single `spawn(agentType, prompt, options)` method signature)
- [x] 1.2 Implement `setSpawner()` function in `src/tools/spawner.ts` — stores spawner reference in a module-level variable
- [x] 1.3 Implement `getSpawner()` or internal access function so `SubagentDeterministicTool` can read the current spawner
- [x] 1.4 Export `Spawner` type and `setSpawner` function from PSD's package entry point (`src/index.ts`)
- [x] 1.5 Update `package.json` exports map to include the new public API paths

## 2. SubagentDeterministicTool changes

- [x] 2.1 Wire `_spawner` into `SubagentDeterministicTool` — check for custom spawner in `execute()` before falling back to `svc.spawn()`
- [x] 2.2 Replace direct `this.svc.spawn()` call with `this._spawner.spawn()` (with error boundary for throw cases)
- [x] 2.3 Handle the no-spawner edge case: when both `svc` and custom spawner are unavailable, return error string
- [x] 2.4 Ensure model fallback loop works with async spawners (use `await` in loop, catch promise rejections)
- [x] 2.5 Wire `subagent_manual` tool to use `_spawner` instead of direct `svc.spawn()` call

## 3. Extension entry point

- [x] 3.1 Modify PSD entry point: register tools (`subagent`, `subagent_manual`) even when `svc` is undefined. The execute() method handles the no-spawner case at call time.
- [x] 3.2 When custom spawner is set (PTS present), skip registering `get_subagent_result` and `steer_subagent` — PTS provides tmux-aware versions
- [x] 3.3 Verify `subagent_manual` tool registration doesn't require `svc` (it now uses `_spawner` which has a no-op default)

## 4. Tests

- [x] 4.1 Unit test: default spawner delegates to `SubagentsService.spawn()` when no custom spawner set
- [x] 4.2 Unit test: `setSpawner()` overrides default — custom spawner is called instead of `svc.spawn()`
- [x] 4.3 Unit test: `setSpawner()` can be called multiple times — latest spawner wins
- [x] 4.4 Unit test: no-op spawner returns error when neither `svc` nor custom spawner is available
- [x] 4.5 Unit test: `Spawner` interface type check — compile-time test verifying interface compatibility
- [x] 4.6 Unit test: model fallback works with async custom spawner (first model rejection → second model succeeds)
- [x] 4.7 Unit test: `string | Promise<string>` return type — both sync and async spawners satisfy the interface
- [x] 4.8 Unit test: spawner throws/rejects on error — `execute()` catches and returns error text, does not return thrown string as agent ID
- [x] 4.9 Unit test: `subagent_manual` routes through custom spawner when set
- [x] 4.10 Verify `pnpm run check` passes (TypeScript)
- [x] 4.11 Verify `pnpm run lint` passes (Biome + ESLint)
- [x] 4.12 Verify `pnpm run test` passes — 89/89 tests pass
