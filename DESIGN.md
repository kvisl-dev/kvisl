# Excalmermaid Design

Status: Draft

## Goal

Excalmermaid describes drawings through their logical structure and turns that structure into outputs including Excalidraw-style drawings. Authors should not have to maintain pixel coordinates, arrow segments placed freely in space, or manually coordinated geometry.

The system is not a collection of hard-coded diagram types. Flowcharts, sequence diagrams, mind maps, architecture diagrams, entity-relationship models, and other visual forms should be implemented as component libraries on top of a general visual model.

The model must support, in particular:

- nested and composable layouts;
- relative identities and references;
- constraints with optional ordering requirements;
- typed input and output ports for black-box component composition;
- links and independently labeled segments declared at every hierarchy level;
- hierarchy-crossing routing that reserves space;
- shared segment paths, dock groups, and controlled branches;
- multiple independent solvers and renderers.

## Fundamental decisions

### TSX is the authoring language

Excalmermaid does not define a programming language. It has no custom grammar, parser, or interpreter.

Diagrams are written as TSX and evaluated by the existing TypeScript and JavaScript toolchain. A custom JSX runtime produces logical diagram expressions; React is not involved.

```tsx
type ServiceProps = {
  request: InputPort<Request>;
};

function Service({ request }: ServiceProps) {
  return (
    <Scope id="service" layout="column">
      <Node id="api" role="service">
        <Dock side="bottom">
          <Input bind={request} />
        </Dock>
      </Node>
    </Scope>
  );
}

const clientRequest = output<Request>();
const serviceRequest = input<Request>();

export default (
  <Diagram>
    <Channel id="request-channel" axis="horizontal" pressure={0.8} />

    <Client request={clientRequest} />
    <Service request={serviceRequest} />

    <Link
      from={clientRequest}
      to={serviceRequest}
      label="request"
      route={[use("request-channel", { axis: "horizontal" })]}
    />
  </Diagram>
);
```

`InputPort<T>` and `OutputPort<T>` values are opaque TSX-level connection halves. Components bind them to internal docks or forward them to child components. Callers connect halves without referencing component-internal IDs. All required halves must be closed before normalization emits Logical IR.

A `Link` contains any number of independently labeled `Segment` values. The `from`/`to` form above is shorthand for a Link containing one implicit Segment. Required parent-scope traversal is inferred from the bound endpoints; authors describe only exceptional route constraints and do not enumerate `parent.parent` paths.

High-level components are ordinary TypeScript functions. They are evaluated recursively until only core primitives remain.

```ts
type Component<Props> = (props: Props) => Expression;

type Expression =
  | CoreElement
  | readonly Expression[]
  | null
  | false;
```

Components may create logical structure, but they may not inspect computed geometry. Normalization therefore remains independent of layout and routing.

### One normalizer, multiple downstream implementations

The TypeScript normalizer is the single normative implementation of component expansion and TSX semantics. Go and Rust implementations begin behind a versioned, language-neutral IR boundary.

```text
diagram.tsx
    -> TSX transformation
    -> JavaScript evaluation
    -> Excalmermaid normalization
    -> Logical IR
    -> layout and routing
    -> Solved IR
    -> renderer
```

Go and Rust renderers do not reimplement TSX or component expansion. They consume either the Logical IR or the geometrically resolved Solved IR.

### Evaluating TSX directly from Go

A standalone Go program can accept TSX without requiring an installed Node.js runtime:

```text
diagram.tsx
    -> esbuild through its Go API
    -> bundled JavaScript
    -> embedded JavaScript runtime, for example goja
    -> Logical IR
    -> Go solver or Go renderer
```

esbuild transforms and bundles TSX, but does not execute it. A JavaScript runtime performs evaluation. Type checking may be offered as an optional development step through `tsc --noEmit`; it is not a runtime prerequisite.

A Rust application does not have to support TSX directly. It can read normalized IR. An embedded JavaScript runtime for Rust remains an optional integration path and is not part of the core contract.

## Layers and intermediate representations

