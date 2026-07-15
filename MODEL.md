# Excalmermaid Data Model

Status: Working draft

This document defines the conceptual data model and the Logical IR. [REQUIREMENTS.md](REQUIREMENTS.md) states what the system must do; this document defines the shapes those requirements normalize into. Nothing here is final; the reference fixtures under [`examples/`](examples/) are the ground truth the model must be able to express.

## 1. Principles

1. **Normalized graph.** After TSX evaluation and component expansion, a diagram is a flat, renderer-neutral entity graph. No functions, no renderer objects, no pixel coordinates.
2. **Four independent relations.** Containment (a tree), layout (membership plus constraints), routing (regions and lines), and paint order are separate relations over the same entities.
3. **Orientation is local.** Every scope has a local frame. All directional vocabulary — sides, axes, row/column — is expressed in the local frame. Rotating a scope re-orients its entire subtree without touching any child declaration.
4. **Whitespace is the routing plane.** Corridors are not free-floating entities. They are the gaps and padding bands that layout produces anyway — implicit, addressable, and space-reserving, like margin and padding in CSS. A `Corridor` declaration refines such a region; it never invents one detached from the structure.
5. **Lines are symmetric and segmented.** A line has two interchangeable ends. It consists of an ordered list of segments; most are implicit and inferred, some are explicitly pinned to a region or waypoint and can carry labels there.
6. **Sharing is opt-in.** Lines share drawn geometry only when they are joined through a group. Within a group, sharing is maximal by default (branch as late as possible). Ungrouped lines never merge.

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

## 3. Containment, scopes, and identity

A `Scope` opens a lexical namespace and is by default also a containment region. Layout containers (`Row`, `Column`, `Grid`, ...) do **not** open namespaces: every identifiable declaration is bound in its nearest enclosing scope. Author IDs are unique per scope, never globally. References are resolved relative to their declaring scope; `/` descends into child scopes, `..` ascends, `.` addresses a port on an entity.

Every entity has exactly one containment parent. Layout, routing, and paint relations may reference any entities regardless of containment.

Scopes are full endpoints: they can carry ports, be targets of lines, and be anchors for notes.

## 4. Elements, content, and sizing

An `Element` (`Node` in the authoring surface) is a visible or intrinsically measurable object: a shape primitive with structured content (text runs, icons, images), ports, and a size policy. Sizing is intrinsic by default — derived from content, padding, and minimum/maximum bounds. Fixed sizes are geometric constraints, not positions.

## 5. Layout

A layout arranges an explicit member set inside a container. JSX children are shorthand for that set. Strategies compose recursively: `row`, `column`, `stack`, `overlay`, `grid`, `tree`, `radial`, `layered`, `constraint`.

**Ordering.** The default ordering policy is `prefer-source`: source order is a soft preference the solver may override only when it clearly reduces crossings, route length, or space. `free` releases the order entirely; `fixed` makes source order a hard constraint. This replaces the earlier `auto` default — the fixtures showed that authors reach for source order almost everywhere, so it should be the cheap default rather than an annotation on every layout.

## 6. Whitespace: margins, padding, gaps, and corridors

This is the CSS box model analogy at the core of routing:

- Every element and scope has a **margin** (whitespace demanded outside its border) and every container a **padding** (whitespace between its border and its content).
- The whitespace between two layout siblings — merged margins plus the layout gap — is a **gap region**.
- The whitespace between a container's border and its content on one side is a **padding band**.

Gap regions and padding bands are the diagram's **corridors**. They exist implicitly for every layout; they are addressable; and lines route through them by default. Like margins in CSS, they interact with layout: a corridor that carries tracks widens until its content fits, and the surrounding layout moves accordingly. Routing is therefore never an overlay pass on finished geometry.

Regions are addressed structurally:

