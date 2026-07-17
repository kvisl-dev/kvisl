import { effectiveLayout, lineLabelDemand } from "./layout.mjs";
import { boundaryLabelStrips, containerBorderRings } from "./route.mjs";

const CELL = 160;

function boxesOverlap(first, second, padding = 0) {
  return first.x < second.x + second.width + padding
    && first.x + first.width + padding > second.x
    && first.y < second.y + second.height + padding
    && first.y + first.height + padding > second.y;
}

function segmentHitsBox(first, second, box) {
  const inset = 3;
  const left = box.x + inset;
  const right = box.x + box.width - inset;
  const top = box.y + inset;
  const bottom = box.y + box.height - inset;
  if (first.x === second.x) {
    return first.x > left && first.x < right
      && Math.max(first.y, second.y) > top
      && Math.min(first.y, second.y) < bottom;
  }
  if (first.y === second.y) {
    return first.y > top && first.y < bottom
      && Math.max(first.x, second.x) > left
      && Math.min(first.x, second.x) < right;
  }
  return false;
}

class BoxIndex {
  constructor(items = []) {
    this.cells = new Map();
    for (const item of items) this.insert(item);
  }

  keys(box) {
    const keys = [];
    const left = Math.floor(box.x / CELL);
    const right = Math.floor((box.x + box.width) / CELL);
    const top = Math.floor(box.y / CELL);
    const bottom = Math.floor((box.y + box.height) / CELL);
    for (let x = left; x <= right; x += 1) {
      for (let y = top; y <= bottom; y += 1) keys.push(`${x},${y}`);
    }
    return keys;
  }

  insert(item) {
    for (const key of this.keys(item.box)) {
      if (!this.cells.has(key)) this.cells.set(key, []);
      this.cells.get(key).push(item);
    }
  }

  query(box) {
    const result = new Set();
    for (const key of this.keys(box)) {
      for (const item of this.cells.get(key) ?? []) result.add(item);
    }
    return result;
  }
}

function segmentBox(first, second) {
  return {
    x: Math.min(first.x, second.x) - 2,
    y: Math.min(first.y, second.y) - 2,
    width: Math.abs(first.x - second.x) + 4,
    height: Math.abs(first.y - second.y) + 4,
  };
}

function obstacleObjects(scene) {
  return scene.objects.filter((object) => object.visible
    && object.children.length === 0
    && !object.frame
    && !["title", "subtitle", "legend-item"].includes(object.kind));
}

function routeObjectIntersections(scene, objects) {
  const index = new BoxIndex(objects);
  const result = [];
  for (const line of scene.lines) {
    if (line.space === "overlay") continue;
    const ignored = new Set([
      line.from?.object,
      line.to?.object,
      ...line.segments.map((segment) => segment.waypoint).filter(Boolean),
    ]);
    for (let segmentIndex = 1; segmentIndex < line.route.length; segmentIndex += 1) {
      const first = line.route[segmentIndex - 1];
      const second = line.route[segmentIndex];
      for (const object of index.query(segmentBox(first, second))) {
        if (!ignored.has(object) && segmentHitsBox(first, second, object.box)) {
          result.push({ line, object, segmentIndex: segmentIndex - 1 });
        }
      }
    }
  }
  return result;
}

function objectOverlapAllowed(first, second) {
  const activation = (object) => object.roles.includes("uml-activation");
  const occurrence = (object) => object.roles.includes("uml-occurrence") || object.roles.includes("uml-lifeline-end");
  return activation(first) && occurrence(second) || activation(second) && occurrence(first);
}

function unexpectedObjectOverlaps(objects) {
  const index = new BoxIndex();
  const result = [];
  for (const object of objects) {
    for (const previous of index.query(object.box)) {
      if (boxesOverlap(object.box, previous.box) && !objectOverlapAllowed(object, previous)) {
        result.push({ first: previous, second: object });
      }
    }
    index.insert(object);
  }
  return result;
}

