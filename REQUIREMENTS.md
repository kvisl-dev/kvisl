# Excalmermaid Requirements

Status: Working draft

This document makes the requirements from [DESIGN.md](DESIGN.md) concrete. In this document, "grammar" means the TSX authoring surface: components, properties, references, and their semantics. Excalmermaid does not extend the TypeScript or TSX grammar.

The keywords **MUST**, **SHOULD**, and **MAY** indicate requirements, strong recommendations, and optional capabilities.

## 1. Goal of the authoring surface

The authoring surface MUST express general logical drawings without compiling diagram types into the core. It MUST support both small sketches and deeply nested system diagrams.

In particular, the surface MUST provide:

- reusable high-level components as ordinary TypeScript functions;
- recursive expansion to a small set of core primitives;
- relative identities and references;
- independent containment, layout, routing, and paint-order relations;
- nested and composable layouts;
- composable components with typed input and output ports;
- links containing any number of independently labeled segments;
- implicit and explicit hierarchical routing that reserves space;
- docks, dock groups, shared paths, bundles, and branch regions;
- ordering that is optional rather than implicitly universal;
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

The precise component names and property forms remain subject to design. Normalized semantics MUST include at least these categories:

- `Diagram`: document root and global metadata;
- `Scope`: lexical namespace and possible containment region;
- `Element`: visible or intrinsically measurable object;
- `Layout`: arrangement of a set of objects;
- `Dock`: attachment surface or connection point on an element;
- `DockGroup`: grouping and path-sharing rules at a dock;
- `InputPort` and `OutputPort`: opaque TSX-level connection halves exposed by components;
- `Input` and `Output`: bindings from component ports to internal docks or child ports;
- `Channel`: reservable routing region;
- `Link`: a semantic connection containing any number of segments;
- `Segment`: one independently labelable connection from an output half to an input half;
- `Constraint`: hard requirement or soft preference;
- `PaintRelation`: drawing order independent of containment.

Diagram types such as `SequenceDiagram`, `MindMap`, `EntityRelationship`, or `KubernetesCluster` MAY exist as library components, but they MUST NOT be required core primitives.

## 4. Scopes, containment, and relative names

### 4.1 Lexical scopes

A `Scope` MUST open a lexical namespace. A visual container or layout MUST NOT necessarily open a namespace.

Every explicit author ID MUST be unique only inside its declaring scope. Objects with equal IDs in different scopes MUST be permitted.

```tsx
<Scope id="orders">
  <Node id="api" />
</Scope>

<Scope id="billing">
  <Node id="api" />
</Scope>
```

The exact namespace behavior of nested elements remains to be fixed. The preferred rule assigns every identifiable declaration to its nearest surrounding `Scope`; purely visual layout containers then introduce no unexpected namespace change.

### 4.2 Relative references

Author references MUST be interpreted relative to their declaring scope. The authoring surface MUST NOT require globally unique IDs.

The reference model MUST address at least:

- an object in the current scope;
- an object in a child scope;
- an object relative to a parent scope;
- an element dock;
- a dock group;
- a channel or another routing region;
- a layout, link, segment, or constraint-relevant region when referencable.

References inside an expanded component MAY use strings, typed `ref()` helpers, or template literals:

```tsx
<Link from="api.out" to="../billing/api.in" />
```

```tsx
<Link from={ref("api").dock("out")} to={ref("../billing/api").dock("in")} />
```

If both forms are offered, both MUST normalize to the same internal reference model.

Component boundaries SHOULD use opaque `InputPort<T>` and `OutputPort<T>` handles instead of references to component-internal IDs. Moving or nesting a component MUST NOT require callers to rewrite its internal endpoint paths.

### 4.3 Containment

JSX nesting SHOULD express containment by default. Containment alone MUST NOT completely determine layout membership, paint order, or link routing.

An object MUST have exactly one containment parent. Additional layout, routing, and paint relations MAY reference any number of other objects.

## 5. Elements, content, and sizing

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

## 6. Layout

### 6.1 Composition

Layouts MUST compose recursively. At least the following strategies SHOULD be available:

- Row;
- Column;
- Stack;
- Overlay;
- Grid;
- Tree;
- Radial;
- Graph or Layered;
- unconstrained arrangement governed by constraints.

A layout MUST have an explicit member set. JSX children MAY be shorthand for that set.

Both of these possible forms may normalize to the same `LayoutIR`:

```tsx
<Row>
  <Service id="orders" />
  <Service id="billing" />
</Row>
```

```tsx
<Scope layout={{ kind: "row" }}>
  <Service id="orders" />
  <Service id="billing" />
</Scope>
```

### 6.2 Ordering

The syntactic order of JSX children MUST NOT generally imply geometric order. The default MUST be `auto`: the solver may select an order based on crossings, route length, constraints, and space requirements.

Layouts and components MUST be able to state order explicitly, including:

- complete source order;
- partial `before` and `after` relations;
- adjacency without total order;
- grouping of several objects;
- ordering of links or segments at a dock or inside a channel.

Text runs, sequences, and other semantically ordered content MAY use dedicated components that explicitly enforce source order.

### 6.3 Layout and routing

Layout MUST be able to account for routing space. A layout run MUST NOT assume that links are drawn afterward with no space requirement.

The grammar MUST distinguish whether a connection:

- reserves no space and is merely overlaid;
- reserves routing space;
- may additionally influence layout ordering or grouping.

## 7. Docks and dock groups

### 7.1 Docks

A dock MUST express at least:

- local ID or role;
- allowed, preferred, or required side;
- automatic or constrained position along that side;
- supported direction or entry/exit axis;
- optional capacity and minimum spacing;
- optional order constraints for attached segments.

A segment endpoint MUST be able to reference an element without an explicit dock. The router then selects a compatible automatic dock or creates an automatic attachment point.

A dock MUST be able to contain an `Input` or `Output` binding:

```tsx
<Dock id="request" side="left">
  <Input bind={inputs.request} />
</Dock>
```

The binding connects an opaque component port to a concrete internal endpoint. A component MAY instead forward a port handle to a child component without binding it locally.

### 7.2 Dock groups

Several link segments MUST be able to attach to the same dock. A dock MUST support multiple dock groups so that segments at the same physical region can use different sharing rules.

A segment endpoint MUST be able to select:

- the dock group it belongs to;
- whether it must remain separate;
- whether it allows, prefers, or requires a shared path;
- the logical subgroup with which it may join.

At least these join policies MUST be representable:

- `require`;
- `prefer`;
- `allow`;
- `forbid`.

At least these sharing modes MUST be distinct:

- `merge`: one genuinely shared drawn segment;
- `bundle`: separate, closely parallel segments;
- `auto`: the router chooses a compatible mode.

Different colors or incompatible line styles MAY prevent `merge`, but need not prevent an explicitly permitted `bundle`.

### 7.3 Branching

Segments in a dock or join group MUST be able to share a path for some distance and then branch.

The branch location MUST be constrainable by a region rather than only by a coordinate. Such a region MAY be a channel, scope region, inter-layout gap, or other named routing region.

When no exact branch location is specified, the default preference MUST maximize the shared path. The authoring surface MAY spell this `late`. Further preferences such as `early`, `balanced`, `near-source`, or `near-target` SHOULD be possible.

## 8. Component ports, links, segments, and hierarchical routing

### 8.1 Component ports

Composability is a primary language property. A component MUST be able to declare typed input and output properties without exposing its internal element IDs.

The TSX runtime MUST provide opaque port handles with at least this conceptual type surface:

```ts
type PortCardinality = "one" | "optional" | "many";

interface PortOptions {
  cardinality?: PortCardinality;
}

type InputPort<T> = PortHandle<T, "input">;
type OutputPort<T> = PortHandle<T, "output">;

declare function input<T>(options?: PortOptions): InputPort<T>;
declare function output<T>(options?: PortOptions): OutputPort<T>;
```

An input or output port is a connection half, not a visual node. A component binds it to an internal dock with `Input` or `Output`, or forwards it unchanged to a child component:

```tsx
type ServiceProps = {
  inputs: { request: InputPort<Request> };
  outputs: { result: OutputPort<Result> };
};

function Service({ inputs, outputs }: ServiceProps) {
  return (
    <Scope id="service">
      <Node id="api">
        <Dock id="request" side="left">
          <Input bind={inputs.request} />
        </Dock>
        <Dock id="result" side="right">
          <Output bind={outputs.result} />
        </Dock>
      </Node>
    </Scope>
  );
}
```

