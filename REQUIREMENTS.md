# Excalmermaid Requirements

Status: Working draft

This document states the requirements for Excalmermaid: the TSX authoring surface, its semantics, and the properties the toolchain must guarantee. The data model and the Logical IR shapes live in [MODEL.md](MODEL.md); implementation architecture and plumbing live in [DESIGN.md](DESIGN.md). In this document, "grammar" means the TSX authoring surface: components, properties, references, and their semantics. Excalmermaid does not extend the TypeScript or TSX grammar.

The keywords **MUST**, **SHOULD**, and **MAY** indicate requirements, strong recommendations, and optional capabilities.

## 1. Vision, scale, and authoring goals

### 1.1 Vision

Excalmermaid MUST be a modelling language for design diagrams whose primary property is composition. A model should be able to start as a handful of boxes and grow into an effectively unbounded system canvas without changing authoring paradigms or falling back to hand-maintained coordinates.

The same language MUST support both overview and lowest-level detail. It should be possible to model, for example, an entire Kubernetes landscape — clusters, control planes, nodes, workloads, resources, controllers, storage, networking, and their internal relationships — or an entire Linux system from machines and subsystems down through processes, syscalls, namespaces, memory, devices, and implementation-level components.

A poster-sized drawing such as DIN A0 is a normal target, not an upper bound. The Logical IR MUST NOT impose a fixed page size, canvas boundary, maximum system breadth, or shallow hierarchy limit. Implementations MAY enforce resource limits, but such limits MUST be operational constraints rather than semantics of the language.

### 1.2 Composition across scales

Composition MUST work at every level of the model:

- a component MUST be usable as a black box through its public ports without requiring callers to know internal IDs;
- every named container inside a component MUST nevertheless remain addressable through its hierarchical path when a caller intentionally reaches into the component;
- the same component MUST also be expandable into its complete internal model;
- components MUST be nestable to arbitrary semantic depth, subject only to implementation resource limits;
- large systems MUST be constructible from independently authored and reusable subsystem components;
- local identities, port bindings, constraints, and routes MUST remain valid when a component is moved, nested, repeated, or embedded in a rotated frame;
- connections MUST be able to cross any number of component and scope boundaries without enumerating every ancestor;
- high-level structure and low-level detail MUST coexist in one logical model rather than requiring unrelated overview and detail diagrams.

The language MUST support projections or views that select, collapse, expand, filter, or emphasize parts of the same model without duplicating its source of truth. View-specific presentation MUST NOT change the identities, ports, or semantic relationships of the underlying model.

### 1.3 Component views and adaptive expansion

A component MUST be able to provide several named renderable views of the same logical identity. A `View` is a hidden meta branch in the component's object tree: its descendants are a template, not ordinary already-active diagram objects. A renderer materializes a selected view branch into a target-specific render instance before that instance is laid out, routed, and painted. Changing the selected branch MUST NOT change the component's canonical identity or invalidate lines attached to its ports.

View selection MUST be more general than a single level-of-detail number. A view MAY declare:

- an ordinal `detail` value;
- score adjustments based on purpose, audience, medium, state, allocation, or renderer capability;
- minimum and preferred footprint and aspect ratio;
- minimum readable scale or other legibility requirements;
- an author preference or explicit fallback relation.

Selectors other than `detail` MUST be extensible without requiring a new core diagram type. A render request MUST be able to force a named view, constrain selector values, or request the greatest useful detail that fits a target. Logical IR retains view templates; a renderer-specific projection step records their concrete instances.

A level-of-detail-capable renderer MUST provide an outside-in materialization strategy. It starts with the requested canvas, page, tile, or viewport, allocates space to outer components, and recursively instantiates the highest-utility eligible view that fits each allocation. It then repeats the process inside the instantiated branch. If a detailed branch violates footprint, readability, routing, or hard layout constraints, the renderer MUST be able to discard that projection instance and instantiate a less demanding fallback. Given identical model, target, conditions, policy, capabilities, and solver version, materialization MUST be deterministic.