```ts
gap(a, b)              // whitespace between two layout siblings
padding(scope, side)   // whitespace band inside a container edge (local side)
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
- cardinality (`one` default, `optional`, `many`);
- capacity and minimum spacing for attached lines;
- optionally a content type tag for compatibility checking.

**Component boundaries.** Components are ordinary TSX functions. To let callers attach lines without knowing internals, the runtime provides opaque port handles:

```ts
declare function port<T>(options?: { cardinality?: "one" | "optional" | "many" }): PortHandle<T>;
```

A handle is created by the caller, passed as a prop, and bound exactly once inside the component to a concrete port (`<Port bind={handle} .../>`) or forwarded to a child component. Handles are TSX-level composition constructs; they are fully resolved before Logical IR is emitted.

**Port groups** collect several ports of one owner. A group keeps its members adjacent and ordered, and sets the default sharing behavior for lines attached to them:

- `merge` — attached lines form a share group drawing one common path;
- `bundle` — attached lines run closely parallel but remain separate strokes;
- `free` — no implied relation (default);
- `separate` — anti-affinity: attached lines must not share and are kept visibly apart.

## 8. Lines and segments

A **line** is the semantic connection unit.

- **Two symmetric ends.** `from` and `to` are positional labels for `ends[0]` and `ends[1]`, nothing more. Arrowheads are properties: `heads = "forward" | "backward" | "both" | "none"` (default `forward`, meaning a head at `to`), with per-end head shapes available in style.
- **Endpoints** reference a port, an element, or a scope. Without a port, the router selects an attachment point; an optional local `side` hint constrains it.
- **A line is an ordered list of segments** from end to end. Segments are:
  - `implicit` — inferred by the normalizer: hierarchy climbs and descents toward the least common ancestor, and connective runs through implicit corridors. Authors never enumerate crossed boundaries.
  - `explicit` — authored pins. An explicit segment either passes `through` a region (a named corridor, `gap(...)`, or `padding(...)`) or `via` a waypoint entity. Explicit segments are where labels live: "this line goes out into the whitespace between the boxes, and the label sits there."

Labels belong to segments. A label has a placement along its segment (`start`, `center`, `end`, `auto`) and an orientation (`upright` or `along` the segment). A line-level `label` is sugar for an automatically placed label on the line's most prominent run.

Lines reserve routing space by default (`space: "reserve"`); `overlay` opts a line out of layout interaction. A line may list regions to `avoid`.

## 9. Sharing: groups, trunks, and branches

Lines share drawn geometry **only** when joined through a group — either explicitly (`share={{ group, mode }}`) or implicitly by attaching to ports of a port group with `merge`/`bundle` affinity. Ungrouped lines attached to the same port stay separate.

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
- Author IDs remain scope-local bindings; the normalizer resolves references to keys and reports missing or ambiguous targets.
- Port handles are resolved before emission; provenance may record the component property and port involved.
- No functions, symbols, cycles, renderer objects, or absolute positions.

### 12.2 Document and entities

```ts
type EntityKey = number;
type LocalId = string;

type EntityKind =
  | "scope"
  | "element"
  | "layout"
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
  id?: LocalId;
  ownerScope: EntityKey | null;
  parent: EntityKey | null;
  roles: readonly string[];
  classes: readonly string[];
}
```

`ownerScope` is the lexical scope; `parent` is containment.

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
  | { kind: "padding"; scope: EntityKey; side: Side }
  | { kind: "corridor"; corridor: EntityKey };
```

### 12.4 Scopes and elements

```ts
interface ScopeIR extends EntityBase<"scope"> {
  orientation: Orientation;
  boundary: "visible" | "invisible";
  children: readonly EntityKey[];
  ports: readonly EntityKey[];
  defaultLayout?: EntityKey;
  padding?: BoxLengths;
  margin?: BoxLengths;
  style?: StyleSpec;
}

interface ElementIR extends EntityBase<"element"> {
  primitive: PrimitiveSpec;
  content: readonly ContentSpec[];
  children: readonly EntityKey[];
  ports: readonly EntityKey[];
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
type Affinity = "merge" | "bundle" | "free" | "separate";

interface PortIR extends EntityBase<"port"> {
  owner: EntityKey; // element or scope
  side: Side | "auto";
  cardinality: "one" | "optional" | "many";
  capacity?: number;
  minSpacing?: Length;
  contentType?: string; // runtime tag from port<T>() when available
}

interface PortGroupIR extends EntityBase<"port-group"> {
  owner: EntityKey;
  members: readonly EntityKey[];
  order: OrderingPolicy;
  affinity: Affinity;
  branch?: BranchPolicy;
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
  target: EntityKey; // port, element, or scope
  side?: Side;       // local hint when target is not a port
}

interface ShareSpec {
  group: LocalId;
  scope: EntityKey; // scope in which the group name is bound
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
  heads?: readonly [HeadSpec, HeadSpec];
}
```

`traversal` segments are the normalizer's record of inferred hierarchy crossings toward the least common ancestor. They are always `origin: "implicit"`; concrete portals, tracks, and bends first appear in Solved IR.

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

- `Row`/`Column`/`Grid`/... produce a `LayoutIR` on an anonymous or containing entity; they do not open scopes.
- Physical direction words in the source are stored as local directions; only the per-scope `orientation` carries rotation.
- `gap()`/`padding()` calls become `RegionRef` values; a bare corridor id becomes `{ kind: "corridor" }`.
- A `Line` without explicit segments emits only implicit segments. Explicit `<Segment>` children are kept in order; the normalizer weaves implicit traversal segments between them.
- A line-level `label` becomes a `LabelIR` with `placement: "auto"` attached to the line's most prominent segment at solve time.
- `heads="both"` and friends resolve to the per-end `heads` tuple.
- Port group affinity `merge`/`bundle` induces a `ShareSpec` on attached lines unless they declare their own.
- Notes with an anchor leave layout membership; notes without one join their parent's layout.
