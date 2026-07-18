// Tolerant authoring surface for the layout experiment. The production core
// remains intentionally smaller; these inert markers let every design fixture
// reach the prototype projection without claiming normalizer completeness.

export const CORE = Symbol.for("kvisl.prototype.core");

function marker(kind) {
  return Object.freeze({ [CORE]: kind });
}

export const Diagram = marker("diagram");
export const Scope = marker("scope");
export const Node = marker("node");
export const Text = marker("text");
export const Image = marker("image");
export const Compartment = marker("compartment");
export const Row = marker("row");
export const Column = marker("column");
export const Grid = marker("grid");
export const Port = marker("port");
export const PortGroup = marker("port-group");
export const PortPlacement = marker("port-placement");
export const Line = marker("line");
export const Segment = marker("segment");
export const End = marker("end");
export const Corridor = marker("corridor");
export const Constraint = marker("constraint");
export const Note = marker("note");
export const Title = marker("title");
export const Subtitle = marker("subtitle");
export const Legend = marker("legend");
export const LegendItem = marker("legend-item");
export const View = marker("view");
export const When = marker("when");

export const self = Object.freeze({ $$self: true });

export function gap(a, b) {
  return { $$region: "gap", between: [a, b] };
}

export function padding(container, side) {
  return { $$region: "padding", container, side };
}

export function role(name) {
  return { steps: [{ roles: [name] }] };
}

export function cls(name) {
  return { steps: [{ classes: [name] }] };
}

export function kind(name) {
  return { steps: [{ kind: name }] };
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

export function context(key) {
  return { kind: "context", key };
}

function literal(value) {
  return value?.kind === "context" ? value : { kind: "literal", value };
}

function compare(operator, left, right) {
  return { kind: "compare", operator, left: literal(left), right: literal(right) };
}

export const eq = (left, right) => compare("eq", left, right);
export const ne = (left, right) => compare("ne", left, right);
export const lt = (left, right) => compare("lt", left, right);
export const lte = (left, right) => compare("lte", left, right);
export const gt = (left, right) => compare("gt", left, right);
export const gte = (left, right) => compare("gte", left, right);

export function ref(path) {
  const value = {
    $$ref: path,
    port(id) {
      return `${path}.${id}`;
    },
    toString() {
      return path;
    },
  };
  return Object.freeze(value);
}
