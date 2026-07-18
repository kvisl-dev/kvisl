import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { test } from "node:test";
import { headGeometry, minimumHeadRun, normalizedHeads } from "../src/heads.mjs";
import { solveFile } from "../src/pipeline.mjs";

const repo = path.dirname(path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url)))));
const fixture = (name) => path.join(repo, "experiments", "layouter", "test", "fixtures", name);
const EPSILON = 0.5;

function linesIn(scene, scopePath) {
  return scene.lines
    .filter((line) => line.scope.path === scopePath)
    .sort((first, second) => first.id.localeCompare(second.id));
}

function routeSegments(line) {
  return line.route.slice(1).map((second, index) => ({ first: line.route[index], second }));
}

function collinearOverlap(first, second) {
  const firstHorizontal = first.first.y === first.second.y;
  const secondHorizontal = second.first.y === second.second.y;
  if (firstHorizontal !== secondHorizontal) return 0;
  if (firstHorizontal && Math.abs(first.first.y - second.first.y) > EPSILON) return 0;
  if (!firstHorizontal && Math.abs(first.first.x - second.first.x) > EPSILON) return 0;
  const firstStart = firstHorizontal ? Math.min(first.first.x, first.second.x) : Math.min(first.first.y, first.second.y);
  const firstEnd = firstHorizontal ? Math.max(first.first.x, first.second.x) : Math.max(first.first.y, first.second.y);
  const secondStart = firstHorizontal ? Math.min(second.first.x, second.second.x) : Math.min(second.first.y, second.second.y);
  const secondEnd = firstHorizontal ? Math.max(second.first.x, second.second.x) : Math.max(second.first.y, second.second.y);
  return Math.max(0, Math.min(firstEnd, secondEnd) - Math.max(firstStart, secondStart));
}

function sharedRunLength(first, second) {
  return Math.max(0, ...routeSegments(first).flatMap((firstSegment) =>
    routeSegments(second).map((secondSegment) => collinearOverlap(firstSegment, secondSegment))));
}

function sharedIntervalsAlong(first, second) {
  const intervals = [];
  let distance = 0;
  for (const firstSegment of routeSegments(first)) {
    const horizontal = firstSegment.first.y === firstSegment.second.y;
    for (const secondSegment of routeSegments(second)) {
      const overlap = collinearOverlap(firstSegment, secondSegment);
      if (overlap <= EPSILON) continue;
      const axis = horizontal ? "x" : "y";
      const low = Math.max(
        Math.min(firstSegment.first[axis], firstSegment.second[axis]),
        Math.min(secondSegment.first[axis], secondSegment.second[axis]),
      );
      const high = Math.min(
        Math.max(firstSegment.first[axis], firstSegment.second[axis]),
        Math.max(secondSegment.first[axis], secondSegment.second[axis]),
      );
      const offset = firstSegment.second[axis] >= firstSegment.first[axis]
        ? low - firstSegment.first[axis]
        : firstSegment.first[axis] - high;
      intervals.push([distance + offset, distance + offset + overlap]);
    }
    distance += Math.abs(firstSegment.second.x - firstSegment.first.x)
      + Math.abs(firstSegment.second.y - firstSegment.first.y);
  }
  intervals.sort((firstInterval, secondInterval) => firstInterval[0] - secondInterval[0]);
  const merged = [];
  for (const interval of intervals) {
    const previous = merged.at(-1);
    if (previous && interval[0] <= previous[1] + EPSILON) previous[1] = Math.max(previous[1], interval[1]);
    else merged.push([...interval]);
  }
  return merged;
}

function everyPair(lines, assertion) {
  for (let first = 0; first < lines.length; first += 1) {
    for (let second = first + 1; second < lines.length; second += 1) {
      assertion(lines[first], lines[second]);
    }
  }
}

function horizontalLaneAt(line, x) {
  const lanes = routeSegments(line)
    .filter((segment) => segment.first.y === segment.second.y
      && x > Math.min(segment.first.x, segment.second.x) + EPSILON
      && x < Math.max(segment.first.x, segment.second.x) - EPSILON)
    .map((segment) => segment.first.y);
  assert.equal(lanes.length, 1, `${line.scope.path}:${line.id} should have exactly one horizontal lane at x=${x}, got ${lanes.join(", ")}`);
  return lanes[0];
}

