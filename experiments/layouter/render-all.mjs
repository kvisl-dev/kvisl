#!/usr/bin/env node

import { mkdir, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";
import { renderFile } from "./src/pipeline.mjs";
import { analyzeScene } from "./src/quality.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.dirname(path.dirname(here));
const examples = path.join(repo, "examples");
const output = path.join(here, "output");

function escape(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

async function entries() {
  const files = await readdir(examples, { recursive: true });
  return files.filter((file) => file.endsWith("diagram.tsx")).sort().map((file) => path.join(examples, file));
}

function card(result) {
  const original = path.join(path.dirname(result.entry), "original.png");
  const originalRelative = path.relative(output, original);
  const hasOriginal = result.entry.split(path.sep).at(-2) !== "uml" && !result.entry.includes(`${path.sep}coverage${path.sep}`);
  const diagnostics = result.scene.diagnostics.length
    ? `<details><summary>${result.scene.diagnostics.length} diagnostics</summary><pre>${escape(result.scene.diagnostics.map((item) => `${item.severity}: ${item.code}: ${item.message}`).join("\n"))}</pre></details>`
    : "<p class=ok>preview emitted without diagnostics</p>";
  const quality = result.quality;
  return `<article>
    <h2>${escape(result.name)}</h2>
    <p>${result.scene.objects.length} objects · ${result.scene.lines.length} lines · ${result.scene.width}×${result.scene.height}</p>
    <p class="${quality.routeObjectIntersections.length ? "bad" : "ok"}">
      ${quality.unexpectedObjectOverlaps.length} object overlaps ·
      ${quality.routeObjectIntersections.length} route–object intersections ·
      ${quality.labelObjectOverlaps.length} label–object overlaps ·
      ${quality.labelLabelOverlaps.length} label–label overlaps ·
      ${quality.unexpectedRouteOverlaps.length} unexpected shared runs ·
      ${quality.routeCrossings.length} crossings
    </p>
    <div class="comparison">
      ${hasOriginal ? `<figure><figcaption>Original</figcaption><img src="${escape(originalRelative)}" alt="Original ${escape(result.name)}"></figure>` : ""}
      <figure><figcaption>Prototype SVG</figcaption><img src="${escape(result.name)}.svg" alt="Prototype ${escape(result.name)}"></figure>
    </div>
    ${diagnostics}
  </article>`;
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
  const { scene } = await renderFile(entry, destination);
  const quality = analyzeScene(scene);
  results.push({ entry, name, scene, quality });
  console.log(`${name}: ${scene.width}x${scene.height}, ${scene.diagnostics.length} diagnostics, ${quality.unexpectedObjectOverlaps.length}/${quality.routeObjectIntersections.length}/${quality.labelObjectOverlaps.length}/${quality.labelLabelOverlaps.length}/${quality.unexpectedRouteOverlaps.length} object/route/object-label/label-label/shared-run conflicts, ${quality.routeCrossings.length} crossings`);
}

const html = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Kvísl layouter comparison gallery</title>
<style>
  :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
  body { margin: 0 auto; max-width: 1800px; padding: 28px; background: Canvas; color: CanvasText; }
  h1 { margin-bottom: 4px; } article { margin: 40px 0 72px; }
  .comparison { display: grid; grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); gap: 24px; align-items: start; }
  figure { margin: 0; } figcaption { margin: 0 0 8px; font-weight: 700; }
  img { display: block; box-sizing: border-box; width: 100%; max-height: 82vh; object-fit: contain; object-position: top; background: white; border: 1px solid color-mix(in srgb, CanvasText 20%, transparent); }
  pre { overflow: auto; } .ok { color: #16803a; } .bad { color: #c62d2d; }
</style>
<h1>Kvísl layouter comparison gallery</h1>
<p>Generated from the repository TSX fixtures. Original images are references, not pixel targets.</p>
${results.map(card).join("\n")}
</html>`;
await writeFile(path.join(output, "index.html"), html, "utf8");
console.log(`gallery: ${path.join(output, "index.html")}`);
