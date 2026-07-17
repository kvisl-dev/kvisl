import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { test } from "node:test";
import { layout } from "../src/layout.mjs";
import { solveFile } from "../src/pipeline.mjs";
import { project } from "../src/project.mjs";
import { analyzeScene } from "../src/quality.mjs";
import { route } from "../src/route.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.dirname(path.dirname(path.dirname(here)));

async function exampleFiles() {
  const root = path.join(repo, "examples");
  return (await readdir(root, { recursive: true }))
    .filter((file) => file.endsWith("diagram.tsx"))
    .sort()
    .map((file) => path.join(root, file));
}

function assertOrthogonal(routePoints, lineId) {
  for (let index = 1; index < routePoints.length; index += 1) {
    const first = routePoints[index - 1];
    const second = routePoints[index];
    assert.ok(first.x === second.x || first.y === second.y, `${lineId} has a non-orthogonal segment`);
  }
}

test("every repository diagram produces a finite orthogonal SVG preview", async () => {
  const files = await exampleFiles();
  assert.equal(files.length, 14);
  for (const file of files) {
    const { scene, svg } = await solveFile(file);
    const errors = scene.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
    assert.deepEqual(errors, [], `${path.relative(repo, file)} has projection or solve errors`);
    assert.ok(Number.isFinite(scene.width) && scene.width > 0);
    assert.ok(Number.isFinite(scene.height) && scene.height > 0);
    assert.match(svg, /^<\?xml version="1\.0"/);
    for (const line of scene.lines) {
      assert.ok(line.route.length >= 2, `${path.relative(repo, file)} did not route ${line.id}`);
      assertOrthogonal(line.route, line.id);
    }
    const quality = analyzeScene(scene);
    assert.deepEqual(
      quality.unexpectedObjectOverlaps.map((item) => `${item.first.path}<->${item.second.path}`),
      [],
      `${path.relative(repo, file)} overlaps unrelated rendered objects`,
    );
    assert.deepEqual(
      quality.routeObjectIntersections.map((item) => `${item.line.id}->${item.object.path}`),
      [],
      `${path.relative(repo, file)} routes through rendered objects`,
    );
    assert.deepEqual(
      quality.labelObjectOverlaps.map((item) => `${item.line.id}:${item.label.text}->${item.object.path}`),
      [],
      `${path.relative(repo, file)} places line labels over rendered objects`,
    );
    assert.deepEqual(
      quality.labelLabelOverlaps.map((item) => `${item.line.id}:${item.label.text}<->${item.otherLine.id}:${item.otherLabel.text}`),
      [],
      `${path.relative(repo, file)} overlaps line labels`,
    );
    assert.deepEqual(
      quality.unexpectedRouteOverlaps.map((item) => `${item.first.line.id}<->${item.second.line.id}`),
      [],
      `${path.relative(repo, file)} gives unrelated lines a shared run`,
    );
  }
});

test("solving the same diagram is deterministic", async () => {
  const entry = path.join(repo, "examples", "agent-substrate", "diagram.tsx");
  const first = await solveFile(entry);
  const second = await solveFile(entry);
  assert.equal(first.svg, second.svg);
});

test("explicit padding pins reserve a physical routing band", async () => {
  const entry = path.join(repo, "examples", "agent-substrate", "diagram.tsx");
  const { scene } = await solveFile(entry);
  const cluster = scene.objectByPath.get("cluster");
  const line = scene.lines.find((candidate) => candidate.id === "request-to-agent");
  const region = [...scene.regions.values()].find((candidate) => candidate.kind === "padding" && candidate.owner === cluster && candidate.side === "right");
  assert.ok(region);
  assert.ok(region.thickness > 0);
  assert.ok(line.regionTracks.has(region.key));
  assert.ok(cluster.reserved.padding.right >= region.thickness);
});

test("a named merge port produces one shared positive-length prefix", async () => {
  const entry = path.join(repo, "examples", "machine-thought-os", "diagram.tsx");
  const { scene } = await solveFile(entry);
  const scheduler = scene.objectByPath.get("kernel/execution/scheduler");
  const port = scheduler.ports.get("children");
  const lines = scene.lines.filter((line) => line.from?.port === port);
  assert.equal(lines.length, 3);
  const prefixes = lines.map((line) => line.route.slice(0, 2));
  assert.deepEqual(prefixes[1], prefixes[0]);
  assert.deepEqual(prefixes[2], prefixes[0]);
  assert.notDeepEqual(prefixes[0][0], prefixes[0][1]);
});

test("a named bundle port keeps separate adjacent strokes after the dock", async () => {
  const entry = path.join(repo, "examples", "machine-thought-os", "diagram.tsx");
  const { scene } = await solveFile(entry);
  const state = scene.objectByPath.get("kernel/execution/shared-state");
  const port = state.ports.get("children");
  const lines = scene.lines.filter((line) => line.from?.port === port);
  assert.equal(lines.length, 3);
  assert.deepEqual(lines[1].route[0], lines[0].route[0]);
  assert.deepEqual(lines[2].route[0], lines[0].route[0]);
  assert.equal(new Set(lines.map((line) => `${line.route[1].x},${line.route[1].y}`)).size, 3);
});

test("an explicit same-size constraint equalizes the referenced boxes", async () => {
  const entry = path.join(repo, "examples", "coverage", "diagram.tsx");
  const { scene } = await solveFile(entry);
  const upright = scene.objectByPath.get("system/upright");
  const monitor = scene.objectByPath.get("system/monitor");
  assert.equal(Math.round(monitor.box.height), Math.round(upright.box.height));
});

function primitive(core, props = {}, children = []) {
  return { core, props, children };
}

function sparsePipeline(size) {
  const nodes = Array.from({ length: size }, (_, index) => primitive("node", { id: `n${index}`, label: `Node ${index}` }, [
    primitive("port", { id: "in", side: "left" }),
    primitive("port", { id: "out", side: "right" }),
  ]));
  const lines = Array.from({ length: size - 1 }, (_, index) => primitive("line", { id: `l${index}`, from: `nodes/n${index}.out`, to: `nodes/n${index + 1}.in` }));
  return primitive("diagram", { id: "scale" }, [primitive("column", { id: "nodes", gap: "small" }, nodes), ...lines]);
}

test("a large sparse model completes within bounded prototype work", () => {
  const started = performance.now();
  const scene = project(sparsePipeline(600));
  layout(scene);
  route(scene);
  const elapsed = performance.now() - started;
  assert.equal(scene.objects.length, 602);
  assert.equal(scene.lines.length, 599);
  assert.ok(elapsed < 5000, `sparse 600-object solve took ${Math.round(elapsed)}ms`);
});
