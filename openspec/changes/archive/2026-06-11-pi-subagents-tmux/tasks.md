## 1. Package scaffolding

- [x] 1.1 Create `packages/pi-tmux-sessionizer/` with `package.json`, `tsconfig.json`, `vitest.config.ts`
- [x] 1.2 Add `@earendil-works/pi-coding-agent` and `@earendil-works/pi-ai` as dev dependencies
- [x] 1.3 Add `@r3b1s/pi-subagents-deterministic` as optional peer dependency (for composition via `setSpawner`)
- [x] 1.4 Configure package.json `pi.extensions` pointing to `./src/index.ts`
- [x] 1.5 Add build, test, check, lint scripts matching monorepo conventions
- [x] 1.6 Set `"files"` in package.json to include `dist/` and any bundled assets

## 2. Tmux session manager

- [x] 2.1 Implement `TmuxManager` class with `createSession(parentSessionId)`, `destroySession(parentSessionId)`, `sessionExists(parentSessionId)`
- [x] 2.2 Implement session name generation: `_pi-sub-<parentSessionId>` with character validation (`[a-zA-Z0-9_-]` only, underscore prefix for grouping)
- [x] 2.3 Implement window creation: `createWindow(sessionName, windowName, command)` using `tmux new-window`
- [x] 2.4 Implement window name generation: `<agentType>-<agentId[:8]>`
- [x] 2.5 Implement `sendKeys(sessionName, windowIndex, text)` — short message path using argv-based `execFileSync` with `-l` literal mode
- [x] 2.6 Implement `sendKeysLong(sessionName, windowIndex, text)` — long/multiline path using temp file + `load-buffer` + `paste-buffer` (argv-based)
- [x] 2.7 Implement `sendCtrlC(sessionName, windowIndex)` for subagent kill
- [x] 2.8 Implement `capturePane(sessionName, windowIndex, lines)` for output capture
- [x] 2.9 Implement `windowExists(sessionName, windowIndex)` using `tmux list-windows` — returns correct boolean
- [x] 2.10 Wrap all tmux CLI calls in `child_process.execFileSync` with argv arrays (prevents shell injection)
- [x] 2.11 Implement tmux availability check: `command -v tmux` via `execFileSync`, return clear error if missing
- [x] 2.12 Set `remain-on-exit` on newly created panes (preserves output after Ctrl+C or `kill_subagent`; pi stays live on natural completion)

## 3. Subagent config directory

- [x] 3.1 Implement `createSubagentConfig(parentId, agentId, options)` — creates `<PI_CODING_AGENT_DIR>/tmp/subagents/<parentId>/<agentId>/` directory
- [x] 3.2 Write `settings.json` with model, thinking level, tools, and other subagent-specific settings
- [x] 3.3 Copy `auth.json` and `models.json` from parent config (not symlink — avoids cross-filesystem issues)
- [x] 3.4 Create `sessions/` subdirectory for session file storage
- [x] 3.5 Implement cleanup: `destroySubagentConfig(parentId, agentId)` removes `<PI_CODING_AGENT_DIR>/tmp/subagents/<parentId>/<agentId>/` recursively
- [x] 3.6 Implement cleanup on session end: remove `<PI_CODING_AGENT_DIR>/tmp/subagents/<parentId>/` entirely

## 4. Subagent spawner

- [x] 4.1 Implement `spawnSubagent(params)` — main spawn function coordinating tmux, config, and monitoring
- [x] 4.2 Build pi launch command: `PI_CODING_AGENT_DIR=<dir> PI_CODING_AGENT_SESSION_DIR=<dir>/sessions pi --session-id <id> "<prompt>"`
- [x] 4.3 Shell-escape the prompt for safe command-line passing (single quotes, special chars)
- [x] 4.4 Pass model as CLI flag if specified: `--model <model>`
- [x] 4.5 Pass thinking level as CLI flag if specified: `--thinking <level>`
- [x] 4.6 Implement agent ID generation (UUID v4, same as `--session-id` value)
- [x] 4.7 Track spawned subagents in an in-memory Map: id → { status, sessionName, windowIndex, configDir, startedAt }
- [x] 4.8 Handle `inherit_context` by prepending parent conversation history as text to the subagent prompt using `buildParentContext()` — wires `parentContextText` and `parentContext` from SpawnParams; documents limitation when neither is available.

## 5. Session file monitor

- [x] 5.1 Implement `monitorSessionFile(agentId, configDir)` — locates and watches the session JSONL file
- [x] 5.2 Implement session file path construction: scan `<sessionDir>/` for cwd-hash subdirectory, find `*_<agentId>.jsonl`
- [x] 5.3 Implement retry logic for when session file doesn't exist yet (pi still starting): poll every 500ms for up to 10s
- [x] 5.4 Implement completion detection algorithm: parse JSONL entries, detect user message → assistant text pattern (assistant must follow user), 3s inactivity grace period before marking completed
- [x] 5.5 Implement result extraction: find last assistant message in message tree, concatenate text content blocks
- [x] 5.6 Implement file watching: primary — `fs.watch` on session file path. Fallback — if no change events fire for 30s after pi is confirmed running, switch to 1s polling. Stay in polling mode for the subagent's lifetime once engaged.
- [x] 5.7 Handle parse errors gracefully (malformed JSONL lines, partial writes)
- [x] 5.8 Update subagent status in the tracking Map when completion is detected

