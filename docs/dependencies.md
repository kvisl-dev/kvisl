# Dependencies, remote modules, and stylesheets

Kvísl models are ordinary TypeScript and TSX modules, and presentation may live in standalone Kvísl stylesheets. Module imports, stylesheet `@import` declarations, and stylesheet asset URLs are the dependency declarations; Kvísl does not add a dependency manifest language or require a `.mod` file.

## Runtime prerequisite

The executable stack is TypeScript and JavaScript. A supported Node.js installation with npm and `npx` is sufficient:

```console
$ npx kvisl render diagram.tsx -o diagram.svg
$ npx kvisl render diagram.tsx -o diagram.excalidraw
```

The repository package currently executes the SVG command. Excalidraw remains the next painter behind the already-reserved suffix. Before registry publication, the same npm `bin` is exercised from a local tarball as described in the [CLI guide](cli.md).

The npm package supplies the compiler frontend, matching `@kvisl/core` authoring API, automatic JSX runtime, planners, experimental layouter, and target painters. A project does not install Kvísl merely to make `@kvisl/core` visible to the compiler, and it does not need Deno, React, or a browser runtime.

## Supported source specifiers

The Node.js/esbuild frontend supports one explicit set of ordinary module specifiers:

| Form | Example | Resolution |
| --- | --- | --- |
| Local | `./components/service.tsx` | Relative to the importing local file |
| Bare npm | `@example/kvisl-aws` | Standard Node.js resolution from the project |
| `npm:` | `npm:@example/kvisl-aws@1.4.0` | Exact npm package through the Kvísl resolver |
| `jsr:` | `jsr:@example/kvisl-network@2.1.0` | JSR package through the Kvísl resolver |
| HTTPS | `https://example.com/components/service.tsx` | Remote TypeScript, TSX, or JavaScript module |
| Local stylesheet | `./styles/company.kvisl.css` | Immutable Kvísl stylesheet value |
| HTTPS stylesheet | `https://example.com/styles/company.kvisl.css` | Remote, lockable Kvísl stylesheet value |

`npm:` and `jsr:` follow Deno-compatible spelling, and HTTPS modules may use relative imports against their own final URL. Kvísl implements those resolver semantics inside the Node.js frontend; it does not start or install Deno and does not provide Deno host APIs to component code.

Bare npm imports are for dependencies managed by an ordinary project `package.json` and npm lockfile. The explicit `npm:` and `jsr:` forms are useful when a standalone diagram should name a package and version directly in TSX.

## Corporate styles from the Internet

A stylesheet is imported as a value and attached explicitly. Importing it does not mutate a hidden global registry:

```tsx
import { Diagram } from "@kvisl/core";
import corporateStyle from "https://raw.githubusercontent.com/company/styles/3f2a91c/architecture.kvisl.css";

export default (
  <Diagram id="production" styles={corporateStyle}>
    {/* reusable components */}
  </Diagram>
);
```

Attached at the root, the sheet will become a diagram-wide corporate style while still obeying component style boundaries and the fixed Kvísl cascade. The resolver already treats `.kvisl.css` as an immutable, lockable value, but the current prototype diagnoses attachment because the restricted stylesheet syntax remains an open decision in the model. Once frozen, it must parse into the same typed rules and tokens as TypeScript helpers; unsupported browser CSS and untyped declarations remain diagnostics.

## One file can compose from the Internet

```tsx
import { Diagram } from "@kvisl/core";
import { KubernetesCluster } from "npm:@example/kvisl-kubernetes@1.4.0";
import { Network } from "jsr:@example/kvisl-network@2.1.0";
import { Platform } from "https://raw.githubusercontent.com/example/platform/v1.2.3/mod.tsx";

export default (
  <Diagram id="production">
    <Platform id="platform">
      <Network id="network" />
      <KubernetesCluster id="cluster" />
    </Platform>
  </Diagram>
);
```

A GitHub `blob` page is HTML, not a module. Use a raw HTTPS source URL, a package registry specifier, or another endpoint that returns module source. Scheme-less text such as `github.com/example/platform/mod.tsx` remains a normal package-like specifier and never silently turns into a network request.

## Recursive resolution

Every imported module may import more modules. Kvísl resolves the complete graph before evaluation:

```text
diagram.tsx
  -> local component
  -> npm or JSR library
  -> HTTPS module
       -> relative HTTPS dependency
  -> HTTPS stylesheet
       -> relative @import
       -> font or image asset
```

For every module, stylesheet, and asset, the frontend records its role, requested specifier, final canonical origin after bounded redirects, media type, content hash, and transitive dependencies. The same graph feeds source maps and diagnostics, so a component or style failure can point back to the source that declared it.

## Cache and reproducibility lock

Fetched modules, stylesheets, and assets are stored in a content-addressed cache. A generated lock artifact records exact resolutions and hashes for the complete remote graph. The lock is resolution state, not a second place to declare packages: authors continue to add and remove dependencies through ordinary imports, stylesheet URLs, or the standard npm project files used by bare imports.

A locked build must reject changed remote content instead of accepting it under the same specifier. An offline build succeeds when all locked content is present in the cache; otherwise it reports the missing dependency rather than fetching or substituting content silently.

Normal rendering verifies the existing lock. Dependency refresh updates it explicitly; rendering never rewrites locked versions merely because a registry or URL now serves something newer.

## Trust model

Remote TSX is executable code, not inert diagram data. It has the same ability to run component logic as a local module and must be reviewed, versioned, and pinned like any other build dependency. A stylesheet is non-executable, but its rules can change layout metrics and its transitive URLs can fetch further content, so it is still locked, reviewed, and subject to fetch policy.

Fetching a module and evaluating it are separate permissions. This permits review tooling to resolve, hash, and inspect a graph without granting it ambient process access. The default trusted workflow is appropriate for project code; hostile input requires the restricted evaluator profile and its explicit module and host-access policy.

Prefer immutable versions or commit-addressed URLs. A reproducibility lock detects content drift, but a stable upstream version also makes reviews, provenance, and cache reuse understandable to humans.

## What Kvísl does not introduce

Kvísl does not require:

- a Kvísl-specific dependency manifest;
- a `.mod` file;
- custom `github:` or scheme-less network syntax;
- a Deno runtime;
- a separate dependency graph outside the imports and URLs already present in TSX and stylesheets.

The goal is Internet-scale composition using recognizable TypeScript module syntax, with enough cache, lock, provenance, and trust information to make repeated rendering deterministic.