function assertContinuousParallelBundle(lines, commonDock, sampleDistance = [16, 32]) {
  const samples = sampleDistance.map((distance) => commonDock.x + distance);
  const laneOrders = samples.map((x) => lines
    .map((line) => ({ id: line.id, y: horizontalLaneAt(line, x) }))
    .sort((first, second) => first.y - second.y)
    .map((lane) => lane.id));
  assert.deepEqual(laneOrders[1], laneOrders[0], "bundle lane order must remain stable along its common run");
  for (const x of samples) {
    const lanes = lines.map((line) => horizontalLaneAt(line, x));
    assert.equal(new Set(lanes).size, lines.length, `bundle strokes must remain distinct at x=${x}`);
  }
}

function terminalRun(line, endIndex) {
  const route = endIndex === 0 ? line.route : [...line.route].reverse();
  if (route.length < 2) return 0;
  return Math.abs(route[0].x - route[1].x) + Math.abs(route[0].y - route[1].y);
}

function assertTerminalHeadReserve(line, endIndex) {
  const head = normalizedHeads(line.heads)[endIndex];
  const minimum = minimumHeadRun(head);
  assert.ok(terminalRun(line, endIndex) + EPSILON >= minimum,
    `${line.scope.path}:${line.id} end ${endIndex} has ${terminalRun(line, endIndex)}px of straight terminal lane; head '${head}' requires ${minimum}px`);
}

test("a canonical named merge port creates one positive-length trunk", async () => {
  const { scene } = await solveFile(fixture("named-port-sharing.tsx"));
  const scope = "compatible-cases/merge-compatible";
  const lines = linesIn(scene, scope);
  const port = scene.objectByPath.get(`${scope}/hub`).ports.get("shared");
  assert.equal(lines.length, 3);
  assert.ok(lines.every((line) => line.from.port === port), "all ends must resolve to the same canonical port identity");
  everyPair(lines, (first, second) => {
    assert.ok(sharedRunLength(first, second) > EPSILON,
      `${first.id} and ${second.id} attach to merge port '${port.id}' but have no positive-length shared trunk`);
  });
});

test("a named bundle port keeps distinct continuous lanes after its common dock", async () => {
  const { scene } = await solveFile(fixture("named-port-sharing.tsx"));
  const scope = "compatible-cases/bundle-compatible";
  const lines = linesIn(scene, scope);
  const port = scene.objectByPath.get(`${scope}/hub`).ports.get("shared");
  assert.ok(lines.every((line) => line.from.port === port));
  everyPair(lines, (first, second) => {
    assert.ok(sharedRunLength(first, second) <= EPSILON,
      `${first.id} and ${second.id} overlap for ${sharedRunLength(first, second)}px although bundle requires separate strokes`);
  });
  assertContinuousParallelBundle(lines, port.point);
});

test("automatic sharing downgrades incompatible shared-piece styles to non-overlapping bundle lanes", async () => {
  const { scene } = await solveFile(fixture("named-port-sharing.tsx"));
  const scope = "mixed-style-cases/auto-mixed";
  const lines = linesIn(scene, scope);
  const port = scene.objectByPath.get(`${scope}/hub`).ports.get("shared");
  everyPair(lines, (first, second) => {
    assert.ok(sharedRunLength(first, second) <= EPSILON,
      `${first.id} and ${second.id} share ${sharedRunLength(first, second)}px despite incompatible stroke/dash/width on an automatic join`);
  });
  assertContinuousParallelBundle(lines, port.point);
});

test("automatic style cohorts share one monotone terminal trunk and never rejoin after splitting", async () => {
  const { scene } = await solveFile(fixture("named-port-sharing.tsx"));
  const scope = "style-cohort-cases/auto-cohorts";
  const [first, second, independent] = linesIn(scene, scope);
  const port = scene.objectByPath.get(`${scope}/hub`).ports.get("shared");
  assert.equal(first.from.port, port);
  assert.equal(second.from.port, port);
  assert.equal(independent.from.port, port);

  const firstIntervals = sharedIntervalsAlong(first, second);
  const secondIntervals = sharedIntervalsAlong(second, first);
  assert.equal(firstIntervals.length, 1,
    `compatible cohort split and later rejoined along ${JSON.stringify(firstIntervals)}`);
  assert.equal(secondIntervals.length, 1,
    `compatible cohort split and later rejoined along ${JSON.stringify(secondIntervals)}`);
  assert.ok(firstIntervals[0][0] <= EPSILON && firstIntervals[0][1] > EPSILON,
    `compatible cohort does not start with a positive terminal trunk: ${JSON.stringify(firstIntervals)}`);
  assert.ok(secondIntervals[0][0] <= EPSILON && secondIntervals[0][1] > EPSILON,
    `compatible cohort does not start with a positive terminal trunk: ${JSON.stringify(secondIntervals)}`);
  assert.ok(sharedRunLength(first, independent) <= EPSILON);
  assert.ok(sharedRunLength(second, independent) <= EPSILON);
});

