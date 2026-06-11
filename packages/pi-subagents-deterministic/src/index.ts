import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { SubagentsService } from "@gotgenes/pi-subagents";
import { SubagentDeterministicTool } from "./tools/deterministic";
import { GetSubagentResultTool } from "./tools/get-result";
import { SubagentManualTool } from "./tools/manual";

export {
  type ResultProvider,
  setResultProvider,
} from "./tools/get-result";
export { type Spawner, setSpawner } from "./tools/spawner";

export default async function (pi: ExtensionAPI): Promise<void> {
  // Resolve pi config directory
  // config.ts appends "agent/model-routing.yml" to this directory
  const configDir = process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi");

  // Access SubagentsService via dynamic import
  let svc: SubagentsService | undefined;
  try {
    const mod = await import("@gotgenes/pi-subagents");
    svc = mod.getSubagentsService();
  } catch {
    // pi-subagents not loaded
  }

  // Register deterministic subagent tool (name collision with pi-subagents)
  // Always registered — when svc is unavailable, the spawner no-op handles errors.
  // This enables composition: PTS provides a spawner via setSpawner(), and PSD's
  // tools must be registered for PTS to route through them.
  const deterministicTool = new SubagentDeterministicTool(configDir, svc);
  pi.registerTool(deterministicTool.toToolDefinition());

  // Register manual override tool (always visible alongside subagent)
  const manualTool = new SubagentManualTool(svc);
  pi.registerTool(manualTool.toToolDefinition());

  // Register get_subagent_result unconditionally.
  // When PTS is present, it injects a ResultProvider via setResultProvider(),
  // and GetSubagentResultTool delegates to it first. This avoids the
  // first-writer-wins registration race: even if PSD registers this tool
  // before PTS loads, the injected provider routes results through PTS's
  // tracker. When no provider is set, falls back to svc-based lookup.
  const getResultTool = new GetSubagentResultTool(svc);
  pi.registerTool(getResultTool.toToolDefinition());
}