function labelObjectOverlaps(scene, objects) {
  const index = new BoxIndex(objects);
  const result = [];
  for (const line of scene.lines) {
    for (const label of line.routeLabels) {
      for (const object of index.query(label.box)) {
        if (boxesOverlap(label.box, object.box, 2)) result.push({ line, label, object });
      }
    }
  }
  return result;
}

function labelLabelOverlaps(scene) {
  const index = new BoxIndex();
  const result = [];
  for (const line of scene.lines) {
    for (const label of line.routeLabels) {
      for (const previous of index.query(label.box)) {
        if (boxesOverlap(label.box, previous.label.box, 4)) result.push({ line, label, otherLine: previous.line, otherLabel: previous.label });
      }
      index.insert({ box: label.box, line, label });
    }
  }
  return result;
}

function sharedGeometryAllowed(first, second) {
  if (first.share?.group && first.share.group === second.share?.group) {
    const mode = first.share.mode ?? second.share.mode ?? "auto";
    if (mode === "merge" || mode === "auto") return true;
  }
  const firstPorts = [first.from?.port, first.to?.port].filter(Boolean);
  const secondPorts = new Set([second.from?.port, second.to?.port].filter(Boolean));
  return firstPorts.some((port) => {
    const mode = port.sharing?.mode ?? "auto";
    return secondPorts.has(port) && (mode === "merge" || mode === "auto");
  });
}

function segmentInteraction(first, second) {
  const firstHorizontal = first.first.y === first.second.y;
  const secondHorizontal = second.first.y === second.second.y;
  if (firstHorizontal === secondHorizontal) {
    const sameAxis = firstHorizontal ? first.first.y === second.first.y : first.first.x === second.first.x;
    if (!sameAxis) return null;
    const firstStart = firstHorizontal ? Math.min(first.first.x, first.second.x) : Math.min(first.first.y, first.second.y);
    const firstEnd = firstHorizontal ? Math.max(first.first.x, first.second.x) : Math.max(first.first.y, first.second.y);
    const secondStart = firstHorizontal ? Math.min(second.first.x, second.second.x) : Math.min(second.first.y, second.second.y);
    const secondEnd = firstHorizontal ? Math.max(second.first.x, second.second.x) : Math.max(second.first.y, second.second.y);
    const length = Math.min(firstEnd, secondEnd) - Math.max(firstStart, secondStart);
    return length > 2 ? { kind: "overlap", length } : null;
  }
  const horizontal = firstHorizontal ? first : second;
  const vertical = firstHorizontal ? second : first;
  const x = vertical.first.x;
  const y = horizontal.first.y;
  const insideHorizontal = x > Math.min(horizontal.first.x, horizontal.second.x)
    && x < Math.max(horizontal.first.x, horizontal.second.x);
  const insideVertical = y > Math.min(vertical.first.y, vertical.second.y)
    && y < Math.max(vertical.first.y, vertical.second.y);
  return insideHorizontal && insideVertical ? { kind: "crossing", x, y } : null;
}

function routeRouteInteractions(scene) {
  const index = new BoxIndex();
  const crossings = [];
  const unexpectedOverlaps = [];
  for (const line of scene.lines) {
    for (let segmentIndex = 1; segmentIndex < line.route.length; segmentIndex += 1) {
      const segment = {
        line,
        segmentIndex: segmentIndex - 1,
        first: line.route[segmentIndex - 1],
        second: line.route[segmentIndex],
      };
      segment.box = segmentBox(segment.first, segment.second);
      for (const previous of index.query(segment.box)) {
        if (previous.line === line) continue;
        const interaction = segmentInteraction(segment, previous);
        if (interaction?.kind === "crossing") crossings.push({ ...interaction, first: previous, second: segment });
        if (interaction?.kind === "overlap" && !sharedGeometryAllowed(previous.line, line)) {
          unexpectedOverlaps.push({ ...interaction, first: previous, second: segment });
        }
      }
      index.insert(segment);
    }
  }
  return { crossings, unexpectedOverlaps };
}

function clusterCount(values, tolerance = 2.5) {
  const sorted = [...values].sort((first, second) => first - second);
  let count = 0;
  let previous = Number.NEGATIVE_INFINITY;
  for (const value of sorted) {
    if (value - previous > tolerance) count += 1;
    previous = value;
  }
  return count;
}