By default, a port MUST be bound exactly once and connected to exactly one compatible opposite half. A component MAY explicitly declare `optional` or `many` cardinality. Output-to-output and input-to-input connections MUST be rejected. TypeScript SHOULD reject incompatible `T` parameters during development; the normalizer MUST retain enough runtime type metadata to reject incompatible bindings when static checking was not performed.

All required ports MUST be closed by the time the document root is normalized. Port handles and component interfaces are TSX-level composition constructs and MUST NOT be serialized as unresolved handles in Logical IR. Provenance MAY preserve the component and property through which a resolved endpoint originated.

### 8.2 Links and segments

A `Link` is the semantic connection unit. It MUST be declarable in every scope and MUST contain any number of segments. A `Segment` connects one output half to one input half and MAY carry its own label, style, ordering rules, sharing rules, and route intent.

```tsx
<Link id="request">
  <Segment
    from={clientRequest}
    to={gatewayRequest}
    label="exact request"
  />
  <Segment
    from={gatewayForward}
    to={workerRequest}
    label="forward to worker Pod"
  />
</Link>
```

Segment child order MUST default to `auto`; topology follows endpoints and explicit constraints, not JSX source order. A link MAY form a chain, a forest, or a branching graph when endpoint cardinalities permit it.

For a single segment, `from`, `to`, and segment properties on `Link` MUST be accepted as shorthand:

```tsx
<Link
  id="status"
  from={workerStatus}
  to={clientStatus}
  label="progress + structured result"
/>
```

This form normalizes to a `Link` containing one implicit `Segment`. `Arrow` MAY remain as a library or compatibility shorthand for a one-segment `Link`, but it is not the normative composition primitive.

Inside a component implementation, segment endpoints MAY also use relative dock references. Across component boundaries, opaque port handles SHOULD be used so that callers do not depend on component internals.

### 8.3 Implicit hierarchy traversal

A segment's endpoints determine their containing scopes after port binding. The normalizer MUST infer the necessary hierarchy path by ascending from the source to the least common ancestor and descending to the target. Authors MUST NOT have to enumerate `parent`, `parent.parent`, or every crossed boundary.

With no route property, hierarchy traversal is fully automatic:

```tsx
<Segment from={producerResult} to={consumerRequest} />
```

The route model MUST accept sparse logical constraints. The current helper vocabulary is:

```ts
leave({ axis?, side? })
use(regionRef, { axis? })
avoid(regionRef)
prefer(regionRef)
arrive({ axis?, side?, dock? })
```

For example:

```tsx
<Segment
  from={gatewayForward}
  to={workerRequest}
  label="forward to worker Pod"
  route={[
    leave({ axis: "vertical" }),
    use("control-channel", { axis: "horizontal" }),
    use("fleet-channel", { axis: "horizontal" }),
    avoid("scheduler"),
    arrive({ side: "bottom" }),
  ]}
/>
```

`leave()` MUST climb through as many containing scopes as required by the next explicit anchor or by the inferred least common ancestor. `use()` MAY occur any number of times. A named region determines the scope in which it exists; the transitions required to reach and leave that region are implicit. `arrive()` MUST include the implicit descent to the target.

Explicit parent counts or ancestor paths MAY exist as a low-level escape hatch, but SHOULD NOT be the normal authoring form because they couple a component to its nesting depth.

### 8.4 Segment labels

A label belongs to a segment, not to the link as a whole. The one-segment Link shorthand MAY expose `label` directly because it unambiguously addresses its implicit segment.

The label position MUST support semantic placement on the resolved route:

```ts
type SegmentLabelPlacement =
  | "auto"
  | "source-exit"
  | "outermost"
  | "longest"
  | "target-entry";
```

An implicit route part MUST be selectable through a stable semantic role rather than a fragile numeric route index. Rich structured label content MAY be added later, but plain text MUST be supported.

### 8.5 Cardinality, joining, and branching

The default `one` cardinality makes connection halves linear resources. An `OutputPort<T>` with `many` cardinality MAY be the source of several segments; an `InputPort<T>` with `many` cardinality MAY be the target of several segments.

Fan-out, fan-in, joining, shared trunks, bundling, and split placement MUST remain explicit policies. Reusing a `many` port permits topology but MUST NOT by itself require geometric path sharing. Dock groups, join subgroups, sharing mode, branch regions, and branch preference control the resulting route network.

### 8.6 Semantics and geometry

The grammar and IR MUST keep four levels separate:

1. TSX component ports and port forwarding;
2. semantic links and their independently labelable segments;
3. route networks containing trunks, bundles, joins, branches, and inferred hierarchy traversal;
4. concrete geometric lines, curves, labels, and arrowheads.

Several semantic segments MAY refer to one geometric route segment. A renderer MUST NOT accidentally produce multiple overlapping strokes for a merged path.

## 9. Channels, corridors, and pressure

A `Channel` MUST describe a logically referencable routing region. It MUST support at least:

- horizontal, vertical, or automatically selected primary axis;
- the containment or routing region in which it exists;
- minimum and preferred track spacing;
- optional capacity;
- packing pressure;
- optional ordering or grouping of contained paths;
- rules for permitted links, segments, bundles, or sharing modes.

Packing pressure MUST be an optimization weight that penalizes occupied cross-sectional width. It MUST NOT override hard minimum spacing or join prohibitions.

High pressure SHOULD:

- move tracks closer to their minimum spacing;
- make allowed bundles more attractive;
- make shared paths more attractive when joining is permitted.

The exact scale and unit of `pressure` remain to be specified.

## 10. Constraints

Constraints MUST be typed and serializable. Arbitrary JavaScript predicates MUST NOT enter Logical IR.

Every constraint MUST have a strength:

- `required` for a hard requirement;
- a weighted preference for a soft requirement.

At least these constraint families SHOULD be available:

- `before` and `after`;
- `adjacent`;
- `align`;
- `distribute`;
- `sameWidth`, `sameHeight`, and `sameSize`;
- `near`;
- `inside`;
- `avoidOverlap`;
- `avoidCrossing`;
- ordering of elements, docks, links, segments, or tracks;
- routing through or outside a region;
- paint order before or behind an object.

Partial-order constraints MUST be preferred. Objects not mentioned remain unconstrained. Cycles in hard ordering constraints MUST produce diagnostics.

## 11. Styling and presentation

Semantics and presentation MUST remain separate. An element SHOULD carry roles and classes:

```tsx
<Node id="database" role="storage" className="critical" />
```

Themes or CSS-like rules MAY derive shape, color, typography, padding, roughness, and other presentation properties from them.

Inline styles MAY be supported. Properties that influence intrinsic size or routing space MUST be resolved before layout. Purely painterly properties MAY be applied later.

Logical IR MUST NOT contain Excalidraw-specific object classes. Standard styles MUST be typed; renderer or library extensions MUST have a namespace.

## 12. Illustrative TSX draft

The following example demonstrates the current grammar direction. Property details may still evolve, but the component-port and Link/Segment model is normative at the conceptual level:

```tsx
type ClientProps = {
  inputs: { result: InputPort<Result> };
  outputs: { request: OutputPort<Request> };
};

function Client({ inputs, outputs }: ClientProps) {
  return (
    <Scope id="client" role="client">
      <Node id="ui">
        <Dock id="request" side="right">
          <Output bind={outputs.request} />
        </Dock>
        <Dock id="result" side="right">
          <Input bind={inputs.result} />
        </Dock>
      </Node>
    </Scope>
  );
}

type GatewayProps = {
  inputs: { request: InputPort<Request> };
  outputs: { forward: OutputPort<Request> };
};

function Gateway({ inputs, outputs }: GatewayProps) {
  return (
    <Scope id="gateway" role="gateway">
      <Node id="router">
        <Dock id="request" side="left">
          <Input bind={inputs.request} />
        </Dock>
        <Dock id="forward" side="bottom">
          <Output bind={outputs.forward} />
        </Dock>
      </Node>
    </Scope>
  );
}

type WorkerProps = {
  inputs: { request: InputPort<Request> };
  outputs: { result: OutputPort<Result> };
};

function Worker({ inputs, outputs }: WorkerProps) {
  return (
    <Scope id="worker" role="worker">
      <Node id="process">
        <Dock id="request" side="bottom">
          <Input bind={inputs.request} />
        </Dock>
        <Dock id="result" side="top">
          <Output bind={outputs.result} />
        </Dock>
      </Node>
    </Scope>
  );
}

const clientRequest = output<Request>();
const gatewayRequest = input<Request>();
const gatewayForward = output<Request>();
const workerRequest = input<Request>();
const workerResult = output<Result>();
const clientResult = input<Result>();

export default (
  <Diagram>
    <Channel
      id="request-channel"
      axis="horizontal"
      pressure={0.8}
      spacing={{ min: 4, preferred: 12 }}
    />

    <Row order="auto">
      <Client
        inputs={{ result: clientResult }}
        outputs={{ request: clientRequest }}
      />
      <Gateway
        inputs={{ request: gatewayRequest }}
        outputs={{ forward: gatewayForward }}
      />
      <Worker
        inputs={{ request: workerRequest }}
        outputs={{ result: workerResult }}
      />
    </Row>

    <Link id="request">
      <Segment
        from={clientRequest}
        to={gatewayRequest}
        label="exact request"
      />
      <Segment
        from={gatewayForward}
        to={workerRequest}
        label="forward to worker Pod"
        labelAt="outermost"
        layoutEffect="reserve"
        route={[
          leave({ axis: "vertical" }),
          use("request-channel", { axis: "horizontal" }),
          arrive({ side: "bottom" }),
        ]}
      />
    </Link>

    <Link
      id="result"
      from={workerResult}
      to={clientResult}
      label="progress + structured result"
      layoutEffect="reserve"
    />
  </Diagram>
);
```

