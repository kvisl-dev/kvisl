# Excalmermaid Data Model

Status: Working draft

This document defines the conceptual data model and the Logical IR. [REQUIREMENTS.md](REQUIREMENTS.md) states what the system must do; this document defines the shapes those requirements normalize into. Nothing here is final; the reference fixtures under [`examples/`](examples/) are the ground truth the model must be able to express.

## 1. Principles

1. **Normalized graph.** After TSX evaluation and component expansion, a diagram is a flat, renderer-neutral entity graph. No functions, no renderer objects, no pixel coordinates.
2. **Four independent relations.** Containment (a tree), layout (membership plus constraints), routing (regions and lines), and paint order are separate relations over the same entities.
3. **Orientation is local.** Every scope has a local frame. All directional vocabulary — sides, axes, row/column — is expressed in the local frame. Rotating a scope re-orients its entire subtree without touching any child declaration.
4. **Whitespace is the routing plane.** Corridors are not free-floating entities. They are the gaps and padding bands that layout produces anyway — implicit, addressable, and space-reserving, like margin and padding in CSS. A `Corridor` declaration refines such a region; it never invents one detached from the structure.
5. **Lines are symmetric and segmented.** A line has two interchangeable ends. It consists of an ordered list of segments; most are implicit and inferred, some are explicitly pinned to a region or waypoint and can carry labels there.
6. **Named ports create joins.** Every port is identified by its owner and local ID. All line ends at that canonical port form one topological join; the port's sharing policy determines whether their adjacent paths merge, bundle, separate, or remain router-selected.
7. **Entity-only endpoints own their docks.** A line end that names no port receives a distinct dock identity derived from that line and end. Coincident automatic docks do not imply a join.
8. **Containers are addressable.** Every author-declared structural container has a local ID and contributes one segment to its canonical containment path. Reusable components therefore create nested namespaces without requiring global IDs.
9. **Views are renderer-instantiated meta branches.** View templates are invisible to ordinary paths. A renderer creates context, scores the alternatives, and materializes one branch without changing the component's semantic identity or canonical ports.

## 2. Frames and orientation

Every scope owns a **local frame**: from the author's point of view inside the scope, x runs right and y runs down. All directions written inside a scope are interpreted in this frame:

- sides: `top`, `right`, `bottom`, `left`;
- axes: `horizontal`, `vertical`;
- layout strategies: `row` flows along local x, `column` along local y;
- note placements, corridor axes, and endpoint side hints.

A scope declares its orientation relative to its parent frame:

```ts
type Orientation = 0 | 90 | 180 | 270; // clockwise, default 0
```

The physical direction of anything is the composition of all ancestor orientations. Setting `orientation={90}` on one scope therefore rotates its complete subtree — layouts, ports, corridors, line routes — while every declaration inside stays untouched. Components authored for a horizontal flow can be embedded rotated in a vertical context.

Rules:

- Orientation is author-set. The solver does not rotate scopes on its own. An `auto` orientation may be added later as an explicit opt-in.
- Text content stays physically upright by default. `textOrientation: "upright" | "frame"` controls whether text rotates with the frame. Intrinsic size measurement happens in the resolved physical orientation.
- Mirroring (flips) is not part of the first model version and is listed as an open decision.

## 3. Containment, containers, and identity

A `Scope` owns a semantic boundary and local frame and is by default also a containment region. Every ordinary structural container — including `Diagram`, `Scope`, explicit layout containers, `PortGroup`, and elements that own diagram entities — has a required local ID. IDs are unique among direct siblings, never globally. Every ordinary container contributes a segment to the canonical containment path; layout containers are therefore addressable even though their purpose remains layout rather than semantic scoping.

`View`, `When`, and `Switch` also require IDs, but they belong to a separate meta tree. Neither a meta container nor any unmaterialized template descendant appears in ordinary path lookup.

References are resolved relative to their containing ordinary container. `/` descends into a named child container, `..` ascends one container, and `.` selects a named port on an entity. For example:

```text
platform/production/control-plane/api.request
```

The address remains stable across component-view selection. `production/internals/layout` cannot accidentally reach a view named `internals`; normal lookup never enters that meta branch. A reusable component may contain the same relative path in every instance because its root container ID creates the instance namespace.

Every entity has exactly one containment parent. Layout, routing, and paint relations may reference any entities regardless of containment.

