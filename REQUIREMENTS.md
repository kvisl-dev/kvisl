# Excalmermaid Requirements

Status: Working draft

This document states the requirements for Excalmermaid: the TSX authoring surface, its semantics, and the properties the toolchain must guarantee. The data model and the Logical IR shapes live in [MODEL.md](MODEL.md); the design rationale lives in [DESIGN.md](DESIGN.md). In this document, "grammar" means the TSX authoring surface: components, properties, references, and their semantics. Excalmermaid does not extend the TypeScript or TSX grammar.

The keywords **MUST**, **SHOULD**, and **MAY** indicate requirements, strong recommendations, and optional capabilities.

## 1. Goal of the authoring surface

The authoring surface MUST express general logical drawings without compiling diagram types into the core. It MUST support both small sketches and deeply nested system diagrams.

In particular, the surface MUST provide:

- reusable high-level components as ordinary TypeScript functions;
- recursive expansion to a small set of core primitives;
- relative identities and references;
- independent containment, layout, routing, and paint-order relations;
- nested and composable layouts with local, rotatable orientation;
- routing through implicit whitespace regions — the gaps and padding bands that layout produces anyway — rather than through separately maintained geometry;
- composable components with opaque, symmetric ports;
- symmetric lines built from segments, most implicit, some explicitly pinned and labeled;
- shared paths only between explicitly joined lines, maximal by default;
- ordering as a soft source-order preference rather than a hard rule;
- versioned, language-neutral Logical IR for Go, Rust, and other consumers.

Pixel coordinates MUST NOT be the primary authoring abstraction. Fixed sizes, minimum sizes, and other geometric constraints MAY be supported. Absolute positions MAY eventually be added as an explicitly marked escape hatch, but ordinary diagrams must not require them.

## 2. TSX evaluation

### 2.1 Existing language

Diagrams MUST be valid TypeScript/TSX modules. Standard language features such as imports, functions, local variables, conditions, array operations, and generics MAY be used.

Excalmermaid MUST NOT parse a custom syntax embedded in TSX text. Meaning arises exclusively from:

- TypeScript expressions;
- JSX components;
- properties and children;
- exported Excalmermaid helper functions.

React MUST NOT be a runtime dependency. JSX transformation MUST target an Excalmermaid-owned runtime.

### 2.2 Modules and root value

A diagram module MUST export exactly one normalizable root value. The preferred contract is a default export:

```tsx
export default <Diagram>{/* ... */}</Diagram>;
```

After component expansion, the root value MUST yield exactly one `Diagram`. Several independent diagrams in one file MAY later be supported by an explicit document or page component.

### 2.3 Components

A component MUST be semantically treatable as a pure mapping from properties and children to a diagram expression:

```ts
type Component<Props> = (props: Props) => Expression;
```

Components MAY call other components and use ordinary TypeScript abstractions. They MUST NOT:

- inspect computed positions or sizes;
- read routing results;
- produce renderer-dependent objects;
- pass non-serializable values into Logical IR.

The runtime SHOULD evaluate components deterministically and, where possible, without unrestricted access to the clock, randomness, network, environment variables, or file system. A first implementation MAY be less restrictive for trusted local modules, but the semantic result MUST still be defined as reproducible.

### 2.4 Expression values

The JSX contract MUST normalize at least the following values:

```ts
type Expression =
  | CoreElement
  | readonly Expression[]
  | null
  | false;
```

Fragments, nested arrays, and `null` or `false` produced by conditions MUST be supported. Strings and numbers as children MUST only be accepted where the receiving component declares textual or numeric content.

Unknown DOM or HTML elements MUST be errors. TSX has no DOM semantics in Excalmermaid.

### 2.5 Keys and IDs

A JSX `key` MAY support stable expansion of repeated expressions. `key` and diagram `id` MUST remain separate concepts:

- `key` identifies a JSX expression for normalization and provenance;
- `id` creates a local binding that can be referenced by the diagram.

## 3. Core vocabulary

