import assert from "node:assert/strict";
import { test } from "node:test";
import { layout } from "../src/layout.mjs";
import { project } from "../src/project.mjs";

function primitive(core, props = {}, children = []) {
  return { core, props, children };
}

function text(value) {
  return primitive("text", {}, [value]);
}

test("the projected theme supplies hand-drawn architecture node floors", () => {
  const scene = project(primitive("diagram", { id: "themed", theme: "excalidraw-handdrawn" }, [
    primitive("scope", { id: "system" }, [
      primitive("node", { id: "small" }, [text("x")]),
      primitive("node", { id: "explicit", style: { minWidth: 180, minHeight: 90 } }, [text("x")]),
      primitive("node", { id: "compact", style: { minWidth: 84, minHeight: 44 } }, [text("x")]),
      primitive("node", { id: "content" }, [text("A label whose intrinsic width exceeds the theme floor")]),
    ]),
  ]));

  layout(scene);

  const small = scene.objectByPath.get("system/small");
  const explicit = scene.objectByPath.get("system/explicit");
  const compact = scene.objectByPath.get("system/compact");
  const content = scene.objectByPath.get("system/content");
  assert.equal(scene.theme, "excalidraw-handdrawn");
  assert.equal(small.theme, "excalidraw-handdrawn");
  assert.ok(small.box.width >= 220 && small.box.height >= 60);
  assert.ok(explicit.box.width >= 180 && explicit.box.height >= 90);
  assert.ok(compact.box.width < 220 && compact.box.height < 60);
  assert.ok(content.box.width > 220);
});

test("fixed shapes do not receive hand-drawn architecture node floors", () => {
  const scene = project(primitive("diagram", { id: "fixed", theme: "excalidraw-handdrawn" }, [
    primitive("node", { id: "start", shape: "initial" }),
  ]));

  layout(scene);

  const start = scene.objectByPath.get("start");
  assert.ok(start.box.width < 220);
  assert.ok(start.box.height < 60);
});

test("titles and subtitles wrap only at authored newlines on an infinite canvas", () => {
  const subtitle = "Micro-scheduler above Kubernetes: persistent worker Pods, logical actors, gVisor/runsc checkpoint/restore, Valkey runtime state.";
  const scene = project(primitive("diagram", { id: "headings" }, [
    primitive("title", { id: "title" }, [text("A deliberately long title that remains intrinsic instead of wrapping at an arbitrary character count")]),
    primitive("subtitle", { id: "subtitle" }, [text(subtitle)]),
    primitive("subtitle", { id: "explicit" }, [text("first line\nsecond line")]),
  ]));

  layout(scene);

  assert.deepEqual(scene.objectByPath.get("title").renderLines.map((line) => line.text), [
    "A deliberately long title that remains intrinsic instead of wrapping at an arbitrary character count",
  ]);
  assert.deepEqual(scene.objectByPath.get("subtitle").renderLines.map((line) => line.text), [subtitle]);
  assert.deepEqual(scene.objectByPath.get("explicit").renderLines.map((line) => line.text), ["first line", "second line"]);
});
