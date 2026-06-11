## ADDED Requirements

### Requirement: Composition with pi-subagents-deterministic via Spawner interface
PTS SHALL implement PSD's `Spawner` interface (defined and exported by `@r3b1s/pi-subagents-deterministic`). PTS SHALL call `setSpawner(tmuxSpawner)` from PSD during initialization to inject its tmux spawner. The `Spawner` interface SHALL require a single `spawn(agentType: string, prompt: string, options: SpawnOptions): string | Promise<string>` method. PTS SHALL also function standalone (without PSD) by registering its own `subagent` tool that reads `model-routing.yml` for model resolution.

#### Scenario: PTS registers with PSD
- **WHEN** pi-subagents-deterministic is installed and PTS calls `setSpawner(tmuxSpawner)`
- **THEN** subsequent calls to PSD's `subagent` tool route through PTS's tmux spawner
- **AND** PTS does not register its own `subagent` tool (avoids duplicate in the LLM tool list)

#### Scenario: PTS runs standalone without PSD
- **WHEN** pi-subagents-deterministic is NOT installed
- **THEN** PTS registers its own `subagent` tool with model-routing.yml resolution
- **AND** PTS registers `get_subagent_result` and `steer_subagent` tools

### Requirement: Extension registers subagent tool (standalone mode) (standalone mode)
When pi-subagents-deterministic is NOT installed, the extension SHALL register a tool named `subagent` with parameters: `subagent_type` (string, required), `prompt` (string, required), `description` (string, required), `run_in_background` (boolean, optional, default true), `inherit_context` (boolean, optional, default false), `max_turns` (number, optional), `model` (string, optional), `thinking` (string, optional), `resume` (string, optional). The `resume` parameter accepts an agent ID and sends a new prompt to that agent's tmux window (functionally equivalent to `steer_subagent`). When PSD IS installed, the extension SHALL NOT register `subagent` (PSD's tool takes precedence via name collision and routes through PTS's `setSpawner`). In both modes, the extension SHALL register `get_subagent_result` and `steer_subagent` tools. The extension SHALL NOT require the parent pi to run inside tmux.

#### Scenario: Tool registered on extension load
- **WHEN** the extension is loaded by pi
- **THEN** a `subagent` tool is visible in the LLM's available tools

#### Scenario: Tool parameters exclude tmux-specific fields
- **WHEN** the LLM inspects the `subagent` tool parameters
- **THEN** no tmux session name, window index, or tmux-specific parameters are exposed

### Requirement: Tmux session created on first subagent spawn
The extension SHALL create a detached tmux session named `_pi-sub-<parentSessionId>` when the first subagent is spawned for a given parent pi session. The session SHALL be created with `tmux new-session -d -s <name>`.

#### Scenario: First subagent in parent session
- **WHEN** the LLM calls `subagent(type=implementer, prompt="write tests")` and no `_pi-sub-<id>` tmux session exists
- **THEN** a detached tmux session `_pi-sub-<parentSessionId>` is created
- **AND** the first window (index 0) is renamed to the subagent type and short ID

#### Scenario: Subsequent subagent in same parent session
- **WHEN** the LLM calls `subagent(type=Explore, prompt="find auth")` and `_pi-sub-<id>` tmux session already exists
- **THEN** a new window is created in the existing session with `tmux new-window -t <session> -n <windowName>`
- **AND** no new tmux session is created

### Requirement: Subagent launched as pi process in tmux window
The extension SHALL launch pi in each tmux window using the interactive mode with initial prompt: `PI_CODING_AGENT_DIR=<configDir> PI_CODING_AGENT_SESSION_DIR=<sessionDir> pi --session-id <agentId> "<prompt>"`. The config directory SHALL contain a settings.json with the subagent's model, thinking level, and tool configuration.

#### Scenario: Subagent pi process launched
- **WHEN** a subagent window is created
- **THEN** a `pi` process is running in that window with the prompt as its initial message
- **AND** the pi process displays its full TUI in the window

#### Scenario: Config directory created per subagent
- **WHEN** a subagent is spawned
- **THEN** a unique config directory is created for the subagent under `<PI_CODING_AGENT_DIR>/tmp/subagents/<parentSessionId>/<agentId>/`
- **AND** the config directory contains `settings.json` with model, thinking, and tool settings
- **AND** `PI_CODING_AGENT_DIR` is set to that directory
- **AND** `PI_CODING_AGENT_SESSION_DIR` is set to a sessions subdirectory

### Requirement: Agent ID returned to caller
The extension SHALL return an agent ID string to the LLM after spawning a subagent. The ID SHALL be the same UUID used for `--session-id`.

#### Scenario: Agent ID returned
- **WHEN** a subagent is successfully spawned
- **THEN** the tool returns a result containing the agent ID
- **AND** the result includes the tmux session name and window name for reference

### Requirement: Graceful degradation when tmux unavailable
The extension SHALL detect whether `tmux` is available on PATH at spawn time. If tmux is not found, the tool SHALL return an error message instructing the user to install tmux.

#### Scenario: tmux not installed
- **WHEN** the `subagent` tool is called and `tmux` is not on PATH
- **THEN** the tool returns an error: "tmux is required but not found. Install with: apt install tmux or brew install tmux"
- **AND** no subagent is spawned

### Requirement: Session ID validation
The extension SHALL validate that tmux session and window names contain only safe characters (`[a-zA-Z0-9_-]`) before passing them to tmux CLI commands.

#### Scenario: Invalid characters in session name
- **WHEN** constructing a tmux command with a session or window name
- **THEN** only alphanumeric characters, hyphens, and underscores are used
- **AND** any other characters are stripped or the operation is rejected