The precise component names and property forms remain subject to design. Normalized semantics MUST include at least these categories (shapes in [MODEL.md](MODEL.md)):

- `Diagram`: document root, global metadata, root frame;
- `Scope`: lexical namespace, containment region, local orientation;
- `Element` (`Node`): visible or intrinsically measurable object;
- `Layout`: arrangement of a set of objects;
- `Port`: symmetric attachment point on an element or scope;
- `PortGroup`: adjacency, ordering, and affinity rules for ports;
- `Corridor`: named refinement of an implicit whitespace routing region;
- `Line`: symmetric semantic connection built from segments;
- `Segment`: one leg of a line, explicit or implicit, labelable;
- `Note`: annotation placed by an anchor relation;
- `Constraint`: hard requirement or soft preference;
- `PaintRelation`: drawing order independent of containment.

Diagram types such as `SequenceDiagram`, `MindMap`, `EntityRelationship`, or `KubernetesCluster` MAY exist as library components, but they MUST NOT be required core primitives.

## 4. Scopes, containment, and relative names

### 4.1 Lexical scopes

A `Scope` MUST open a lexical namespace. Layout containers MUST NOT open namespaces: every identifiable declaration is bound in its nearest enclosing scope, so purely visual containers introduce no unexpected namespace change.

Every explicit author ID MUST be unique only inside its declaring scope. Objects with equal IDs in different scopes MUST be permitted.

```tsx
<Scope id="orders">
  <Node id="api" />
</Scope>

<Scope id="billing">
  <Node id="api" />
</Scope>
```

### 4.2 Relative references

Author references MUST be interpreted relative to their declaring scope. The authoring surface MUST NOT require globally unique IDs.

The reference model MUST address at least:

- an object in the current scope;
- an object in a child scope (`orders/api`);
- an object relative to a parent scope (`../billing/api`);
- a port (`api.request`);
- a port group;
- an implicit whitespace region (`gap(a, b)`, `padding(scope, side)`) or a named corridor;
- a layout, line, segment, or constraint-relevant region when referencable.

References MAY use strings, typed `ref()` helpers, or template literals. If several forms are offered, all MUST normalize to the same internal reference model.

Component boundaries SHOULD use opaque `port()` handles instead of references to component-internal IDs. Moving or nesting a component MUST NOT require callers to rewrite its internal endpoint paths.

### 4.3 Containment

JSX nesting SHOULD express containment by default. Containment alone MUST NOT completely determine layout membership, paint order, or line routing.

An object MUST have exactly one containment parent. Additional layout, routing, and paint relations MAY reference any number of other objects.

Scopes MUST be full endpoints: they can carry ports, terminate lines, and anchor notes.

## 5. Orientation

Every scope MUST own a local frame. All directional vocabulary inside a scope — sides (`top`, `right`, `bottom`, `left`), axes (`horizontal`, `vertical`), layout directions (`row`, `column`), note placements — MUST be interpreted in that local frame.

A scope MUST be able to declare its orientation relative to its parent frame in 90° steps. Rotating one scope MUST re-orient its complete subtree — layouts, ports, corridors, and line routes — without any change to the declarations inside the scope. A component authored for one flow direction MUST be embeddable rotated in another context.

The solver MUST NOT change orientations on its own; automatic orientation MAY be added later as an explicit opt-in. Text SHOULD stay physically upright by default, with an explicit property to rotate it with the frame.

## 6. Elements, content, and sizing

The authoring surface MUST support at least:

- text;
- basic shapes;
- containers with visible or invisible boundaries;
- icons and images;
- semantic roles from which a theme can derive presentation.

The element model MUST support intrinsic sizing. Text measurement, wrapping, padding, minimum and maximum size, and size derived from children MUST be expressible or style-derived.

The grammar SHOULD keep simple cases concise:

```tsx
<Node id="api" role="service">API</Node>
```

It MUST also permit richer content without compressing it into an untyped string:

```tsx
<Node id="api" role="service">
  <Text>Orders API</Text>
  <Text role="subtitle">public</Text>
</Node>
```

