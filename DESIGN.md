# Kvísl Script Implementation Design

Status: Draft

This document describes the implementation architecture and plumbing required to build Kvísl Script, shortened to Kvísl. It deliberately does not define diagram semantics, authoring primitives, layout behavior, routing behavior, or Logical IR fields.

- [REQUIREMENTS.md](REQUIREMENTS.md) states what the system must support.
- [MODEL.md](MODEL.md) defines the conceptual model and Logical IR.
- [`examples/`](examples/) contains the executable visual conformance fixtures and their original acceptance references.

If this document conflicts with either the requirements or the model on language semantics, the other document wins. This document owns process boundaries, package boundaries, execution, serialization plumbing, embedding, diagnostics, caching, and test architecture.

## 1. Architectural goals

The implementation must provide:

- one normative TSX evaluation and normalization path;
- a versioned, serializable data boundary after normalization;
- independently replaceable solvers and renderers;
- one TypeScript and JavaScript stack runnable through the npm-distributed `kvisl` command;
- `npx kvisl render diagram.tsx -o diagram.svg` and `.excalidraw` as the primary end-to-end surface;
- deterministic and diagnosable builds;
- controlled evaluation of untrusted or semi-trusted TSX;
- caching and incremental interfaces suitable for very large models;
- no dependency on React or a browser DOM;
- no requirement that downstream consumers understand TSX or component expansion.

The implementation must keep authoring, normalization, solving, and rendering as separate stages even when a single command runs them in one process.

## 2. End-to-end pipeline

```text
diagram.tsx
    -> source and dependency resolution
    -> TSX transformation and bundling
    -> JavaScript evaluation
    -> custom JSX runtime and component expansion
    -> normalization and validation
    -> Logical IR + provenance + diagnostics
    -> renderer context construction, first-fit view selection, and meta-branch materialization
    -> Projection IR + diagnostics
    -> layout and routing solver
    -> Solved IR + diagnostics
    -> target painter
    -> Excalidraw, SVG, Canvas, raster, or another output
```

Each arrow is an explicit interface. An all-in-one executable may fuse stages for performance, but it must preserve the same observable contracts and diagnostics as separate execution.

Expected durable artifacts are:

- canonical Logical IR;
- optional normalization provenance;
- optional renderer-materialized Projection IR;
- optional Solved IR;
- renderer output;
- structured diagnostics from every stage;
- dependency and asset manifests for reproducibility.

## 3. Package and module boundaries

The exact package names may change, but the codebase should preserve these responsibilities.

### 3.1 JSX runtime

The JSX runtime exports the functions required by the automatic JSX transform:

```ts
jsx(type, props, key?)
jsxs(type, props, key?)
Fragment
```

It creates immutable authoring expressions and invokes function components. It has no React dependency, no reconciliation, no hooks, no DOM, and no renderer behavior.

### 3.2 Authoring API

The authoring package exports the typed TSX surface and helper functions defined by the model. It may provide library components, but the core package must remain independent of domain libraries such as Kubernetes or Linux.

### 3.3 Compiler frontend

The compiler frontend owns source loading, dependency resolution, TSX transformation, bundling, source maps, JavaScript evaluation, runtime limits, and module-result extraction.

### 3.4 Normalizer

The normalizer owns component-expression lowering, reference resolution, default expansion, semantic validation, deterministic entity assignment, canonical Logical IR emission, and provenance generation. It performs no layout or routing solve.

### 3.5 Schema package

The schema package owns version identifiers, machine-readable schemas, feature declarations, compatibility rules, canonical serialization, and TypeScript types used across the JavaScript implementation.

### 3.6 Renderer planners

A renderer planner consumes Logical IR plus target options and renderer capabilities. It constructs per-instance render contexts, selects and materializes view branches per REQUIREMENTS section 7.4, evaluates conditional template adjustments, and emits Projection IR. It may cooperate iteratively with a solver when allocation or routing feedback invalidates a tentative branch. It never evaluates TSX.

### 3.7 Solvers

Solvers consume Projection IR and emit Solved IR. A trivial projection may be used for a model with no meta branches. Multiple implementations may coexist. A solver must advertise supported schema versions and optional features.