The authoring model MUST leave room for responsive meta branches comparable to print styles, media queries, and container queries on the web. Target-dependent conditions MUST be represented as typed, serializable data evaluated during renderer materialization, never as arbitrary JavaScript callbacks executed by Go or Rust renderers. Conditions MAY inspect a bounded rendering context such as medium, page format, viewport class, allocated inline or block size, purpose, semantic state, and renderer capabilities. They MUST NOT inspect unconstrained mutable process state.

The same condition model SHOULD later apply to nested `When`/`Switch` meta branches and to conditional lines or segments. This permits responsive structure and conditional paths without turning Excalmermaid into another general-purpose programming language. Conditions depending on allocated size require deterministic outside-in iteration or fallback; implementations MUST detect non-converging selection cycles.

DIN A4, DIN A0, a viewport, and an infinite canvas are render targets, not component semantics. For example, an A4 request using `maximum-that-fits` will usually select less internal detail than an A0 request, while preserving the same component identities and external connectivity.

### 1.4 Large-model behavior

The architecture MUST permit implementations that solve and render only the parts of a model needed for a viewport, export, or selected level of detail. A first implementation MAY solve a complete document eagerly, but the Logical IR and component model MUST NOT require global materialization as a semantic prerequisite.

Solvers and renderers SHOULD support incremental recomputation so that a local edit does not require unrelated regions of a very large model to be rebuilt. Canonical normalization MUST remain deterministic regardless of whether later layout, routing, and rendering are eager, incremental, tiled, or viewport-driven.

An infinite-canvas renderer, a single poster-sized export, tiled pages, and focused subsystem views MUST all be projections of the same logical model. Page boundaries and viewport bounds belong to presentation and export, not to the identity or containment model.

### 1.5 Goal of the authoring surface

The authoring surface MUST express general logical drawings without compiling diagram types into the core. It MUST support both small sketches and deeply nested system diagrams.

In particular, the surface MUST provide:

- reusable high-level components as ordinary TypeScript functions;
- recursive expansion to a small set of core primitives;
- relative identities and references;
- mandatory IDs for structural containers so every containment level is addressable;
- alternative component views and recursive target-aware view selection;
- independent containment, layout, routing, and paint-order relations;
- nested and composable layouts with local, rotatable orientation;
- routing through implicit whitespace regions — the gaps and padding bands that layout produces anyway — rather than through separately maintained geometry;
- composable components with opaque, symmetric ports;
- symmetric lines built from segments, most implicit, some explicitly pinned and labeled;
- shared paths controlled by canonical named-port joins, port groups, or explicit line groups, maximal by default;
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
export default <Diagram id="system">{/* ... */}</Diagram>;
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

Components MAY construct serializable render conditions through authoring helpers. They MUST NOT branch on target size, renderer capability, or solved geometry during TSX evaluation, because doing so would erase the unchosen meta branch before another renderer can instantiate it.

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

Every author-declared structural container MUST have an `id`. This includes the `Diagram`, every `Scope`, every explicit layout container such as `Row`, `Column`, or `Grid`, every meta container such as `View` or `When`, every `PortGroup`, and every `Node` or extension entity that owns nested diagram entities. Library components MUST ultimately emit such an ID on their root container; a reusable component SHOULD receive that ID from its caller. Meta-container IDs belong to their separate meta namespace and do not make those branches visible to ordinary path lookup.

Content values that do not own diagram entities, such as text runs, need no ID. Compiler-generated implicit segments and anonymous automatic attachment points MAY use internal keys without author IDs. Any other entity that an author wants to reference directly MUST have an explicit ID.

## 3. Core vocabulary

The precise component names and property forms remain subject to design. Normalized semantics MUST include at least these categories (shapes in [MODEL.md](MODEL.md)):