The exact set of shape primitives remains open. Extensions MUST be namespaced and serializable; arbitrary renderer objects or JavaScript classes MUST NOT enter the IR.

## 7. Layout and whitespace

### 7.1 Composition

Layouts MUST compose recursively. At least the following strategies SHOULD be available: Row, Column, Stack, Overlay, Grid, Tree, Radial, Graph or Layered, and unconstrained arrangement governed by constraints.

A layout MUST have an explicit member set. JSX children MAY be shorthand for that set. Layout MAY appear both as a component (`<Row>...</Row>`) and as a property (`<Scope layout={{ kind: "row" }}>`); both forms MUST normalize identically.

### 7.2 Ordering

The default ordering policy MUST be a soft source-order preference: the solver keeps JSX child order unless deviating clearly reduces crossings, route length, or space consumption. Layouts MUST be able to opt into fully free ordering and into hard source ordering.

Layouts and components MUST additionally be able to state partial `before`/`after` relations, adjacency without total order, grouping, and ordering of lines or tracks at a port or inside a corridor.

### 7.3 Whitespace is the routing plane

Every element and scope MUST carry margin, and every container padding, as logical whitespace demands. The whitespace between layout siblings (gaps) and between a container's border and its content (padding bands) MUST be implicit, addressable routing regions — no declaration is needed for a line to route through them.

Routing MUST interact with layout the way margins do: a whitespace region that carries line tracks widens until its content fits, and the surrounding layout accounts for it. A layout run MUST NOT assume lines are drawn afterward with no space requirement. Lines MUST reserve routing space by default, with an explicit opt-out to overlay.

A `Corridor` declaration MUST refine an implicit region rather than exist detached from structure: it names the region, sets spacing, capacity, and packing pressure, orders tracks, and MAY subdivide a region together with other corridors in a defined order.

A corridor MUST be able to carry a divider: a drawn separation line with an optional label, so a visible boundary between two bands is a decorated gap rather than a fake element.

Packing pressure MUST be an optimization weight that penalizes occupied cross-sectional width. It MUST NOT override hard minimum spacing or sharing prohibitions. High pressure SHOULD move tracks toward minimum spacing and make permitted bundles and merges more attractive. The exact scale and unit of pressure remain to be specified.

Elements MAY reside inside a whitespace region (a decision shape in the middle of a corridor); track order relative to such residents MUST be constrainable.

## 8. Ports and components

### 8.1 Ports

A port is a symmetric attachment point — direction belongs to lines, not ports. A port MUST express at least:

- local ID or role;
- allowed, preferred, or required side and position in the local frame;
- cardinality (`one` default, `optional`, `many`);
- optional capacity and minimum spacing;
- optional order constraints for attached lines.

A line endpoint MUST be able to reference an element or scope without an explicit port; the router then selects a compatible attachment point, optionally constrained by a side hint.

### 8.2 Component ports

Composability is a primary language property. A component MUST be able to expose connection points without revealing its internal element IDs.

The TSX runtime MUST provide opaque port handles:

```ts
declare function port<T>(options?: {
  cardinality?: "one" | "optional" | "many";
}): PortHandle<T>;
```

A handle is created by the caller, passed as a prop, and bound exactly once inside the component to a concrete port, or forwarded unchanged to a child component:

```tsx
type ServiceProps = { request: PortHandle<Request> };

function Service({ request }: ServiceProps) {
  return (
    <Scope id="service">
      <Node id="api">
        <Port id="request" side="left" bind={request} />
      </Node>
    </Scope>
  );
}
```

By default, a bound port MUST be attached by exactly one line; `optional` and `many` cardinalities MUST be declarable. Two lines connecting the same pair of ports MUST be permitted only within cardinality limits. TypeScript SHOULD reject incompatible `T` parameters during development; the normalizer MUST retain enough runtime type metadata to reject incompatible attachments when static checking was not performed.

