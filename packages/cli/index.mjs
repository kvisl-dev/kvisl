import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { hasErrors, materialize, normalizeFile, paint, render, solve } from "../pipeline/index.mjs";
import { artifactFormat, readArtifact, writeArtifact } from "../serialization/index.mjs";

const STEPS = {
  resolve: "📦 Resolving dependencies",
  transform: "⚡ Transforming TSX",
  expand: "🧩 Expanding components",
  normalize: "🧱 Normalizing the model",
  materialize: "🔭 Selecting and materializing views",
  layout: "📐 Laying out objects",
  route: "🛤️ Routing lines",
  paint: "🎨 Painting SVG",
};

const HELP = `Kvísl Script prototype CLI

Usage:
  kvisl render <diagram.tsx> -o <diagram.svg>
  kvisl check <diagram.tsx>
  kvisl normalize <diagram.tsx> [-o logical.json]
  kvisl materialize <logical.json> [-o projection.json]
  kvisl solve <projection.json> [-o solved.json]
  kvisl paint <solved.json> -o <diagram.svg>

Options:
  -o, --output <file>       Output file; use - for stdout
      --format <format>     svg or excalidraw for render/paint
      --target <medium>     Rendering medium such as screen, print, or infinite-canvas
      --inline-size <px>    Available target width for adaptive views
      --block-size <px>     Available target height for adaptive views
      --debug-routing       Paint the solved routing mesh
      --transparent         Do not paint a canvas background
      --background <color>  Override the canvas background
      --lock <file>         Dependency lock file
      --update-lock         Refresh locked remote dependency hashes
      --offline             Resolve remote dependencies from lock and cache only
      --cache-dir <path>    Content-addressed dependency cache
      --diagnostics <mode>  human or json
      --quiet               Suppress human progress output
  -h, --help                Show this help
  -v, --version             Show the package version
`;

function parseArguments(argv) {
  const options = { positionals: [], diagnostics: "human" };
  const values = new Set(["-o", "--output", "--format", "--target", "--inline-size", "--block-size", "--background", "--lock", "--cache-dir", "--diagnostics"]);
  const booleans = new Set(["--debug-routing", "--transparent", "--update-lock", "--offline", "--quiet", "-h", "--help", "-v", "--version"]);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (values.has(argument)) {
      if (index + 1 >= argv.length) throw new Error(`missing value after ${argument}`);
      options[argument.replace(/^--?/, "").replaceAll("-", "_")] = argv[++index];
    } else if (booleans.has(argument)) {
      options[argument.replace(/^--?/, "").replaceAll("-", "_")] = true;
    } else if (argument.startsWith("-")) {
      throw new Error(`unknown option: ${argument}`);
    } else {
      options.positionals.push(argument);
    }
  }
  options.output ??= options.o;
  options.help ??= options.h;
  options.version ??= options.v;
  return options;
}

