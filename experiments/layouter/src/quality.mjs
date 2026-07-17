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

export function analyzeScene(scene) {
  const objects = obstacleObjects(scene);
  const routeInteractions = routeRouteInteractions(scene);
  return {
    unexpectedObjectOverlaps: unexpectedObjectOverlaps(objects),
    routeObjectIntersections: routeObjectIntersections(scene, objects),
    labelObjectOverlaps: labelObjectOverlaps(scene, objects),
    labelLabelOverlaps: labelLabelOverlaps(scene),
    routeCrossings: routeInteractions.crossings,
    unexpectedRouteOverlaps: routeInteractions.unexpectedOverlaps,
  };
}