The current layout and routing solver remains under [`experiments/layouter/`](experiments/layouter/) while its geometry model and internal APIs evolve. The public CLI may call it through a narrow internal adapter, but importing experimental modules does not make those modules stable API. Promotion into a regular package is a later decision and is not required for the npm command to render the conformance fixtures.

### 3.8 Painters and public renderers

A target painter consumes Solved IR and produces a target format. A public renderer packages a renderer planner, compatible solver integration, and a painter behind one API. It does not evaluate TSX, expand components, or reinterpret unsupported requirements silently.

## 4. TSX transformation and bundling

esbuild is the primary transformation and bundling implementation. It provides a maintained TSX parser, fast builds, and a JavaScript API suitable for the Node.js frontend.

The transform must use automatic JSX mode with the Kvísl JSX runtime as its import source. It must preserve source maps through bundling so that runtime and normalization diagnostics map back to original TSX modules.

The compiler resolves `@kvisl/core` and `@kvisl/core/jsx-runtime` to the authoring API and JSX runtime shipped with that exact CLI build. This keeps a one-file diagram runnable through `npx kvisl` without a project-local Kvísl installation and prevents frontend/runtime version skew.

Bundling is responsible for:

- resolving the entry module, local imports, npm packages, supported remote imports, stylesheet modules, and stylesheet assets;
- including component libraries allowed by the host;
- parsing standalone stylesheets into immutable authoring-runtime values and following their `@import` and asset edges;
- rewriting JSX to the custom runtime;
- producing a JavaScript format supported by the selected evaluator;
- recording every source dependency and content hash;
- rejecting imports disallowed by the active trust policy;
- preserving enough source-map information for component stacks and property spans.

esbuild transforms TypeScript syntax but does not type-check it. Development tooling should offer `tsc --noEmit` as a separate optional check. Runtime correctness and normalization validation must not depend on the user having run `tsc`.

### 4.1 Deno-compatible remote specifiers without Deno

The compiler frontend extends esbuild resolution with the established module-specifier vocabulary used by Deno: absolute `https:` imports plus `npm:` and `jsr:` specifiers. It also preserves ordinary local and bare npm imports. The same resolver handles stylesheet modules and their transitive `@import` and asset URLs. This is resolver compatibility, not a Deno execution host: the public command runs on Node.js, and neither users nor the npm package need an installed Deno runtime.

The resolver must:

- resolve a relative import in a remote module against that module's final canonical URL;
- follow bounded redirects and record both requested and final origins;
- reject unsupported schemes and scheme-less strings that would otherwise be ambiguous with package names;
- preserve media type and source-map provenance through transformation;
- dispatch TypeScript/JavaScript to esbuild and Kvísl stylesheet content to the stylesheet parser based on the resolved media type and supported suffix;
- convert a stylesheet module into an immutable default-export value instead of installing it into ambient global state;
- hash every fetched module, stylesheet, and asset and include the complete transitive graph in the dependency manifest;
- reuse a content-addressed local cache and verify locked hashes before evaluation;
- support offline builds when the locked graph is already cached;
- keep fetching and executing permissions separate under the active trust policy.

Module imports, stylesheet imports, and stylesheet asset URLs are the dependency declarations. No Kvísl `.mod` file or second dependency grammar exists. A generated lock artifact records exact resolutions and hashes but does not duplicate the authored graph. The exact lock filename and serialization format may be chosen with the CLI packaging work, provided updates are explicit and deterministic.

## 5. JavaScript evaluation

### 5.1 Module contract

The bundled module must produce exactly one normalizable root value, normally through its default export. The evaluator returns that value together with captured provenance, dependency information, and runtime diagnostics.

### 5.2 Node.js host

The normative frontend runs in Node.js because `npx` supplies the intended installation-free command surface and Node provides direct JavaScript, npm, and source-map integration. The CLI, compiler, normalizer, planners, experimental solver, and painters remain TypeScript or JavaScript. Public compiler results use serializable Kvísl values rather than exposing Node-specific objects.

## 6. Evaluation isolation

