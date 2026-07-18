import assert from "node:assert/strict";
import { mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { evaluateFile } from "../packages/compiler/index.mjs";

test("HTTPS TSX dependencies lock and render from the offline content cache", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "kvisl-remote-"));
  const cacheDirectory = path.join(directory, "cache");
  const lockFile = path.join(directory, "kvisl.lock.json");
  const remote = "https://components.example.test/component.tsx";
  const entry = path.join(directory, "diagram.tsx");
  await writeFile(entry, `import { Diagram } from "@kvisl/core";\nimport { Remote } from ${JSON.stringify(remote)};\nexport default <Diagram id="remote-test"><Remote /></Diagram>;\n`);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (url === remote) {
      return new Response(null, { status: 302, headers: { location: "/v1/component.tsx" } });
    }
    if (url === "https://components.example.test/v1/component.tsx") {
      return new Response(`import { Node } from "@kvisl/core";\nimport { label } from "./label.ts";\nexport function Remote() { return <Node id="remote" label={label} />; }\n`, {
        headers: { "content-type": "text/tsx" },
      });
    }
    if (url === "https://components.example.test/v1/label.ts") {
      return new Response(`export const label = "remote component";\n`, {
        headers: { "content-type": "text/typescript" },
      });
    }
    return new Response("not found", { status: 404 });
  };
  try {
    const online = await evaluateFile(entry, { cacheDirectory, lockFile, updateLock: true });
    assert.equal(online.expanded.children[0].props.label, "remote component");
    assert.ok(online.dependencies.some((dependency) => dependency.requested === remote));
    const lock = JSON.parse(await readFile(lockFile, "utf8"));
    assert.equal(Object.keys(lock.dependencies).length, 2);

    globalThis.fetch = async () => {
      throw new Error("offline compilation attempted a network fetch");
    };
    const offline = await evaluateFile(entry, { cacheDirectory, lockFile, offline: true });
    assert.deepEqual(offline.expanded, online.expanded);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("remote source dependencies reject unencrypted HTTP", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "kvisl-http-"));
  const entry = path.join(directory, "diagram.tsx");
  await writeFile(entry, `import { Remote } from "http://components.example.test/component.tsx";\nexport default <Remote />;\n`);
  await assert.rejects(evaluateFile(entry), /remote dependencies require HTTPS/);
});

test("npm specifiers resolve through the project Node dependency graph", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "kvisl-npm-"));
  await symlink(path.resolve("node_modules"), path.join(directory, "node_modules"), "dir");
  const entry = path.join(directory, "diagram.tsx");
  await writeFile(entry, `import { Diagram, Node } from "@kvisl/core";\nimport YAML from "npm:yaml@2.9.0";\nconst label = YAML.parse("label: npm dependency").label;\nexport default <Diagram id="npm-test"><Node id="node" label={label} /></Diagram>;\n`);
  const evaluated = await evaluateFile(entry);
  assert.equal(evaluated.expanded.children[0].props.label, "npm dependency");
  assert.ok(evaluated.dependencies.some((dependency) => dependency.requested === "npm:yaml@2.9.0"));
});

test("jsr specifiers lower to the canonical JSR module URL without Deno", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "kvisl-jsr-"));
  const entry = path.join(directory, "diagram.tsx");
  await writeFile(entry, `import { Diagram } from "@kvisl/core";\nimport { Remote } from "jsr:@example/diagram@1.2.3";\nexport default <Diagram id="jsr-test"><Remote /></Diagram>;\n`);
  const expected = "https://jsr.io/@example/diagram/1.2.3/mod.ts";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.equal(url, expected);
    return new Response(`import { Node } from "@kvisl/core";\nimport { jsx } from "@kvisl/core/jsx-runtime";\nexport function Remote() { return jsx(Node, { id: "remote", label: "JSR" }); }\n`, {
      headers: { "content-type": "text/typescript" },
    });
  };
  try {
    const evaluated = await evaluateFile(entry, { cacheDirectory: path.join(directory, "cache") });
    assert.equal(evaluated.expanded.children[0].props.label, "JSR");
    assert.ok(evaluated.dependencies.some((dependency) => dependency.requested === expected));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a stylesheet import is inert until attached and then diagnoses the open grammar", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "kvisl-css-"));
  await writeFile(path.join(directory, "theme.kvisl.css"), `.service { stroke: blue; }\n`);
  const inert = path.join(directory, "inert.tsx");
  await writeFile(inert, `import { Diagram } from "@kvisl/core";\nimport theme from "./theme.kvisl.css";\nvoid theme;\nexport default <Diagram id="inert" />;\n`);
  assert.deepEqual((await evaluateFile(inert)).diagnostics, []);

  const attached = path.join(directory, "attached.tsx");
  await writeFile(attached, `import { Diagram } from "@kvisl/core";\nimport theme from "./theme.kvisl.css";\nexport default <Diagram id="attached" styles={theme} />;\n`);
  const evaluated = await evaluateFile(attached);
  assert.ok(evaluated.diagnostics.some((diagnostic) => diagnostic.code === "stylesheet-syntax-not-frozen"));
});