## 13. Logical IR data model

### 13.1 General invariants

Logical IR MUST be a normalized, renderer-neutral graph model. It MUST NOT contain TypeScript functions, prototypes, symbols, cyclic JavaScript objects, or renderer instances.

Every IR entity MUST have a compiler-internal `EntityKey`. Such a key:

- is not written by the author;
- is unique within one IR document;
- connects normalized tables;
- is not a global domain ID;
- must be assigned deterministically for identical input;
- need not remain stable across arbitrary source edits.

Explicit author IDs remain local bindings of their scope. The normalizer MUST resolve author references to `EntityKey` values and report missing or ambiguous targets.

TSX `InputPort<T>` and `OutputPort<T>` handles MUST be fully resolved before Logical IR is emitted. They are not IR entities. Their bindings become resolved segment endpoints, while optional provenance records the component property and internal dock involved.

Canonical human-readable serialization MAY emit unique relative paths instead of internal keys. Reading that serialization MUST resolve the paths again.

### 13.2 Document and entities

The following TypeScript draft describes the required shape. Names and details may change during grammar design.

```ts
type EntityKey = number;
type LocalId = string;

type EntityKind =
  | "scope"
  | "element"
  | "layout"
  | "dock"
  | "dock-group"
  | "channel"
  | "link"
  | "segment"
  | "constraint";

interface LogicalIR {
  schema: "excalmermaid.logical";
  version: string;
  root: EntityKey;
  entities: readonly EntityIR[];
  paint: readonly PaintRelationIR[];
  extensions?: Readonly<Record<string, unknown>>;
}

type EntityIR =
  | ScopeIR
  | ElementIR
  | LayoutIR
  | DockIR
  | DockGroupIR
  | ChannelIR
  | LinkIR
  | SegmentIR
  | ConstraintIR;

interface EntityBase<Kind extends EntityKind> {
  key: EntityKey;
  kind: Kind;
  id?: LocalId;
  ownerScope: EntityKey | null;
  parent: EntityKey | null;
  roles: readonly string[];
  classes: readonly string[];
}
```

`ownerScope` identifies the lexical scope. `parent` identifies containment. For a nested scope, `ownerScope` points to the outer scope, while declarations inside it use the nested scope as `ownerScope`.

### 13.3 Scopes and elements

```ts
interface ScopeIR extends EntityBase<"scope"> {
  children: readonly EntityKey[];
  defaultLayout?: EntityKey;
}

interface ElementIR extends EntityBase<"element"> {
  primitive: PrimitiveSpec;
  content: readonly ContentSpec[];
  children: readonly EntityKey[];
  docks: readonly EntityKey[];
  size: SizePolicy;
  style?: StyleSpec;
}

type PrimitiveSpec =
  | { kind: "rectangle"; cornerRadius?: number }
  | { kind: "ellipse" }
  | { kind: "diamond" }
  | { kind: "text" }
  | { kind: "image"; source: string }
  | {
      kind: "extension";
      namespace: string;
      name: string;
      data: Readonly<Record<string, unknown>>;
    };

type ContentSpec =
  | { kind: "text"; value: string; role?: string }
  | { kind: "icon"; name: string; namespace?: string }
  | { kind: "image"; source: string; alt?: string };

interface SizePolicy {
  width: SizeValue;
  height: SizeValue;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  aspectRatio?: number;
}

type SizeValue =
  | { kind: "auto" }
  | { kind: "content" }
  | { kind: "fixed"; value: number }
  | { kind: "fill"; weight?: number };
```