- `Diagram`: document root, global metadata, root frame;
- `Scope`: containment region, semantic boundary, local orientation;
- `Element` (`Node`): visible or intrinsically measurable object;
- `Layout`: arrangement of a set of objects;
- `View`: named alternative representation of one component or scope;
- `Port`: symmetric attachment point on an element or scope;
- `PortPlacement`: view-template mapping from a stable owner port to one rendered anchor;
- `PortGroup`: adjacency, ordering, and affinity rules for ports;
- `Corridor`: named refinement of an implicit whitespace routing region;
- `Line`: symmetric semantic connection built from segments;
- `Segment`: one leg of a line, explicit or implicit, labelable;
- `Note`: annotation placed by an anchor relation;
- `Constraint`: hard requirement or soft preference;
- `Condition`: serializable predicate controlling renderer materialization;
- `PaintRelation`: drawing order independent of containment.

Diagram types such as `SequenceDiagram`, `MindMap`, `EntityRelationship`, or `KubernetesCluster` MAY exist as library components, but they MUST NOT be required core primitives.

## 4. Containers, containment, and relative names

### 4.1 Addressable containers

A `Scope` owns a local frame and semantic boundary. Independently, every ordinary named structural container MUST open one segment in the containment address space. Layout containers therefore remain layout constructs but are not invisible in hierarchical paths. Renderer-instantiated meta containers are the exception: their templates live outside the ordinary address space until materialized.

Every explicit author ID MUST be unique only among the direct children of its containment parent. Objects with equal IDs under different parents MUST be permitted. The canonical author address of an entity is the sequence of local IDs from the diagram root through every containing structural container. A reference written inside a container starts at that container's contents and therefore does not repeat the current container ID; a canonical serialized address may include the diagram root ID.

```tsx
<Scope id="orders">
  <Column id="services">
    <Node id="api" />
  </Column>
</Scope>

<Scope id="billing">
  <Column id="services">
    <Node id="api" />
  </Column>
</Scope>
```

The two nodes have the distinct addresses `orders/services/api` and `billing/services/api`. Reusing the component that produces `services/api` under another instance ID MUST not cause a collision.

### 4.2 Relative references

Author references MUST be interpreted relative to their containing addressable container. The authoring surface MUST NOT require globally unique IDs.

The reference model MUST address at least:

- an object in the current scope;
- an object in a child container (`orders/services/api`);
- an object relative to a parent container (`../../billing/services/api`);
- a port (`api.request`);
- a port group;
- an implicit whitespace region (`gap(a, b)`, `padding(container, side)`) or a named corridor;
- a layout, line, segment, or constraint-relevant region when referencable.

References MAY use strings, typed `ref()` helpers, or template literals. If several forms are offered, all MUST normalize to the same internal reference model.

`/` MUST descend through named ordinary containers, `..` MUST ascend one named ordinary container, and `.` MUST select a named port on an entity. The exact typed helper API may evolve, but these relationships MUST normalize unambiguously. Ordinary lookup MUST NOT descend into `View`, `When`, `Switch`, or their unmaterialized template descendants. A normal path therefore cannot accidentally depend on whichever branch a renderer later selects.

Component boundaries SHOULD use opaque `port()` handles when only the public interface is intended. Deep paths remain a supported escape hatch and inspection mechanism, not an encapsulation violation. Moving or nesting a component preserves its internal relative addresses; only an external absolute path to that instance changes.

### 4.3 Containment

JSX nesting SHOULD express containment by default. Containment alone MUST NOT completely determine layout membership, paint order, or line routing.

An object MUST have exactly one containment parent. Additional layout, routing, and paint relations MAY reference any number of other objects.

Scopes MUST be full endpoints: they can carry ports, terminate lines, and anchor notes.

All ordinary intermediate containers on a deep path MUST be author-addressable. A normalizer MUST NOT flatten explicit layout containers out of the author identity model. It MUST preserve view and conditional containers in the separate meta tree without exposing them through ordinary paths.

Port-group JSX nesting is membership shorthand, not another owner for the ports. A port remains canonically owned by its enclosing element or scope and is selected with `owner.port`; the named `PortGroup` itself is independently addressable for ordering and affinity constraints.

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