test("style-separated lanes at one canonical port stay more compact than independent docks", async () => {
  const [{ scene: namedScene }, { scene: independentScene }] = await Promise.all([
    solveFile(fixture("named-port-sharing.tsx")),
    solveFile(fixture("port-group-affinity.tsx")),
  ]);
  const namedScope = "style-cohort-cases/auto-cohorts";
  const namedPort = namedScene.objectByPath.get(`${namedScope}/hub`).ports.get("shared");
  const namedLines = linesIn(namedScene, namedScope);
  const independentScope = "independent/separate";
  const independentLines = linesIn(independentScene, independentScope);

  assert.equal(namedPort.terminalSlots.length, 2,
    "two compatible styles should share one compact slot while the incompatible style gets a neighboring slot");
  assert.equal(new Set(namedLines.map((line) => line.from.port)).size, 1,
    "style-separated lanes must retain one canonical named port identity");
  assert.equal(new Set(independentLines.map((line) => line.to.port)).size, independentLines.length,
    "comparison fixture must use independent canonical docks");
  const compactSpan = Math.max(...namedPort.terminalSlots.map((slot) => slot.point.y))
    - Math.min(...namedPort.terminalSlots.map((slot) => slot.point.y));
  const independentSpan = Math.max(...independentLines.map((line) => line.to.point.y))
    - Math.min(...independentLines.map((line) => line.to.point.y));
  assert.ok(compactSpan + EPSILON < independentSpan,
    `same-port style lanes span ${compactSpan}px, not more compact than independent docks spanning ${independentSpan}px`);
});