### Logical IR

The Logical IR contains only logical information:

- scopes and containment;
- elements and intrinsic content;
- layout strategies and constraints;
- relative identities and references;
- docks and dock groups;
- channels, corridors, and routing preferences;
- semantic links, independently labeled segments, and their grouping rules;
- styles or semantic roles insofar as they affect size or layout.

The Logical IR contains neither final pixel positions nor Excalidraw-specific element data.

### Solved IR

The Solved IR is the result of a layout and routing run. It may contain:

- measured element sizes;
- computed positions;
- reserved routing regions and tracks;
- portals between scopes;
- route networks with shared segments and branch points;
- geometric paths and label positions.

The Solved IR should remain renderer-neutral. An Excalidraw, SVG, or Canvas renderer translates it into its respective output format.

A renderer may instead consume Logical IR directly and use its own solver. This keeps experimentation and independent Go, Rust, and TypeScript implementations possible.

## Multiple independent structures

The word "layer" is too ambiguous to serve several responsibilities in the core model. A diagram has at least four independent structures:

1. **Containment:** Which scope or element contains which other element?
2. **Layout:** Which elements are arranged together, and which constraints apply?
3. **Routing:** Through which regions may link segments travel?
4. **Paint order:** What is drawn in front of or behind what?

Containment forms a tree. Layout and routing form additional graphs or constraint systems. Paint order is a separate relation again.

## Relative identities

Author-provided IDs are always relative to their scope. They do not have to be globally unique.

```tsx
<Scope id="orders">
  <Node id="api" />
</Scope>

<Scope id="billing">
  <Node id="api" />
</Scope>
```

A reference is resolved relative to the scope in which it is declared. Internal references in a component tree therefore remain stable when the entire tree is moved or instantiated more than once.

The normalizer may generate fully resolved structural addresses or opaque handles internally. These are not global IDs maintained by authors. The representation of resolved references in canonical IR serialization remains to be specified.

## Layout and ordering

Layouts are composable, nestable strategies. Expected foundational strategies include:

- Row and Column;
- Stack and Overlay;
- Grid;
- Tree and Radial;
- Graph and Layered;
- unconstrained placement governed by constraints.

Order is unspecified by default. The solver may select an advantageous order to reduce crossings, route length, and space consumption.

If order is semantically required, it is expressed as a partial constraint. Such constraints may originate from elements, layouts, docks, dock groups, channels, links, or segments. Orders that are not constrained remain free.

Constraints must eventually distinguish hard requirements from soft preferences. Conflicts should be reported as understandable diagnostics instead of being hidden behind arbitrary geometry.

## Docks and dock groups

A dock describes a logical attachment surface or connection point on an element. It may have a preferred or required side, a role, and further connection rules.

Several segments may attach to the same dock. Dock groups specify which of those segments may or must be routed together. At least the following join intents are expected:

- `require`: a shared path is mandatory;
- `prefer`: the router should use a shared path when possible;
- `allow`: the router may decide freely;
- `forbid`: paths must remain separate.

Two representations must also be distinguished:

- **Merge:** Several semantic segments truly share one drawn route segment.
- **Bundle:** Several segments travel closely in parallel but remain separate strokes.

This distinction is necessary when segments have different styles, colors, or meanings.

## Links, segments, and route networks

Links can be declared in any scope. They do not necessarily belong to a global connection layer, and they are not merely children of a layout tree. Each Link contains any number of independently labeled Segments. A Segment connects an output half to an input half.

A segment may cross scope boundaries. A hierarchical route may, for example:

1. leave a source dock vertically;
2. pass through a portal into a parent routing region;
3. travel horizontally through a reserved channel there;
4. pass through a target portal into another child scope;
5. attach to a required side or dock group on the target.

The concrete geometry remains the router's responsibility. TSX describes axes, regions, docks, and preferences rather than coordinates. Scope ascents and descents are implicit unless an explicit constraint is necessary.

Component ports, semantic connections, and geometric routes are separate layers:

