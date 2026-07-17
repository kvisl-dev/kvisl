// Temporary diagnostic (delete me): renders agent-substrate to the session
// scratchpad and prints its geometry while direct script execution is
// unavailable in this session.
import { fileURLToPath } from "node:url";
import path from "node:path";
import { test } from "node:test";
import { renderFile } from "../src/pipeline.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.dirname(path.dirname(path.dirname(here)));

test("zz debug render agent-substrate", async () => {
  const out = "/private/tmp/claude-501/-Users-sts-Quellen-excalmermaid/cb4c4c9f-b89f-452f-b6d7-c4d680e6c608/scratchpad/as.svg";
  const { scene } = await renderFile(path.join(repo, "examples", "agent-substrate", "diagram.tsx"), out);
  console.log("DEBUG canvas", scene.width, "x", scene.height);
  console.log("DEBUG reservations", JSON.stringify([...scene.labelReservations]));
  for (const p of [
    "cluster/layers/runtime",
    "cluster/layers/runtime/atelet",
    "cluster/layers/runtime/worker-pod",
    "cluster/layers/runtime/worker-pod/ateom-visor",
    "cluster/layers/runtime/worker-pod/sandbox",
    "cluster/layers/runtime/warm-pods",
    "cluster/layers/control-and-storage/substrate-control",
    "cluster/layers/control-and-storage/snapshot-storage",
  ]) {
    const o = scene.objectByPath.get(p);
    console.log("DEBUG", p.split("/").pop(), Math.round(o.box.x), Math.round(o.box.y), Math.round(o.box.width), "x", Math.round(o.box.height));
  }
  for (const line of scene.lines) {
    console.log("ROUTE", line.id, JSON.stringify(line.route.map((pt) => [Math.round(pt.x), Math.round(pt.y)])));
  }
  const visor = scene.objectByPath.get("cluster/layers/runtime/worker-pod/ateom-visor");
  const sandbox = scene.objectByPath.get("cluster/layers/runtime/worker-pod/sandbox");
  console.log("DEBUG centers visor", Math.round(visor.box.x + visor.box.width / 2), "sandbox", Math.round(sandbox.box.x + sandbox.box.width / 2));
});
