export function jsx(type, props, key) {
  return { $$jsx: true, type, props: props ?? {}, key };
}

export const jsxs = jsx;
export const jsxDEV = jsx;
export const Fragment = Symbol.for("kvisl.prototype.fragment");