The host must distinguish at least two execution profiles:

- `trusted`: local project code with explicitly configured import and host access;
- `restricted`: untrusted or shared input with no ambient file-system, network, process, environment, clock, or randomness access.

Restricted evaluation should provide only deterministic runtime services required by the JSX runtime and normalizer. Hosts must support:

- module and package allowlists;
- source-size, dependency-count, execution-time, and memory budgets;
- cancellation and termination;
- controlled stack depth;
- disabled or wrapped nondeterministic globals;
- no network access unless explicitly supplied by the host;
- no arbitrary native module loading.

A Node.js worker, `vm` context, or bundled evaluator is not automatically a security boundary. The threat model and evaluator-specific escape analysis must be documented before accepting hostile input.

## 7. Component expansion and JSX expression handling

The runtime normalizes JSX results into a small host-owned expression representation. It must handle:

- function components;
- fragments;
- nested arrays;
- `null` and `false` results;
- JSX keys for provenance and deterministic expansion;
- source locations and component stacks;
- typed handles allocated by the authoring runtime.

Expressions must be immutable after creation or defensively copied before normalization. Runtime objects, functions, prototypes, symbols, and evaluator-specific handles must not cross the Logical IR boundary.

Component expansion cannot inspect solved geometry. The compiler frontend therefore has no callback from the solver into TSX evaluation.

## 8. Normalization API

The frontend should expose a host-neutral result shape equivalent to:

```ts
interface CompileOptions {
  entry: string;
  trust: "trusted" | "restricted";
  schemaVersion?: string;
  features?: readonly string[];
  signal?: AbortSignal;
}

interface CompileResult {
  logicalIR?: unknown;
  provenance?: unknown;
  dependencies: readonly DependencyRecord[];
  diagnostics: readonly Diagnostic[];
}
```

Failure to produce Logical IR must still return structured diagnostics and discovered dependencies. Expected user errors must not require parsing stderr or JavaScript stack strings.

Normalization phases and semantic validation rules are defined by the requirements and model. The implementation should make phases observable in traces, but phase-local internal data structures are not interchange formats.

## 9. Serializable IR boundary

Logical IR, Projection IR, and Solved IR must have explicit schema identifiers and versions. The schema package should generate or verify the TypeScript types used by all implementation stages to prevent handwritten drift.

The boundary must support:

- canonical JSON;
- canonical YAML as a lossless projection of the same data;
- optional binary transport later, without changing semantics;
- required and optional feature declarations;
- compatibility checks before solving or rendering;
- preservation of unknown optional extensions where possible;
- rejection of unknown required extensions.

Provenance is a separate artifact. Absolute paths, source spans, component stacks, and evaluator details must not affect canonical Logical IR hashes.

## 10. Renderer planning and solver feedback

A renderer-planning API should be equivalent to:

```ts
interface MaterializeOptions {
  target: RenderTarget;
  policy: MaterializationPolicy;
  capabilities: readonly string[];
  inheritedContext?: Readonly<Record<string, ContextValue>>;
  seed?: string;
  signal?: AbortSignal;
}

interface MaterializeResult {
  projectionIR?: unknown;
  diagnostics: readonly Diagnostic[];
  selectionExplanations: readonly ViewSelectionExplanation[];
}

interface SolveOptions {
  viewport?: Region;
  selection?: readonly InstanceKey[];
  seed?: string;
  signal?: AbortSignal;
}

interface SolveResult {
  solvedIR?: unknown;
  diagnostics: readonly Diagnostic[];
  invalidated?: readonly InstanceKey[];
  rejectedViews?: readonly ViewRejection[];
}
```

The concrete option types belong to the versioned Projection and Solved IR contracts. The renderer planner constructs immutable context per component instance, applies the selection semantics of REQUIREMENTS section 7.4, resolves endpoint alternatives, and emits Projection IR. It must record enough context and selection explanation to reproduce every choice.

Normal endpoint lookup never enters a meta branch. During materialization, endpoint alternatives may inspect the selected view and resolve one branch-local suffix. A remaining unmaterialized suffix truncates to its deepest projected instance. The planner records the selected case and truncation point for diagnostics and caching.