Port-group JSX children are membership shorthand rather than containment. Ports remain directly owned by their element or scope, so placing `tasks` inside `<PortGroup id="loop">` does not change the endpoint from `voice-agent.tasks` to `voice-agent/loop/tasks`. The group itself remains an addressable relation entity.

Scopes are full endpoints: they can carry ports, be targets of lines, and be anchors for notes.

## 4. Elements, content, and sizing

An `Element` (`Node` in the authoring surface) is a visible or intrinsically measurable object: a shape primitive with structured content (text runs, icons, images), ports, and a size policy. Sizing is intrinsic by default — derived from content, padding, and minimum/maximum bounds. Fixed sizes are geometric constraints, not positions.

## 5. Layout

A layout arranges an explicit member set inside a container. JSX children are shorthand for that set. Strategies compose recursively: `row`, `column`, `stack`, `overlay`, `grid`, `tree`, `radial`, `layered`, `constraint`.

**Ordering.** The default ordering policy is `prefer-source`: source order is a soft preference the solver may override only when it clearly reduces crossings, route length, or space. `free` releases the order entirely; `fixed` makes source order a hard constraint. This replaces the earlier `auto` default — the fixtures showed that authors reach for source order almost everywhere, so it should be the cheap default rather than an annotation on every layout.

### 5.1 Component views

A component view is a named meta branch owned by a component scope. Its descendants are template declarations, not active diagram entities. The branch and its template-local IDs are available to normalization, validation, scoring, and explicit meta-reference validation, but ordinary path resolution cannot see them.

The renderer creates an immutable context for each component instance. It contains target properties, current outside-in allocation, inherited purpose and audience, semantic state, and renderer capabilities. Each view evaluates a serializable score expression against that context. The highest-scoring viable view wins; its template is materialized into Projection IR. Conditions inside the winning branch then adapt its instantiated structure and paths using the same context.

Footprint, readability, routing space, and hard constraints can invalidate a tentative winner and cause deterministic fallback or rescoring. Logical IR retains all templates and score expressions. Projection IR records concrete render instances and the winning score explanation; Solved IR retains their provenance.

The owner and its ports exist independently of every view. `PortPlacement` maps a stable port onto a template anchor without cloning its semantic identity. External connections normally target those stable ports.

An ordinary deep endpoint is resolved against Projection IR. If the selected rendering did not instantiate its complete suffix, the endpoint truncates to the deepest instantiated object and attaches there automatically.

An exceptional endpoint-alternative reference contains a common ordinary prefix and cases keyed by the selected view of an object on that path. For `api.{foo#view:abc, foo:bar}`, view `view` continues through branch-local `abc`; the unqualified case continues through ordinary `bar`. Exact view cases precede the default, and truncation remains the final fallback. The `#view` selector is part of this endpoint expression only and never exposes the meta tree to general path lookup.

## 6. Whitespace: margins, padding, gaps, and corridors

This is the CSS box model analogy at the core of routing:

- Every element and scope has a **margin** (whitespace demanded outside its border) and every container a **padding** (whitespace between its border and its content).
- The whitespace between two layout siblings — merged margins plus the layout gap — is a **gap region**.
- The whitespace between a container's border and its content on one side is a **padding band**.

Gap regions and padding bands are the diagram's **corridors**. They exist implicitly for every layout; they are addressable; and lines route through them by default. Like margins in CSS, they interact with layout: a corridor that carries tracks widens until its content fits, and the surrounding layout moves accordingly. Routing is therefore never an overlay pass on finished geometry.

Regions are addressed structurally:

```ts
gap(a, b)              // whitespace between two layout siblings
padding(container, side) // whitespace band inside a container edge (local side)
```

A `Corridor` declaration refines an implicit region:

- names it, so segments and constraints can reference it;
- sets minimum and preferred track spacing, capacity, and packing pressure;
- orders tracks and other corridors within the same region (several corridors may subdivide one gap, ranked by declaration order by default);
- optionally carries a **divider**: a drawn separation line with a label. A horizontal boundary line between two bands is a decorated gap, not an element.

**Pressure** is an optimization weight penalizing occupied cross-sectional width: high pressure packs tracks toward minimum spacing and makes permitted bundles and merges more attractive. It never overrides hard minimum spacing or sharing prohibitions.

Elements may sit inside a corridor (a decision diamond in the middle of a vertical run). Track order within a corridor is constrainable, including relative to such resident elements.

