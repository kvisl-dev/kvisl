# CLI and local packaging

Kvísl's public command is an npm `bin` entry. A render performs dependency resolution, TSX transformation, component expansion, normalization, view materialization, layout, routing, and painting in one process while evaluating the TSX entry exactly once.

```console
$ npx kvisl render diagram.tsx -o diagram.svg
📦 Resolving dependencies
⚡ Transforming TSX
🧩 Expanding components
🧱 Normalizing the model
🔭 Selecting and materializing views
📐 Laying out objects
🛤️ Routing lines
🎨 Painting SVG
✨ Wrote diagram.svg
```

SVG is the executable painter in the current prototype. The `.excalidraw` suffix and `--format excalidraw` are reserved by the same dispatch path, but return a failing diagnostic until the editable Excalidraw painter is implemented.

## Commands

| Command | Input | Result |
| --- | --- | --- |
| `render` | TSX entry | Runs every stage and paints SVG |
| `check` | TSX entry | Compiles, materializes, lays out, and routes without writing an artifact |
| `normalize` | TSX entry | Writes versioned prototype Logical data as JSON or YAML |
| `materialize` | Logical artifact | Selects views and writes versioned prototype Projection data |
| `solve` | Projection artifact | Writes serializable solved geometry and SVG-painter data |
| `paint` | Solved artifact | Paints SVG without evaluating TSX again |

The separate stages reproduce the direct render byte for byte:

```console
$ npx kvisl normalize diagram.tsx -o logical.yaml
$ npx kvisl materialize logical.yaml --target print -o projection.json
$ npx kvisl solve projection.json -o solved.json
$ npx kvisl paint solved.json -o diagram.svg
```

The current artifact schema names end in `.prototype`. They are inspectable and round-trip through JSON and YAML, but they are not yet the stable canonical schemas drafted in [MODEL.md](../MODEL.md).

## Render context and painter options

```console
$ npx kvisl render diagram.tsx \
    --target print \
    --inline-size 1120 \
    --block-size 760 \
    --background '#ffffff' \
    --debug-routing \
    -o diagram.svg
```

`--target`, `--inline-size`, and `--block-size` construct the bounded context used for view selection. `--debug-routing` paints the canonical channel mesh and sharing state. `--transparent` omits the canvas rectangle.

## Dependencies, lock, and offline mode

The compiler accepts local and bare npm imports plus `npm:`, `jsr:`, and HTTPS specifiers. HTTPS modules may import relative dependencies against their final URL after redirects. Remote bytes are stored by SHA-256 in the content cache.

```console
$ npx kvisl render diagram.tsx --update-lock -o diagram.svg
$ npx kvisl render diagram.tsx --offline -o diagram.svg
$ npx kvisl render diagram.tsx \
    --lock ./locks/architecture.json \
    --cache-dir ./.cache/kvisl \
    -o diagram.svg
```

`--update-lock` is the only mode that rewrites the generated dependency lock. A normal online render verifies existing locked URLs and hashes. Offline mode requires every remote dependency to exist in both the lock and the content-addressed cache.

The resolver recognizes `.kvisl.css` modules as immutable values and records their source role. Attaching them currently produces a diagnostic because the restricted stylesheet grammar is deliberately still an open language decision; silently interpreting browser CSS or inventing declarations in the compiler would conflict with the model.

## Diagnostics

Human output uses one leading emoji per progress, success, warning, or error line. Machine consumers can suppress progress and receive one structured diagnostic document:

```console
$ npx kvisl check diagram.tsx --diagnostics json
{"schema":"kvisl.diagnostics","version":"0.1.0","diagnostics":[]}
```

Any error diagnostic, unsupported output format, compilation failure, or inability to produce the requested artifact returns a nonzero status.

## Test the package before publishing

The manifest contains the public package metadata and runtime file allowlist, but this preparation does not publish anything. `npm pack` creates the exact artifact that a registry would serve:

```console
$ npm ci
$ npm test
$ npm run build
$ npm pack --pack-destination dist
$ npm exec --package ./dist/kvisl-0.1.0.tgz -- kvisl render diagram.tsx -o diagram.svg
```

The automated suite packs the repository, exposes the tarball's `bin`, invokes it through `npx`, and verifies the resulting SVG. Publication is intentionally a separate release action.
