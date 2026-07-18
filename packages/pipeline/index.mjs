import path from "node:path";
import { pathToFileURL } from "node:url";
import { evaluateFile } from "../compiler/index.mjs";
import { project } from "../../experiments/layouter/src/project.mjs";
import { solveExpanded } from "../../experiments/layouter/src/pipeline.mjs";
import { renderSvgScene, serializeSvgScene } from "../../experiments/layouter/src/svg.mjs";

const ARTIFACT_VERSION = "0.1.0";

function serializable(value) {
  const encoded = JSON.stringify(value);
  return encoded === undefined ? null : JSON.parse(encoded);
}

function assertArtifact(artifact, schema) {
  if (artifact?.schema !== schema || artifact.version !== ARTIFACT_VERSION) {
    throw new Error(`expected ${schema}@${ARTIFACT_VERSION}, got ${artifact?.schema ?? "<missing>"}@${artifact?.version ?? "<missing>"}`);
  }
}

function diagnosticFailure(diagnostics) {
  return diagnostics.some((item) => item.severity === "error");
}

function diagnostics(...groups) {
  const unique = new Map();
  for (const item of groups.flat()) {
    const key = `${item.severity}:${item.code}:${item.message}:${item.path ?? ""}`;
    unique.set(key, item);
  }
  return [...unique.values()];
}

export async function normalizeFile(entry, options = {}) {
  const absoluteEntry = path.resolve(entry);
  options.progress?.("resolve");
  options.progress?.("transform");
  const evaluated = await evaluateFile(absoluteEntry, options.compiler);
  options.progress?.("expand");
  options.progress?.("normalize");
  return {
    schema: "kvisl.logical.prototype",
    version: ARTIFACT_VERSION,
    source: pathToFileURL(absoluteEntry).href,
    root: serializable(evaluated.expanded),
    dependencies: evaluated.dependencies,
    diagnostics: evaluated.diagnostics,
  };
}

export function materialize(logical, options = {}) {
  assertArtifact(logical, "kvisl.logical.prototype");
  options.progress?.("materialize");
  const projectionOptions = serializable(options.projection ?? {});
  const scene = project(logical.root, projectionOptions);
  const selectedViews = scene.objects
    .filter((object) => object.selectedView)
    .map((object) => ({ object: object.path, view: object.selectedView }));
  const projectionDiagnostics = diagnostics(logical.diagnostics, scene.diagnostics);
  return {
    schema: "kvisl.projection.prototype",
    version: ARTIFACT_VERSION,
    source: logical.source,
    root: logical.root,
    target: projectionOptions,
    selectedViews,
    dependencies: logical.dependencies,
    diagnostics: projectionDiagnostics,
  };
}

export function solve(projection, options = {}) {
  assertArtifact(projection, "kvisl.projection.prototype");
  options.progress?.("layout");
  options.progress?.("route");
  const result = solveExpanded(projection.root, projection.target);
  const solvedDiagnostics = diagnostics(projection.diagnostics, result.scene.diagnostics);
  return {
    schema: "kvisl.solved.prototype",
    version: ARTIFACT_VERSION,
    source: projection.source,
    target: projection.target,
    dependencies: projection.dependencies,
    diagnostics: solvedDiagnostics,
    scene: serializeSvgScene(result.scene),
  };
}

export function paint(solved, options = {}) {
  assertArtifact(solved, "kvisl.solved.prototype");
  options.progress?.("paint");
  return renderSvgScene(solved.scene, options.paint);
}

export async function render(entry, options = {}) {
  const logical = await normalizeFile(entry, options);
  const projection = materialize(logical, options);
  const solved = solve(projection, options);
  const output = paint(solved, options);
  return { logical, projection, solved, output, failed: diagnosticFailure(solved.diagnostics) };
}

export function hasErrors(artifact) {
  return diagnosticFailure(artifact.diagnostics ?? []);
}