## 6. PSD detection and tool registration

- [x] 6.1 Implement PSD detection: try/catch dynamic import of `@r3b1s/pi-subagents-deterministic` (retry up to 3 times with 200ms interval to handle loading order race)
- [x] 6.2 Capture `parentSessionId` from `ExtensionAPI` at init time (defensive extraction from session/context objects; falls back to random ID) — bake into the spawner closure for config path construction
- [x] 6.3 If PSD detected, call `setSpawner(tmuxSpawner)` from PSD with a `Spawner`-compatible object wrapping the tmux spawn logic
- [x] 6.4 Create `Spawner`-compatible spawn function that implements PSD's `spawn(agentType, prompt, options): string | Promise<string>` interface — creates tmux window, returns agent ID
- [x] 6.5 If PSD absent, register own `subagent` tool (standalone mode) — reads model-routing.yml, resolves model, spawns via tmux
- [x] 6.6 Define parameter schema: `subagent_type`, `prompt`, `description` (required); `model`, `thinking`, `max_turns`, `run_in_background`, `inherit_context`, `resume` (optional)
- [x] 6.7 `subagent` tool `execute()` delegates to tmux spawner, returns agent ID with session/window metadata (session name, window index, attach command)
- [x] 6.8 Implement `GetSubagentResultTool` class — accepts `agent_id`, returns result or status
- [x] 6.9 `GetSubagentResultTool.execute()` checks tracking Map: running → status message, completed → extracted result, unknown → error
- [x] 6.10 Implement `SteerSubagentTool` class — accepts `agent_id` and `message`
- [x] 6.11 `SteerSubagentTool.execute()` uses TmuxManager.sendKeys or sendKeysLong depending on message length
- [x] 6.12 Register tools in extension entry point: `get_subagent_result` and `steer_subagent` always; `subagent` only when PSD absent
- [x] 6.13 Implement `resume` support in `SubagentTool` — sends prompt to existing tmux window via send-keys
- [x] 6.14 Build tool descriptions with inline guidance (agent type → task mapping)

## 7. Extension entry point

- [x] 7.1 Export default function `(pi: ExtensionAPI) => void`
- [x] 7.2 Run PSD detection (6.1) and setSpawner (6.3) before tool registration
- [x] 7.3 Initialize TmuxManager, spawner, and monitor on extension load
- [x] 7.4 Register tools based on PSD detection outcome (6.12)
- [x] 7.5 Handle `session_shutdown` event: kill tmux session, clean up config directories
- [x] 7.6 Handle graceful degradation: if tmux not available, tools return clear error messages; early warning logged at startup
- [x] 7.7 Log meaningful errors for debugging (tmux failures, spawn failures, monitor issues)

## 9. Tests

- [x] 9.1 Unit tests for TmuxManager session name validation and generation
- [x] 9.2 Unit tests for window name generation
- [x] 9.3 Unit tests for shell escaping of prompts with special characters
- [x] 9.4 Unit tests for completion detection algorithm (mock JSONL entries, various patterns)
- [x] 9.5 Unit tests for result extraction (assistant text, mixed content, edge cases)
- [x] 9.6 Unit tests for session file path construction
- [x] 9.7 Unit tests for tool parameter schemas (subagent, get_result, steer)
- [x] 9.8 Unit tests for agent tracking Map (CRUD operations, status transitions)
- [x] 9.9 Unit tests for PSD detection (present vs absent, tool registration logic)
- [x] 9.10 Integration test: composition with PSD — PTS calls `setSpawner`, PSD routes through PTS
- [x] 9.11 Integration test: standalone mode — PSD absent, PTS registers all three tools
- [x] 9.12 Integration test: tmux session creation and teardown (skip if tmux not available in CI)
- [x] 9.13 Integration test: subagent spawn, monitor, result extraction
- [x] 9.14 Integration test: `inherit_context=true` — seed parent with N exchanges, verify child prompt contains parent context text block
- [x] 9.15 Verify `pnpm run check` passes (TypeScript) — local code compiles; pre-existing errors from npm-published PSD path aliases
- [x] 9.16 Verify `pnpm run lint` passes (Biome + ESLint)
- [x] 9.17 Verify `pnpm run test` passes — 81/81 tests pass

## 10. Monorepo integration

- [x] 10.1 Add package to root `pnpm-workspace.yaml` workspace packages
- [x] 10.2 Verify `pnpm install` resolves all dependencies
- [x] 10.3 Add package to CI pipeline (check + lint + test)
- [x] 10.4 Document installation in README.md: `pi install npm:@r3b1s/pi-tmux-sessionizer`
- [x] 10.5 Document tmux requirement and how to verify it's installed
- [x] 10.6 Document how to attach to tmux session: `tmux attach -t _pi-sub-<sessionId>`
- [x] 10.7 Document composition with PSD: install both for deterministic routing + tmux spawning