The units of fixed sizes remain to be specified. They must not be confused with absolute positions.

### 13.4 Layout

```ts
interface LayoutIR extends EntityBase<"layout"> {
  container: EntityKey;
  members: readonly EntityKey[];
  strategy: LayoutStrategy;
  order: OrderingPolicy;
}

type LayoutStrategy =
  | { kind: "row"; gap?: number }
  | { kind: "column"; gap?: number }
  | { kind: "stack" }
  | { kind: "overlay" }
  | { kind: "grid"; columns?: number; rows?: number; gap?: number }
  | { kind: "tree"; direction?: Direction }
  | { kind: "radial" }
  | { kind: "layered"; direction?: Direction }
  | { kind: "constraint" };

type Direction = "top-down" | "bottom-up" | "left-right" | "right-left";

type OrderingPolicy =
  | { kind: "auto" }
  | { kind: "source" }
  | { kind: "constraints"; constraints: readonly EntityKey[] };
```

When `order` is `auto`, the order of `members` is not a geometric instruction. It remains available for provenance and deterministic processing.

### 13.5 Docks and groups

```ts
type Side = "auto" | "top" | "right" | "bottom" | "left";
type Axis = "auto" | "horizontal" | "vertical";

interface DockIR extends EntityBase<"dock"> {
  owner: EntityKey;
  side: Side;
  axis: Axis;
  groups: readonly EntityKey[];
  capacity?: number;
  minSpacing?: number;
}

type JoinPolicy = "require" | "prefer" | "allow" | "forbid";
type SharingMode = "auto" | "merge" | "bundle";

interface DockGroupIR extends EntityBase<"dock-group"> {
  dock: EntityKey;
  join: JoinPolicy;
  sharing: SharingMode;
  branch: BranchPolicy;
  orderConstraints: readonly EntityKey[];
}

interface BranchPolicy {
  within?: EntityKey;
  preference:
    | "maximize-shared-path"
    | "early"
    | "balanced"
    | "near-source"
    | "near-target";
}
```

An additional join subgroup per segment endpoint is required so that not every segment in the same dock group joins automatically.

### 13.6 Channels

```ts
interface ChannelIR extends EntityBase<"channel"> {
  region: EntityKey;
  axis: Axis;
  spacing: {
    min: number;
    preferred: number;
  };
  pressure: number;
  capacity?: number;
  orderConstraints: readonly EntityKey[];
  allowedSharing?: readonly SharingMode[];
}
```

`region` references the containment or layout region in which the channel may reserve space. A channel can itself be a referencable region for branch and route constraints.

### 13.7 Links, segments, endpoints, and route intent

```ts
interface LinkIR extends EntityBase<"link"> {
  segments: readonly EntityKey[];
  style?: SegmentStyleSpec;
  order: OrderingPolicy;
}

interface SegmentIR extends EntityBase<"segment"> {
  link: EntityKey;
  origin: "explicit" | "implicit";
  from: EndpointIR;
  to: EndpointIR;
  direction: "directed" | "undirected" | "bidirectional";
  layoutEffect: "none" | "reserve" | "structural";
  route: RouteIntentIR;
  style?: SegmentStyleSpec;
  labels: readonly SegmentLabelIR[];
}

interface EndpointIR {
  target: EntityKey;
  dock?: EntityKey;
  dockGroup?: EntityKey;
  join?: {
    group?: LocalId;
    policy?: JoinPolicy;
    sharing?: SharingMode;
  };
}

interface RouteIntentIR {
  hints: readonly RouteHintIR[];
  scopePath: readonly ScopeTraversalIR[];
  branch?: BranchPolicy;
}

type RouteHintIR =
  | { kind: "leave"; axis: Axis; side?: Side }
  | { kind: "use"; region: EntityKey; axis: Axis }
  | { kind: "avoid"; region: EntityKey }
  | { kind: "prefer"; region: EntityKey }
  | { kind: "arrive"; axis: Axis; side?: Side; dock?: EntityKey };

interface ScopeTraversalIR {
  scope: EntityKey;
  role:
    | "source-exit"
    | "ancestor"
    | "explicit-anchor"
    | "least-common-ancestor"
    | "target-entry";
  origin: "explicit" | "implicit";
}

type SegmentLabelPlacement =
  | "auto"
  | "source-exit"
  | "outermost"
  | "longest"
  | "target-entry";

interface SegmentLabelIR {
  text: string;
  placement: SegmentLabelPlacement;
  role?: string;
}

interface SegmentStyleSpec {
  stroke?: string;
  width?: number;
  dash?: readonly number[];
  sourceHead?: string;
  targetHead?: string;
}
```

