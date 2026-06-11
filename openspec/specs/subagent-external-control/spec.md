## ADDED Requirements

### Requirement: Kill subagent via Ctrl+C in tmux window
When the user is attached to the tmux session and presses `Ctrl+C` in a subagent's window, the subagent's pi process SHALL terminate. The extension SHALL detect this termination and mark the subagent as stopped.

#### Scenario: Kill running subagent from tmux
- **WHEN** the user presses `Ctrl+C` in a subagent's tmux window while pi is running
- **THEN** the pi process receives SIGINT and terminates
- **AND** the extension detects the subagent is no longer running
- **AND** the parent TUI widget updates to show the subagent was stopped

### Requirement: Steer subagent by typing in tmux window
When the user is attached to the tmux session and types a message into a subagent's window followed by Enter, pi SHALL process it as a user message (steering). The subagent SHALL incorporate the steering message into its ongoing work.

#### Scenario: Steer subagent from tmux
- **WHEN** the user types "also check edge cases" and presses Enter in the implementer's tmux window
- **THEN** the subagent pi process receives the message as user input
- **AND** the subagent adjusts its work based on the steering message

### Requirement: Steer subagent via steer_subagent tool
The extension SHALL register a `steer_subagent` tool that accepts an `agent_id` and `message`. The tool SHALL send the message to the subagent's tmux window using `tmux send-keys -t <session>:<windowIndex> -l "<message>"` followed by `tmux send-keys -t <session>:<windowIndex> Enter`.

#### Scenario: Steer via tool call
- **WHEN** the LLM calls `steer_subagent(agent_id="abc123", message="try a different approach")`
- **THEN** the message is sent to the subagent's tmux window as typed input
- **AND** the subagent processes it as a steering message

#### Scenario: Steer with multiline message
- **WHEN** the LLM calls `steer_subagent` with a multiline message
- **THEN** the message is written to a temp file and loaded via `tmux load-buffer` + `tmux paste-buffer`
- **AND** the subagent receives the complete multiline input

### Requirement: Kill subagent via extension tool
The extension SHALL provide a mechanism to kill a subagent programmatically. The `steer_subagent` tool SHALL support a special kill signal, or a separate mechanism SHALL exist to send `Ctrl+C` to the subagent's tmux window.

#### Scenario: Kill via tool
- **WHEN** the LLM or user requests to kill subagent `abc123`
- **THEN** `tmux send-keys -t <session>:<windowIndex> C-c` is sent to the subagent's window
- **AND** the subagent's pi process terminates
- **AND** the subagent is marked as stopped in the extension's state

### Requirement: Subagent abort on parent session end
When the parent pi session ends (quit, crash, or session switch), the extension SHALL kill the tmux session `_pi-sub-<parentSessionId>`, terminating all subagent processes.

#### Scenario: Parent session ends
- **WHEN** the parent pi session terminates
- **THEN** the tmux session `_pi-sub-<parentSessionId>` is killed via `tmux kill-session -t <name>`
- **AND** all subagent pi processes are terminated
