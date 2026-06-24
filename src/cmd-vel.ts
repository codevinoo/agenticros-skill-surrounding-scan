import type { AgenticROSConfig } from "@agenticros/core";
import { toNamespacedTopic } from "@agenticros/core";
import type { RosTransport } from "@agenticros/core";

export function resolveCmdVelTopic(config: AgenticROSConfig, override: string): string {
  const raw = override.trim() || (config.teleop?.cmdVelTopic ?? "").trim() || "/cmd_vel";
  const namespaced = toNamespacedTopic(config, raw);
  const match = namespaced.match(/^\/([^/]+)\/cmd_vel$/i);
  const segment = match?.[1] ?? "";
  if (match && !segment.toLowerCase().startsWith("robot")) {
    return `/robot${segment.replace(/-/g, "")}/cmd_vel`;
  }
  return namespaced;
}

export async function publishTwist(
  transport: RosTransport,
  topic: string,
  linearX: number,
  angularZ: number,
): Promise<void> {
  await transport.publish({
    topic,
    type: "geometry_msgs/msg/Twist",
    msg: { linear: { x: linearX, y: 0, z: 0 }, angular: { x: 0, y: 0, z: angularZ } },
  });
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