`LinkIR.segments` is a membership relation, not necessarily a linear order. Segment endpoint topology and explicit ordering constraints determine chains and branches.

An implicit one-segment Link shorthand MUST produce a `SegmentIR` with `origin: "implicit"`. Explicit `<Segment>` declarations produce `origin: "explicit"`.

`RouteIntentIR.scopePath` records logically inferred containment traversal, including the least common ancestor and any explicit channel owners. It does not describe a completed polyline. Concrete portals, tracks, bends, and curves MAY first appear in Solved IR.

### 13.8 Constraints and paint order

```ts
type Strength =
  | { kind: "required" }
  | { kind: "preference"; weight: number };

interface ConstraintBase<Type extends string>
  extends EntityBase<"constraint"> {
  type: Type;
  strength: Strength;
}

type ConstraintIR =
  | (ConstraintBase<"order"> & {
      before: EntityKey;
      after: EntityKey;
      within?: EntityKey;
    })
  | (ConstraintBase<"adjacent"> & {
      members: readonly EntityKey[];
      within?: EntityKey;
    })
  | (ConstraintBase<"align"> & {
      members: readonly EntityKey[];
      edge: Side | "center-x" | "center-y";
    })
  | (ConstraintBase<"same-size"> & {
      members: readonly EntityKey[];
      dimension: "width" | "height" | "both";
    })
  | (ConstraintBase<"near"> & {
      first: EntityKey;
      second: EntityKey;
    })
  | (ConstraintBase<"avoid-overlap"> & {
      members: readonly EntityKey[];
    });

interface PaintRelationIR {
  before: EntityKey;
  after: EntityKey;
  strength: Strength;
}
```

Further constraint types MUST be introduced as new tagged variants or namespaced extensions. Unstructured solver expressions MUST NOT be part of the portable core format.

### 13.9 Styles and extensions

```ts
interface StyleSpec {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  fontFamily?: string;
  fontSize?: number;
  padding?: number;
  roughness?: number;
  extensions?: Readonly<Record<string, unknown>>;
}
```

Every extension key MUST be qualified by a stable namespace. A consumer MUST reject unknown required extensions and MAY preserve unknown optional extensions unchanged.

## 14. Normalization and validation

Normalization MUST include at least these phases:

1. Transform TSX and evaluate it in a JavaScript context.
2. Expand components recursively.
3. Normalize fragments, arrays, and empty expressions.
4. Collect core declarations and build containment.
5. Build lexical scopes and local bindings.
6. Collect TSX port allocations, local bindings, and forwarded bindings.
7. Resolve every required port to a concrete internal endpoint.
8. Resolve relative references.
9. Lower one-segment Link shorthand to an implicit segment.
10. Canonicalize defaults and other shorthand forms.
11. Assign `EntityKey` values deterministically.
12. Infer scope traversal paths, least common ancestors, and explicit region anchors.
13. Perform structural and semantic validation.
14. Emit Logical IR and optional provenance.

At least these errors MUST be detected before solving:

- more than one diagram root;
- duplicate IDs in the same scope;
- missing or ambiguous references;
- references that traverse above the root scope;
- required ports that are unbound or unconnected;
- ports bound more often than their cardinality permits;
- output-to-output or input-to-input segment endpoints;
- statically or dynamically incompatible port payload types;
- port handles or component functions remaining after lowering;
- segments that do not belong to exactly one link;
- contradictory one-segment Link shorthand and explicit Segment children;
- dock groups attached to the wrong dock;
- incompatible required join rules;
- invalid or empty layout membership;
- cycles in hard partial orders;
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

The fixtures define required semantic and layout capabilities. They do not require pixel-identical output. A conforming result MUST preserve containment, major relative placement, visible content, link connectivity, segment labels, route hierarchy, path sharing, boundaries, and style roles closely enough that the reference remains recognizably the same drawing.

