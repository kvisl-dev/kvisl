import { writeFile } from "node:fs/promises";
import path from "node:path";
import { evaluateFile } from "./evaluate.mjs";
import { layout } from "./layout.mjs";
import { project } from "./project.mjs";
import { analyzeScene, escalateLabelReservations } from "./quality.mjs";
import { route } from "./route.mjs";
import { renderSvg } from "./svg.mjs";

export async function solveFile(entry, options = {}) {
  const evaluated = await evaluateFile(entry);
  // corridors start at bare track width; when a label proves it has no free
  // spot, its corridor reservation escalates and the scene solves again
  let labelReservations = new Map();
  let scene = project(evaluated.expanded, options);
  if (scene.root) {
    for (let attempt = 0; ; attempt += 1) {
      scene.labelReservations = labelReservations;
      layout(scene);
      route(scene);
      if (attempt >= 7 || !escalateLabelReservations(scene, labelReservations)) break;
      scene = project(evaluated.expanded, options);
    }

    // Escalation deliberately overshoots in bounded increments. Reclaim part
    // of that slack with two fixed global attempts; a failed attempt is
    // discarded wholesale, so feasibility never depends on search order.
    for (let attempt = 0; attempt < 2 && labelReservations.size; attempt += 1) {
      const anchored = new Set(scene.lines.flatMap((line) =>
        line.routeLabels.map((label, index) => label.authoredRegion ? `${line.id}:${index}` : null).filter(Boolean)));
      const compacted = new Map([...labelReservations].map(([key, value]) => [key, Math.max(0, value - 8)]));
      const candidate = project(evaluated.expanded, options);
      candidate.labelReservations = compacted;
      layout(candidate);
      route(candidate);
      const quality = analyzeScene(candidate);
      const conflicts = quality.labelObjectOverlaps.length + quality.labelLabelOverlaps.length + quality.labelDecorOverlaps.length;
      const displaced = candidate.lines.some((line) =>
        line.routeLabels.some((label, index) => anchored.has(`${line.id}:${index}`) && !label.authoredRegion));
      if (conflicts || displaced) break;
      labelReservations = compacted;
      scene = candidate;
    }
  }
  scene.diagnostics.unshift(...evaluated.diagnostics);
  if (!scene.root) return { scene, svg: null };
  return { scene, svg: renderSvg(scene, options) };
}

export async function renderFile(entry, output, options = {}) {
  const result = await solveFile(entry, options);
  if (!result.svg) throw new Error(`could not render ${entry}`);
  await writeFile(path.resolve(output), result.svg, "utf8");
  return result;
}