## 7. Ports and port groups

A **port** is a named attachment point on an element or scope. Ports are symmetric: they have no input/output direction — direction belongs to lines. A port declares:

- a preferred or required side and position in the local frame;
- cardinality (`one`, `optional`, `many`; geometric ports default to `many`);
- capacity and minimum spacing for attached lines;
- optionally a content type tag for compatibility checking.
- an optional visible marker;
- a sharing policy for the lines joined there.

The canonical identity of a named port is `(owner entity, local port ID)`. An endpoint such as `api.request` creates that port implicitly when no declaration exists. A nested `<Port id="request" .../>`, a post-hoc `<Port ref="api.request" .../>`, and a TSX handle bound there all refine or alias that same identity. The normalizer collects these forms before merging properties, so source order is irrelevant. Conflicting explicit property values are diagnostics.

Every line end has a dock identity. An endpoint naming only `api` receives a line-owned dock whose identity is derived from `(line key, end index)` and whose position is chosen by the router. It does not synthesize the stable named port `request` or any other author-visible ID. Two lines targeting `api` without a port own distinct docks and do not join even if solving places those docks at the same coordinate.

A dock carries a base presentation style. Its line contributes an overlay to the rendered dock: non-conflicting properties from both are retained, and the line wins property conflicts. Named-port docks and line-owned docks use the same cascade. Dock-only properties such as marker shape or fill therefore compose with line properties such as stroke or width.

**Component boundaries.** Components are ordinary TSX functions. To let callers attach lines without knowing internals, the runtime provides opaque port handles:

```ts
declare function port<T>(options?: { cardinality?: "one" | "optional" | "many" }): PortHandle<T>;
```

A handle is created by the caller, passed as a prop, and bound exactly once inside the component to a concrete port (`<Port bind={handle} .../>`) or forwarded to a child component. Handles are TSX-level composition constructs; they are fully resolved before Logical IR is emitted.

**Port groups** collect several distinct ports of one owner. They are unnecessary for multiple lines at one named port. A group keeps its members adjacent and ordered, and sets the default sharing behavior for lines attached to them:

- `merge` — attached lines form a share group drawing one common path;
- `bundle` — attached lines run closely parallel but remain separate strokes;
- `free` — no implied relation (default);
- `separate` — anti-affinity: attached lines must not share and are kept visibly apart.

## 8. Lines and segments

A **line** is the semantic connection unit.

- **Two symmetric ends.** `from` and `to` are positional labels for `ends[0]` and `ends[1]`, nothing more. Arrowheads are properties: `heads = "forward" | "backward" | "both" | "none"` (default `forward`, meaning a head at `to`), with per-end head shapes available in style.
- **Endpoints** reference a port, an element, or a scope. A named port supplies the dock identity. Without a port, the endpoint owns a distinct automatic dock and the router selects its position; an optional local `side` hint constrains it.
- **A line is an ordered list of segments** from end to end. Segments are:
  - `implicit` — inferred by the normalizer: hierarchy climbs and descents toward the least common ancestor, and connective runs through implicit corridors. Authors never enumerate crossed boundaries.
  - `explicit` — authored pins. An explicit segment either passes `through` a region (a named corridor, `gap(...)`, or `padding(...)`) or `via` a waypoint entity. Explicit segments are where labels live: "this line goes out into the whitespace between the boxes, and the label sits there."

Labels belong to segments. A label has a placement along its segment (`start`, `center`, `end`, `auto`) and an orientation (`upright` or `along` the segment). A line-level `label` is sugar for an automatically placed label on the line's most prominent run.

Lines reserve routing space by default (`space: "reserve"`); `overlay` opts a line out of layout interaction. A line may list regions to `avoid`.

## 9. Sharing: port joins, groups, trunks, and branches

All line ends attached to one canonical named port belong to its topological join group. The port's sharing policy controls adjacent positive-length geometry: `merge` draws one trunk, `bundle` draws close parallel strokes, `separate` permits only the common endpoint and splits immediately, and `auto` lets the router choose. `auto` is the default.

Port-group affinity coordinates lines on several distinct ports. An explicit line share group coordinates lines with no common named port. Neither creates a second identity for a join already induced by a canonical port.

Within a share group:

