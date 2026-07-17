import { writeFile } from "node:fs/promises";
import path from "node:path";
import { evaluateFile } from "./evaluate.mjs";
import { layout } from "./layout.mjs";
import { project } from "./project.mjs";
import { route } from "./route.mjs";
import { renderSvg } from "./svg.mjs";

export async function solveFile(entry, options = {}) {
  const evaluated = await evaluateFile(entry);
  const scene = project(evaluated.expanded, options);
  scene.diagnostics.unshift(...evaluated.diagnostics);
  if (!scene.root) return { scene, svg: null };
  layout(scene);
  route(scene);
  return { scene, svg: renderSvg(scene, options) };
}

export async function renderFile(entry, output, options = {}) {
  const result = await solveFile(entry, options);
  if (!result.svg) throw new Error(`could not render ${entry}`);
  await writeFile(path.resolve(output), result.svg, "utf8");
  return result;
}
