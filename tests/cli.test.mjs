import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { promisify } from "node:util";

const execute = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "bin/kvisl.mjs");

async function fixture(directory) {
  const entry = path.join(directory, "diagram.tsx");
  await writeFile(entry, `import { Diagram, Node } from "@kvisl/core";\nexport default <Diagram id="smoke"><Node id="hello" label="Hello from npx" /></Diagram>;\n`);
  return entry;
}

test("the public CLI runs the same SVG through separate serializable stages", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "kvisl-cli-"));
  const entry = await fixture(directory);
  const direct = path.join(directory, "direct.svg");
  const logical = path.join(directory, "logical.yaml");
  const projection = path.join(directory, "projection.json");
  const solved = path.join(directory, "solved.json");
  const staged = path.join(directory, "staged.svg");
  await execute(process.execPath, [cli, "render", entry, "-o", direct]);
  await execute(process.execPath, [cli, "normalize", entry, "-o", logical]);
  await execute(process.execPath, [cli, "materialize", logical, "-o", projection]);
  await execute(process.execPath, [cli, "solve", projection, "-o", solved]);
  await execute(process.execPath, [cli, "paint", solved, "-o", staged]);
  assert.equal(await readFile(staged, "utf8"), await readFile(direct, "utf8"));
});

test("the reserved Excalidraw target fails with a structured diagnostic", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "kvisl-excalidraw-"));
  const entry = await fixture(directory);
  await assert.rejects(
    execute(process.execPath, [cli, "render", entry, "-o", path.join(directory, "diagram.excalidraw"), "--diagnostics", "json"]),
    (error) => {
      const diagnostic = JSON.parse(error.stderr.trim());
      assert.equal(diagnostic.schema, "kvisl.diagnostics");
      assert.match(diagnostic.diagnostics[0].message, /not implemented/);
      return true;
    },
  );
});

test("an npm tarball exposes an npx-discoverable kvisl binary", { timeout: 30_000 }, async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "kvisl-pack-"));
  const packDirectory = path.join(directory, "pack");
  const unpackDirectory = path.join(directory, "unpacked");
  const workDirectory = path.join(directory, "work");
  const cacheDirectory = path.join(directory, "npm-cache");
  await mkdir(packDirectory);
  await mkdir(unpackDirectory);
  await mkdir(path.join(workDirectory, "node_modules/.bin"), { recursive: true });
  const environment = { ...process.env, npm_config_cache: cacheDirectory };
  const packed = await execute("npm", ["pack", "--pack-destination", packDirectory], { cwd: root, env: environment });
  const tarball = path.join(packDirectory, packed.stdout.trim().split("\n").at(-1));
  await execute("tar", ["-xzf", tarball, "-C", unpackDirectory]);
  const unpackedPackage = path.join(unpackDirectory, "package");
  await symlink(path.join(root, "node_modules"), path.join(unpackedPackage, "node_modules"), "dir");
  await symlink(path.join(unpackedPackage, "bin/kvisl.mjs"), path.join(workDirectory, "node_modules/.bin/kvisl"));
  await fixture(workDirectory);
  await execute("npx", ["--no-install", "kvisl", "render", "diagram.tsx", "-o", "diagram.svg"], { cwd: workDirectory, env: environment });
  const svg = await readFile(path.join(workDirectory, "diagram.svg"), "utf8");
  assert.match(svg, /Hello from npx/);
});
