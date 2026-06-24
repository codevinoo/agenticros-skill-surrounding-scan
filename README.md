# AgenticROS Surroundings Scan Skill

Rotate the robot in place and sample **left / center / right** depth at evenly spaced bearings. Returns a structured obstacle map — ideal for **text-only LLMs** (e.g. Nemotron on NemoClaw) that can call tools but cannot interpret camera images.

## Install

```bash
# From a sibling of your agenticros checkout:
git clone git@github.com:codevinoo/agenticros-skill-surrounding-scan.git ../agenticros-skill-surroundings-scan
cd ../agenticros-skill-surroundings-scan && pnpm install && pnpm build
agenticros skills add surroundings-scan
agenticros skills sync
systemctl --user restart openclaw-gateway.service   # or: nemoclaw nemo recover
```

## Tool

| Tool | Capability | Verb |
|------|------------|------|
| `scan_surroundings` | `scan_surroundings` | `scan` |

### Example prompts (NemoClaw + Nemotron)

- *"Scan your surroundings and tell me which direction is most open."*
- *"Look around and list any bearings blocked within half a meter."*
- `run_mission({ goal: "scan surroundings" })`

## Config (`config.skills["surroundings-scan"]`)

| Field | Default | Description |
|-------|---------|-------------|
| `depthTopic` | `/camera/camera/depth/image_rect_raw` | Raw depth image (`sensor_msgs/Image`) |
| `cmdVelTopic` | *(from teleop)* | cmd_vel override |
| `defaultSteps` | `8` | Bearings per full rotation |
| `defaultAngularSpeed` | `0.3` | rad/s between samples |
| `settleMs` | `400` | Pause after each rotation before sampling |
| `depthTimeoutMs` | `5000` | Per-sample subscribe timeout |
| `defaultMinClearanceM` | `0.5` | Center distance below this → blocked bearing |
| `clockwise` | `true` | Rotation direction between samples |

## Requirements

- AgenticROS plugin with depth sampling (`getDepthSectors` in skill context)
- RealSense (or any) depth stream on `depthTopic`
- Hybrid NemoClaw: host runs RealSense + rosbridge; plugin in sandbox uses rosbridge transport

## License

Apache-2.0
