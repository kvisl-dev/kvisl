import assert from "node:assert/strict";
import test from "node:test";

import { buildShareGroups, linesMayShareGeometry } from "../src/sharing.mjs";

function joinedScene(mode, styles) {
  const owner = { path: "target" };
  const port = { id: "input", owner, sharing: { mode } };
  const lines = styles.map((style, order) => {
    const endpoint = { end: 1, port };
    return {
      id: `line-${order}`,
      order,
      style,
      from: { end: 0 },
      to: endpoint,
    };
  });
  return { diagnostics: [], lines, objects: [], tokens: {} };
}

test("automatic joins merge only when their effective stroke styles match", () => {
  const compatible = joinedScene("auto", [{ stroke: "#123456" }, { stroke: "#123456" }]);
  const compatibleGroup = [...buildShareGroups(compatible).values()][0];
  assert.equal(compatibleGroup.mode, "merge");
  assert.equal(linesMayShareGeometry(...compatible.lines), true);

  const incompatible = joinedScene("auto", [{ stroke: "#123456" }, { stroke: "#abcdef", dash: [4, 3] }]);
  const incompatibleGroup = [...buildShareGroups(incompatible).values()][0];
  assert.equal(incompatibleGroup.mode, "bundle");
  assert.equal(incompatibleGroup.bundle.monotoneTowardCommonEnd, true);
  assert.deepEqual(incompatibleGroup.bundle.laneOrder, ["line-0", "line-1"]);
  assert.equal(linesMayShareGeometry(...incompatible.lines), false);
  assert.deepEqual(incompatible.diagnostics, []);
});

test("an incompatible required merge diagnoses the conflict and retains separate bundle lanes", () => {
  const scene = joinedScene("merge", [{ strokeWidth: 2 }, { strokeWidth: 4 }]);
  const group = [...buildShareGroups(scene).values()][0];
  assert.equal(group.requestedMode, "merge");
  assert.equal(group.mode, "bundle");
  assert.equal(linesMayShareGeometry(...scene.lines), false);
  assert.equal(scene.diagnostics.length, 1);
  assert.equal(scene.diagnostics[0].severity, "error");
  assert.match(scene.diagnostics[0].message, /incompatible.*stroke styles/i);
});

test("automatic sharing merges compatible style cohorts inside a compact multi-style bundle", () => {
  const scene = joinedScene("auto", [
    { stroke: "#123456", dash: "solid" },
    { stroke: "#123456" },
    { stroke: "#abcdef", dash: "dashed" },
  ]);
  const group = [...buildShareGroups(scene).values()][0];
  assert.equal(group.mode, "bundle");
  assert.equal(group.bundle.lanes.length, 2);
  assert.equal(scene.lines[0].shareMemberships[0].lane, scene.lines[1].shareMemberships[0].lane);
  assert.notEqual(scene.lines[0].shareMemberships[0].lane, scene.lines[2].shareMemberships[0].lane);
  assert.equal(linesMayShareGeometry(scene.lines[0], scene.lines[1]), true);
  assert.equal(linesMayShareGeometry(scene.lines[0], scene.lines[2]), false);
});

test("incompatible terminal heads at one named port receive separate automatic lanes", () => {
  const scene = joinedScene("auto", [{ stroke: "#123456" }, { stroke: "#123456" }]);
  scene.lines[0].heads = "forward";
  scene.lines[1].heads = "none";
  const group = [...buildShareGroups(scene).values()][0];
  assert.equal(group.mode, "bundle");
  assert.equal(group.bundle.lanes.length, 2);
  assert.equal(linesMayShareGeometry(scene.lines[0], scene.lines[1]), false);
});