The planner and solver may iterate when footprint, readability, layout, or routing rejects a tentative view. Rejection is structured feedback, not an invitation for the solver to select a hidden branch itself. Iteration must be bounded, cancellable, and detect cycles.

Given identical Logical IR, renderer version, target, inherited context, capabilities, materialization policy, solver version, assets, and seed, the pair must emit canonical-equivalent Projection and Solved IR.

## 11. Renderer interface

A public renderer owns a renderer planner and compatible solver integration, then passes Solved IR to a target painter. It returns output bytes or a streaming result together with optional Projection IR, optional Solved IR, view-selection explanations, and structured diagnostics.

Painter responsibilities include:

- mapping solved primitives to the target format;
- resolving fonts, images, and other assets through host-provided services;
- applying target-specific presentation that does not change model semantics;
- clipping, pagination, tiling, or viewport output when requested;
- reporting unsupported required features.

A renderer package may expose policies such as `maximum-that-fits` and `outside-in`. Internally these policies drive context construction, first-fit view materialization, conditional template adjustment, solving, and only then painting. They must not re-evaluate component code or hide view choices in target-specific output only.

A renderer must not re-run component code. Target-specific IDs should derive deterministically from Solved IR identities where the output format permits it.

### 11.1 Solved IR contract

SVG and Excalidraw both sit behind the painter boundary, but they are different kinds of targets: SVG is pure structured geometry, while an Excalidraw document is geometry plus residual topology (bindings, bound text, frames) that stays live-editable. Solved IR must serve both, which fixes several properties:

- **Geometry plus provenance, never geometry alone.** Every solved fragment keeps its logical linkage: which polyline belongs to which line and segment, which endpoint attaches to which object or port, which text is whose label or content, which rectangle is whose boundary. Flattening to anonymous shapes would make the Excalidraw target impossible and degrade the SVG target.
- **Local coordinates with explicit directional mappings.** Geometry is expressed per container in its local frame and composed through parent translations. Layout orientation maps axes, sides, ports, and routes to a bounded frame depth without applying a geometric rotation to child boxes. Identical component projections remain cacheable; tiles and viewports slice the frame tree instead of recomputing unrelated world coordinates.
- **A small geometric vocabulary.** Solved fragments lower to paths, text runs, and images. Model semantics never leak into the painter contract.
- **Text is solved, not delegated.** Measurement, wrapping, and label placement happen in the solver against declared fonts and metrics. Painters place finished text runs; no output format is trusted with layout (SVG famously has none).
- **A total paint order.** `PaintRelation` partial orders are linearized into one total order per rendered fragment. Painters that emit structural groups (one per object) may split groups where the paint order requires interleaving.

### 11.2 Stable output identity and painterly determinism

The canonical containment address — not the ephemeral `EntityKey` — is the stable identity across builds and exports. Painters derive target IDs from canonical addresses (with deterministic derivation for anonymous entities). Re-exporting a changed model into an existing target document then **updates elements instead of replacing them**, so a target editor can diff, merge, and preserve manual adjustments where its format allows.

Painterly randomness is seeded, never ambient: hand-drawn jitter (rough.js style) derives its per-element seed from the canonical address plus the build seed. Re-rendering an unchanged element reproduces identical strokes; determinism extends through the last painterly detail.

### 11.3 Target painters: SVG and Excalidraw

The SVG painter emits structured output, not flattened shape soup: one group per object with the composed transform, roles and classes as `class` attributes, the canonical address as a stable `id` or data attribute, labels as `<title>`/`<desc>` where appropriate, and heads as reusable `<marker>` definitions. The result remains stylable, scriptable, accessible, and traceable back to the model.

The Excalidraw painter preserves as much live topology as the format carries: line endpoints become element **bindings** (`startBinding`/`endBinding`) instead of dead coordinates, labels become **bound text**, container boundaries map to frames or grouped rectangles depending on nesting depth, and element IDs, versions, and seeds follow section 11.2 so re-export merges instead of clobbers. Known format limits are documented, not papered over: Excalidraw cannot bind an arrow to another arrow, so branches of a merged trunk attach at unbound coordinates and lose follow-behavior; deeply nested frames degrade to rectangles plus groups.