The initial fixtures are:

| Fixture | Primary coverage |
| --- | --- |
| [`vegvisir-voice-agents`](examples/vegvisir-voice-agents/) | nested scopes, image content, ellipse and diamond shapes, bidirectional links, cross-scope shared trunks, dock groups, and labeled segments |
| [`modelplane-fleet-inference`](examples/modelplane-fleet-inference/) | legends, repeated components with ports, two independent cross-hierarchy buses, external nodes, dashed status elements, and a footer |
| [`agent-substrate`](examples/agent-substrate/) | deep containment, overlapping routing levels, sparse route constraints, boundary-spanning links, nested runtime isolation, and annotations |
| [`machine-thought-os`](examples/machine-thought-os/) | horizontal boundary, many-cardinality ports, fan-out and fan-in, shared data feeds, deferred work, overlays, and a hierarchy-crossing return path |

A grammar change MUST update all affected fixture files. A future executable fixture lifecycle SHOULD produce:

- `logical.yaml`, the canonical normalized IR;
- `solved.yaml`, the selected solver result;
- `rendered.png`, the renderer result used for visual regression testing.

The checked-in TSX fixtures MUST become normalization and render golden tests as soon as an implementation exists.

## 18. Conformance scenarios

The first grammar and IR version MUST cover at least these golden scenarios:

1. A component is instantiated twice and produces the same local IDs in both scopes without collision.
2. A component forwards an input port to a child, and the final binding remains valid after another scope is inserted around either component.
3. A component caller connects ports without referencing any component-internal IDs.
4. A required port that is not bound or connected produces a source-located diagnostic.
5. Input-to-input, output-to-output, payload-type, and cardinality violations produce diagnostics.
6. A one-segment Link shorthand normalizes to a Link and an implicit Segment.
7. A Link contains several explicitly declared segments, each retaining its own label and style.
8. A segment connects endpoints across several scope boundaries without naming any parent scope.
9. The inferred scope path ascends to the least common ancestor and descends to the target deterministically.
10. A sparse route uses several named channels and automatically infers the hierarchy transitions between them.
11. Several segments attach to the same dock group, share a trunk, and branch as late as possible inside a channel.
12. Two segments at the same dock use different join subgroups and cannot share a trunk.
13. A `many` output creates explicit fan-out without implicitly requiring merged geometry.
14. High channel pressure reduces preferred spacing without violating minimum spacing.
15. Unordered layout and Link members may be reordered by the solver.
16. A partial-order constraint fixes only the stated relation.
17. A cycle of hard ordering constraints produces a diagnostic.
18. TSX normalizes deterministically to the same Logical IR.
19. JSON and YAML representations read back to the same Logical IR.
20. Go and Rust consumers read the same IR and recognize the same core features.
21. Every reference fixture normalizes without absolute positions or unresolved TSX port handles.
22. Every reference fixture preserves its named scopes, nodes, links, segments, resolved endpoints, labels, and route intents through serialization.

## 19. Open grammar decisions

The following details must be decided next by comparing the concrete TSX fixtures:

- the runtime representation of `InputPort<T>` and `OutputPort<T>` payload types when `tsc` was not run;
- whether component ports conventionally use grouped `inputs` and `outputs` properties or permit individually named properties equally;
- the exact names of the `input()`, `output()`, `Input`, and `Output` APIs;
- the exact rules for `optional` and `many` cardinality and connection completeness;
- strings versus typed `ref()` objects for internal references and routing regions;
- syntax and separators for relative element, dock, and group paths;
- layout as component, property, or both;
- text as child, `label` property, or structured content;
- rich segment-label content and the complete set of semantic label-placement selectors;
- exact core shape set;
- separation and interaction of dock group and join subgroup;
- whether explicit segments require local IDs and how implicit segment identities are serialized;
- whether `Arrow` remains a compatibility shorthand or is removed from the public API;
- automatic IDs for anonymous elements and their stability guarantees;
- inline styles versus a CSS-like cascade;
- exact units for size, spacing, pressure, and weights;
- representation of resolved references in canonical JSON and YAML;
- which core shorthand forms normalization accepts;
- which provenance data the JSX runtime must capture;
- how Links that contain disconnected segment subgraphs communicate their semantic grouping;
- how shared trunks and fan-out/fan-in policies map to route networks;
- how reference fixtures express relative placement without turning preferences into accidental hard order.
