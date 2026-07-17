import { build } from "esbuild";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { CORE } from "./authoring.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const authoring = path.join(here, "authoring.mjs");
const jsxRuntime = path.join(here, "jsx-runtime.mjs");

const aliasPlugin = {
  name: "kvisl-layouter-authoring",
  setup(builder) {
    builder.onResolve({ filter: /^@kvisl\/core\/jsx-runtime$/ }, () => ({ path: jsxRuntime }));
    builder.onResolve({ filter: /^@kvisl\/core$/ }, () => ({ path: authoring }));
  },
};

function asExpandedChildren(original, expanded) {
  if (original == null) return undefined;
  if (Array.isArray(original)) return expanded;
  return expanded.length === 1 ? expanded[0] : expanded;
}

function expandList(value, diagnostics) {
  if (value == null || value === false || value === true) return [];
  if (Array.isArray(value)) return value.flatMap((item) => expandList(item, diagnostics));
  const expanded = expandValue(value, diagnostics);
  return Array.isArray(expanded) ? expanded.flatMap((item) => expandList(item, diagnostics)) : [expanded];
}

function expandValue(value, diagnostics) {
  if (!value?.$$jsx) return value;

  const { type, props = {} } = value;
  if (typeof type === "function") {
    const children = expandList(props.children, diagnostics);
    try {
      return expandValue(type({ ...props, children: asExpandedChildren(props.children, children) }), diagnostics);
    } catch (cause) {
      diagnostics.push({
        severity: "error",
        code: "component-evaluation",
        message: cause instanceof Error ? cause.message : String(cause),
      });
      return null;
    }
  }

  if (typeof type === "symbol") return expandList(props.children, diagnostics);
  if (type?.[CORE]) {
    return {
      core: type[CORE],
      props: Object.fromEntries(Object.entries(props).filter(([key]) => key !== "children")),
      children: expandList(props.children, diagnostics),
    };
  }

  diagnostics.push({ severity: "error", code: "unknown-element", message: "unknown JSX element type" });
  return null;
}

export async function evaluateFile(entry) {
  const absoluteEntry = path.resolve(entry);
  const result = await build({
    entryPoints: [absoluteEntry],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    target: "es2022",
    jsx: "automatic",
    jsxImportSource: "@kvisl/core",
    plugins: [aliasPlugin],
    sourcemap: "inline",
  });
  const code = result.outputFiles[0].text;
  const source = `${pathToFileURL(absoluteEntry).href}?prototype=${Date.now()}`;
  const url = `data:text/javascript;base64,${Buffer.from(`${code}\n//# sourceURL=${source}`).toString("base64")}`;
  const module = await import(url);
  const diagnostics = [];
  const expanded = expandValue(module.default, diagnostics);
  return { expanded, diagnostics };
}