- the shared path is **maximal by default**: branches happen as late as possible relative to the common end. Preferences `early` and `balanced`, and a constraining branch region (`within: gap(...)` or a corridor), remain available;
- `merge` draws one genuine shared trunk; `bundle` keeps parallel strokes; `auto` lets the router pick;
- style unification applies **only to the shared piece**: branches keep their own style (a dashed branch may leave a solid merged trunk). Incompatible styles on the shared piece downgrade `merge` to `bundle` unless merging was required, which is then a diagnostic;
- fan-out and fan-in are symmetric: a group whose common end is a target behaves identically with roles reversed.

Explicit segments of grouped lines that pin the same region are merged into one shared trunk in that region.

## 10. Notes and anchors

A `Note` is annotation content placed by an **anchor relation** instead of layout membership: `anchor` names an entity or region (default: the declaring parent), `placement` positions the note relative to it (`above`, `below`, `left`, `right`, `inside-top-left`, `inside-bottom`, `inside-bottom-right`, ..., in the anchor's local frame). A note without an anchor participates in normal layout like an element. Page furniture — titles, legends, footers — are library components built on the same mechanism.

## 11. Constraints and paint order

Constraints are typed, serializable, and carry a strength (`required` or a weighted preference). Families include ordering (`before`/`after`, also for ports, corridor tracks, and corridors within a region), `adjacent`, `align`, `same-size`, `near`, `below`/`between` conveniences, `avoid-overlap`, and routing prohibitions. Partial orders are preferred; unmentioned entities stay unconstrained; hard cycles are diagnostics.

Paint order is an independent relation of `before`/`after` pairs.

## 12. Logical IR

### 12.1 Invariants

- Every entity has a compiler-internal `EntityKey`: deterministic for identical input, unique per document, not authored, not stable across arbitrary edits.
- Author IDs remain containment-local bindings; every structural container has one, and the normalizer resolves hierarchical paths to keys.
- A port's canonical identity is its resolved owner plus local port ID, regardless of whether it was implicit, explicitly declared, configured post-hoc, or reached through a handle.
- Every entity-only endpoint has a line-owned dock identity derived deterministically from its line key and end index. Such a dock is not an entity in the ordinary address space and never creates an implicit join.
- Port handles are resolved before emission; provenance may record the component property and port involved.
- View templates remain present in the meta domain of Logical IR and are invisible to ordinary references. Renderer materialization creates separate instance keys in Projection IR.
- No functions, symbols, cycles, renderer objects, or absolute positions.

### 12.2 Document and entities

```ts
type EntityKey = number;
type LocalId = string;

type EntityKind =
  | "diagram"
  | "scope"
  | "element"
  | "layout"
  | "view"
  | "conditional"
  | "port-placement"
  | "port"
  | "port-group"
  | "corridor"
  | "line"
  | "segment"
  | "note"
  | "constraint";

interface LogicalIR {
  schema: "excalmermaid.logical";
  version: string;
  root: EntityKey;
  entities: readonly EntityIR[];
  paint: readonly PaintRelationIR[];
  extensions?: Readonly<Record<string, unknown>>;
}

interface EntityBase<Kind extends EntityKind> {
  key: EntityKey;
  kind: Kind;
  id: LocalId | null;
  domain: "ordinary" | "meta";
  ownerScope: EntityKey | null;
  parent: EntityKey | null;
  when?: ConditionIR;
  roles: readonly string[];
  classes: readonly string[];
}

type EntityIR =
  | DiagramIR
  | ScopeIR
  | ElementIR
  | LayoutIR
  | ViewIR
  | ConditionalIR
  | PortPlacementIR
  | CorridorIR
  | PortIR
  | PortGroupIR
  | LineIR
  | SegmentIR
  | NoteIR
  | ConstraintIR;
```

For `domain: "ordinary"`, `parent` is both containment and the parent used to construct author addresses. Ordinary lookup ignores every `domain: "meta"` entity. Meta parents instead form a hidden template tree rooted at a `ViewIR` or conditional meta container. `ownerScope` identifies the nearest local frame and does not participate in name resolution. `id` may be `null` only for compiler-generated or explicitly non-addressable leaf entities; it is required for every author-declared ordinary or meta container.

### 12.3 Directions, lengths, and regions

```ts
type Side = "top" | "right" | "bottom" | "left"; // always local to the owning scope's frame
type Axis = "horizontal" | "vertical";           // always local
type Orientation = 0 | 90 | 180 | 270;

type Length = number; // unit to be specified; never an absolute position

interface BoxLengths {
  top?: Length;
  right?: Length;
  bottom?: Length;
  left?: Length;
}

type RegionRef =
  | { kind: "gap"; between: readonly [EntityKey, EntityKey] }
  | { kind: "padding"; container: EntityKey; side: Side }
  | { kind: "corridor"; corridor: EntityKey };
```

### 12.4 Diagram, scopes, and elements

```ts
interface DiagramIR extends EntityBase<"diagram"> {
  id: LocalId;
  children: readonly EntityKey[];
  views: readonly EntityKey[];
}

interface ScopeIR extends EntityBase<"scope"> {
  id: LocalId;
  orientation: Orientation;
  boundary: "visible" | "invisible";
  children: readonly EntityKey[];
  ports: readonly EntityKey[];
  views: readonly EntityKey[];
  defaultLayout?: EntityKey;
  padding?: BoxLengths;
  margin?: BoxLengths;
  style?: StyleSpec;
}

interface ElementIR extends EntityBase<"element"> {
  id: LocalId;
  primitive: PrimitiveSpec;
  content: readonly ContentSpec[];
  children: readonly EntityKey[];
  ports: readonly EntityKey[];
  views: readonly EntityKey[];
  size: SizePolicy;
  margin?: BoxLengths;
  padding?: BoxLengths;
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
  | { kind: "text"; value: string; role?: string; orientation?: "upright" | "frame" }
  | { kind: "icon"; name: string; namespace?: string }
  | { kind: "image"; source: string; alt?: string };

interface SizePolicy {
  width: SizeValue;
  height: SizeValue;
  minWidth?: Length;
  minHeight?: Length;
  maxWidth?: Length;
  maxHeight?: Length;
  aspectRatio?: number;
}

type SizeValue =
  | { kind: "auto" }
  | { kind: "content" }
  | { kind: "fixed"; value: Length }
  | { kind: "fill"; weight?: number };
```

### 12.5 Layout

```ts
interface LayoutIR extends EntityBase<"layout"> {
  id: LocalId;
  container: EntityKey;
  members: readonly EntityKey[];
  strategy: LayoutStrategy;
  order: OrderingPolicy;
  gap?: Length;
}

type LayoutStrategy =
  | { kind: "row" }
  | { kind: "column" }
  | { kind: "stack" }
  | { kind: "overlay" }
  | { kind: "grid"; columns?: number; rows?: number }
  | { kind: "tree"; direction?: Direction }
  | { kind: "radial" }
  | { kind: "layered"; direction?: Direction }
  | { kind: "constraint" };

type Direction = "top-down" | "bottom-up" | "left-right" | "right-left"; // local

type OrderingPolicy =
  | { kind: "prefer-source"; weight?: number } // default
  | { kind: "free" }
  | { kind: "fixed" }
  | { kind: "constraints"; constraints: readonly EntityKey[] };
```

### 12.5.1 Component views

```ts
interface ViewIR extends EntityBase<"view"> {
  id: LocalId;
  domain: "meta";
  owner: EntityKey; // ordinary diagram, scope, or element whose identity this view preserves
  detail?: number;
  score: ScoreIR;
  requires?: ConditionIR;
  templateChildren: readonly EntityKey[];
  footprint?: ViewFootprint;
  fallback?: EntityKey;
}

interface ConditionalIR extends EntityBase<"conditional"> {
  id: LocalId;
  domain: "meta";
  mode: "when" | "switch-case";
  templateChildren: readonly EntityKey[];
}

interface ScoreIR {
  base: number;
  adjustments: readonly ScoreAdjustmentIR[];
}

interface ScoreAdjustmentIR {
  when: ConditionIR;
  add: number;
}

type ConditionIR =
  | { kind: "literal"; value: boolean }
  | { kind: "all" | "any"; operands: readonly ConditionIR[] }
  | { kind: "not"; operand: ConditionIR }
  | {
      kind: "compare";
      operator: "eq" | "ne" | "lt" | "lte" | "gt" | "gte" | "in";
      left: ContextValueIR;
      right: ContextValueIR;
    }
  | {
      kind: "extension";
      namespace: string;
      name: string;
      data: Readonly<Record<string, unknown>>;
    };

type ContextValueIR =
  | { kind: "context"; key: string }
  | { kind: "literal"; value: string | number | boolean | readonly string[] };

interface ViewFootprint {
  minWidth?: Length;
  minHeight?: Length;
  preferredWidth?: Length;
  preferredHeight?: Length;
  preferredAspect?: number;
  minReadableScale?: number;
}
```

`templateChildren` and all of their descendants have `domain: "meta"`. They have branch-local IDs for validation and renderer instantiation, but no ordinary author path. The renderer evaluates `requires` and `score` using its context, then materializes the winning branch into Projection IR.

### 12.5.2 Projection instances and renderer context

```ts
type InstanceKey = number;
type ContextKey = number;

interface ProjectionIR {
  schema: "excalmermaid.projection";
  version: string;
  logicalSourceHash: string;
  target: Readonly<Record<string, unknown>>;
  root: InstanceKey;
  contexts: readonly RenderContextIR[];
  instances: readonly RenderInstanceIR[];
}

interface RenderContextIR {
  key: ContextKey;
  owner: InstanceKey;
  parent?: ContextKey;
  values: Readonly<Record<string, string | number | boolean | readonly string[]>>;
  capabilities: readonly string[];
}

interface RenderInstanceIR {
  key: InstanceKey;
  source: EntityKey; // ordinary entity or selected meta-template declaration
  parent: InstanceKey | null;
  context: ContextKey;
  selectedView?: EntityKey;
  score?: ScoreExplanationIR;
}

interface ScoreExplanationIR {
  base: number;
  applied: readonly { adjustment: number; condition: boolean }[];
  total: number;
}
```

The renderer constructs contexts; author code only reads their declared keys through `ContextValueIR`. Projection instances are target-local and never replace stable `EntityKey` values. `source` preserves the ordinary or template declaration from which each instance was created.

### 12.6 Corridors

```ts
interface CorridorIR extends EntityBase<"corridor"> {
  region: RegionRef; // gap or padding, never another corridor
  rank: number;      // order among corridors subdividing the same region
  axis: Axis;        // derived from the region unless overridden
  spacing?: { min: Length; preferred: Length };
  pressure?: number;
  capacity?: number;
  divider?: DividerSpec;
  orderConstraints: readonly EntityKey[];
  allowedSharing?: readonly SharingMode[];
}

interface DividerSpec {
  label?: string;
  labelPlacement?: "start" | "center" | "end";
  style?: LineStyleSpec;
}
```

Implicit regions need no `CorridorIR` to be routable; a corridor entity exists only when a region is named, configured, subdivided, or decorated.

### 12.7 Ports and port groups

```ts
type SharingMode = "merge" | "bundle" | "auto";
type PortSharingMode = SharingMode | "separate";
type Affinity = "merge" | "bundle" | "free" | "separate";

interface PortIR extends EntityBase<"port"> {
  id: LocalId;
  owner: EntityKey; // element or scope
  origin: "implicit" | "explicit" | "refined";
  side: Side | "auto";
  cardinality: "one" | "optional" | "many";
  capacity?: number;
  minSpacing?: Length;
  contentType?: string; // runtime tag from port<T>() when available
  dockStyle?: DockStyleSpec;
  sharing: { mode: PortSharingMode; branch?: BranchPolicy };
}

type PortMarkerSpec =
  | "none"
  | "circle"
  | "square"
  | "diamond"
  | { kind: "extension"; namespace: string; name: string };

interface DockStyleSpec {
  marker?: PortMarkerSpec;
  fill?: string;
  stroke?: string;
  width?: number;
  size?: Length;
  opacity?: number;
  roughness?: number;
  extensions?: Readonly<Record<string, unknown>>;
}

interface PortGroupIR extends EntityBase<"port-group"> {
  id: LocalId;
  owner: EntityKey;
  members: readonly EntityKey[];
  order: OrderingPolicy;
  affinity: Affinity;
  branch?: BranchPolicy;
}

interface PortPlacementIR extends EntityBase<"port-placement"> {
  domain: "meta";
  view: EntityKey;
  port: EntityKey;   // canonical ordinary owner port
  anchor: EntityKey; // branch-local meta-template entity
  side: Side | "auto";
}

interface BranchPolicy {
  within?: RegionRef;
  preference: "late" | "early" | "balanced"; // relative to the group's common end
}
```

### 12.8 Lines and segments

```ts
interface LineIR extends EntityBase<"line"> {
  ends: readonly [EndpointIR, EndpointIR];
  heads: readonly [HeadSpec, HeadSpec]; // per end; "forward" sugar resolves here
  segments: readonly EntityKey[];       // ordered ends[0] -> ends[1]
  share?: ShareSpec;
  space: "reserve" | "overlay";
  avoid: readonly RegionRef[];
  style?: LineStyleSpec;
}

type HeadSpec =
  | "none"
  | "arrow"
  | "open-arrow"
  | "diamond"
  | "dot"
  | { kind: "extension"; namespace: string; name: string };

interface EndpointIR {
  target: EndpointTargetIR;
  dock: EndpointDockIR;
  side?: Side;       // local hint when target is not a port
}

type EndpointDockIR =
  | {
      kind: "port";
      port: EntityKey;
    }
  | {
      kind: "line-owned";
      line: EntityKey;
      end: 0 | 1;
      style?: DockStyleSpec;
    };

type EndpointTargetIR =
  | {
      kind: "path";
      path: readonly EntityKey[];
      onUnmaterialized: "truncate";
    }
  | {
      kind: "alternatives";
      prefix: readonly EntityKey[];
      cases: readonly EndpointAlternativeCaseIR[];
      onUnmaterialized: "truncate";
    };

interface EndpointAlternativeCaseIR {
  base: EntityKey;             // ordinary object whose rendered view is inspected
  view?: EntityKey;            // exact ViewIR selector; absent means default case
  suffix: readonly EntityKey[]; // ordinary or branch-local resolved declaration chain
}

// Resolution order: exact selected-view case, unqualified default case,
// then truncation at the deepest EntityKey with a Projection IR instance.

interface ShareSpec {
  source:
    | { kind: "port"; port: EntityKey }
    | { kind: "port-group"; group: EntityKey }
    | { kind: "explicit"; id: LocalId; parent: EntityKey };
  mode: SharingMode;
  branch?: BranchPolicy;
}

interface SegmentIR extends EntityBase<"segment"> {
  line: EntityKey;
  origin: "explicit" | "implicit";
  form:
    | { kind: "through"; region: RegionRef }
    | { kind: "via"; waypoint: EntityKey }
    | { kind: "traversal"; scope: EntityKey; role: "exit" | "enter" };
  labels: readonly LabelIR[];
  style?: LineStyleSpec; // branch-local override; shared trunks unify style
}

interface LabelIR {
  text: string;
  placement: "auto" | "start" | "center" | "end";
  orientation: "upright" | "along";
  role?: string;
}

interface LineStyleSpec {
  stroke?: string;
  width?: number;
  dash?: "solid" | "dashed" | "dotted" | readonly number[];
  opacity?: number;
  roughness?: number;
  heads?: readonly [HeadSpec, HeadSpec];
  dock?: DockStyleSpec; // marker-specific additions or overrides at both ends
}
```

An authoring-level `labels` collection on a line is normalization sugar, not another IR location for labels. `start` entries attach to the first suitable inferred or explicit segment, `end` entries to the last, and `center` or `auto` entries to a suitable prominent segment. Multiple entries remain distinct `LabelIR` values in source order. This supports relation names, endpoint roles, multiplicities, guards, and sequence numbers without encoding several semantics into one string.

`traversal` segments are the normalizer's record of inferred hierarchy crossings toward the least common ancestor. They are always `origin: "implicit"`; concrete portals, tracks, and bends first appear in Solved IR.

For a port endpoint, the dock base style is `PortIR.dockStyle`; for a line-owned endpoint, it is `EndpointDockIR.style`. The compatible properties of `LineStyleSpec`, including its optional `dock` block, overlay that base property by property. A line value wins a conflict, while every non-conflicting base value survives. The resolved dock style is computed before any marker geometry that consumes routing or layout space.

### 12.9 Notes

```ts
type NotePlacement =
  | "auto"
  | "above" | "below" | "left" | "right"
  | "inside-top-left" | "inside-top" | "inside-top-right"
  | "inside-left" | "inside-right"
  | "inside-bottom-left" | "inside-bottom" | "inside-bottom-right";

interface NoteIR extends EntityBase<"note"> {
  anchor: EntityKey | RegionRef | null; // null: participates in layout instead
  placement: NotePlacement;
  content: readonly ContentSpec[];
  style?: StyleSpec;
}
```

### 12.10 Constraints and paint order

```ts
type Strength =
  | { kind: "required" }
  | { kind: "preference"; weight: number };

interface ConstraintBase<Type extends string> extends EntityBase<"constraint"> {
  type: Type;
  strength: Strength;
}

type ConstraintIR =
  | (ConstraintBase<"order"> & {
      before: EntityKey;
      after: EntityKey;
      within?: EntityKey | RegionRef; // layout, port group, or corridor tracks
    })
  | (ConstraintBase<"adjacent"> & { members: readonly EntityKey[]; within?: EntityKey })
  | (ConstraintBase<"align"> & {
      members: readonly EntityKey[];
      edge: Side | "center-x" | "center-y";
    })
  | (ConstraintBase<"same-size"> & {
      members: readonly EntityKey[];
      dimension: "width" | "height" | "both";
    })
  | (ConstraintBase<"near"> & { first: EntityKey; second: EntityKey })
  | (ConstraintBase<"inside"> & {
      members: readonly EntityKey[];
      container: EntityKey;
      padding?: Length;
    })
  | (ConstraintBase<"below"> & { item: EntityKey; reference: EntityKey })
  | (ConstraintBase<"between"> & { item: EntityKey; first: EntityKey; second: EntityKey })
  | (ConstraintBase<"avoid-overlap"> & { members: readonly EntityKey[] });

interface PaintRelationIR {
  before: EntityKey;
  after: EntityKey;
  strength: Strength;
}
```

New constraint types are added as tagged variants or namespaced extensions; unstructured solver expressions never enter the portable core.

### 12.11 Styles and extensions

```ts
interface StyleSpec {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  dash?: "solid" | "dashed" | "dotted" | readonly number[];
  fontFamily?: string;
  fontSize?: number;
  padding?: Length;
  roughness?: number;
  extensions?: Readonly<Record<string, unknown>>;
}
```

Extension keys are namespace-qualified. Consumers reject unknown required extensions and may preserve unknown optional ones.

## 13. Normalization mapping

How authoring constructs normalize (details and phases in [REQUIREMENTS.md](REQUIREMENTS.md)):

- `Row`/`Column`/`Grid`/... outside meta branches produce addressable ordinary `LayoutIR`. The same declarations inside a view remain meta templates until materialized.
- Every author-declared ordinary structural container retains its ID and containment parent; the normalizer never flattens it out of the address model. Meta containers and descendants retain IDs in their hidden branch-local tree.
- Physical direction words in the source are stored as local directions; only the per-scope `orientation` carries rotation.
- `gap()`/`padding()` calls become `RegionRef` values; a bare corridor id becomes `{ kind: "corridor" }`.
- A named endpoint whose port has not been declared synthesizes a `PortIR` with `origin: "implicit"`. Nested and post-hoc `Port` declarations refine that same owner-and-ID identity, and TSX handles resolve to it.
- An entity-only endpoint emits a `line-owned` `EndpointDockIR` derived from its line key and end index. It never synthesizes a `PortIR`, and equal target entities do not merge these dock identities.
- A `Line` without explicit segments emits only implicit segments. Explicit `<Segment>` children are kept in order; the normalizer weaves implicit traversal segments between them.
- A line-level `label` becomes a `LabelIR` with `placement: "auto"`; an authoring-level `labels` collection becomes several ordered `LabelIR` values distributed onto suitable start, center, end, or automatic segments.
- `heads="both"` and friends resolve to the per-end `heads` tuple.
- Lines sharing one canonical named port receive a port-derived `ShareSpec`; its mode and branch policy come from `PortIR.sharing`. Port-group affinity and explicit line groups apply only when they add a relation across distinct ports.
- Dock style resolution overlays compatible line-style properties onto the port or line-owned dock style. The line wins conflicts and non-conflicting properties from both inputs survive.
- `View` declarations emit hidden `ViewIR` alternatives with score expressions and template children. Normalization does not select or instantiate them.
- Ordinary reference resolution skips the meta domain. Endpoint-alternative syntax emits an `alternatives` target whose exact-view and default cases are validated separately. Renderer materialization chooses a case, then truncates at the deepest instantiated object if necessary.
- `PortPlacement` emits a meta mapping from one canonical ordinary port to one anchor in the containing view template.
- The renderer creates context, evaluates scores and conditions, and emits Projection IR before layout and routing. This stage never re-runs TSX.
- Notes with an anchor leave layout membership; notes without one join their parent's layout.
