## 1. Config changes

- [ ] 1.1 Remove `TYPE_TO_ROLE` map and its export from `src/config.ts`
- [ ] 1.2 Change `resolveModelsForType` to match agent type directly against YAML role keys using case-insensitive comparison
- [ ] 1.3 Add `console.warn()` when agent type has no matching role, preserving the existing error return to LLM
- [ ] 1.4 Update YAML: rename `explorer` → `Explore`, `planner` → `Plan`, `cheap` → `general-purpose`, and rename `effort` → `thinking` in `~/.pi/agent/model-routing.yml`

## 2. License

- [ ] 2.1 Change `license` field in `package.json` to `MIT`

## 3. Non-blocking get_subagent_result

- [ ] 3.1 Create `src/tools/get-result.ts` with non-blocking `get_subagent_result` tool
- [ ] 3.2 Tool accepts `agent_id`, `wait` (ignored), `verbose` (accepted, no effect) parameters
- [ ] 3.3 Tool uses `SubagentsService.getRecord()` — never awaits `record.promise`
- [ ] 3.4 Format output with agent ID, type, status, tool uses, duration, result/error
- [ ] 3.5 Running agents return: "Agent is still running. Call get_subagent_result again to check its status."
- [ ] 3.6 Register tool in `src/index.ts` (name collision with pi-subagents' `get_subagent_result`)

## 4. Tests

- [ ] 4.1 Remove all TYPE_TO_ROLE tests from `test/config.test.ts`
- [ ] 4.2 Add test: agent type matches YAML role case-insensitively
- [ ] 4.3 Add test: agent type with no matching role returns error and logs warning
- [ ] 4.4 Add test: all existing agent types resolve correctly against renamed YAML keys
- [ ] 4.5 Add test: `get_subagent_result` returns immediately for running agents (no blocking)
- [ ] 4.6 Add test: `get_subagent_result` returns result for completed agents
- [ ] 4.7 Add test: `get_subagent_result` returns error for unknown agent ID
- [ ] 4.8 Add test: `get_subagent_result` accepts `wait` parameter but ignores it

## 5. Verification

- [ ] 5.1 Verify `pnpm run check` passes (TypeScript)
- [ ] 5.2 Verify `pnpm run test` passes
- [ ] 5.3 Verify `pnpm run lint` passes (Biome)
