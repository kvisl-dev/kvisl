# Kvísl Script documentation

Kvísl Script, or Kvísl for short, is a composable modelling language for technical design diagrams. These guides cover authoring TSX models, routing and ports, adaptive views, rendering, and domain libraries such as UML.

**These guides dogfood the prototype.** Their architecture, UML, feature, adaptive-view, alternate-style, and routing-debug images are generated from repository TSX by the local evaluator, layouter, router, and SVG painter. The prototype remains experimental; the generated drawings make its current strengths and limitations reviewable against complete models instead of prose alone.

```console
npm run build
```

This one command regenerates every linked documentation diagram, both example galleries, and the alternate CSS render. Documentation sources live in [`docs/diagrams/`](diagrams/), generated assets in [`docs/generated/`](generated/), and complete example sources in [`examples/`](../examples/). Original reference drawings are visual acceptance inputs and are never overwritten.

## Start here

1. [Overview](overview.md) — the problem, the model, and when Kvísl is useful.
2. [Getting started](getting-started.md) — create and render a diagram, then grow it into reusable components.
3. [Layout and orientation](layout-and-orientation.md) — local frames, quarter turns, upright geometry, and explicit orientation depth.
4. [Dependencies, remote modules, and stylesheets](dependencies.md) — compose TSX and corporate styles from local files, npm, JSR, and HTTPS without another runtime.
5. [Routing, corridors, and ports](routing-and-ports.md) — the attachment and routing model, with feature illustrations.
6. [UML with Kvísl Script](uml.md) — how UML works as a library over the same composable core.

## Specification documents

The guides above explain the language from an author's point of view. The root-level documents define its contracts in more detail:

- [Requirements](../REQUIREMENTS.md) defines normative language and system requirements.
- [Data model](../MODEL.md) defines the conceptual model and draft intermediate representations.
- [Implementation design](../DESIGN.md) describes compiler, planner, solver, and renderer plumbing.
- [Examples](../examples/README.md) contains complete architecture and UML models.
