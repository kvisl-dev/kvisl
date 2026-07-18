export const SIDES = ["top", "right", "bottom", "left"];

export function rotateSide(side, degrees) {
  if (!SIDES.includes(side)) return side;
  const turns = ((degrees % 360) + 360) % 360 / 90;
  return SIDES[(SIDES.indexOf(side) + turns) % 4];
}

// Orientation changes directional semantics, never the painted geometry of
// an object. By default it applies to the declaring container's layout and
// to the sides of its direct children. A larger depth cascades across more
// nested frame boundaries.
export function layoutOrientation(object) {
  let orientation = object?.orientation ?? 0;
  let distance = 1;
  for (let current = object?.parent; current; current = current.parent, distance += 1) {
    if (current.orientationDepth === "all" || current.orientationDepth > distance) orientation += current.orientation ?? 0;
  }
  return ((orientation % 360) + 360) % 360;
}

export function absoluteOrientation(object) {
  let orientation = object?.orientation ?? 0;
  let distance = 1;
  for (let current = object?.parent; current; current = current.parent, distance += 1) {
    if (current.orientationDepth === "all" || current.orientationDepth >= distance) orientation += current.orientation ?? 0;
  }
  return ((orientation % 360) + 360) % 360;
}
