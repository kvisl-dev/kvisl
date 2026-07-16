// Kvísl JSX runtime: creates immutable authoring expressions.
// No React, no reconciliation, no DOM — expansion happens in the normalizer.

export function jsx(type, props, key) {
  return { $$jsx: true, type, props: props ?? {}, key };
}

export const jsxs = jsx;
export const jsxDEV = jsx;

export const Fragment = Symbol.for("kvisl.fragment");