A layout MUST have an explicit member set. JSX children MAY be shorthand for that set. Layout MAY appear both as a component (`<Row id="services">...</Row>`) and as a property (`<Scope id="services" layout={{ kind: "row" }}>`); both forms MUST normalize identically.

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

### 7.4 Component views

A component or scope MAY own several `View` declarations. Every view MUST have an ID in the owner's meta namespace and MUST be a meta container whose descendants form an instantiation template. The view and its descendants are invisible to ordinary path lookup and MUST NOT participate in ordinary containment, layout, routing, or paint order until a renderer instantiates their branch.

```tsx
<Scope id="cluster" role="serving-cluster">
  <Port id="request" side="left" />

  <View
    id="compact"
    detail={0}
    score={score(
      0,
      boost(100, lte(context("allocation.inlineSize"), 90)),
      boost(20, eq(context("medium"), "print")),
    )}
    footprint={{ minWidth: 35, minHeight: 20 }}
  >
    <Node id="card">Cluster</Node>
    <PortPlacement port="request" on="card" side="left" />
  </View>

  <View
    id="internals"
    detail={2}
    score={score(
      10,
      boost(100, gte(context("allocation.inlineSize"), 70)),
    )}
    footprint={{ minWidth: 100, minHeight: 70 }}
    fallback="compact"
  >
    <Column id="internal-layout">
      <Node id="api">Gateway</Node>
      <Scope id="workers">{/* detailed render branch */}</Scope>
      <When id="capacity-details" test={gte(context("allocation.inlineSize"), 140)}>
        <Node id="capacity">Capacity details</Node>
      </When>
    </Column>
    <PortPlacement port="request" on="internal-layout/api" side="left" />
  </View>
</Scope>
```

Here `context()`, `score()`, `boost()`, and the comparison helpers construct typed, serializable expression values; they are not callbacks. The renderer creates the context for each component instance. A view's base score receives conditional additions or penalties from that context, and the highest-scoring viable view is instantiated. The exact convenience syntax remains open, but its normalized form MUST be language-neutral.

The declarations `compact/card` and `internals/internal-layout/api` are branch-local template identities, not ordinary paths below `cluster`. Their materialized render instances receive renderer-local instance keys derived from the owning component instance, selected view, template-local identity, render target, and projection generation. Reusing a view template MUST NOT reuse one mutable render object across component instances.

Ports owned by the component remain stable across views. `PortPlacement` maps one canonical owner port onto an anchor in a view template; materializing that mapping changes docking geometry but MUST NOT create a second semantic port. A line attached to `cluster.request` remains attached while the renderer switches between `compact` and `internals`.

References from outside a component SHOULD target stable component ports or stable semantic children. An ordinary deep endpoint is resolved against Projection IR. If some suffix was not instantiated by the selected views, the endpoint MUST truncate to the deepest instantiated object on that path and attach there using automatic docking. This is the default behavior for a line whose semantic destination exists more deeply than the current rendering exposes.

As a break-glass escape hatch, a line endpoint MAY contain explicit view alternatives. The current candidate syntax is:

```tsx
<Line
  from="client.request"
  to="api.{foo#view:abc, foo:bar}"
/>
```

This endpoint has the common prefix `api`. If the renderer instantiated `foo` with the view named `view`, the selected case continues to branch-local target `abc`. Otherwise the unqualified case continues through the ordinary target `foo.bar`. An exact `#view` case has precedence over the unqualified case; if neither applies, or if the chosen suffix is only partially instantiated, resolution truncates to the deepest instantiated object.

The braces and `#view` selector belong to endpoint-alternative syntax, not ordinary path lookup. They do not make the meta tree globally visible. The normalized representation MUST keep common prefix, cases, selected-view predicates, suffixes, and truncation policy structurally rather than preserve an opaque string. Typed helper syntax MAY normalize identically. This mechanism SHOULD remain exceptional; stable component ports plus `PortPlacement` are the composable default.

