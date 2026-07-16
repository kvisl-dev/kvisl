// Kvísl authoring surface — the Core-profile subset used by the
// normalizer slice. Core components are inert markers; the normalizer
// interprets them after component expansion.

export const CORE = Symbol.for("kvisl.core");

function coreType(kind) {
  return Object.freeze({ [CORE]: kind });
}

// structural objects (Node/Scope/Diagram are sugar over one object primitive)
export const Diagram = coreType("diagram");
export const Scope = coreType("scope");
export const Node = coreType("node");
export const Text = coreType("text");
export const Compartment = coreType("compartment");

// layout containers (addressable objects with a default layout strategy)
export const Row = coreType("row");
export const Column = coreType("column");
export const Grid = coreType("grid");

// ports, lines, routing
export const Port = coreType("port");
export const PortGroup = coreType("port-group");
export const Line = coreType("line");
export const Segment = coreType("segment");
export const End = coreType("end");
export const Corridor = coreType("corridor");
export const Constraint = coreType("constraint");
export const Note = coreType("note");

// region references; `self` resolves to the declaring component's root
export const self = Object.freeze({ $$self: true });

export function gap(a, b) {
  return { $$region: "gap", between: [a, b] };
}

export function padding(container, side) {
  return { $$region: "padding", container, side };
}

// selectors and rules
export function role(name) {
  return { steps: [{ roles: [name] }] };
}

export function cls(name) {
  return { steps: [{ classes: [name] }] };
}

export function within(outer, inner) {
  return { steps: [...outer.steps, ...inner.steps], combinators: ["descendant"] };
}

export function rule(selector, declarations, condition) {
  return { $$rule: true, selector, declarations, condition };
}

export function tokens(values) {
  return { $$tokens: values };
}

// shared condition model (used by conditional rules; Adaptive reuses it)
export function context(key) {
  return { kind: "context", key };
}

function literal(value) {
  return value != null && value.kind === "context" ? value : { kind: "literal", value };
}

function compare(operator, left, right) {
  return { kind: "compare", operator, left: literal(left), right: literal(right) };
}

export const eq = (l, r) => compare("eq", l, r);
export const ne = (l, r) => compare("ne", l, r);
export const lt = (l, r) => compare("lt", l, r);
export const lte = (l, r) => compare("lte", l, r);
export const gt = (l, r) => compare("gt", l, r);
export const gte = (l, r) => compare("gte", l, r);
