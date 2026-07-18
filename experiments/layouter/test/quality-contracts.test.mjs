import assert from "node:assert/strict";
import { test } from "node:test";
import { layout } from "../src/layout.mjs";
import { project } from "../src/project.mjs";
import { analyzeScene } from "../src/quality.mjs";
import { buildShareGroups } from "../src/sharing.mjs";

function primitive(core, props = {}, children = []) {
  return { core, props, children };
}

function distributedRow(orientation = 0) {
  const scene = project(primitive("diagram", { id: "contracts" }, [
    primitive("row", { id: "items", orientation, distribute: "space-between", style: { minWidth: 500 } }, [
      primitive("node", { id: "first", label: "First" }),
      primitive("node", { id: "second", label: "Second" }),
      primitive("node", { id: "third", label: "Third" }),
    ]),
  ]));
  layout(scene);
  return scene;
}

test("layout contracts detect changes made after declarative distribution", () => {
  const scene = distributedRow();
  assert.deepEqual(analyzeScene(scene).layoutContractViolations, []);
  assert.deepEqual(analyzeScene(distributedRow(90)).layoutContractViolations, []);

  scene.objectByPath.get("items/second").box.x += 20;
  const violations = analyzeScene(scene).layoutContractViolations;
  assert.ok(violations.some((violation) =>
    violation.kind === "distribution"
      && violation.container.path === "items"
      && violation.distribution === "space-between"));
});

test("layout contracts report containment, source-order, and minimum-gap independently", () => {
  const containmentScene = distributedRow();
  const containmentRow = containmentScene.objectByPath.get("items");
  containmentScene.objectByPath.get("items/first").box.x = containmentRow.box.x - 10;
  assert.ok(analyzeScene(containmentScene).layoutContractViolations.some((violation) =>
    violation.kind === "containment" && violation.member.path === "items/first"));

  const gapScene = distributedRow();
  const first = gapScene.objectByPath.get("items/first");
  gapScene.objectByPath.get("items/second").box.x = first.box.x + first.box.width + 8;
  assert.ok(analyzeScene(gapScene).layoutContractViolations.some((violation) =>
    violation.kind === "minimum-gap" && violation.first.path === "items/first" && violation.second.path === "items/second"));

  const orderScene = distributedRow();
  const orderFirst = orderScene.objectByPath.get("items/first");
  orderScene.objectByPath.get("items/second").box.x = orderFirst.box.x + 10;
  assert.ok(analyzeScene(orderScene).layoutContractViolations.some((violation) =>
    violation.kind === "source-order" && violation.first.path === "items/first" && violation.second.path === "items/second"));
});

function line(id, route, routeLabels = [], share = null) {
  return { id, route, routeLabels, share, segments: [], endLabels: [[], []], labels: [], space: "reserve" };
}

test("label-route overlap detection ignores the owning line and its authorized shared run", () => {
  const label = { text: "status", box: { x: 40, y: 40, width: 60, height: 24 } };
  const labeled = line("labeled", [{ x: 20, y: 52 }, { x: 120, y: 52 }], [label], { group: "bus", mode: "merge" });
  const unrelated = line("unrelated", [{ x: 70, y: 20 }, { x: 70, y: 90 }]);
  const shared = line("shared", [{ x: 20, y: 52 }, { x: 120, y: 52 }], [], { group: "bus", mode: "merge" });
  const scene = { objects: [], lines: [labeled, unrelated, shared], constraints: [], diagnostics: [], tokens: {}, width: 140, height: 110 };
  const group = [...buildShareGroups(scene).values()][0];
  group.allowedSharedRuns = [{
    first: { x: 20, y: 52 },
    second: { x: 120, y: 52 },
    members: [labeled, shared],
  }];

  const overlaps = analyzeScene(scene).labelRouteOverlaps;
  assert.equal(overlaps.length, 1);
  assert.equal(overlaps[0].line, labeled);
  assert.equal(overlaps[0].otherLine, unrelated);
  assert.equal(overlaps[0].segmentIndex, 0);
});