The renderer owns materialization. For every component instance it creates an immutable context from the render request, inherited context, renderer capabilities, semantic state, and current outside-in allocation. Views evaluate their score expressions against that context. The renderer then instantiates the winning viable branch into Projection IR, evaluates conditional adjustments inside that branch, and submits the projection to layout and routing. A solve may reject a tentative branch and ask the renderer planner to instantiate its fallback. Solved IR MUST retain the selected view, context snapshot or hash, score explanation, and template provenance for every materialized instance.

### 7.5 Responsive conditions and conditional paths

The renderer-context expression model MUST support numeric score composition, conditional score adjustments, Boolean composition (`all`, `any`, `not`), and typed comparisons over a bounded context. Context keys SHOULD include:

- target medium and page or viewport class;
- allocated inline size, block size, and aspect ratio;
- requested purpose, audience, detail policy, and semantic state;
- renderer and solver capabilities.

Unknown context keys or operators MUST be namespaced extensions. Conditions MUST be pure, deterministic, serializable, and safe to evaluate in TypeScript, Go, and Rust. JavaScript functions, closures, DOM queries, and arbitrary CSS evaluation MUST NOT enter Logical IR.

After a view wins, the same context MUST be available to conditional adjustments inside its template. The model SHOULD permit `when` on view-template entities, lines, and segments, plus explicit `When` or `Switch` meta containers for larger alternatives. A conditional line or segment exists in Projection IR only when its condition holds. Removing it MUST still preserve port-cardinality and required-connectivity invariants or produce a diagnostic.

CSS media queries and container queries are design precedents, not required source syntax. A later CSS-like rule layer MAY compile to the same condition tree. The core contract is the normalized condition semantics, not a particular textual mini-language.

## 8. Ports and components

### 8.1 Ports

A port is a symmetric attachment point — direction belongs to lines, not ports. A port MUST express at least:

- local ID or role;
- allowed, preferred, or required side and position in the local frame;
- cardinality (`one`, `optional`, `many`; named geometric ports default to `many`);
- optional capacity and minimum spacing;
- optional order constraints for attached lines;
- optional visible marker such as a circle;
- a sharing policy for lines joined at the port.

A line endpoint MUST be able to reference an element or scope without an explicit port; the router then selects a compatible attachment point, optionally constrained by a side hint.

A named endpoint reference such as `api.request` MUST resolve to the canonical port identity `(api, request)`. If no explicit declaration exists, the normalizer MUST create that named port implicitly with default properties. Referencing only `api` requests an anonymous automatic attachment point and MUST NOT create a stable named port.

An explicit nested declaration and a post-hoc refinement both address the same canonical port:

```tsx
<Node id="api">
  <Port id="request" side="left" marker="circle" />
</Node>

<Port ref="services/api.request" sharing={{ mode: "merge", branch: "late" }} />
```

The explicit declaration may appear before or after lines that imply the port. Normalization MUST collect all references and declarations before merging their properties, and source order MUST NOT create two ports. Compatible declarations refine the same port. Conflicting explicit values for the same property MUST produce a source-located diagnostic rather than silently choosing one.

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

By default, a bound port handle MUST be attached by exactly one line; `optional` and `many` handle cardinalities MUST be declarable. This handle constraint overrides the `many` default of an otherwise unconstrained geometric named port. Two lines connecting the same pair of ports MUST be permitted only within the effective cardinality limits. TypeScript SHOULD reject incompatible `T` parameters during development; the normalizer MUST retain enough runtime type metadata to reject incompatible attachments when static checking was not performed.

All required ports MUST be bound and attached by the time the document root is normalized. Port handles and component interfaces are TSX-level composition constructs and MUST NOT be serialized as unresolved handles in Logical IR. Provenance MAY preserve the component and property through which a resolved endpoint originated.

A handle binding, a nested `<Port id="...">` declaration, a post-hoc `<Port ref="...">` refinement, and a relative string endpoint MUST all normalize to the same canonical port when they identify the same owner and local port ID. Handles are aliases for canonical ports, not a second port identity system.

### 8.3 Port groups and affinity

