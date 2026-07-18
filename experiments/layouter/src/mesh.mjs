const SIDES = ["top", "right", "bottom", "left"];

function flowChildren(object) {
  return object.children.filter((child) => !child.anchor && !child.frame);
}

function layoutKind(object) {
  return object.layout?.kind ?? (["scope", "diagram"].includes(object.kind) ? "column" : object.kind);
}

function geometry(x, y, width, height, axis) {
  return { x, y, width: Math.max(0, width), height: Math.max(0, height), axis };
}

export function regionGeometry(region) {
  if (region.kind === "padding") {
    const box = region.owner.box;
    const clearance = region.clearance ?? 0;
    const padding = region.owner.paddingBox ?? { top: 12, right: 12, bottom: 12, left: 12 };
    const thickness = region.thickness > 0 ? region.thickness : padding[region.side];
    const contentHeight = region.owner.contentHeight ?? 0;
    if (region.side === "top") {
      return geometry(box.x, box.y + padding.top + contentHeight - clearance - thickness, box.width, thickness, "horizontal");
    }
    if (region.side === "bottom") {
      return geometry(box.x, box.y + box.height - padding.bottom + clearance, box.width, thickness, "horizontal");
    }
    if (region.side === "left") {
      return geometry(box.x + padding.left - clearance - thickness, box.y, thickness, box.height, "vertical");
    }
    return geometry(box.x + box.width - padding.right + clearance, box.y, thickness, box.height, "vertical");
  }
  const first = region.owner.children[region.index]?.box;
  const second = region.owner.children[region.index + 1]?.box;
  if (!first || !second) return geometry(0, 0, 0, 0, "vertical");
  const separatedX = first.x + first.width <= second.x || second.x + second.width <= first.x;
  if (separatedX) {
    const left = first.x < second.x ? first.x + first.width : second.x + second.width;
    const right = first.x < second.x ? second.x : first.x;
    return geometry(left, Math.min(first.y, second.y), right - left,
      Math.max(first.y + first.height, second.y + second.height) - Math.min(first.y, second.y), "vertical");
  }
  const top = first.y < second.y ? first.y + first.height : second.y + second.height;
  const bottom = first.y < second.y ? second.y : first.y;
  return geometry(Math.min(first.x, second.x), top,
    Math.max(first.x + first.width, second.x + second.width) - Math.min(first.x, second.x), bottom - top, "horizontal");
}

function gapBetween(first, second, axis) {
  if (axis === "vertical") {
    const top = Math.min(first.y, second.y);
    const bottom = Math.max(first.y + first.height, second.y + second.height);
    return geometry(first.x + first.width, top, second.x - first.x - first.width, bottom - top, "vertical");
  }
  const left = Math.min(first.x, second.x);
  const right = Math.max(first.x + first.width, second.x + second.width);
  return geometry(left, first.y + first.height, right - left, second.y - first.y - first.height, "horizontal");
}

function gridGutters(object, members) {
  const columns = Math.max(1, Math.min(object.layoutData?.columns ?? object.columns ?? 1, members.length));
  const rows = Math.ceil(members.length / columns);
  const cells = [];
  const columnMembers = Array.from({ length: columns }, () => []);
  const rowMembers = Array.from({ length: rows }, () => []);
  members.forEach((member, index) => {
    columnMembers[index % columns].push(member);
    rowMembers[Math.floor(index / columns)].push(member);
  });
  const top = Math.min(...members.map((member) => member.box.y));
  const bottom = Math.max(...members.map((member) => member.box.y + member.box.height));
  const left = Math.min(...members.map((member) => member.box.x));
  const right = Math.max(...members.map((member) => member.box.x + member.box.width));
  for (let column = 0; column < columns - 1; column += 1) {
    const before = columnMembers[column];
    const after = columnMembers[column + 1];
    const start = Math.max(...before.map((member) => member.box.x + member.box.width));
    const end = Math.min(...after.map((member) => member.box.x));
    cells.push({
      key: `mesh:grid-column-gap:${object.path || "$root"}:${column}`,
      kind: "gap",
      owner: object,
      materialized: false,
      geometry: geometry(start, top, end - start, bottom - top, "vertical"),
    });
  }
  for (let row = 0; row < rows - 1; row += 1) {
    const before = rowMembers[row];
    const after = rowMembers[row + 1];
    const start = Math.max(...before.map((member) => member.box.y + member.box.height));
    const end = Math.min(...after.map((member) => member.box.y));
    cells.push({
      key: `mesh:grid-row-gap:${object.path || "$root"}:${row}`,
      kind: "gap",
      owner: object,
      materialized: false,
      geometry: geometry(left, start, right - left, end - start, "horizontal"),
    });
  }
  return cells;
}

