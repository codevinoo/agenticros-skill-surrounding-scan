/**
 * Surroundings Scan skill config slice: config.skills["surroundings-scan"]
 */

export interface SurroundingsScanConfig {
  /** Depth image topic (sensor_msgs/Image, 16UC1 or 32FC1). */
  depthTopic?: string;
  /** Override cmd_vel topic. Default: derived from teleop / robot namespace. */
  cmdVelTopic?: string;
  /** Default number of bearings (full 360° / steps). Default 8. */
  defaultSteps?: number;
  /** Default rotation speed in rad/s when caller omits it. Default 0.3. */
  defaultAngularSpeed?: number;
  /** Pause after each rotation before sampling depth (ms). Default 400. */
  settleMs?: number;
  /** Depth subscribe timeout per sample (ms). Default 5000. */
  depthTimeoutMs?: number;
  /** Bearings with center distance below this are marked blocked (m). Default 0.5. */
  defaultMinClearanceM?: number;
  /** Rotate clockwise between samples (default true). */
  clockwise?: boolean;
}

const DEFAULTS: Required<SurroundingsScanConfig> = {
  depthTopic: "/camera/camera/depth/image_rect_raw",
  cmdVelTopic: "",
  defaultSteps: 8,
  defaultAngularSpeed: 0.3,
  settleMs: 400,
  depthTimeoutMs: 5000,
  defaultMinClearanceM: 0.5,
  clockwise: true,
};

export function getSurroundingsScanConfig(skillsSlice: unknown): Required<SurroundingsScanConfig> {
  if (!skillsSlice || typeof skillsSlice !== "object") return DEFAULTS;
  const c = skillsSlice as Record<string, unknown>;
  return {
    depthTopic: typeof c.depthTopic === "string" ? c.depthTopic : DEFAULTS.depthTopic,
    cmdVelTopic: typeof c.cmdVelTopic === "string" ? c.cmdVelTopic : DEFAULTS.cmdVelTopic,
    defaultSteps:
      typeof c.defaultSteps === "number" && c.defaultSteps >= 2 && c.defaultSteps <= 36
        ? Math.floor(c.defaultSteps)
        : DEFAULTS.defaultSteps,
    defaultAngularSpeed:
      typeof c.defaultAngularSpeed === "number" && c.defaultAngularSpeed > 0
        ? c.defaultAngularSpeed
        : DEFAULTS.defaultAngularSpeed,
    settleMs:
      typeof c.settleMs === "number" && c.settleMs >= 0 ? c.settleMs : DEFAULTS.settleMs,
    depthTimeoutMs:
      typeof c.depthTimeoutMs === "number" && c.depthTimeoutMs > 0
        ? c.depthTimeoutMs
        : DEFAULTS.depthTimeoutMs,
    defaultMinClearanceM:
      typeof c.defaultMinClearanceM === "number" && c.defaultMinClearanceM > 0
        ? c.defaultMinClearanceM
        : DEFAULTS.defaultMinClearanceM,
    clockwise: typeof c.clockwise === "boolean" ? c.clockwise : DEFAULTS.clockwise,
  };
}
