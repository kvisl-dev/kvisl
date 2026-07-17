import assert from "node:assert/strict";
import { test } from "node:test";
import { renderSvg } from "../src/svg.mjs";

function sceneWithLabel(label) {
  return {
    width: 320,
    height: 180,
    root: { id: "label-painter" },
    diagnostics: [],
    tokens: {},
    objects: [],
    corridors: [],
    lines: [{
      id: "request",
      style: { stroke: "#2563eb" },
      heads: "none",
      route: [{ x: 20, y: 90 }, { x: 300, y: 90 }],
      routeLabels: [label],
    }],
  };
}

test("line labels paint at their solved center without an opaque background rectangle", () => {
  const svg = renderSvg(sceneWithLabel({
    text: "a deliberately long label",
    box: { x: 80, y: 62, width: 42, height: 22 },
    angle: 0,
  }), { transparent: true });

  assert.doesNotMatch(svg, /<rect/);
  assert.match(svg, /<g data-line-label="request">/);
  assert.match(svg, /<text x="101" y="78"/);
  assert.match(svg, /paint-order="stroke fill"/);
});

test("rotated multiline labels keep the solved center as their painter origin", () => {
  const svg = renderSvg(sceneWithLabel({
    text: "first\nsecond",
    x: 137,
    y: 91,
    box: { x: 118, y: 46, width: 38, height: 90 },
    angle: 90,
  }), { transparent: true });

  assert.match(svg, /transform="rotate\(90 137 91\)"/);
  assert.match(svg, /<text x="137" y="88"/);
  assert.match(svg, /<text x="137" y="104"/);
  assert.equal((svg.match(/stroke="#ffffff"/g) ?? []).length, 2);
});
