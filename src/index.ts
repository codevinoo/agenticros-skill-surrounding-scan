/**
 * AgenticROS Surroundings Scan skill.
 * Registers scan_surroundings — depth-based 360° obstacle map for text-only agents.
 *
 * Config: config.skills["surroundings-scan"]
 */

import type { AgenticROSConfig } from "@agenticros/core";
import type { SkillPluginApi, SkillContext } from "./types.js";
import { registerScanSurroundingsTool } from "./tools/scan-surroundings.js";

export function registerSkill(
  api: SkillPluginApi,
  config: AgenticROSConfig,
  context: SkillContext,
): void {
  registerScanSurroundingsTool(api, config, context);
}