function paddingCells(object, activePadding) {
  const sides = Object.fromEntries(SIDES.map((side) => {
    const active = activePadding.get(`${object.path || "$root"}:${side}`);
    const region = active ?? { kind: "padding", owner: object, side, thickness: 0, clearance: 0, corridors: [] };
    return [side, { region, geometry: active?.geometry ?? regionGeometry(region) }];
  }));
  const box = object.box;
  const leftEdge = sides.left.geometry.x + sides.left.geometry.width;
  const rightEdge = sides.right.geometry.x;
  const topEdge = sides.top.geometry.y + sides.top.geometry.height;
  const bottomEdge = sides.bottom.geometry.y;
  const path = object.path || "$root";
  const sideCells = [
    { side: "top", geometry: geometry(leftEdge, sides.top.geometry.y, rightEdge - leftEdge, sides.top.geometry.height, "horizontal") },
    { side: "right", geometry: geometry(sides.right.geometry.x, topEdge, sides.right.geometry.width, bottomEdge - topEdge, "vertical") },
    { side: "bottom", geometry: geometry(leftEdge, sides.bottom.geometry.y, rightEdge - leftEdge, sides.bottom.geometry.height, "horizontal") },
    { side: "left", geometry: geometry(sides.left.geometry.x, topEdge, sides.left.geometry.width, bottomEdge - topEdge, "vertical") },
  ].map((cell) => ({
    key: `mesh:padding:${path}:${cell.side}`,
    kind: "padding",
    owner: object,
    side: cell.side,
    materialized: Boolean(activePadding.get(`${path}:${cell.side}`)),
    corridors: sides[cell.side].region.corridors ?? [],
    geometry: cell.geometry,
  }));
  const cornerCells = [
    { corner: "top-left", outwardSides: ["top", "left"], geometry: geometry(sides.left.geometry.x, sides.top.geometry.y, leftEdge - sides.left.geometry.x, topEdge - sides.top.geometry.y, "junction") },
    { corner: "top-right", outwardSides: ["top", "right"], geometry: geometry(rightEdge, sides.top.geometry.y, box.x + box.width - rightEdge, topEdge - sides.top.geometry.y, "junction") },
    { corner: "bottom-right", outwardSides: ["bottom", "right"], geometry: geometry(rightEdge, bottomEdge, box.x + box.width - rightEdge, box.y + box.height - bottomEdge, "junction") },
    { corner: "bottom-left", outwardSides: ["bottom", "left"], geometry: geometry(sides.left.geometry.x, bottomEdge, leftEdge - sides.left.geometry.x, box.y + box.height - bottomEdge, "junction") },
  ].map((cell) => ({
    key: `mesh:corner:${path}:${cell.corner}`,
    kind: "corner",
    owner: object,
    corner: cell.corner,
    outwardSides: cell.outwardSides,
    materialized: true,
    geometry: cell.geometry,
  }));
  return [...sideCells, ...cornerCells];
}

export function buildChannelMesh(scene) {
  const cells = [];
  const activePadding = new Map();
  const activeGaps = new Map();
  for (const region of scene.regions.values()) {
    if (region.kind === "padding") activePadding.set(`${region.owner.path || "$root"}:${region.side}`, region);
    if (region.kind === "gap") activeGaps.set(`${region.owner.path || "$root"}:${region.index}`, region);
  }
  for (const object of scene.objects) {
    const members = flowChildren(object);
    if (!members.length) continue;
    cells.push(...paddingCells(object, activePadding));
    const layout = layoutKind(object);
    if (layout === "grid") {
      cells.push(...gridGutters(object, members));
    } else if (layout === "row" || layout === "column") {
      for (let index = 1; index < members.length; index += 1) {
        const first = members[index - 1];
        const second = members[index];
        const axis = layout === "row" ? "vertical" : "horizontal";
        const active = activeGaps.get(`${object.path || "$root"}:${first.siblingIndex}`);
        cells.push({
          key: `mesh:gap:${object.path || "$root"}:${index - 1}`,
          kind: "gap",
          owner: object,
          index: index - 1,
          materialized: Boolean(active),
          corridors: active?.corridors ?? [],
          geometry: active?.geometry ?? gapBetween(first.box, second.box, axis),
        });
      }
    }
  }
  scene.channelMesh = cells.filter((cell) => cell.geometry.width > 0 && cell.geometry.height > 0);
  return scene.channelMesh;
}
