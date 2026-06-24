import assert from "node:assert/strict";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");

test("package.json declares agenticros.surroundings-scan capability", () => {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf-8")) as {
    agenticros?: { id?: string; capabilities?: Array<{ id: string }> };
  };
  assert.equal(pkg.agenticros?.id, "surroundings-scan");
  const ids = (pkg.agenticros?.capabilities ?? []).map((c) => c.id);
  assert.deepEqual(ids, ["scan_surroundings"]);
});

test("registerSkill exposes scan_surroundings tool", async () => {
  const mod = await import(pathToFileURL(join(root, "dist/index.js")).href);
  const tools: string[] = [];
  const api = {
    registerTool(tool: { name: string }) {
      tools.push(tool.name);
    },
    logger: { info() {}, warn() {}, error() {} },
  };
  mod.registerSkill(api, { skills: {} }, {
    getTransport() {
      return { getStatus: () => "connected" };
    },
    getDepthSectors() {
      return Promise.resolve({
        left_m: 1,
        center_m: 2,
        right_m: 1,
        valid: true,
        topic: "/depth",
      });
    },
    logger: api.logger,
  });
  assert.deepEqual(tools, ["scan_surroundings"]);
});