All required ports MUST be bound and attached by the time the document root is normalized. Port handles and component interfaces are TSX-level composition constructs and MUST NOT be serialized as unresolved handles in Logical IR. Provenance MAY preserve the component and property through which a resolved endpoint originated.

### 8.3 Port groups and affinity

Ports MUST be groupable. A port group MUST keep its members adjacent and ordered, and set the default affinity of the lines attached to them:

- `merge`: attached lines form a share group with one common drawn path;
- `bundle`: attached lines run closely parallel but stay separate;
- `free`: no implied relation (default);
- `separate`: anti-affinity — attached lines must not share and are kept visibly apart.

## 9. Lines, segments, and sharing

### 9.1 Symmetric lines

A `Line` is the semantic connection unit. It MUST be declarable in every scope. Its two ends MUST be symmetric: `from` and `to` are positional labels, and direction is expressed by head properties (`forward`, `backward`, `both`, `none`, plus per-end head shapes), not by an asymmetry of the ends.

### 9.2 Segments, implicit and explicit

A line MUST consist of an ordered list of segments between its ends. Segments the author does not write MUST be inferred: the normalizer ascends from one end to the least common ancestor and descends to the other, routing through implicit whitespace regions. Authors MUST NOT have to enumerate `parent`, `parent.parent`, or every crossed boundary.

With no explicit segments, routing is fully automatic:

```tsx
<Line from="producer.result" to="consumer.request" />
```

An explicit segment MUST be able to:

- pin the line `through` a region — a named corridor, `gap(a, b)`, or `padding(scope, side)`;
- pass `via` a waypoint element (a decision shape inside a flow);
- carry labels and a branch-local style.

```tsx
<Line from="phone/road-agent.remote" to="user-owned/travel-agent.request">
  <Segment
    through={gap("phone", "user-owned")}
    label="drive context + exact request"
    labelOrientation="along"
  />
</Line>
```

The normalizer MUST weave implicit segments around explicit ones and MUST reject explicit segment sequences no route can satisfy. Lines MUST also be able to `avoid` regions. Explicit ancestor paths MAY exist as a low-level escape hatch but SHOULD NOT be the normal authoring form because they couple a component to its nesting depth.

### 9.3 Labels

A label belongs to a segment. Pinning a segment into a whitespace region and labeling it there MUST be the primary way to place a label "out in the white space between the boxes". A line-level `label` MUST be accepted as sugar for an automatically placed label on the line's most prominent run.

Labels MUST support placement along their segment (`start`, `center`, `end`, `auto`) and orientation (`upright` or `along` the segment). Rich structured label content MAY be added later, but plain text MUST be supported.

### 9.4 Sharing only within groups

Lines MUST share drawn geometry only when joined through a group — explicitly (`share={{ group, mode }}`) or implicitly via port-group affinity. Ungrouped lines, including lines attached to the same port, MUST stay separate.

Within a share group:

- the shared path MUST be maximal by default: branches happen as late as possible relative to the group's common end; `early` and `balanced` preferences and a constraining branch region MUST be expressible;
- at least the sharing modes `merge` (one genuinely shared stroke) and `bundle` (separate, closely parallel strokes) MUST be distinct, with `auto` letting the router choose;
- style unification MUST apply only to the shared piece; branches keep their own style, so a dashed branch may leave a solid merged trunk. Incompatible styles on the shared piece SHOULD downgrade `merge` to `bundle`; if merging was required, this MUST be a diagnostic;
- fan-out and fan-in MUST be symmetric.

A `many` port permits topology but MUST NOT by itself cause geometric path sharing. A renderer MUST NOT accidentally produce multiple overlapping strokes for a merged path.

### 9.5 Semantics and geometry

The grammar and IR MUST keep these levels separate:

1. TSX component ports and port forwarding;
2. semantic lines and their labelable segments;
3. route networks containing trunks, bundles, joins, branches, and inferred hierarchy traversal;
4. concrete geometric polylines, curves, labels, and heads.