function numberOption(value, name) {
  if (value == null) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${name} must be a positive number`);
  return parsed;
}

function commandOptions(options) {
  const human = options.diagnostics !== "json" && !options.quiet;
  return {
    compiler: {
      lockFile: options.lock,
      updateLock: options.update_lock,
      offline: options.offline,
      cacheDirectory: options.cache_dir,
    },
    projection: {
      medium: options.target,
      inlineSize: numberOption(options.inline_size, "--inline-size"),
      blockSize: numberOption(options.block_size, "--block-size"),
    },
    paint: {
      debugRouting: options.debug_routing,
      transparent: options.transparent,
      background: options.background,
    },
    progress: human ? (step) => console.error(STEPS[step]) : undefined,
  };
}

function outputFormat(options, output, fallback) {
  return options.format ?? (output ? path.extname(output).slice(1).toLowerCase() : fallback);
}

function artifactDestination(command, source, output) {
  if (output) return output;
  if (command === "normalize") return "-";
  const suffix = command === "materialize" ? "projection" : "solved";
  return `${path.basename(source, path.extname(source))}.${suffix}.json`;
}

async function writeOutput(output, contents) {
  if (!output || output === "-") {
    process.stdout.write(contents);
    return;
  }
  await mkdir(path.dirname(path.resolve(output)), { recursive: true });
  await writeFile(path.resolve(output), contents, "utf8");
}

function printDiagnostics(diagnostics, mode) {
  if (mode === "json") {
    process.stderr.write(`${JSON.stringify({ schema: "kvisl.diagnostics", version: "0.1.0", diagnostics })}\n`);
    return;
  }
  for (const diagnostic of diagnostics) {
    const icon = diagnostic.severity === "error" ? "❌" : diagnostic.severity === "warning" ? "⚠️" : "ℹ️";
    console.error(`${icon} ${diagnostic.code}: ${diagnostic.message}`);
  }
}

async function version() {
  const packageFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../package.json");
  const packageJson = JSON.parse(await readFile(packageFile, "utf8"));
  return packageJson.version;
}

export async function run(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  if (!new Set(["human", "json"]).has(options.diagnostics)) {
    throw new Error("--diagnostics must be human or json");
  }
  if (options.version) {
    process.stdout.write(`${await version()}\n`);
    return 0;
  }
  if (options.help || !options.positionals.length) {
    process.stdout.write(HELP);
    return options.help ? 0 : 2;
  }
  const [command, input] = options.positionals;
  if (!input) throw new Error(`missing input for ${command}`);
  const pipelineOptions = commandOptions(options);

  if (command === "render") {
    const output = options.output ?? `${path.basename(input, path.extname(input))}.svg`;
    const format = outputFormat(options, output, "svg");
    if (format === "excalidraw") throw new Error("the Excalidraw painter is not implemented yet; SVG is available");
    if (format !== "svg") throw new Error(`unsupported render format: ${format}`);
    const result = await render(input, pipelineOptions);
    await writeOutput(output, result.output);
    printDiagnostics(result.solved.diagnostics, options.diagnostics);
    if (options.diagnostics !== "json" && !options.quiet) {
      console.error(`✨ Wrote ${output} (${result.solved.scene.width}×${result.solved.scene.height})`);
    }
    return result.failed ? 1 : 0;
  }

  if (command === "check") {
    const logical = await normalizeFile(input, pipelineOptions);
    const projection = materialize(logical, pipelineOptions);
    const solved = solve(projection, pipelineOptions);
    printDiagnostics(solved.diagnostics, options.diagnostics);
    if (options.diagnostics !== "json" && !options.quiet && !hasErrors(solved)) console.error("✅ Diagram is valid and solvable");
    return hasErrors(solved) ? 1 : 0;
  }

  if (command === "normalize") {
    const artifact = await normalizeFile(input, pipelineOptions);
    const output = artifactDestination(command, input, options.output);
    const serialized = await writeArtifact(output, artifact, artifactFormat(output));
    if (output === "-") process.stdout.write(serialized);
    printDiagnostics(artifact.diagnostics, options.diagnostics);
    return hasErrors(artifact) ? 1 : 0;
  }

  if (command === "materialize" || command === "solve") {
    const source = await readArtifact(input);
    const artifact = command === "materialize" ? materialize(source, pipelineOptions) : solve(source, pipelineOptions);
    const output = artifactDestination(command, input, options.output);
    const serialized = await writeArtifact(output, artifact, artifactFormat(output));
    if (output === "-") process.stdout.write(serialized);
    printDiagnostics(artifact.diagnostics, options.diagnostics);
    return hasErrors(artifact) ? 1 : 0;
  }

  if (command === "paint") {
    const format = outputFormat(options, options.output, "svg");
    if (format === "excalidraw") throw new Error("the Excalidraw painter is not implemented yet; SVG is available");
    if (format !== "svg") throw new Error(`unsupported paint format: ${format}`);
    const solved = await readArtifact(input);
    const output = options.output ?? `${path.basename(input, path.extname(input))}.svg`;
    const svg = paint(solved, pipelineOptions);
    await writeOutput(output, svg);
    printDiagnostics(solved.diagnostics, options.diagnostics);
    if (options.diagnostics !== "json" && !options.quiet) console.error(`✨ Wrote ${output}`);
    return hasErrors(solved) ? 1 : 0;
  }

  throw new Error(`unknown command: ${command}`);
}

export async function main(argv = process.argv.slice(2)) {
  try {
    process.exitCode = await run(argv);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    const json = argv.some((argument, index) => argument === "--diagnostics" && argv[index + 1] === "json");
    if (json) {
      process.stderr.write(`${JSON.stringify({
        schema: "kvisl.diagnostics",
        version: "0.1.0",
        diagnostics: [{ severity: "error", code: "cli", message }],
      })}\n`);
    } else {
      console.error(`❌ ${message}`);
    }
    process.exitCode = 1;
  }
}
