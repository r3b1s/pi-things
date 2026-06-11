## Context

Subagents currently run in-process via `@gotgenes/pi-subagents` — child `AgentSession` objects within the same Node.js runtime. This provides no external observability, no process isolation, and no way to visually watch subagent execution. The parent TUI shows only compact status widgets.

Pi's own design philosophy states: **"No sub-agents — Spawn pi instances via tmux, or build sub-agent support via extensions."** The broader AI coding agent ecosystem has converged on tmux as the multi-agent observability substrate (shogun, herdr, Agent Deck, cmux, Claude Code agent teams).

This extension creates real pi processes in detached tmux windows, giving users full terminal visibility into subagent execution without changing their parent pi UX.

### Existing infrastructure

- **pi CLI** supports `pi "prompt"` — launches full TUI with prompt auto-sent. Session stored at deterministic path via `PI_CODING_AGENT_DIR`, `PI_CODING_AGENT_SESSION_DIR`, and `--session-id`.
- **Session files** are JSONL — each entry is a parseable JSON line. Last assistant text message = subagent result.
- **tmux CLI** provides `new-session -d`, `new-window`, `send-keys`, `capture-pane`, `has-session`, `kill-session` — everything needed for lifecycle management.
- **`pi-subagents-deterministic` (PSD)** (in this repo) wraps pi-subagents' `SubagentsService` with deterministic model routing. This extension (PTS) composes with PSD via a `setSpawner()` plugin point when both are installed.

## Goals / Non-Goals

**Goals:**
- Spawn subagents as real `pi` processes in detached tmux windows within a single tmux session per parent pi session
- Parent pi remains completely tmux-oblivious — works without tmux installed
- UX identical for users who never attach to tmux sessions
- Optional `tmux attach -t pi-sub-<id>` for full TUI view of any subagent
- Completion detection via session JSONL file monitoring
- Result extraction from session file (last assistant text)
- Steering support via `steer_subagent` tool (`tmux send-keys`) and native typing in tmux window
- Kill support via `Ctrl+C` in tmux window or extension tool
- Graceful degradation when tmux is not installed (clear error message)
- Cleanup of tmux sessions on parent session end

**Non-Goals:**
- Process-level security isolation (sandboxing, containers) — this is about observability, not sandboxing
- Git worktree isolation per subagent (defer to future)
- Foreground/streaming subagent execution (background-only MVP)
- Replacing pi-subagents' lifecycle infrastructure — this is a separate spawn mechanism
- Modifying pi source code
- Cross-session subagent persistence (subagents die with their tmux session)
- Replacing PSD's model routing — PTS reads `model-routing.yml` itself when standalone, defers to PSD when composed

## Decisions

### Decision 1: One tmux session per parent pi session, windows per subagent

**Chosen**: `tmux new-session -d -s "_pi-sub-<parentSessionId>"` for the session, `tmux new-window -t "_pi-sub-<id>" -n "<type>-<shortId>"` for each subagent. Standard tmux navigation between windows.

**Underscore prefix** (`_pi-sub-`): Groups all PTS sessions together in `tmux list-sessions` (sorting), prevents polluting user's personal tmux namespace. The `_` character is valid in tmux session names and visually separates the prefix from the ID.

**Rationale**: One session per parent means the user attaches once and can see all subagents via `C-b n`/`p`/`0-9`. Clean namespace. No proliferation of tmux sessions.

**Alternatives considered**:
- One tmux session per subagent: too many sessions, user must remember individual names, harder to navigate
- Single window with split panes: doesn't scale, layout management complex

### Decision 2: pi interactive mode with initial prompt (`pi "prompt"`) — not print mode

**Chosen**: `pi "write tests for foo.ts"` — launches full TUI, auto-sends prompt, runs agentic turn loop, stays interactive after completion.

**Rationale**: The whole point is observability. Print mode (`-p`) exits after completion and shows only text output — no tool call visibility, no thinking indicators, no TUI. Interactive mode with initial prompt gives the full pi experience in the tmux window.

**Trade-off**: pi doesn't auto-exit after task completion. We detect completion from the session file instead. The process stays alive (user can steer from within tmux). The parent is not blocked — it gets results via file monitoring.

