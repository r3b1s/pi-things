## ADDED Requirements

### Requirement: Completion detected from session JSONL file
The extension SHALL monitor the subagent's session JSONL file for completion. A subagent is considered complete when a user message is followed by an assistant text message (not just tool calls) and no new entries appear in the session file for 3 seconds.

#### Scenario: Subagent completes task
- **WHEN** the subagent pi process produces an assistant text response after processing the initial prompt
- **AND** no new entries are written to the session file for 3 seconds
- **THEN** the extension marks the subagent as "completed"
- **AND** the parent TUI widget updates to show completion

#### Scenario: Subagent still running (tool calls ongoing)
- **WHEN** the subagent has made tool calls and is waiting for results
- **AND** new entries continue to appear in the session file
- **THEN** the subagent is NOT marked as completed
- **AND** monitoring continues

### Requirement: Result extracted from last assistant message
The extension SHALL extract the subagent's result by parsing the session JSONL file and concatenating the text content blocks from the last assistant message in the message tree.

#### Scenario: Result extraction after completion
- **WHEN** the subagent is marked as completed
- **THEN** the extension parses the session file entries
- **AND** identifies the last assistant message in the message tree
- **AND** concatenates all text content blocks from that message
- **AND** stores the result for retrieval via `get_subagent_result`

#### Scenario: Assistant message with mixed content (text + tool_use)
- **WHEN** the last assistant message contains both text and tool_use content blocks
- **THEN** only the text content blocks are included in the extracted result

### Requirement: get_subagent_result returns extracted result
The extension SHALL register a `get_subagent_result` tool that accepts an `agent_id` and returns the subagent's result. If the subagent is still running, the tool SHALL return its current status. If completed, it SHALL return the extracted result text.

#### Scenario: Get result of completed subagent
- **WHEN** the LLM calls `get_subagent_result(agent_id="abc123")` and the subagent has completed
- **THEN** the tool returns the extracted result text from the last assistant message

#### Scenario: Get result of running subagent
- **WHEN** the LLM calls `get_subagent_result(agent_id="abc123")` and the subagent is still running
- **THEN** the tool returns a status message indicating the subagent is still running
- **AND** optionally includes any partial output available

#### Scenario: Get result of unknown agent
- **WHEN** the LLM calls `get_subagent_result(agent_id="nonexistent")`
- **THEN** the tool returns an error: "Agent not found: nonexistent"

### Requirement: Session file path construction
The extension SHALL construct the session file path from the known config directory and session ID. The path follows pi's convention: `<sessionDir>/<cwd-hash>/<timestamp>_<agentId>.jsonl`.

#### Scenario: Session file located
- **WHEN** the extension needs to monitor a subagent's session file
- **THEN** it scans `<sessionDir>/` for a subdirectory matching the cwd hash
- **AND** within that subdirectory, finds the file matching `*_<agentId>.jsonl`
- **AND** begins monitoring that file for new entries

### Requirement: Monitoring handles file rotation and errors
The extension SHALL handle cases where the session file does not yet exist (pi still starting), the file is temporarily unreadable, or the file path structure changes. Monitoring SHALL retry with backoff rather than failing permanently.

#### Scenario: Session file not yet created
- **WHEN** the subagent pi process is still starting up and the session file doesn't exist
- **THEN** the extension retries locating the file every 500ms for up to 10 seconds
- **AND** returns a "starting" status during this period

#### Scenario: Session file unreadable
- **WHEN** the session file exists but cannot be read (permissions, lock)
- **THEN** the extension retries after 1 second, up to 3 times
- **AND** returns an error if all retries fail