Several semantic lines MAY map to one geometric trunk. Concrete portals, tracks, bends, and curves MAY first appear in Solved IR.

## 10. Notes and anchors

Annotations MUST be placeable by anchor relation rather than only by layout membership: a `Note` names an anchor entity or region (defaulting to its declaring parent) and a placement relative to it in the anchor's local frame. A note without an anchor MAY participate in normal layout like an element. Page furniture — titles, legends, footers — SHOULD be library components on the same mechanism.

## 11. Constraints

Constraints MUST be typed and serializable. Arbitrary JavaScript predicates MUST NOT enter Logical IR.

Every constraint MUST have a strength:

- `required` for a hard requirement;
- a weighted preference for a soft requirement.

At least these constraint families SHOULD be available:

- `before` and `after`, including for ports, corridor tracks, and corridors within a region;
- `adjacent`;
- `align`;
- `distribute`;
- `sameWidth`, `sameHeight`, and `sameSize`;
- `near`;
- `inside`;
- `avoidOverlap`;
- `avoidCrossing`;
- routing through or outside a region;
- paint order before or behind an object.

Partial-order constraints MUST be preferred. Objects not mentioned remain unconstrained. Cycles in hard ordering constraints MUST produce diagnostics.

## 12. Styling and presentation

Semantics and presentation MUST remain separate. An element SHOULD carry roles and classes:

```tsx
<Node id="database" role="storage" className="critical" />
```

Themes or CSS-like rules MAY derive shape, color, typography, padding, roughness, and other presentation properties from them.

Inline styles MAY be supported. Properties that influence intrinsic size or routing space MUST be resolved before layout. Purely painterly properties MAY be applied later.

Logical IR MUST NOT contain Excalidraw-specific object classes. Standard styles MUST be typed; renderer or library extensions MUST have a namespace.

## 13. Illustrative TSX draft

The following example demonstrates the current grammar direction. Property details may still evolve, but symmetric ports, segment pinning, and group-only sharing are normative at the conceptual level:

```tsx
type ClientProps = { conversation: PortHandle<Chat> };

function Client({ conversation }: ClientProps) {
  return (
    <Scope id="client" role="client">
      <Node id="ui">
        <Port id="chat" side="right" bind={conversation} />
      </Node>
    </Scope>
  );
}

type WorkerProps = { request: PortHandle<Request> };

function Worker({ request }: WorkerProps) {
  return (
    <Scope id="worker" role="worker">
      <Node id="process">
        <Port id="request" side="top" bind={request} />
      </Node>
    </Scope>
  );
}

const chat = port<Chat>();
const forwarding = port<Request>({ cardinality: "many" });
const workerRequests = [port<Request>(), port<Request>()];

export default (
  <Diagram>
    <Row id="frontend">
      <Client conversation={chat} />
      <Scope id="gateway" role="gateway">
        <Node id="router">
          <Port id="chat" side="left" />
          <Port id="forward" side="bottom" bind={forwarding} />
        </Node>
      </Scope>
    </Row>

    <Row id="workers">
      {workerRequests.map((request, i) => (
        <Worker key={`worker-${i}`} request={request} />
      ))}
    </Row>

    <Line from={chat} to="gateway/router.chat" heads="both" label="conversation" />

    {workerRequests.map((request, i) => (
      <Line
        key={`forward-${i}`}
        from={forwarding}
        to={request}
        share={{ group: "forwarding", mode: "merge" }}
      >
        <Segment through={gap("frontend", "workers")} label={i === 0 ? "forward to worker" : undefined} />
      </Line>
    ))}
  </Diagram>
);
```

## 14. Normalization and validation

Normalization MUST include at least these phases:

1. Transform TSX and evaluate it in a JavaScript context.
2. Expand components recursively.
3. Normalize fragments, arrays, and empty expressions.
4. Collect core declarations and build containment.
5. Build lexical scopes and local bindings.
6. Collect TSX port allocations, local bindings, and forwarded bindings.
7. Resolve every required port handle to a concrete port.
8. Resolve relative references and region references.
9. Canonicalize defaults and shorthand forms (line-level labels, `heads` sugar, layout components versus properties).
10. Weave implicit segments around explicit ones; infer least common ancestors and traversals.
11. Derive share groups from port-group affinity where lines declare none.
12. Assign `EntityKey` values deterministically.
13. Perform structural and semantic validation.
14. Emit Logical IR and optional provenance.

At least these errors MUST be detected before solving:

- more than one diagram root;
- duplicate IDs in the same scope;
- missing or ambiguous references;
- references that traverse above the root scope;
- required port handles that are unbound, bound twice, or unattached;
- ports attached more often than their cardinality permits;
- statically or dynamically incompatible port payload types;
- port handles or component functions remaining after lowering;
- `gap()` between entities that are not layout siblings, or region references that do not resolve;
- explicit segment sequences no route can satisfy;
- required `merge` with incompatible styles on the shared piece;
- share groups spanning lines with no common end;
- invalid or empty layout membership;
- cycles in hard partial orders;
- invalid orientation values;
- non-serializable core properties;
- renderer objects or functions in Logical IR;
- unknown required extensions.

Solver-dependent unsatisfiability MAY be diagnosed during layout or routing. Diagnostics SHOULD identify source file, position, and component stack.

## 15. Serialization and versioning

Logical IR MUST carry an explicit schema version. Breaking changes MUST be identifiable through an incompatible version.

At least JSON and YAML SHOULD be supported without loss. Canonical serialization MUST be deterministic and render the same semantic IR identically.

Serialization MUST:

- tag every core variant unambiguously;
- identify unknown required features;
- preserve relative author identity or a uniquely resolved equivalent;
- sort semantic sets deterministically;
- preserve semantic order where required;
- reject functions, `undefined`, symbols, and cyclic values.

Provenance, absolute source paths, and component stacks SHOULD be stored in a separate source map so that they do not affect canonical domain IR or its hashes.

## 16. Renderer and solver requirements

A Logical IR consumer MUST determine from the schema version and required features whether it can process a document completely. Unsupported semantic requirements MUST NOT be ignored silently.

Independent Go, Rust, and TypeScript implementations MUST be able to read the same Logical IR. They MAY use different layout and routing algorithms as long as they satisfy hard constraints or report unsatisfiability with an understandable explanation.

A solver SHOULD produce renderer-neutral Solved IR. Renderers may then produce Excalidraw, SVG, Canvas, or other outputs without evaluating TSX components again.

## 17. Reference fixtures before implementation

The reference drawings under [`examples/`](examples/) are requirements fixtures, not post-implementation demos. Each fixture MUST contain:

- `original.png`: the visual reference provided before implementation;
- `diagram.tsx`: a complete logical formulation in the proposed authoring language.

No core API, normalizer, solver, or renderer implementation should begin until every current reference can be expressed in TSX without pixel coordinates. The fixture TSX files are intentionally allowed to precede the implementation and therefore are not expected to compile yet.

The fixtures define required semantic and layout capabilities. They do not require pixel-identical output. A conforming result MUST preserve containment, major relative placement, visible content, line connectivity, segment labels, route hierarchy, path sharing, boundaries, and style roles closely enough that the reference remains recognizably the same drawing.

The initial fixtures are:

| Fixture | Primary coverage |
| --- | --- |
| [`vegvisir-voice-agents`](examples/vegvisir-voice-agents/) | nested scopes, image content, ellipse and diamond shapes, a waypoint element inside a corridor, two-headed lines, a labeled segment pinned into the gap between containers, and a merged fan-out in a padding band |
| [`modelplane-fleet-inference`](examples/modelplane-fleet-inference/) | anchored page furniture, repeated parameterized cluster components, two ordered corridors subdividing one gap, external nodes, dashed status elements, and a footer |
| [`agent-substrate`](examples/agent-substrate/) | deep containment, lines pinned through padding bands and sibling gaps, dashed control paths, a boundary-spanning request route arriving deep inside nested scopes, and corner-anchored annotations |
| [`machine-thought-os`](examples/machine-thought-os/) | a labeled divider on a gap, many-cardinality ports, fan-out and fan-in share groups, a dashed branch leaving a solid merged trunk, bundled data feeds, deferred work, and a hierarchy-crossing return path |