**Alternatives considered**:
- Print mode (`pi -p`): exits cleanly but no TUI, defeats the purpose
- RPC mode (`pi --mode rpc`): headless, no TUI, requires custom client
- Custom extension to auto-exit: adds complexity, fragile

### Decision 3: Session file monitoring for completion detection

**Chosen**: Watch the subagent's JSONL session file for the pattern: user message → (tool calls)* → assistant text. After last assistant text, wait 3 seconds of inactivity before marking complete.

**Rationale**: pi persists every message to the session file in real-time (append-only JSONL). The file path is deterministic given `PI_CODING_AGENT_SESSION_DIR` and `--session-id`. No need for custom extensions, named pipes, or signal files. Simple polling or `fs.watch`.

**Completion detection algorithm**:
1. Find the session file: `<sessionDir>/<cwd-hash>/<timestamp>_<agentId>.jsonl`
2. Parse entries, tracking the last user message timestamp
3. When entries after that user message include an assistant message with text content (not just tool calls), and no new entries appear for 3 seconds → task complete
4. Extract result: last assistant message's text content blocks concatenated

**Alternatives considered**:
- Companion extension that writes `.done` file: cleaner signal but adds extension loading complexity, extra file to ship
- `tmux capture-pane` for output scraping: fragile, mixes ANSI escape codes, doesn't give clean result text
- Named pipe for completion signal: requires the pi process to explicitly write to it, which it doesn't
- RPC mode with explicit completion events: no TUI, defeats purpose

### Decision 4: `steer_subagent` via `tmux send-keys`

**Chosen**: `tmux send-keys -t "pi-sub-<id>:<windowIndex>" -l "<message>"` followed by `tmux send-keys -t "..." Enter`. For multiline/long messages, write to temp file + `tmux load-buffer` + `tmux paste-buffer`.

**Rationale**: The subagent is running pi interactively — stdin is the natural steering channel. `send-keys` types into the terminal exactly as a user would. Simple, reliable, no custom protocol needed.

**Short messages** (<200 chars, single line): `send-keys -l` (literal mode) + Enter.
**Long/multiline messages**: Write to `/tmp/pi-sub-steer-<uuid>`, `load-buffer`, `paste-buffer -d`.

**Alternatives considered**:
- Named pipe connected to pi's stdin: requires launching pi differently, doesn't work with tmux's PTY management
- Custom extension that watches a steer file: adds complexity, needs extension loading in subagent
- RPC mode for steering: no TUI

### Decision 5: Config isolation via `PI_CODING_AGENT_DIR` per subagent

**Chosen**: Each subagent gets its own config directory at `<PI_CODING_AGENT_DIR>/tmp/subagents/<parentId>/<agentId>/` with:
- `settings.json` — model, thinking level, tool allowlist
- `auth.json` — copied from parent's config (not symlinked, to avoid cross-filesystem issues)
- `models.json` — copied from parent's config
- `sessions/` — for `PI_CODING_AGENT_SESSION_DIR`

**Rationale**: Full config isolation prevents subagent config from leaking into parent or other subagents. Scoping under `PI_CODING_AGENT_DIR/tmp/subagents/<parentId>/` keeps all PTS data within the user's pi directory, avoids cross-instance conflicts, provides a single cleanup target, and survives reboots. Copying auth.json avoids path leakage on multi-user systems.

**Alternatives considered**:
- `/tmp/pi-sub/<agentId>/`: cross-instance conflicts, tmpwatch cleanup risk, auth.json symlink leaks API key path
- Symlinks instead of copies: reveals source path on `ls -la`, breaks if target filesystem is different

### Decision 6: Composition with pi-subagents-deterministic (PSD) via Spawner interface

**Chosen**: PTS implements PSD's exported `Spawner` interface and calls `setSpawner()` from PSD to inject itself. Dependency direction: PTS → PSD (one-way). PSD has zero knowledge of tmux or PTS.

**The `Spawner` interface** (defined and exported by PSD):
```typescript
interface Spawner {
  spawn(agentType: string, prompt: string, options: SpawnOptions): string | Promise<string>;
}
```

PTS creates an object satisfying this interface and passes it to PSD:
```typescript
import { setSpawner } from "@r3b1s/pi-subagents-deterministic";
setSpawner({
  spawn(agentType, prompt, options) {
    return spawnInTmux(agentType, prompt, options); // returns Promise<string>
  },
});
```