## 12. Assets and dependency manifests

Source modules, stylesheets, and visual or font assets must resolve through host interfaces rather than ambient process state. The compiler records a manifest containing at least logical name, requested specifier, resolved origin, content hash, media type, dependency role, and transitive edges.

The default restricted host performs no network fetches. A caller may supply a resolver that fetches remote assets and returns immutable content-addressed data. Canonical build hashes use content, not retrieval timestamps or local absolute paths.

Missing assets should produce diagnostics with source provenance. A renderer may use an explicit placeholder only when the active policy allows degraded output.

## 13. Diagnostics and provenance

Every stage emits the same structured diagnostic envelope:

```ts
interface Diagnostic {
  stage: "transform" | "evaluate" | "normalize" | "solve" | "render";
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
  source?: SourceSpan;
  componentStack?: readonly ComponentFrame[];
  entity?: string;
  details?: Readonly<Record<string, unknown>>;
}
```

Diagnostic codes are stable API. Human-readable messages may improve without becoming machine contracts.

Provenance should map normalized entities back to source declarations, JSX keys, generated component instances, and component stacks. It must remain outside canonical domain hashes so that relocating a project does not change its model identity.

## 14. Determinism and build identity

A build identity must include at least:

- entry source and all dependency contents;
- frontend and JSX-runtime versions;
- normalizer and schema versions;
- enabled semantic features;
- normalization-relevant options;
- content-addressed assets that affect intrinsic measurement.

It must exclude wall-clock time, temporary paths, process IDs, nondeterministic object iteration, and unrelated environment variables.

Canonical Logical IR must be reproducible for the same build identity. Solver and renderer outputs may add their own versioned identities.

## 15. Caching and incrementality

The pipeline should expose cache boundaries after bundling, evaluation, normalization, solving, and rendering. Cache entries must be content-addressed and versioned by the stage implementation and schema.

Large-model support requires interfaces that can invalidate by source dependency, normalized entity, solved region, viewport, or asset. A first implementation may recompute whole stages, but it must not encode whole-document recomputation into public contracts.

Incremental and full execution must converge on canonical-equivalent results for the same affected region when no wider constraint requires invalidation.

## 16. CLI and embedding surfaces

The npm package must expose a `kvisl` executable so a packed or published package supports these canonical commands:

```sh
npx kvisl render diagram.tsx -o diagram.svg
npx kvisl render diagram.tsx -o diagram.excalidraw
```

`render` infers the target painter from the output suffix; an explicit `--format` may override inference. Both forms use one frontend and one evaluation of the entry module. SVG and Excalidraw are painters behind the same Projection and Solved IR stages, not separate compilation paths.

The package manifest must include the executable through `bin`, publish every runtime dependency and required asset, declare its supported Node.js versions, and exclude repository-only fixtures and generated galleries unless deliberately shipped. A release smoke test must run the packed tarball rather than resolving source files from the repository:

```sh
npm pack
npx --package ./kvisl-<version>.tgz kvisl render diagram.tsx -o diagram.svg
npx --package ./kvisl-<version>.tgz kvisl render diagram.tsx -o diagram.excalidraw
```

Additional stage-oriented commands may expose the pipeline without competing with the primary surface:

```text
kvisl check diagram.tsx
kvisl normalize diagram.tsx --output logical.yaml
kvisl materialize logical.yaml --target a4 --output projection.yaml
kvisl solve projection.yaml --output solved.yaml
kvisl paint solved.yaml --format excalidraw --output diagram.excalidraw
```

Commands must support machine-readable diagnostics, stdin/stdout where meaningful, explicit schema and feature selection, cancellation, reproducible-output modes, and nonzero exit status when the requested artifact cannot be produced.

Embedding APIs in TypeScript and JavaScript should mirror the same stage boundaries rather than expose one opaque `build()` function only.

### 16.1 Current local package slice

