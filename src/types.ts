/**
 * Minimal skill contract types so the skill can build without installing the plugin.
 * At runtime the plugin passes the real api and context matching this shape.
 */

import type { RosTransport } from "@agenticros/core";

export interface DepthSectorsResult {
  left_m: number;
  center_m: number;
  right_m: number;
  valid: boolean;
  topic: string;
}

export interface SkillContext {
  getTransport(): RosTransport;
  getDepthSectors(
    transport: RosTransport,
    topic: string,
    timeoutMs?: number,
  ): Promise<DepthSectorsResult>;
  logger: { info(msg: string): void; warn(msg: string): void; error(msg: string): void };
}

export interface AgentTool {
  name: string;
  label: string;
  description: string;
  parameters: unknown;
  execute(
    toolCallId: string,
    params: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<{ content: { type: string; text: string }[]; details?: unknown }>;
}

export interface SkillPluginApi {
  registerTool(tool: AgentTool): void;
  logger: SkillContext["logger"];
}