function coefficientOfVariation(values) {
  if (values.length < 2) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (mean <= 0) return null;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

function pointSegmentDistance(point, first, second) {
  const dx = second.x - first.x;
  const dy = second.y - first.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared ? Math.max(0, Math.min(1, ((point.x - first.x) * dx + (point.y - first.y) * dy) / lengthSquared)) : 0;
  return Math.hypot(point.x - (first.x + t * dx), point.y - (first.y + t * dy));
}

function flowMembers(object) {
  return object.children.filter((child) => !child.anchor && !child.frame);
}

// Soft drawing-quality measures a human perceives at a glance. They are
// reported alongside the hard conflict gate and guide the aesthetics passes.
export function perceptionMetrics(scene) {
  let bendTotal = 0;
  let maxBends = 0;
  let routeLength = 0;
  let manhattan = 0;
  let backtrack = 0;
  let routedLines = 0;
  for (const line of scene.lines) {
    if (line.route.length < 2) continue;
    routedLines += 1;
    bendTotal += line.route.length - 2;
    maxBends = Math.max(maxBends, line.route.length - 2);
    const start = line.route[0];
    const end = line.route.at(-1);
    const spanX = end.x - start.x;
    const spanY = end.y - start.y;
    manhattan += Math.abs(spanX) + Math.abs(spanY);
    for (let index = 1; index < line.route.length; index += 1) {
      const dx = line.route[index].x - line.route[index - 1].x;
      const dy = line.route[index].y - line.route[index - 1].y;
      const length = Math.abs(dx) + Math.abs(dy);
      routeLength += length;
      if (dx !== 0 && spanX !== 0 && Math.sign(dx) !== Math.sign(spanX)) backtrack += Math.abs(dx);
      if (dy !== 0 && spanY !== 0 && Math.sign(dy) !== Math.sign(spanY)) backtrack += Math.abs(dy);
    }
  }

  const boxes = obstacleObjects(scene).map((object) => object.box);
  const xs = boxes.flatMap((box) => [box.x, box.x + box.width / 2, box.x + box.width]);
  const ys = boxes.flatMap((box) => [box.y, box.y + box.height / 2, box.y + box.height]);

  const peerCVs = [];
  const gapCVs = [];
  for (const container of scene.objects) {
    const members = flowMembers(container).filter((child) => child.visible);
    if (members.length >= 2) {
      const leafPeers = members.filter((child) => child.children.length === 0);
      const widthCV = coefficientOfVariation(leafPeers.map((child) => child.box.width));
      const heightCV = coefficientOfVariation(leafPeers.map((child) => child.box.height));
      if (widthCV != null) peerCVs.push(widthCV);
      if (heightCV != null) peerCVs.push(heightCV);
    }
    if (members.length >= 3) {
      const layout = container.layout?.kind;
      const horizontal = layout === "row";
      if (layout === "row" || layout === "column") {
        const gaps = [];
        for (let index = 1; index < members.length; index += 1) {
          const previous = members[index - 1].box;
          const current = members[index].box;
          gaps.push(horizontal ? current.x - (previous.x + previous.width) : current.y - (previous.y + previous.height));
        }
        const gapCV = coefficientOfVariation(gaps.filter((value) => value >= 0));
        if (gapCV != null) gapCVs.push(gapCV);
      }
    }
  }

  const displacements = [];
  for (const line of scene.lines) {
    for (const label of line.routeLabels) {
      let nearest = Number.POSITIVE_INFINITY;
      for (let index = 1; index < line.route.length; index += 1) {
        nearest = Math.min(nearest, pointSegmentDistance({ x: label.x, y: label.y }, line.route[index - 1], line.route[index]));
      }
      if (Number.isFinite(nearest)) displacements.push(nearest);
    }
  }

  const average = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  return {
    routedLines,
    bendTotal,
    bendsPerLine: routedLines ? bendTotal / routedLines : 0,
    maxBends,
    detourFactor: manhattan > 0 ? routeLength / manhattan : 1,
    backtrackRatio: routeLength > 0 ? backtrack / routeLength : 0,
    guidesX: clusterCount(xs),
    guidesY: clusterCount(ys),
    boxCount: boxes.length,
    peerSizeCV: average(peerCVs),
    gapCV: average(gapCVs),
    labelDisplacement: average(displacements),
  };
}

// Labels that provably found no free spot escalate their line's corridor
// reservation; the pipeline re-solves with the wider corridor. Bumps are
// incremental (overlap depth, capped at the full label demand) so corridors
// end as narrow as the labels allow. Returns true when a reservation grew.
export function escalateLabelReservations(scene, reservations) {
  const quality = analyzeScene(scene);
  let changed = false;
  const raise = (key, value) => {
    const current = reservations.get(key) ?? 0;
    if (value > current + 0.5) {
      reservations.set(key, value);
      changed = true;
    }
  };

  // A collision-free fallback is still a failed placement when an authored
  // segment label could not stay at its declared region. Treat that rejected
  // preferred candidate as pressure on the same reserving corridor.
  for (const line of scene.lines) {
    for (const label of line.routeLabels) {
      if (!label.authoredSegment || label.authoredRegion || !line.labelReservation) continue;
      const current = reservations.get(line.labelReservation.key) ?? 0;
      const cap = lineLabelDemand(line, line.labelReservation.axis);
      raise(line.labelReservation.key, Math.min(cap, current + 32));
    }
  }
  for (const item of [...quality.labelObjectOverlaps, ...quality.labelDecorOverlaps, ...quality.labelLabelOverlaps]) {
    // a label pressed against container decor is squeezed in a pocket next
    // to that container — widening the adjacent sibling gaps is the targeted
    // fix, so it replaces the corridor bump for these offenders
    const owner = item.object?.owner;
    const parent = owner?.parent;
    const layout = parent ? effectiveLayout(parent) : null;
    if (owner && (layout === "row" || layout === "column")) {
      const extent = layout === "column" ? "height" : "width";
      const need = item.label.box[extent] + 16;
      for (const index of [owner.siblingIndex - 1, owner.siblingIndex]) {
        if (index < 0) continue;
        const key = `gap:${parent.path || "$root"}:${index}`;
        raise(key, Math.max(need, (reservations.get(key) ?? 0) + 16));
      }
      continue;
    }
    const target = item.line.labelReservation;
    if (!target) continue;
    const current = reservations.get(target.key) ?? 0;
    const cap = lineLabelDemand(item.line, target.axis);
    const other = item.object?.box ?? item.otherLabel.box;
    const overlap = target.axis === "horizontal"
      ? Math.min(item.label.box.x + item.label.box.width, other.x + other.width) - Math.max(item.label.box.x, other.x)
      : Math.min(item.label.box.y + item.label.box.height, other.y + other.height) - Math.max(item.label.box.y, other.y);
    // thin decor rings understate the shortfall, so steps have a floor
    raise(target.key, Math.min(cap, current + Math.max(32, overlap + 8)));
  }
  return changed;
}

export function analyzeScene(scene) {
  const objects = obstacleObjects(scene);
  const routeInteractions = routeRouteInteractions(scene);
  const titleStrips = boundaryLabelStrips(scene);
  return {
    unexpectedObjectOverlaps: unexpectedObjectOverlaps(objects),
    routeObjectIntersections: routeObjectIntersections(scene, objects),
    labelObjectOverlaps: labelObjectOverlaps(scene, objects),
    labelLabelOverlaps: labelLabelOverlaps(scene),
    routeCrossings: routeInteractions.crossings,
    unexpectedRouteOverlaps: routeInteractions.unexpectedOverlaps,
    // decor readability: runs parallel to a container title's text line,
    // and labels on titles or border strokes; perpendicular crossings of a
    // title strip are tolerated
    routeTitleCrossings: routeObjectIntersections(scene, titleStrips).filter((hit) =>
      hit.line.route[hit.segmentIndex].y === hit.line.route[hit.segmentIndex + 1].y),
    labelDecorOverlaps: labelObjectOverlaps(scene, [...titleStrips, ...containerBorderRings(scene)]),
  };
}
