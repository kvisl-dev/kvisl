// CLI: transform a diagram.tsx with esbuild, evaluate it against the
// Excalmermaid JSX runtime, normalize, and print canonical Logical IR JSON.
//
//   node tools/normalize.mjs examples/coverage/diagram.tsx

import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";
import { normalize } from "../packages/normalizer/index.mjs";

const repo = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const corePkg = path.join(repo, "packages", "core");

// map the published package name onto the in-repo sources
const aliasPlugin = {
  name: "excalmermaid-alias",
  setup(b) {
    b.onResolve({ filter: /^@excalmermaid\/core\/jsx-runtime$/ }, () => ({
      path: path.join(corePkg, "jsx-runtime.mjs"),
    }));
    b.onResolve({ filter: /^@excalmermaid\/core$/ }, () => ({
      path: path.join(corePkg, "index.mjs"),
    }));
  },
};

export async function normalizeFile(entry) {
  const result = await build({
    entryPoints: [path.resolve(entry)],
    bundle: true,
    write: false,
    format: "esm",
    jsx: "automatic",
    jsxImportSource: "@excalmermaid/core",
    plugins: [aliasPlugin],
  });
  const code = result.outputFiles[0].text;
  const url = `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
  const module = await import(url);
  return normalize(module.default);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const entry = process.argv[2];
  if (!entry) {
    console.error("usage: node tools/normalize.mjs <diagram.tsx>");
    process.exit(2);
  }
  const { ir, diagnostics } = await normalizeFile(entry);
  for (const d of diagnostics) console.error(`${d.severity}: ${d.code}: ${d.message}`);
  if (!ir || diagnostics.some((d) => d.severity === "error")) process.exit(1);
  console.log(JSON.stringify(ir, null, 2));
}
