## ADDED Requirements

### Requirement: User can attach to subagent tmux session
The user SHALL be able to attach to the tmux session using `tmux attach -t _pi-sub-<parentSessionId>` and see the full pi TUI of each subagent in its respective window.

#### Scenario: Attach to tmux session
- **WHEN** the user runs `tmux attach -t _pi-sub-<parentSessionId>`
- **THEN** they see the subagent's pi TUI with live output
- **AND** they can see tool calls, thinking indicators, and model responses as they happen

### Requirement: Standard tmux window navigation
The user SHALL be able to navigate between subagent windows using standard tmux keybindings: `C-b n` (next window), `C-b p` (previous window), `C-b 0-9` (specific window by index).

#### Scenario: Navigate between subagent windows
- **WHEN** the user presses `C-b n` while attached to `_pi-sub-<id>`
- **THEN** the display switches to the next subagent's pi TUI

### Requirement: Window names reflect subagent type
Each tmux window SHALL be named `<agentType>-<shortId>` (e.g., `implementer-a1b2c3d4`, `Explore-f9e8d7c6`). This SHALL allow the user to identify which window corresponds to which subagent.

#### Scenario: Window names visible in tmux status bar
- **WHEN** the user attaches to `_pi-sub-<id>`
- **THEN** the tmux status bar shows window names like `0:implementer-a1b2* 1:Explore-f9e8 2:reviewer-b3c4`

### Requirement: Subagent output visible when attached
After a subagent completes its task, the pi process SHALL remain running in the tmux window (waiting for input). The user SHALL see the final assistant response in the terminal scrollback when they attach. If the user kills the subagent process (Ctrl+C or `kill_subagent`), the pane SHALL remain visible for inspection via `remain-on-exit`.

#### Scenario: Attach after task completion
- **WHEN** a subagent's task completes and the user attaches to its tmux window
- **THEN** the subagent's pi TUI displays the last assistant response in the terminal (pi does not clear output between exchanges)
- **AND** the subagent is waiting for more input (interactive mode)

#### Scenario: Pane preserved after manual kill
- **WHEN** the user kills a subagent via Ctrl+C or the `kill_subagent` tool
- **THEN** the pane remains visible (via `remain-on-exit`) for post-hoc inspection
- **AND** the final output up to the kill point is still readable

### Requirement: Parent pi UX unchanged when not attached
When the user does NOT attach to the tmux session, the parent pi session SHALL behave identically to how it does without the extension — widgets, notifications, and result retrieval work the same way.

#### Scenario: User never attaches to tmux
- **WHEN** subagents are spawned but the user never runs `tmux attach`
- **THEN** the parent pi TUI widgets show subagent status normally
- **AND** `get_subagent_result` returns results when the subagent completes
- **AND** no tmux windows pop up or interrupt the parent terminal
