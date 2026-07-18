export function normalizedHeads(heads) {
  if (Array.isArray(heads)) return heads;
  if (heads === "none") return ["none", "none"];
  if (heads === "both") return ["arrow", "arrow"];
  if (heads === "backward") return ["arrow", "none"];
  return ["none", "arrow"];
}

export function headKind(value) {
  if (typeof value === "string") return value;
  return value?.name ?? "arrow";
}

// The router and painter share these dimensions so every terminal run can
// reserve a straight approach at least twice as long as its head is wide.
export function headGeometry(value) {
  const kind = headKind(value);
  if (!kind || kind === "none") return { kind, width: 0, shoulderDepth: 0, depth: 0 };
  if (kind.includes("diamond")) return { kind, width: 14, shoulderDepth: 12, depth: 22 };
  if (kind.includes("triangle")) return { kind, width: 16, shoulderDepth: 12, depth: 12 };
  return { kind, width: 12, shoulderDepth: 12, depth: 12 };
}

export function minimumHeadRun(value) {
  return headGeometry(value).width * 2;
}
