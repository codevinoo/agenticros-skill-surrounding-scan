/**
 * scan_surroundings: Rotate in place and sample depth sectors at each bearing.
 */

import { Type } from "@sinclair/typebox";
import type { AgenticROSConfig } from "@agenticros/core";
import type { SkillPluginApi, SkillContext } from "../types.js";
import { scanSurroundings } from "../scan-surroundings.js";

export function registerScanSurroundingsTool(
  api: SkillPluginApi,
  config: AgenticROSConfig,
  context: SkillContext,
): void {
  api.registerTool({
    name: "scan_surroundings",
    label: "Scan surroundings",
    description:
      "Rotate the robot in place and sample left/center/right depth at evenly spaced bearings. " +
      "Returns a structured obstacle map (sectors, clearest bearing, blocked bearings) — ideal for text-only LLMs " +
      "that cannot interpret camera images. Does not require vision; uses the RealSense depth stream only.",

    parameters: Type.Object({
      steps: Type.Optional(
        Type.Integer({
          minimum: 2,
          maximum: 36,
          description:
            "Number of bearings around a full 360° rotation. Default skills.surroundings-scan.defaultSteps (8).",
        }),
      ),
      angular_speed: Type.Optional(
        Type.Number({
          minimum: 0.05,
          maximum: 3,
          description:
            "Rotation speed in rad/s between samples. Clamped to safety.maxAngularVelocity. Default 0.3.",
        }),
      ),
      min_clearance_m: Type.Optional(
        Type.Number({
          minimum: 0.1,
          maximum: 10,
          description:
            "Bearings with center distance below this are listed as blocked. Default skills.surroundings-scan.defaultMinClearanceM (0.5).",
        }),
      ),
      clockwise: Type.Optional(
        Type.Boolean({
          description: "Rotate clockwise between samples (default true).",
        }),
      ),
    }),

    async execute(_toolCallId, params) {
      const transport = context.getTransport();
      if (transport.getStatus() !== "connected") {
        return {
          content: [
            {
              type: "text" as const,
              text: "Transport not connected to ROS2. Check the AgenticROS plugin status.",
            },
          ],
          details: { error: "transport_not_connected" },
        };
      }

      try {
        const result = await scanSurroundings(config, context, transport, {
          steps: params["steps"] as number | undefined,
          angularSpeed: params["angular_speed"] as number | undefined,
          minClearanceM: params["min_clearance_m"] as number | undefined,
          clockwise: params["clockwise"] as boolean | undefined,
        });

        const text = result.error
          ? result.summary
          : `${result.summary} (${result.sectors.length} bearings in ${result.elapsedSeconds.toFixed(1)}s).`;

        return {
          content: [{ type: "text" as const, text }],
          details: {
            ok: result.ok,
            steps: result.steps,
            sectors: result.sectors,
            clearest_bearing_deg: result.clearest_bearing_deg,
            clearest_center_m: result.clearest_center_m,
            blocked_bearings: result.blocked_bearings,
            summary: result.summary,
            elapsed_seconds: result.elapsedSeconds,
            depth_topic: result.depthTopic,
            ...(result.error ? { error: result.error } : {}),
          },
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        context.logger.error(`scan_surroundings failed: ${message}`);
        return {
          content: [{ type: "text" as const, text: `scan_surroundings failed: ${message}` }],
          details: { error: message },
        };
      }
    },
  });
}
