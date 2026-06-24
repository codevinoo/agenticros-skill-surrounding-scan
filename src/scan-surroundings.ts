/**
 * Rotate in place and sample left/center/right depth at evenly spaced bearings.
 */

import type { AgenticROSConfig, RosTransport } from "@agenticros/core";
import { toNamespacedTopic } from "@agenticros/core";
import type { DepthSectorsResult, SkillContext } from "./types.js";
import { getSurroundingsScanConfig } from "./config.js";
import { publishTwist, resolveCmdVelTopic, sleep } from "./cmd-vel.js";

export interface ScanSector {
  bearing_deg: number;
  left_m: number;
  center_m: number;
  right_m: number;
  min_m: number;
  valid: boolean;
}

export interface ScanSurroundingsOptions {
  steps?: number;
  angularSpeed?: number;
  minClearanceM?: number;
  clockwise?: boolean;
}

export interface ScanSurroundingsResult {
  ok: boolean;
  steps: number;
  sectors: ScanSector[];
  clearest_bearing_deg: number | null;
  clearest_center_m: number | null;
  blocked_bearings: number[];
  summary: string;
  elapsedSeconds: number;
  depthTopic: string;
  error?: string;
}

function roundM(x: number): number {
  return Number.isFinite(x) ? Math.round(x * 1000) / 1000 : NaN;
}

function sectorMin(s: DepthSectorsResult): number {
  const vals = [s.left_m, s.center_m, s.right_m].filter((v) => Number.isFinite(v) && v > 0);
  return vals.length > 0 ? Math.min(...vals) : NaN;
}

function buildSummary(
  sectors: ScanSector[],
  clearestBearing: number | null,
  clearestCenter: number | null,
  blocked: number[],
  minClearanceM: number,
): string {
  if (sectors.length === 0) {
    return "No depth samples collected.";
  }
  const valid = sectors.filter((s) => s.valid);
  if (valid.length === 0) {
    return "Depth scan completed but no valid depth readings — check depthTopic and that the sensor publishes sensor_msgs/Image.";
  }
  const parts: string[] = [];
  if (clearestBearing !== null && clearestCenter !== null) {
    parts.push(
      `Clearest path at ${clearestBearing}° (${clearestCenter.toFixed(2)} m center clearance).`,
    );
  }
  if (blocked.length > 0) {
    parts.push(
      `Blocked bearings (< ${minClearanceM} m center): ${blocked.map((b) => `${b}°`).join(", ")}.`,
    );
  }
  const front = sectors.find((s) => s.bearing_deg === 0);
  if (front?.valid) {
    parts.push(
      `At current heading (0°): center ${front.center_m.toFixed(2)} m, left ${front.left_m.toFixed(2)} m, right ${front.right_m.toFixed(2)} m.`,
    );
  }
  return parts.join(" ");
}

export async function scanSurroundings(
  config: AgenticROSConfig,
  context: SkillContext,
  transport: RosTransport,
  opts: ScanSurroundingsOptions,
): Promise<ScanSurroundingsResult> {
  const skill = getSurroundingsScanConfig(config.skills?.["surroundings-scan"]);
  const startedAt = Date.now();

  const steps = opts.steps ?? skill.defaultSteps;
  const minClearanceM = opts.minClearanceM ?? skill.defaultMinClearanceM;
  const clockwise = opts.clockwise ?? skill.clockwise;

  const safety = config.safety ?? {};
  const maxAngular = safety.maxAngularVelocity ?? 1.5;
  const angularSpeed = Math.max(0.05, Math.min(maxAngular, opts.angularSpeed ?? skill.defaultAngularSpeed));
  const angularZ = clockwise ? -angularSpeed : angularSpeed;

  const cmdVelTopic = resolveCmdVelTopic(config, skill.cmdVelTopic);
  const depthTopic = toNamespacedTopic(config, skill.depthTopic);

  const sectors: ScanSector[] = [];
  const stepAngleRad = (2 * Math.PI) / steps;
  const rotateDurationMs = (stepAngleRad / angularSpeed) * 1000;

  try {
    for (let i = 0; i < steps; i++) {
      const bearingDeg = Math.round((i * 360) / steps);

      let sample: DepthSectorsResult;
      try {
        sample = await context.getDepthSectors(transport, depthTopic, skill.depthTimeoutMs);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          ok: false,
          steps,
          sectors,
          clearest_bearing_deg: null,
          clearest_center_m: null,
          blocked_bearings: [],
          summary: `Depth sample failed at bearing ${bearingDeg}°: ${message}`,
          elapsedSeconds: (Date.now() - startedAt) / 1000,
          depthTopic,
          error: message,
        };
      }

      const left_m = roundM(sample.left_m);
      const center_m = roundM(sample.center_m);
      const right_m = roundM(sample.right_m);
      const min_m = roundM(sectorMin(sample));

      sectors.push({
        bearing_deg: bearingDeg,
        left_m,
        center_m,
        right_m,
        min_m,
        valid: sample.valid,
      });

      if (i < steps - 1) {
        await publishTwist(transport, cmdVelTopic, 0, angularZ);
        await sleep(rotateDurationMs);
        await publishTwist(transport, cmdVelTopic, 0, 0);
        if (skill.settleMs > 0) await sleep(skill.settleMs);
      }
    }
  } finally {
    await publishTwist(transport, cmdVelTopic, 0, 0).catch(() => {});
  }

  const validSectors = sectors.filter((s) => s.valid && Number.isFinite(s.center_m) && s.center_m > 0);
  let clearestBearing: number | null = null;
  let clearestCenter: number | null = null;
  if (validSectors.length > 0) {
    const best = validSectors.reduce((a, b) => (a.center_m >= b.center_m ? a : b));
    clearestBearing = best.bearing_deg;
    clearestCenter = best.center_m;
  }

  const blocked_bearings = sectors
    .filter(
      (s) =>
        s.valid &&
        Number.isFinite(s.center_m) &&
        s.center_m > 0 &&
        s.center_m < minClearanceM,
    )
    .map((s) => s.bearing_deg);

  const summary = buildSummary(sectors, clearestBearing, clearestCenter, blocked_bearings, minClearanceM);

  return {
    ok: validSectors.length > 0,
    steps,
    sectors,
    clearest_bearing_deg: clearestBearing,
    clearest_center_m: clearestCenter,
    blocked_bearings,
    summary,
    elapsedSeconds: (Date.now() - startedAt) / 1000,
    depthTopic,
  };
}