A grammar change MUST update all affected fixture files. A future executable fixture lifecycle SHOULD produce:

- `logical.yaml`, the canonical normalized IR;
- `solved.yaml`, the selected solver result;
- `rendered.png`, the renderer result used for visual regression testing.

The checked-in TSX fixtures MUST become normalization and render golden tests as soon as an implementation exists.

## 18. Conformance scenarios

The first grammar and IR version MUST cover at least these golden scenarios:

1. A component is instantiated twice and produces the same local IDs in both scopes without collision.
2. A component forwards a port handle to a child, and the final binding remains valid after another scope is inserted around either component.
3. A component caller attaches lines without referencing any component-internal IDs.
4. A required port handle that is not bound or not attached produces a source-located diagnostic.
5. Payload-type and cardinality violations produce diagnostics.
6. A line connects two elements across several scope boundaries with no explicit segments.
7. A line is pinned through the gap between two containers and carries its label on that segment.
8. A line passes via a waypoint element between its ends.
9. Several lines in one share group merge into a trunk and branch as late as possible.
10. Two lines attached to the same port without a shared group never merge.
11. A dashed line branches off a solid merged trunk; the shared piece has one unified style.
12. A port group with `separate` affinity keeps its attached lines visibly apart.
13. A `many` port creates fan-out topology without implicitly merging geometry.
14. High corridor pressure reduces preferred spacing without violating minimum spacing.
15. A scope with `orientation={90}` renders its local row as a physical column; ports, corridors, and lines follow, and text stays upright.
16. A layout with the default ordering keeps source order absent a solver reason to deviate; `free` ordering permits reordering.
17. A partial-order constraint fixes only the stated relation.
18. A cycle of hard ordering constraints produces a diagnostic.
19. A divider on a gap renders as a labeled separation line between two bands.
20. A note anchored `inside-bottom-left` of a scope stays inside that scope's border, outside its content flow.
21. TSX normalizes deterministically to the same Logical IR.
22. JSON and YAML representations read back to the same Logical IR.
23. Go and Rust consumers read the same IR and recognize the same core features.
24. Every reference fixture normalizes without absolute positions or unresolved TSX port handles.
25. Every reference fixture preserves its named scopes, nodes, resolved endpoints, labels, and pinned segments through serialization.

## 19. Open grammar decisions

The following details must be decided next by comparing the concrete TSX fixtures:

- the runtime representation of `port<T>()` payload types when `tsc` was not run;
- naming conventions for port-handle props on components;
- the exact rules for `optional` and `many` cardinality and attachment completeness;
- strings versus typed `ref()` objects for references and regions;
- syntax and separators for relative element, port, and region paths;
- whether a scope can reference itself (for `padding(self, side)` from inside);
- layout as component, property, or both;
- text as child, `label` property, or structured content;
- exact core shape set;
- mirroring (flips) in addition to 90° orientation steps;
- whether the solver may ever choose orientation (`orientation="auto"`);
- whether explicit segments require local IDs and how implicit segment identities are serialized;
- whether an `Arrow` compatibility shorthand exists in the public API;
- automatic IDs for anonymous elements and their stability guarantees;
- inline styles versus a CSS-like cascade;
- exact units for size, spacing, margin, padding, pressure, and weights;
- how corridors subdividing one gap are ordered and addressed;
- whether a share group can carry its trunk pinning once instead of per line;
- grouping lines into higher-level semantic flows (line sets) as a library concept;
- representation of resolved references and regions in canonical JSON and YAML;
- which core shorthand forms normalization accepts;
- which provenance data the JSX runtime must capture;
- how reference fixtures express relative placement without turning preferences into accidental hard order.
