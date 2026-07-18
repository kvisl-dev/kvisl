// Golden and diagnostic tests for the Core-profile normalizer slice.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { test } from "node:test";
import { normalizeFile } from "../tools/normalize.mjs";

const repo = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test("coverage fixture normalizes to the golden Logical IR", async () => {
  const { ir, diagnostics } = await normalizeFile(path.join(repo, "examples/coverage/diagram.tsx"));
  assert.deepEqual(diagnostics, []);
  const golden = JSON.parse(await readFile(path.join(repo, "examples/coverage/logical.json"), "utf8"));
  assert.deepEqual(ir, golden);
});

test("normalization is deterministic", async () => {
  const first = await normalizeFile(path.join(repo, "examples/coverage/diagram.tsx"));
  const second = await normalizeFile(path.join(repo, "examples/coverage/diagram.tsx"));
  assert.equal(JSON.stringify(first.ir), JSON.stringify(second.ir));
});

test("coverage fixture preserves the headline features", async () => {
  const { ir } = await normalizeFile(path.join(repo, "examples/coverage/diagram.tsx"));
  const entity = (pred) => ir.entities.find(pred);

  // layout orientation and its explicit cascade depth survive normalization
  assert.equal(entity((e) => e.id === "rotated").orientation, 90);
  assert.equal(entity((e) => e.id === "rotated").orientationDepth, 2);

  // both audit lines share one explicit group and pin the same gap region
  const audits = ir.entities.filter((e) => e.kind === "line" && e.share?.source.id === "audit");
  assert.equal(audits.length, 2);
  const throughs = audits.map((line) =>
    ir.entities.find((e) => e.kind === "segment" && e.line === line.key && e.form.kind === "through"),
  );
  assert.deepEqual(throughs[0].form.region, throughs[1].form.region);

  // entity-only ends own line-scoped docks and never share an identity
  const owned = ir.entities
    .filter((e) => e.kind === "line")
    .flatMap((line) => line.ends.filter((end) => end.dock.kind === "line-owned").map((end) => end.dock));
  const identities = new Set(owned.map((d) => `${d.line}/${d.end}`));
  assert.equal(identities.size, owned.length);

  // the separate-affinity port group lists both probe ports
  const group = entity((e) => e.kind === "port-group" && e.id === "probes");
  assert.equal(group.affinity, "separate");
  assert.equal(group.members.length, 2);

  // tokens and rules land in the document layer
  assert.ok(entity((e) => e.kind === "token-set" && e.values["flow-blue"]));
  assert.equal(ir.entities.filter((e) => e.kind === "rule").length, 3);
});

test("strictPorts turns a port typo into a diagnostic", async () => {
  const { diagnostics } = await normalizeFile(path.join(repo, "tests/fixtures/strict-ports-typo.tsx"));
  assert.ok(diagnostics.some((d) => d.code === "strict-ports" && d.message.includes("reqest")));
});
