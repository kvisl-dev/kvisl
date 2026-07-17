#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";
import { renderFile } from "./src/pipeline.mjs";

function parseArguments(argv) {
  const values = { entry: null, output: null };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--output" || argv[index] === "-o") values.output = argv[++index];
    else if (!values.entry) values.entry = argv[index];
  }
  return values;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { entry, output } = parseArguments(process.argv.slice(2));
  if (!entry) {
    console.error("usage: node experiments/layouter/render.mjs <diagram.tsx> [--output preview.svg]");
    process.exit(2);
  }
  const destination = output ?? path.join(process.cwd(), `${path.basename(path.dirname(entry))}.svg`);
  const { scene } = await renderFile(entry, destination);
  for (const diagnostic of scene.diagnostics) console.error(`${diagnostic.severity}: ${diagnostic.code}: ${diagnostic.message}`);
  console.log(`${entry} -> ${destination} (${scene.width}x${scene.height}, ${scene.objects.length} objects, ${scene.lines.length} lines)`);
}
