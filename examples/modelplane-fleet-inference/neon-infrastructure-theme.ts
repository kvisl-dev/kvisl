import { kind, role, rule, tokens } from "@kvisl/core";

const uiFont = "Inter, ui-sans-serif, system-ui, sans-serif";

export const neonInfrastructureTheme = [
  tokens({
    canvas: "#100d2e",
    panel: "#17133d",
    "panel-violet": "#1d1b4f",
    surface: "#211a4d",
    "text-primary": "#f8f7ff",
    "text-muted": "#b7b2d6",
    ink: "#f8f7ff",
    "muted-gray": "#aaa4c7",
    "status-gray": "#aaa4c7",
    "structural-gray": "#aaa4c7",
    "ml-green": "#2dd4bf",
    "platform-blue": "#38bdf8",
    "composition-yellow": "#fbbf24",
    "reconcile-orange": "#fb7185",
    "request-purple": "#a855f7",
    "external-pink": "#f472b6",
    "locality-cyan": "#22d3ee",
    "pale-green": "#0d2f36",
    "pale-blue": "#1d214f",
    "pale-yellow": "#35270f",
    "pale-orange": "#351a32",
    "warm-white": "#241734",
    "pale-purple": "#2b194d",
    "near-white": "#1b1938",
    white: "#f8f7ff",
  }),
  rule(kind("diagram"), {
    fill: "canvas",
    color: "text-primary",
    fontFamily: uiFont,
  }),
  rule(kind("scope"), {
    fill: "panel",
    color: "text-primary",
    fontFamily: uiFont,
    strokeWidth: 2,
    roughness: 0,
  }),
  rule(role("control-plane"), { fill: "panel-violet" }),
  rule(role("inference-fleet"), { fill: "panel-violet" }),
  rule(kind("node"), {
    fill: "surface",
    color: "text-primary",
    fontFamily: uiFont,
    strokeWidth: 2,
    roughness: 0,
  }),
  rule(kind("note"), {
    fill: "surface",
    color: "text-muted",
    fontFamily: uiFont,
  }),
  rule(kind("title"), {
    color: "text-primary",
    fontFamily: uiFont,
  }),
  rule(kind("subtitle"), {
    color: "text-muted",
    fontFamily: uiFont,
  }),
  rule(kind("legend-item"), {
    color: "text-primary",
    fontFamily: uiFont,
  }),
  rule(kind("line"), {
    fontFamily: uiFont,
    roughness: 0,
  }),
];