Ports MUST be groupable. A port group coordinates several distinct ports; it is not required to group lines attached to one canonical named port. A port group MUST keep its members adjacent and ordered, and set the default affinity of the lines attached to them:

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

- pin the line `through` a region — a named corridor, `gap(a, b)`, or `padding(container, side)`;
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

### 9.4 Port joins and shared geometry

All line ends attached to the same canonical named port MUST form one topological join group at that port. This is true whether the port was implicit, explicitly nested, configured post-hoc, or reached through a TSX handle. Repeating the port name is therefore sufficient to join the line ends; a separate `PortGroup` declaration is neither necessary nor appropriate for that case.

The joined port's sharing policy controls the positive-length path next to the common endpoint:

- `merge` requires one genuinely shared stroke;
- `bundle` keeps separate strokes closely parallel;
- `separate` permits only the common endpoint and requires the lines to split immediately;
- `auto` lets the router choose and is the default.

An explicit line share group MAY coordinate lines that do not meet at one named port. Port-group affinity MAY coordinate lines attached to several distinct ports. Neither mechanism creates a duplicate group for lines already joined by one canonical port.

Within a share group:

- the shared path MUST be maximal by default: branches happen as late as possible relative to the group's common end; `early` and `balanced` preferences and a constraining branch region MUST be expressible;
- at least the sharing modes `merge` (one genuinely shared stroke) and `bundle` (separate, closely parallel strokes) MUST be distinct, with `auto` letting the router choose;
- style unification MUST apply only to the shared piece; branches keep their own style, so a dashed branch may leave a solid merged trunk. Incompatible styles on the shared piece SHOULD downgrade `merge` to `bundle`; if merging was required, this MUST be a diagnostic;
- fan-out and fan-in MUST be symmetric.

A `many` port permits multiple attachments. The port sharing policy, not cardinality alone, determines whether their paths merge, bundle, separate, or remain router-selected. A renderer MUST NOT accidentally produce multiple overlapping strokes for a merged path.

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

