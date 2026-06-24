# AgenticROS Surroundings Scan Skill

An [AgenticROS](https://github.com/agenticros/agenticros) skill that rotates the robot in place and samples **left / center / right** depth at evenly spaced bearings. It returns a **structured obstacle map** (meters and degrees as JSON) — no camera images required.

That makes it especially useful for **text-only agents** that handle tool calling well but cannot interpret vision (e.g. Nemotron on NemoClaw, or any LLM you use without a VLM). The agent calls one tool, reads numeric output, and reasons about clearance and heading.

## What it does

1. Stops at the current heading and samples depth in three sectors (left, center, right).
2. Rotates by `360° / steps` (default **8** stops × **45°**).
3. Repeats until a full rotation is complete.
4. Returns:
   - `sectors[]` — per-bearing distances (`bearing_deg`, `left_m`, `center_m`, `right_m`, `min_m`)
   - `clearest_bearing_deg` / `clearest_center_m` — bearing with the farthest center clearance
   - `blocked_bearings` — bearings whose center distance is below `min_clearance_m`
   - `summary` — one-line human-readable summary for the chat UI

The skill uses the plugin’s `getDepthSectors()` helper (same depth pipeline as Follow Me and `ros2_depth_distance`). It publishes `cmd_vel` only during the rotation steps and always stops the base when finished.

## Tool & capability

| Registered tool | Capability id | Planner verb |
|-----------------|---------------|--------------|
| `scan_surroundings` | `scan_surroundings` | `scan` |

Natural-language goals understood by `run_mission` (when the capability is installed):

- *"scan surroundings"*
- *"look around"*
- *"survey the room"*

---

## Agent platforms

AgenticROS has multiple adapters. **Skill tools load on the OpenClaw gateway**; MCP/Gemini adapters read skill metadata for planning but do not execute skill tools in-process today.

| Platform | Install skill here | `scan_surroundings` runs? | Sees capability in `ros2_list_capabilities`? |
|----------|-------------------|---------------------------|-----------------------------------------------|
| **OpenClaw gateway** | `~/.openclaw/openclaw.json` → `skillPaths` | **Yes** | Yes |
| **NemoClaw** (OpenClaw in sandbox) | Same via `agenticros skills add` | **Yes** | Yes |
| **Claude Code / Desktop / Dispatch** (MCP) | `~/.agenticros/config.json` → `skillPaths` | No¹ | Yes (after MCP restart) |
| **Codex CLI** (MCP) | `~/.agenticros/config.json` → `skillPaths` | No¹ | Yes |
| **Gemini CLI** | `~/.agenticros/config.json` → `skillPaths` | No¹ | Yes |

¹ For MCP/Gemini, use the **OpenClaw or NemoClaw chat** to execute `scan_surroundings`, or call `run_mission` from the gateway. MCP still benefits from the skill for **`ros2_list_capabilities`** and goal compilation (*"scan surroundings"* → `scan_surroundings` step in the plan).

### OpenClaw / NemoClaw (full execution)

```bash
git clone git@github-codevino:codevinoo/agenticros-skill-surrounding-scan.git
cd agenticros-skill-surrounding-scan
pnpm install
pnpm build

# Registers skillPaths + syncs openclaw.plugin.json allowlist
agenticros skills add surroundings-scan
agenticros skills sync

# Restart the gateway
systemctl --user restart openclaw-gateway.service   # bare OpenClaw
# or
nemoclaw nemo recover                              # NemoClaw sandbox
```

### Claude / Codex / Gemini (capabilities + missions planning)

Add the built skill directory to **`~/.agenticros/config.json`**:

```jsonc
{
  "skillPaths": [
    "/absolute/path/to/agenticros-skill-surroundings-scan"
  ],
  "skills": {
    "surroundings-scan": {
      "depthTopic": "/camera/camera/depth/image_rect_raw",
      "defaultSteps": 8
    }
  }
}
```

Rebuild and restart the MCP server (Claude Code example):

```bash
pnpm --filter @agenticros/claude-code build
pnpm mcp:kill   # from agenticros repo root, if needed
```

Then verify:

- *"Call `ros2_list_capabilities` — is `scan_surroundings` listed?"*
- On **OpenClaw/NemoClaw**: *"Scan your surroundings and tell me which way is most open."*

---

## Install (summary)

```bash
git clone git@github-codevino:codevinoo/agenticros-skill-surrounding-scan.git
cd agenticros-skill-surrounding-scan
corepack enable          # once per machine, if pnpm is not on PATH
pnpm install             # run separately from build (do not type "pnpm install and build")
pnpm build
pnpm test
```

agenticros skills add surroundings-scan   # OpenClaw / NemoClaw
agenticros skills sync
```

Requires [AgenticROS](https://github.com/agenticros/agenticros) with the OpenClaw plugin (or NemoClaw hybrid stack). See [docs/skills.md](https://github.com/agenticros/agenticros/blob/main/docs/skills.md).

---

## Configuration

Per-skill options live under **`config.skills["surroundings-scan"]`** (OpenClaw: `plugins.entries.agenticros.config.skills`).

| Field | Default | Description |
|-------|---------|-------------|
| `depthTopic` | `/camera/camera/depth/image_rect_raw` | Raw depth (`sensor_msgs/Image`, `16UC1` or `32FC1`) |
| `cmdVelTopic` | *(from `teleop.cmdVelTopic`)* | Override cmd_vel topic |
| `defaultSteps` | `8` | Bearings per full 360° rotation (2–36) |
| `defaultAngularSpeed` | `0.3` | rad/s between samples (clamped by `safety.maxAngularVelocity`) |
| `settleMs` | `400` | Pause after each rotation before sampling (ms) |
| `depthTimeoutMs` | `5000` | Per-sample depth subscribe timeout (ms) |
| `defaultMinClearanceM` | `0.5` | Center distance below this → `blocked_bearings` |
| `clockwise` | `true` | Rotation direction between samples |

### Tool parameters (override per call)

| Parameter | Type | Description |
|-----------|------|-------------|
| `steps` | integer | Number of bearings (2–36) |
| `angular_speed` | number | rad/s between samples |
| `min_clearance_m` | number | Blocked-bearing threshold (m) |
| `clockwise` | boolean | Rotation direction |

### Example output (`details`)

```json
{
  "ok": true,
  "steps": 8,
  "sectors": [
    { "bearing_deg": 0, "left_m": 1.2, "center_m": 2.8, "right_m": 0.9, "min_m": 0.9, "valid": true },
    { "bearing_deg": 45, "left_m": 0.6, "center_m": 1.1, "right_m": 2.0, "min_m": 0.6, "valid": true }
  ],
  "clearest_bearing_deg": 0,
  "clearest_center_m": 2.8,
  "blocked_bearings": [135],
  "summary": "Clearest path at 0° (2.80 m center clearance). Blocked bearings (< 0.5 m center): 135°. ..."
}
```

---

## Testing in simulation

Use the AgenticROS **sim AMR** (Gazebo + RGBD + diff drive). Depth topic matches a RealSense layout so the same skill config works on sim and hardware.

### 1. Start the sim

From your `agenticros` checkout:

```bash
agenticros up sim-amr              # Gazebo + bridged ROS topics
./scripts/configure_for_sim.sh --backup   # ~/.agenticros/config.json for sim (empty namespace)
```

Sim publishes `/cmd_vel` and `/camera/camera/depth/image_rect_raw` at the graph root. See [docs/simulation.md](https://github.com/agenticros/agenticros/blob/main/docs/simulation.md).

### 2. Install this skill on the gateway

```bash
agenticros skills add /path/to/agenticros-skill-surroundings-scan
agenticros skills sync
systemctl --user restart openclaw-gateway.service
```

Optional sim slice in OpenClaw config:

```jsonc
"skills": {
  "surroundings-scan": {
    "depthTopic": "/camera/camera/depth/image_rect_raw",
    "defaultSteps": 8,
    "defaultAngularSpeed": 0.25
  }
}
```

### 3. Run checks

**Unit tests** (no robot):

```bash
cd agenticros-skill-surroundings-scan
pnpm test
```

**Integration** (sim running + gateway up):

| Check | How |
|-------|-----|
| Depth works | `ros2_depth_distance` on `/camera/camera/depth/image_rect_raw` |
| Capability listed | `ros2_list_capabilities` includes `scan_surroundings` |
| Tool call | *"Scan your surroundings"* in OpenClaw / NemoClaw chat |
| Mission | `run_mission` with `goal: "scan surroundings"` |

The sim room has obstacles; expect varying `center_m` per bearing and a non-empty `summary`.

---

## Testing on a real robot

### Local OpenClaw + ROS on the robot

1. ROS 2 + depth camera publishing `sensor_msgs/Image` on your depth topic.
2. AgenticROS plugin connected (`transport.mode`: `local`, `zenoh`, or `rosbridge`).
3. Skill installed (`agenticros skills add` + `sync` + gateway restart).

Point `depthTopic` at your camera, e.g. RealSense:

```jsonc
"skills": {
  "surroundings-scan": {
    "depthTopic": "/camera/camera/depth/image_rect_raw"
  }
}
```

### NemoClaw hybrid (Jetson + RealSense)

Host runs ROS + RealSense + rosbridge; plugin runs inside the NemoClaw sandbox over `ws://host.docker.internal:9090`. Full walkthrough: [docs/nemoclaw.md](https://github.com/agenticros/agenticros/blob/main/docs/nemoclaw.md).

```bash
./scripts/run_nemoclaw_host_stack.sh humble
# deploy plugin into sandbox, policy, recover — see nemoclaw.md Part 2 Method A
agenticros skills add surroundings-scan && agenticros skills sync
nemoclaw nemo recover
```

**Nemotron / text-only models:** prefer this skill over `ros2_camera_snapshot` for spatial reasoning — Nemotron returns images in chat but does not describe them without a VLM.

Example prompts:

- *"Scan your surroundings and tell me which direction is most open."*
- *"Look around and list bearings blocked within half a meter."*
- *"Run a mission: scan surroundings."*

---

## Example prompts (any agent with gateway access)

| Prompt | Expected behavior |
|--------|-------------------|
| *"Scan your surroundings."* | `scan_surroundings` → summary + JSON sectors |
| *"Which way should I drive for the most clearance?"* | Agent calls scan, reasons over `clearest_bearing_deg` |
| *"How far is the obstacle in front?"* | May use `ros2_depth_distance` or full scan |
| `run_mission({ "goal": "scan surroundings" })` | Planner emits one `scan_surroundings` step |

---

## Requirements

- **AgenticROS** OpenClaw plugin (≥ 0.5.x core) with skill loader
- **Depth stream**: `sensor_msgs/Image` on `depthTopic` (not `CompressedImage`)
- **cmd_vel** relay or driver subscribed to the configured twist topic
- **Safety**: angular velocity clamped via `config.safety.maxAngularVelocity`

## Development

Uses **pnpm 11.9.0** (pinned in `packageManager`). Run `corepack enable` once so Corepack selects that version. Optional native deps from `@agenticros/core` are disabled via `allowBuilds` in `pnpm-workspace.yaml` (pnpm 11 requirement).

```bash
corepack enable
pnpm install
pnpm run typecheck
pnpm run build
pnpm test
```

After changing skill tool names, run `agenticros skills sync` from the AgenticROS repo so `openclaw.plugin.json` `contracts.tools` includes `scan_surroundings`.

## Related

- [AgenticROS skills contract](https://github.com/agenticros/agenticros/blob/main/docs/skills.md)
- [Simulation guide](https://github.com/agenticros/agenticros/blob/main/docs/simulation.md)
- [NemoClaw + AgenticROS](https://github.com/agenticros/agenticros/blob/main/docs/nemoclaw.md)
- [Skills marketplace](https://skills.agenticros.com)

## License

Apache-2.0