The repository currently prepares an npm tarball without publishing it. Its manifest includes public package metadata, the `kvisl` `bin`, Node.js engine range, runtime dependencies, and only the source files required by the command. The executable supports `check`, `normalize`, `materialize`, `solve`, `paint`, and end-to-end `render`; SVG is the implemented painter and Excalidraw returns an explicit unsupported-target diagnostic.

The compiler frontend aliases the bundled authoring API, transforms TSX with esbuild, resolves local, bare npm, `npm:`, `jsr:`, and HTTPS modules, follows relative remote imports against final redirect URLs, records hashes, and supports explicit lock update plus offline cache verification. `.kvisl.css` is recognized as an immutable dependency value, but attachment is rejected until the open restricted-CSS grammar decision is resolved; this prevents the implementation from silently inventing semantics that do not exist in the model.

The stage commands currently serialize explicitly prototype-namespaced JSON or YAML artifacts. They exercise and test the intended process boundaries but do not claim to be the stable canonical Logical, Projection, or Solved schemas drafted in [MODEL.md](MODEL.md). The packed-tarball test uses the tarball's `bin` through `npx` and verifies SVG output before any publication step.

## 17. Testing and conformance plumbing

The fixtures under [`examples/`](examples/) are golden inputs. Every implemented pipeline stage should process every applicable fixture and produce:

- canonical Logical IR;
- provenance with stable source mappings;
- one or more Projection IR results with render contexts and view-selection explanations;
- one or more Solved IR results for named solvers;
- renderer outputs;
- structured diagnostics, including expected warnings.

Required test layers are:

- JSX-runtime expression tests;
- component-expansion and normalization tests;
- renderer-context, first-fit view-selection, conditional-materialization, and endpoint-alternative tests;
- schema validation and canonical serialization tests;
- JSON/YAML round-trip tests;
- local, bare npm, `npm:`, `jsr:`, and HTTPS module- and stylesheet-resolution tests;
- redirect, transitive URL and stylesheet `@import`, stylesheet asset, cache, lock-integrity, and offline-resolution tests;
- solver constraint and determinism tests;
- renderer structural and visual regression tests;
- packed-tarball `npx kvisl render` smoke tests for SVG and Excalidraw;
- restricted-evaluator security tests;
- cancellation, budget, and malformed-input tests;
- large generated-model and incremental invalidation tests.

Tests must compare semantics before pixels. Visual regression thresholds are renderer-specific and cannot replace IR assertions.

## 18. Proposed repository structure

```text
packages/
  cli/
  expression/
  jsx-runtime/
  authoring/
  compiler/
  normalizer/
  schema/
  renderer-svg/
  renderer-excalidraw/
experiments/
  layouter/
examples/
```

The repository may start smaller. Boundaries should become packages only when code exists on both sides, but dependencies must continue to point in one direction:

```text
jsx runtime -> expression representation
authoring API -> expression representation
normalizer -> expression representation + schema
compiler frontend -> JSX runtime + authoring API + normalizer
solvers -> schema
renderers -> schema
CLI -> compiler frontend + solver adapter + renderers
```

Solvers and renderers must not become dependencies of the authoring runtime or normalizer.

## 19. Delivery sequence

1. Freeze the first Logical, Projection, and Solved IR schemas and generate their TypeScript contracts.
2. Package the custom JSX runtime, Node.js/esbuild frontend, and a public `kvisl` npm executable.
3. Normalize every reference fixture to canonical Logical IR.
4. Keep the current layouter experimental while connecting it through a private solver adapter and exercising it against every reference fixture.
5. Complete the SVG and editable Excalidraw painters behind the same `render` command.
6. Add Deno-compatible URL, `npm:`, and `jsr:` resolution with a content-addressed cache and reproducibility lock.
7. Prove the installation-free surface with packed-tarball `npx` tests for both output formats.
8. Add deterministic renderer context, first-fit Projection IR materialization, viewport, tiling, caching, and incremental invalidation.
9. Harden restricted evaluation and publish the threat model.

This sequence is an implementation plan, not a change to model semantics. Any model or grammar change remains governed by [REQUIREMENTS.md](REQUIREMENTS.md), [MODEL.md](MODEL.md), and the reference fixtures.