The following example demonstrates the current grammar direction. Property details may still evolve, but symmetric ports, canonical named-port joins, and segment pinning are normative at the conceptual level:

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
  <Diagram id="service-system">
    <Row id="frontend">
      <Client conversation={chat} />
      <Scope id="gateway" role="gateway">
        <Node id="router">
          <Port id="chat" side="left" />
          <Port
            id="forward"
            side="bottom"
            bind={forwarding}
            sharing={{ mode: "merge", branch: "late" }}
          />
        </Node>
      </Scope>
    </Row>

    <Row id="workers">
      {workerRequests.map((request, i) => (
        <Worker key={`worker-${i}`} request={request} />
      ))}
    </Row>

    <Line from={chat} to="frontend/gateway/router.chat" heads="both" label="conversation" />

    {workerRequests.map((request, i) => (
      <Line
        key={`forward-${i}`}
        from={forwarding}
        to={request}
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
4. Collect core declarations, build containment, and require IDs on every structural container.
5. Build the hierarchical address tree and local bindings from containment.
6. Collect TSX port allocations, nested port declarations, post-hoc refinements, endpoint-derived implicit ports, and forwarded bindings.
7. Merge all declarations for each canonical `(owner, local port ID)` and diagnose conflicting explicit properties.
8. Resolve every required port handle and relative endpoint to a canonical port.
9. Resolve ordinary entity and region references without entering meta branches; normalize endpoint alternatives into common prefixes, selected-view cases, branch-local suffixes, defaults, and truncation policy.
10. Canonicalize defaults and shorthand forms (line-level labels, `heads` sugar, layout components versus properties).
11. Weave implicit segments around explicit ones; infer least common ancestors and traversals.
12. Derive join groups from common canonical ports, then apply port sharing policies, explicit share groups, and port-group affinity.
13. Preserve every component view template, port-placement mapping, and normalized condition tree for renderer materialization.
14. Assign `EntityKey` values deterministically.
15. Perform structural and semantic validation.
16. Emit Logical IR and optional provenance.

At least these errors MUST be detected before solving:

- more than one diagram root;
- a missing ID on an author-declared structural container;
- duplicate IDs below the same containment parent;
- missing or ambiguous references;
- references that traverse above the diagram root;
- conflicting explicit refinements of one canonical port;
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
- duplicate view IDs on one owner or an invalid view selector or footprint;
- invalid, non-serializable, or cyclic render conditions;
- an ordinary path that attempts to enter a view branch without endpoint-alternative syntax;
- an invalid endpoint-alternative prefix, view ID, branch-local target, duplicate case, or ambiguous default;
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

Independent Go, Rust, and TypeScript implementations MUST be able to read the same Logical IR and renderer-materialized Projection IR. They MAY use different layout and routing algorithms as long as they satisfy hard constraints or report unsatisfiability with an understandable explanation.

A renderer planner MUST materialize the required meta branches into renderer-neutral Projection IR without evaluating TSX components again. It MUST create the render context used by view score and conditional-adjustment expressions. A solver consumes that projection and SHOULD produce renderer-neutral Solved IR. A target painter may then produce Excalidraw, SVG, Canvas, or other output.

Renderer-planner and solver interfaces MUST NOT assume a fixed page rectangle. They SHOULD accept a viewport, selected subtree, export region, tile, view-materialization policy, or level-of-detail policy so that very large models can be processed incrementally. A full-canvas projection and solve MAY remain available for deterministic exports.

A render target MUST be able to request `maximum-that-fits` with an outside-in strategy. The renderer planner and solver MUST cooperate over declared view templates, renderer-created context, score expressions, conditional adjustments, target dimensions, minimum readability, routing space, and capabilities. Projection IR records every materialized view instance and its winning score; Solved IR retains that provenance and enough information to explain fallback decisions. Explicitly forced views are hard requirements; an impossible forced view MUST produce a diagnostic rather than silently substitute another view.

Projection IR MUST be versioned and serializable for debugging, caching, cross-language solvers, and deterministic tests. It MUST distinguish stable logical entity keys, view-template entity keys, and target-local render-instance keys.

Different projections of one model — infinite canvas, single poster, tiled pages, and focused subsystem views — MUST preserve semantic identity and connectivity. Presentation clipping, pagination, collapsing, and filtering MUST NOT silently delete or reinterpret the underlying model.

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
| [`modelplane-fleet-inference`](examples/modelplane-fleet-inference/) | anchored page furniture, repeated cluster components with hidden renderer-scored view templates, stable ports mapped by `PortPlacement`, a context-conditional detail and path, an implicitly created and post-hoc refined port, two ordered corridors subdividing one gap, external nodes, and a footer |
| [`agent-substrate`](examples/agent-substrate/) | deep containment, lines pinned through padding bands and sibling gaps, dashed control paths, a boundary-spanning request route arriving deep inside nested scopes, and corner-anchored annotations |
| [`machine-thought-os`](examples/machine-thought-os/) | a labeled divider on a gap, many-cardinality ports, fan-out and fan-in share groups, a dashed branch leaving a solid merged trunk, bundled data feeds, deferred work, and a hierarchy-crossing return path |

A grammar change MUST update all affected fixture files. A future executable fixture lifecycle SHOULD produce:

- `logical.yaml`, the canonical normalized IR;
- `projection.yaml`, the renderer-materialized instance tree for a named target and policy;
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
10. Two lines attached to the same named port resolve to one port join; `sharing={{ mode: "separate" }}` makes them split immediately while `sharing={{ mode: "merge" }}` gives them one shared trunk.
11. A dashed line branches off a solid merged trunk; the shared piece has one unified style.
12. A port group with `separate` affinity keeps its attached lines visibly apart.
13. A `many` port permits fan-out topology while its independent sharing policy controls merge, bundle, separate, or automatic routing.
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
26. A generated model can nest reusable components to a depth greater than any built-in grammar assumption; only an explicit implementation resource limit may reject it.
27. The same Logical IR can drive an unbounded-canvas view, a DIN A0-style export, and tiled output without changing semantic identities or connections.
28. A focused subsystem projection preserves every connection crossing its boundary and can represent the hidden side as an external continuation rather than dropping it.
29. Expanding a black-box component into its internal model preserves its public port bindings and external lines.
30. Incremental solving of a local subtree produces the same logical result as a complete solve for the affected region when global constraints do not require wider recomputation.
31. Every author-declared structural container has an ID, and two reusable component instances containing identical local container IDs remain separately addressable.
32. A deep reference traverses explicit layout containers into a nested component and resolves to the same entity before and after unrelated sibling insertion.
33. A named endpoint reference implicitly creates a port; a later nested or post-hoc declaration adds a side, marker, and sharing policy without creating another port.
34. A TSX port handle and a relative path that identify the same owner and local port ID resolve to one canonical `PortIR`.
35. One component offers compact and internal meta branches while its canonical identity, external ports, and attached lines remain unchanged across materialization.
36. An A4 `maximum-that-fits` renderer instantiates a less demanding viable branch than an A0 renderer when necessary, and both projections are deterministic.
37. Outside-in materialization recursively instantiates nested components until the next view would violate footprint, readability, routing, or hard layout constraints.
38. A forced view that cannot fit produces a diagnostic; an automatic policy instead instantiates its declared or computed fallback.
39. View templates and their descendants are invisible to ordinary path resolution; descendants of an unselected template do not appear in Projection IR, while selecting it creates distinct render-instance keys with stable template provenance.
40. The same Logical IR materializes different print, screen, narrow, and wide projections because renderer-created contexts produce different explainable view scores, without re-running TSX.
41. A conditional line or segment appears only when its condition holds, and a required connection removed by the condition produces a diagnostic.
42. Cyclic or non-converging size-dependent view fallback is detected and diagnosed deterministically.
43. A deep ordinary endpoint truncates to its deepest instantiated object when the selected rendering hides its suffix; `api.{foo#view:abc, foo:bar}` selects `abc` for view `view`, otherwise selects `bar`, and still truncates if the chosen suffix is only partly instantiated.

## 19. Open grammar decisions

The following details must be decided next by comparing the concrete TSX fixtures:

- the runtime representation of `port<T>()` payload types when `tsc` was not run;
- naming conventions for port-handle props on components;
- the exact rules for `optional` and `many` cardinality and attachment completeness;
- strings versus typed `ref()` objects for references and regions;
- whether a container can reference itself through an explicit `self` alias (for `padding(self, side)` from inside);
- text as child, `label` property, or structured content;
- exact core shape set;
- mirroring (flips) in addition to 90° orientation steps;
- whether the solver may ever choose orientation (`orientation="auto"`);
- whether explicit segments require local IDs and how implicit segment identities are serialized;
- whether an `Arrow` compatibility shorthand exists in the public API;
- automatic IDs for non-container entities and their stability guarantees;
- inline styles versus a CSS-like cascade;
- exact units for size, spacing, margin, padding, pressure, and weights;
- how corridors subdividing one gap are ordered and addressed;
- whether a share group can carry its trunk pinning once instead of per line;
- grouping lines into higher-level semantic flows (line sets) as a library concept;
- representation of resolved references and regions in canonical JSON and YAML;
- which core shorthand forms normalization accepts;
- which provenance data the JSX runtime must capture;
- how reference fixtures express relative placement without turning preferences into accidental hard order;
- the standardized condition-context vocabulary and utility function for automatic component-view choice;
- score ranges, tie-breaking, context inheritance, and score-explanation serialization;
- how view-local port placement maps onto a component's canonical semantic ports;
- the final separators, escaping, nesting, and completeness rules for endpoint alternatives such as `api.{foo#view:abc, foo:bar}`;
- the exact TSX helpers or object syntax for `Condition`, `When`, `Switch`, and conditional paths;
- how much renderer/solver backtracking outside-in materialization requires before falling back to a less detailed view;
