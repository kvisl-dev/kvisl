#!/usr/bin/env node

import { mkdir, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";
import { renderFile } from "./src/pipeline.mjs";
import { analyzeScene, perceptionMetrics } from "./src/quality.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.dirname(path.dirname(here));
const examples = path.join(repo, "examples");
const debugRouting = process.argv.includes("--debug-routing");
const output = path.join(here, "output", ...(debugRouting ? ["routing-debug"] : []));

function escape(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

async function entries() {
  const files = await readdir(examples, { recursive: true });
  return files.filter((file) => file.endsWith("diagram.tsx")).sort().map((file) => path.join(examples, file));
}

function markdownCard(result) {
  const original = path.join(path.dirname(result.entry), "original.png");
  const originalRelative = path.relative(output, original).split(path.sep).join("/");
  const hasOriginal = result.entry.split(path.sep).at(-2) !== "uml" && !result.entry.includes(`${path.sep}coverage${path.sep}`);
  const quality = result.quality;
  const perception = result.perception;
  const comparison = hasOriginal
    ? `<table>
  <tr><th>Original</th><th>Prototype SVG</th></tr>
  <tr>
    <td><img src="${escape(originalRelative)}" alt="Original ${escape(result.name)}" width="100%"></td>
    <td><img src="./${escape(result.name)}.svg" alt="Prototype ${escape(result.name)}" width="100%"></td>
  </tr>
</table>`
    : `<p align="center"><img src="./${escape(result.name)}.svg" alt="Prototype ${escape(result.name)}" width="90%"></p>`;
  const diagnostics = result.scene.diagnostics.length
    ? `<details>
<summary>${result.scene.diagnostics.length} diagnostics</summary>

<pre>${escape(result.scene.diagnostics.map((item) => `${item.severity}: ${item.code}: ${item.message}`).join("\n"))}</pre>
</details>`
    : "✅ Preview emitted without diagnostics.";
  return `## ${result.name}

${result.scene.objects.length} objects · ${result.scene.lines.length} lines · ${result.scene.width}×${result.scene.height}

**Structural quality:** ${quality.layoutContractViolations.length} layout contract violations · ${quality.unexpectedObjectOverlaps.length} object overlaps · ${quality.routeObjectIntersections.length} route–object intersections · ${quality.labelObjectOverlaps.length} label–object overlaps · ${quality.labelLabelOverlaps.length} label–label overlaps · ${quality.labelRouteOverlaps.length} label–route overlaps · ${quality.unexpectedRouteOverlaps.length} unexpected shared runs · ${quality.routeCrossings.length} crossings · ${quality.routeTitleCrossings.length} title crossings · ${quality.labelDecorOverlaps.length} label–decor overlaps

**Perception:** ${perception.bendsPerLine.toFixed(2)} bends/line (max ${perception.maxBends}) · detour ×${perception.detourFactor.toFixed(2)} · backtrack ${(perception.backtrackRatio * 100).toFixed(0)}% · ${perception.guidesX}/${perception.guidesY} x/y guides for ${perception.boxCount} boxes · peer-size CV ${perception.peerSizeCV.toFixed(2)} · gap CV ${perception.gapCV.toFixed(2)} · label offset ${perception.labelDisplacement.toFixed(1)}px

${comparison}

${diagnostics}`;
}

await mkdir(output, { recursive: true });
const results = [];
for (const entry of await entries()) {
  const relative = path.relative(examples, entry);
  const name = relative === "coverage/diagram.tsx"
    ? "coverage"
    : relative.startsWith(`uml${path.sep}`)
      ? `uml-${path.basename(entry, ".tsx").replace("-diagram", "")}`
      : path.basename(path.dirname(entry));
  const destination = path.join(output, `${name}.svg`);
  const { scene } = await renderFile(entry, destination, { debugRouting });
  const quality = analyzeScene(scene);
  const perception = perceptionMetrics(scene);
  results.push({ entry, name, scene, quality, perception });
  console.log(`${name}: ${scene.width}x${scene.height}, ${scene.diagnostics.length} diagnostics, ${quality.layoutContractViolations.length}/${quality.unexpectedObjectOverlaps.length}/${quality.routeObjectIntersections.length}/${quality.labelObjectOverlaps.length}/${quality.labelLabelOverlaps.length}/${quality.labelRouteOverlaps.length}/${quality.unexpectedRouteOverlaps.length}/${quality.routeTitleCrossings.length}/${quality.labelDecorOverlaps.length} layout/object/route/object-label/label-label/label-route/shared-run/title/label-decor conflicts, ${quality.routeCrossings.length} crossings, ${perception.bendsPerLine.toFixed(2)} bends/line, detour x${perception.detourFactor.toFixed(2)}, backtrack ${(perception.backtrackRatio * 100).toFixed(0)}%, guides ${perception.guidesX}/${perception.guidesY}, peer-size CV ${perception.peerSizeCV.toFixed(2)}, label offset ${perception.labelDisplacement.toFixed(1)}px`);
}

const markdown = `# Kvísl layouter ${debugRouting ? "routing-region debug" : "comparison"} gallery

Generated from the repository TSX fixtures. ${debugRouting ? "Complete channel-mesh cells are painted translucent red." : "Original images are references, not pixel targets."}

> This file is generated by \`npm run ${debugRouting ? "layout:examples:debug" : "layout:examples"}\`. Do not edit it by hand.

${results.map(markdownCard).join("\n\n")}
`;
await writeFile(path.join(output, "README.md"), markdown, "utf8");
console.log(`gallery: ${path.join(output, "README.md")}`);