test("an explicit merge with incompatible shared-piece styles emits a required-sharing diagnostic", async () => {
  const { scene } = await solveFile(fixture("named-port-sharing.tsx"));
  const relevant = scene.diagnostics.filter((diagnostic) =>
    diagnostic.severity === "error"
    && /merge|sharing/i.test(diagnostic.message)
    && /style|stroke|dash|incompat/i.test(diagnostic.message));
  assert.ok(relevant.length > 0,
    `required mixed-style merge emitted no diagnostic; got: ${scene.diagnostics.map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`).join(" | ") || "none"}`);
});

test("headed bundle branches keep independent terminal lanes and the full arrowhead approach", async () => {
  const { scene } = await solveFile(fixture("named-port-sharing.tsx"));
  const scope = "compatible-cases/bundle-compatible";
  const lines = linesIn(scene, scope);
  const port = scene.objectByPath.get(`${scope}/hub`).ports.get("shared");
  assert.ok(lines.every((line) => line.from.port === port), "fixture must retain one canonical PortIR identity");
  assert.equal(new Set(lines.map((line) => `${line.from.point.x},${line.from.point.y}`)).size, lines.length,
    "a named bundle needs one physical terminal slot per line without multiplying the canonical port");
  everyPair(lines, (first, second) => {
    for (const endIndex of [0, 1]) {
      const firstSegment = endIndex === 0 ? routeSegments(first)[0] : routeSegments(first).at(-1);
      const secondSegment = endIndex === 0 ? routeSegments(second)[0] : routeSegments(second).at(-1);
      assert.ok(collinearOverlap(firstSegment, secondSegment) <= EPSILON,
        `${first.id} and ${second.id} overlap on headed terminal lanes at end ${endIndex}`);
    }
    const firstHead = headGeometry(normalizedHeads(first.heads)[0]);
    const secondHead = headGeometry(normalizedHeads(second.heads)[0]);
    const tipDistance = Math.hypot(first.from.point.x - second.from.point.x, first.from.point.y - second.from.point.y);
    const minimumTipDistance = Math.max(port.minSpacing ?? 0, (firstHead.width + secondHead.width) / 2);
    assert.ok(tipDistance + EPSILON >= minimumTipDistance,
      `${first.id} and ${second.id} share named port '${port.id}' but their bundle slots are ${tipDistance}px apart; expected ${minimumTipDistance}px`);
  });
  for (const line of lines) {
    assertTerminalHeadReserve(line, 0);
    assertTerminalHeadReserve(line, 1);
  }
});

test("PortGroup merge affinity creates a shared trunk across distinct canonical ports", async () => {
  const { scene } = await solveFile(fixture("port-group-affinity.tsx"));
  const scope = "cohesive/merge";
  const hub = scene.objectByPath.get(`${scope}/hub`);
  const lines = linesIn(scene, scope);
  assert.equal(hub.portGroups[0].affinity, "merge");
  assert.equal(new Set(lines.map((line) => line.to.port)).size, lines.length, "fixture must use distinct named ports");
  everyPair(lines, (first, second) => {
    assert.ok(sharedRunLength(first, second) > EPSILON,
      `merge-affinity lines ${first.id} and ${second.id} have no positive-length common trunk`);
  });
});

test("PortGroup bundle affinity compresses distinct lines into a stable adjacent lane block", async () => {
  const { scene } = await solveFile(fixture("port-group-affinity.tsx"));
  const scope = "cohesive/bundle";
  const hub = scene.objectByPath.get(`${scope}/hub`);
  const lines = linesIn(scene, scope);
  const sources = scene.objectByPath.get(`${scope}/sources`).children;
  const gapStart = hub.box.x + hub.box.width;
  const gapEnd = Math.min(...sources.map((source) => source.box.x));
  const samples = [gapStart + (gapEnd - gapStart) * 0.4, gapStart + (gapEnd - gapStart) * 0.6];
  const laneSets = samples.map((x) => lines.map((line) => horizontalLaneAt(line, x)));
  everyPair(lines, (first, second) => {
    assert.ok(sharedRunLength(first, second) <= EPSILON,
      `bundle-affinity lines ${first.id} and ${second.id} overlap for ${sharedRunLength(first, second)}px`);
  });
  assert.deepEqual(
    laneSets[1].map((y, index) => ({ id: lines[index].id, y })).sort((first, second) => first.y - second.y).map((lane) => lane.id),
    laneSets[0].map((y, index) => ({ id: lines[index].id, y })).sort((first, second) => first.y - second.y).map((lane) => lane.id),
    "PortGroup bundle lanes must not swap order",
  );
  const dockSpan = Math.max(...lines.map((line) => line.to.point.y)) - Math.min(...lines.map((line) => line.to.point.y));
  const laneSpan = Math.max(...laneSets[0]) - Math.min(...laneSets[0]);
  assert.ok(laneSpan < dockSpan,
    `bundle-affinity lane block spans ${laneSpan}px, not closer than its ${dockSpan}px dock fan-out`);
  const terminalOrder = [...lines].sort((first, second) => first.to.point.y - second.to.point.y).map((line) => line.to.port.id);
  assert.deepEqual(terminalOrder, ["request-a", "request-b", "request-c"],
    "fixed PortGroup member order must be the bundled terminal-slot order");
});

test("PortGroup free affinity introduces neither a shared trunk nor a bundle requirement", async () => {
  const { scene } = await solveFile(fixture("port-group-affinity.tsx"));
  const scope = "independent/free";
  const hub = scene.objectByPath.get(`${scope}/hub`);
  const lines = linesIn(scene, scope);
  assert.equal(hub.portGroups[0].affinity, "free");
  everyPair(lines, (first, second) => {
    assert.ok(sharedRunLength(first, second) <= EPSILON,
      `free-affinity lines ${first.id} and ${second.id} unexpectedly share ${sharedRunLength(first, second)}px`);
  });
});

test("PortGroup separate affinity keeps headed terminal lanes and arrowheads visibly apart", async () => {
  const { scene } = await solveFile(fixture("port-group-affinity.tsx"));
  const scope = "independent/separate";
  const hub = scene.objectByPath.get(`${scope}/hub`);
  const lines = linesIn(scene, scope);
  assert.equal(hub.portGroups[0].affinity, "separate");
  everyPair(lines, (first, second) => {
    assert.ok(sharedRunLength(first, second) <= EPSILON,
      `separate-affinity lines ${first.id} and ${second.id} share ${sharedRunLength(first, second)}px`);
    const firstHead = headGeometry(normalizedHeads(first.heads)[1]);
    const secondHead = headGeometry(normalizedHeads(second.heads)[1]);
    const tipDistance = Math.hypot(first.to.point.x - second.to.point.x, first.to.point.y - second.to.point.y);
    const minimumTipDistance = (firstHead.width + secondHead.width) / 2;
    assert.ok(tipDistance + EPSILON >= minimumTipDistance,
      `${first.id} and ${second.id} arrow tips are ${tipDistance}px apart; their heads require ${minimumTipDistance}px`);
  });
  for (const line of lines) assertTerminalHeadReserve(line, 1);
});