```text
Ports          TSX-level input and output halves
Link           semantic connection containing Segments
Route Network  shared trunks, bundles, and branches
Geometry       concrete route segments and curves
```

Several segments can use a shared trunk and split later. The branch location is not necessarily specified as a point; it may instead be constrained to a relative region:

```text
branchPoint is within channels/backbone
```

Without a more specific requirement, segments in the same dock group should by default split as late as possible, maximizing their shared path. Other preferences such as early, balanced, near source, or near target remain possible.

## Channels, corridors, and space reservation

Routing is not a drawing pass placed on top of an already completed layout. Layout and routing must cooperate:

1. Elements and scopes provide preliminary sizes.
2. Link segments determine required docks, portals, corridors, and tracks.
3. Layout reserves the required space.
4. Final positions are computed.
5. Route networks are geometrically resolved inside the reserved regions.

A channel can define at least an axis, capacity, minimum and preferred spacing, and pressure. High pressure penalizes occupied cross-sectional width and produces more tightly packed tracks or makes bundles more attractive. Minimum spacing remains a hard constraint. Pressure alone cannot permit joining that a dock, port, or segment group forbids.

## Normalization

Normalization performs at least these steps:

1. Evaluate TSX components recursively.
2. Normalize fragments, arrays, conditions, and empty expressions.
3. Expand high-level components down to core primitives.
4. Validate scopes and relative references.
5. Apply defaults according to a versioned rule set.
6. Diagnose semantic errors and locally unsatisfiable requirements.
7. Produce deterministic Logical IR.

Normalization performs no layout. Components therefore cannot use positions, measured sizes, or routes as input.

Component evaluation should be reproducible. An embedded runtime should, where possible, avoid unlimited access to the file system, network, clock, environment variables, or uncontrolled randomness. Execution limits and controlled interruption are especially important for untrusted input.

## Serialization

Logical IR and Solved IR require versioned, language-neutral serializations. JSON and YAML should represent the same data model without loss.

A canonical YAML output must define at least:

- fixed field order per element type;
- unambiguous handling of defaults;
- deterministic ordering of semantically unordered sets;
- preservation of order only where it is semantically relevant;
- no aliases, merge keys, or custom YAML tags;
- unambiguous representation of numbers, strings, and units;
- fixed encoding and line endings.

Whether JSON or an abstract schema is the normative interchange format, with YAML as a canonical projection of it, remains open. This decision must not change the logical IR.

The original TSX source cannot be reconstructed from normalized IR. After expansion, it is no longer possible to tell whether elements were written individually or generated by a component. Origin information and component stacks may be emitted as a separate source map or provenance file.

## Expected core primitives

The exact TSX surface has not yet been fixed. The currently expected semantic core comprises:

- `Diagram`;
- `Scope`;
- `Layout`;
- `Node`, or the more general `Element`;
- `Dock`;
- `DockGroup`;
- `Input` and `Output` port bindings;
- `Channel` or `Corridor`;
- `Link`;
- `Segment`;
- `Constraint`.

Diagram types and domain components do not belong in this core. They are ordinary TSX components and component libraries.

## Non-goals

- no new general-purpose or domain-specific programming language;
- no pixel coordinates as the primary authoring model;
- no hard-coded list of diagram types;
- no reimplementation of TSX semantics in every renderer;
- no lossless round trip from normalized IR to original TSX source;
- no coupling of Logical IR to Excalidraw.

## Next step: refine the TSX surface

The component-port and Link/Segment model is fixed at the conceptual level. The remaining surface work must decide:

- which elements are core primitives and which are library components;
- how text, shapes, scopes, and layouts nest in TSX;
- how relative element, dock, and region references are written;
- the exact runtime representation and naming of typed port handles;
- the cardinality and completeness rules for optional and many-valued ports;
- the final set of sparse route helpers and semantic label placements;
- how optional ordering and hard versus soft constraints are expressed;
- how dock groups, joining, bundling, and branch regions are expressed;
- which properties are inline and which may later be set through CSS-like rules;
- how components carry provenance through normalization.
