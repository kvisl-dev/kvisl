# Excalmermaid documentation

Excalmermaid is a composable modelling language for technical design diagrams. These guides cover authoring TSX models, routing and ports, adaptive views, rendering, and domain libraries such as UML.

**These guides are a reality check.** The language and data model are designed; a first normalizer slice runs; solver and renderers do not exist yet. Before building them, we want an honest answer to one question: *does the world need this?* Read the [overview](overview.md), skim one [complete example](../examples/README.md), and tell us — see [the questions we are asking](overview.md#does-the-world-need-this).

## Start here

1. [Overview](overview.md) — the problem, the model, and when Excalmermaid is useful.
2. [Getting started](getting-started.md) — create and render a diagram, then grow it into reusable components.
3. [Routing, corridors, and ports](routing-and-ports.md) — the attachment and routing model, with feature illustrations.
4. [UML with Excalmermaid](uml.md) — how UML works as a library over the same composable core.

## Specification documents

The guides above explain the language from an author's point of view. The root-level documents define its contracts in more detail:

- [Requirements](../REQUIREMENTS.md) defines normative language and system requirements.
- [Data model](../MODEL.md) defines the conceptual model and draft intermediate representations.
- [Implementation design](../DESIGN.md) describes compiler, planner, solver, and renderer plumbing.
- [Examples](../examples/README.md) contains complete architecture and UML models.