**When both installed:**
- PSD's `subagent` and `subagent_manual` tools win (name collision) — handles model/effort resolution from `model-routing.yml`
- PSD routes all spawn calls through PTS's spawner
- PTS registers `get_subagent_result` and `steer_subagent` (tmux-aware versions)
- PTS captures `parentSessionId` at init time via `ExtensionAPI` and bakes it into the spawner closure for config directory path construction

**When PTS is standalone (PSD absent):**
- PTS reads `model-routing.yml` itself and registers its own `subagent` tool
- Same Spawner interface internally, no import from PSD needed

### Decision 7: tmux session naming and ID scheme

**Chosen**: 
- Session: `_pi-sub-<parentSessionId>` (underscore groups PTS sessions, prevents namespace pollution)
- Window: `<agentType>-<agentId[:8]>` (e.g., `implementer-a1b2c3d4`)
- Naming uses only `[a-zA-Z0-9_-]` (safe for tmux, no shell escaping issues)

**Rationale**: Underscore groups all PTS-managed sessions together in `tmux list-sessions` output. Users can distinguish their own sessions from extension-managed ones at a glance. Parent session ID is stable for the parent's lifetime. Short prefixes keep window names readable.

### Decision 8: Background-only MVP, result retrieval via tool

**Chosen**: All subagents run in background (tmux windows). `get_subagent_result` tool reads result from the monitored session file. No foreground/streaming in MVP.

**Rationale**: Matches pi-subagents-deterministic's MVP scope. Foreground execution would require the parent TUI to render subagent output inline — much more complex and not the primary use case (users want to attach to tmux for foreground-like views).

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| **tmux not installed** | Return clear error: "tmux is required. Install with: apt install tmux / brew install tmux" |
| **Session file monitoring race** — completion detected before last entry flushed | 3-second inactivity grace period. pi flushes synchronously. |
| **Orphaned tmux sessions** if parent pi crashes | Extension cleanup on `session_shutdown`. Also: `tmux list-sessions -F '#{session_name}' \| grep '^_pi-sub-'` for manual cleanup. |
| **pi stays running after task completion** — resource leak | pi processes are lightweight when idle. Tmux session killed on parent session end. Acceptable for MVP. |
| **`send-keys` escaping** — special characters in prompts | Use `-l` (literal) mode for short messages. Temp file + `load-buffer` for complex content. Sanitize session/window names. |
| **Session file path construction** — cwd-hash directory name format may change across pi versions | Test against current pi version. Document dependency on pi >= 0.79. |
| **Multiple subagents in same cwd** — session files share same cwd-hash subdirectory | Each subagent has unique `--session-id`, so filenames are unique even in same directory |
| **tmux server not running** | `new-session` auto-starts tmux server. No special handling needed. |
| **Subagent inherits parent extensions** | pi loads extensions from `PI_CODING_AGENT_DIR`. Our config dir has only the extensions we want. Use `--no-extensions` or explicit `-e` for subagent-specific extensions. |

## Open Questions

- **Should the `subagent` tool support a `foreground` parameter?** Not in MVP — background-only. Users attach to tmux for foreground-like views.
## Integration Contract with pi-subagents-deterministic

When both `@r3b1s/pi-tmux-sessionizer` (PTS) and `@r3b1s/pi-subagents-deterministic` (PSD) are installed:

1. PTS detects PSD via dynamic import during its init and calls `setSpawner(tmuxSpawner)` imported from PSD.
2. `tmuxSpawner` implements PSD's `Spawner` interface (`spawn(agentType, prompt, options): string | Promise<string>`).
3. PSD routes all spawn calls through PTS's spawner. `SubagentsService` is never called.
4. PSD skips registering `get_subagent_result` and `steer_subagent` — PTS provides tmux-aware versions.
5. PTS captures `parentSessionId` at init time and bakes it into the spawner closure for config path construction.

See `openspec/changes/psd-pluggable-spawner/` for PSD design details.

## Open Questions

- **Should the `subagent` tool support a `foreground` parameter?** Not in MVP — background-only. Users attach to tmux for foreground-like views.
- **Worktree isolation?** Defer to future. Would require the subagent pi to use a git worktree, which is a separate concern from tmux spawning.
- **`subagent_manual` model fallback on spawn failure?** Could iterate the role's model list. Defer — simpler to report error for MVP.
