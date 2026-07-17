# Layouter Prototype Decisions

Status: Accepted for the experiment

These decisions make the first layout experiment concrete. They do not amend the Kvísl language model. Where the experiment exposes a model ambiguity, the result belongs in a later explicit update to [`MODEL.md`](../../MODEL.md).

## D1. Port sides are an ordered set

A port side is represented internally as an ordered, non-empty set of allowed sides.

- One side means required.
- Several sides mean allowed in preference order.
- All four sides mean automatic placement.

The current `side: Side | "auto"` model maps directly to a singleton or all four sides. The prototype does not add authoring syntax for a preference list.

Rationale: this keeps hard feasibility distinct from preference without introducing opaque numeric weights.

## D2. Corridor capacity counts simultaneous visible tracks

Capacity is the number of simultaneous visible track slots at one cross-section of a corridor.

- A merged trunk consumes one slot.
- Five separately visible bundled lines consume five slots.
- A divider or corridor-resident object consumes physical width but not a track slot.

Rationale: capacity then has a geometric meaning the solver can validate before coordinates are assigned.

## D3. Pressure is normalized

Pressure is in the closed interval `0..1`.

- `0` uses preferred track spacing.
- `1` uses minimum track spacing.
- Intermediate values interpolate linearly: `min + (1 - pressure) * (preferred - min)`.

Pressure may bias an automatic sharing choice toward a bundle or merge. It never violates minimum spacing, capacity, or an explicit sharing prohibition.

## D4. The reference route geometry is orthogonal

The prototype emits orthogonal polylines. Painter profiles may round corners, perturb strokes, or produce a hand-drawn appearance without changing solved topology.

The first language version does not need a per-line route-geometry grammar. A future alternative solver may advertise non-orthogonal routing as a renderer capability.

Rationale: orthogonal geometry makes corridors, tracks, portals, docking sides, labels, and reserved space measurable with one coherent model.

## D5. Corridor residents remain ordinary objects

An object residing in a corridor remains an `ObjectIR`. It is anchored to a `RegionRef` with `placement.area: "inside"`. Track-order constraints can place tracks before or after that object.

The experiment must use this representation when corridor-resident fixtures are added; it must not introduce a corridor-resident entity kind.

## D6. Hard size conflicts cause deterministic fallback or failure

When required routing space conflicts with a hard maximum size, the solver proceeds in this order:

1. try its bounded alternative route topologies;
2. if the view was selected automatically, reject it and try the next view;
3. if the view was forced or no viable view remains, emit a hard diagnostic.

The solver must not silently route outside a semantic boundary or overlap an object to satisfy the size.

## D7. Pure hierarchy traversals stay compressed

The solver materializes a boundary portal only where geometry, orientation, a visible boundary, or painter binding changes. Pure hierarchy traversal remains compact provenance.

Rationale: eagerly emitting one portal for every crossed ancestor can make a sparse, deeply nested input produce quadratic output.

## D8. Crossing geometry is output-sensitive and optional

The reference solver may count crossings in aggregate while choosing routes. It enumerates individual crossings only when the painter requests bridge or gap adornments.

The resulting `X` term is part of output size. Crossing enumeration is off by default in this experiment.

## D9. Prototype completeness is explicit

The experiment has two result classes:

- **solved**: all required endpoints, regions, capacities, and hard constraints were honored;
- **preview**: an SVG was emitted, but one or more unsupported or relaxed features produced diagnostics.

Preview output is valuable for visual comparison, but it is never evidence that the complete language feature is implemented.

## D10. The experiment is deterministic and bounded

The prototype uses a fixed candidate set for routes, stable ordering by canonical path, and a fixed number of refinement passes. It contains no permutation search, backtracking over global route combinations, SAT/ILP invocation, or convergence loop.

The implementation target is near-linear in projected input plus emitted geometry. Spatial queries use a sparse cell index instead of testing every route segment against every object.

## D11. Label demand is reserved in one physical region

A line label contributes space to one selected gap or explicitly named padding/corridor region, not to every hierarchy band crossed by the line. Grid column and row gutters are sized independently.

Rationale: charging the full label width to every traversed band compounds through nesting and makes otherwise compact diagrams arbitrarily wide. A label is painted once and therefore reserves one local interval.

## D12. Named merge and bundle ports have different geometry

Lines at a `merge` port share one positive-length dock trunk before branching. Lines at a `bundle` port share only the canonical dock point, fan into adjacent lanes immediately, and remain separate strokes. Line-level bundles occupying one explicit gap receive adjacent tracks there.

Rationale: coincident polylines are not a visual implementation of a bundle. The distinction must remain visible even in the minimal SVG painter.

## D13. Previously routed lines are sparse routing obstacles

The router indexes emitted segments as it proceeds. A new candidate receives a strong penalty for an unrelated collinear run and a smaller penalty for a crossing. A declared merge is exempt from the collinear penalty.

Rationale: object avoidance alone can produce visually ambiguous coincident paths. The same cell index keeps this check local and output-sensitive.

## D14. The gallery reports structural conflicts

Every preview is checked for unrelated object overlaps, route/object intersections, line-label/object overlaps, line-label/line-label overlaps, and unrelated shared runs. UML occurrences inside activation bars are an explicit object-overlap exception. Crossings are counted but are not a hard failure because some legal drawings require them.

The repository examples are a regression gate: every example must render, remain orthogonal, and report zero structural conflicts in those five categories.
