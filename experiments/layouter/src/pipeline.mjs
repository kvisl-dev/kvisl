import { writeFile } from "node:fs/promises";
import path from "node:path";
import { evaluateFile } from "./evaluate.mjs";
import { layout } from "./layout.mjs";
import { project } from "./project.mjs";
import { escalateLabelReservations } from "./quality.mjs";
import { route } from "./route.mjs";
import { renderSvg } from "./svg.mjs";

export async function solveFile(entry, options = {}) {
  const evaluated = await evaluateFile(entry);
  // corridors start at bare track width; when a label proves it has no free
  // spot, its corridor reservation escalates and the scene solves again
  const labelReservations = new Map();
  let scene = project(evaluated.expanded, options);
  if (scene.root) {
    for (let attempt = 0; ; attempt += 1) {
      scene.labelReservations = labelReservations;
      layout(scene);
      route(scene);
      if (attempt >= 7 || !escalateLabelReservations(scene, labelReservations)) break;
      scene = project(evaluated.expanded, options);
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
