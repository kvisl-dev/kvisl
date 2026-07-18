import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import { CORE } from "../../experiments/layouter/src/authoring.mjs";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const authoring = path.join(packageRoot, "experiments/layouter/src/authoring.mjs");
const jsxRuntime = path.join(packageRoot, "experiments/layouter/src/jsx-runtime.mjs");
const LOCK_SCHEMA = "kvisl.dependencies";
const LOCK_VERSION = "0.1.0";

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function asExpandedChildren(original, expanded) {
  if (original == null) return undefined;
  if (Array.isArray(original)) return expanded;
  return expanded.length === 1 ? expanded[0] : expanded;
}

function expandList(value, diagnostics) {
  if (value == null || value === false || value === true) return [];
  if (Array.isArray(value)) return value.flatMap((item) => expandList(item, diagnostics));
  const expanded = expandValue(value, diagnostics);
  return Array.isArray(expanded) ? expanded.flatMap((item) => expandList(item, diagnostics)) : [expanded];
}

function expandValue(value, diagnostics) {
  if (!value?.$$jsx) return value;

  const { type, props = {} } = value;
  if (typeof type === "function") {
    const children = expandList(props.children, diagnostics);
    try {
      return expandValue(type({ ...props, children: asExpandedChildren(props.children, children) }), diagnostics);
    } catch (cause) {
      diagnostics.push({
        severity: "error",
        code: "component-evaluation",
        message: cause instanceof Error ? cause.message : String(cause),
      });
      return null;
    }
  }

  if (typeof type === "symbol") return expandList(props.children, diagnostics);
  if (type?.[CORE]) {
    return {
      core: type[CORE],
      props: Object.fromEntries(Object.entries(props).filter(([key]) => key !== "children")),
      children: expandList(props.children, diagnostics),
    };
  }

  diagnostics.push({ severity: "error", code: "unknown-element", message: "unknown JSX element type" });
  return null;
}

function diagnoseAttachedStylesheets(value, diagnostics) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) diagnoseAttachedStylesheets(item, diagnostics);
    return;
  }
  if (value.core) {
    const styles = Array.isArray(value.props?.styles) ? value.props.styles : [value.props?.styles];
    for (const stylesheet of styles) {
      if (!stylesheet?.$$kvislStylesheet) continue;
      diagnostics.push({
        severity: "error",
        code: "stylesheet-syntax-not-frozen",
        message: `cannot attach ${stylesheet.source}: the restricted .kvisl.css surface is still an open model decision`,
      });
    }
    diagnoseAttachedStylesheets(value.children, diagnostics);
  }
}

function mediaType(url, responseType) {
  const contentType = responseType?.split(";", 1)[0]?.trim();
  if (contentType) return contentType;
  if (url.endsWith(".tsx")) return "text/tsx";
  if (url.endsWith(".ts")) return "text/typescript";
  if (url.endsWith(".jsx")) return "text/jsx";
  if (url.endsWith(".json")) return "application/json";
  if (url.endsWith(".kvisl.css") || url.endsWith(".css")) return "text/css";
  return "text/javascript";
}

function loaderFor(url, type) {
  if (type === "application/json" || url.endsWith(".json")) return "json";
  if (url.endsWith(".tsx") || type === "text/tsx") return "tsx";
  if (url.endsWith(".ts") || type === "text/typescript") return "ts";
  if (url.endsWith(".jsx") || type === "text/jsx") return "jsx";
  return "js";
}

function jsrUrl(specifier) {
  const match = /^jsr:(@[^/]+\/[^@/]+)(?:@([^/]+))?(?:\/(.*))?$/.exec(specifier);
  if (!match) throw new Error(`invalid jsr specifier: ${specifier}`);
  const [, packageName, version = "latest", subpath = "mod.ts"] = match;
  return `https://jsr.io/${packageName}/${version}/${subpath}`;
}

function npmSpecifier(specifier) {
  const value = specifier.slice("npm:".length);
  const match = value.startsWith("@")
    ? /^(@[^/]+\/[^@/]+)(?:@([^/]+))?(?:\/(.*))?$/.exec(value)
    : /^([^@/]+)(?:@([^/]+))?(?:\/(.*))?$/.exec(value);
  if (!match) throw new Error(`invalid npm specifier: ${specifier}`);
  const [, packageName, version, subpath] = match;
  return { bare: subpath ? `${packageName}/${subpath}` : packageName, packageName, version };
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function packageMetadata(resolvedFile, packageName) {
  let directory = path.dirname(resolvedFile);
  while (directory !== path.dirname(directory)) {
    const manifest = path.join(directory, "package.json");
    if (await exists(manifest)) {
      const parsed = JSON.parse(await readFile(manifest, "utf8"));
      if (parsed.name === packageName) return { directory, version: parsed.version };
    }
    directory = path.dirname(directory);
  }
  return null;
}

async function fetchBounded(url, maximumRedirects = 5) {
  let current = url;
  for (let redirects = 0; redirects <= maximumRedirects; redirects += 1) {
    if (new URL(current).protocol !== "https:") throw new Error(`remote dependencies require HTTPS: ${current}`);
    const response = await fetch(current, { redirect: "manual" });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new Error(`redirect without Location while fetching ${current}`);
      if (redirects === maximumRedirects) throw new Error(`too many redirects while fetching ${url}`);
      current = new URL(location, current).href;
      continue;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status} while fetching ${current}`);
    return { response, finalUrl: current };
  }
  throw new Error(`could not fetch ${url}`);
}

class DependencyResolver {
  constructor(entry, options) {
    this.entry = entry;
    this.cacheDirectory = path.resolve(options.cacheDirectory ?? process.env.KVISL_CACHE_DIR ?? path.join(os.homedir(), ".cache/kvisl"));
    this.lockFile = path.resolve(options.lockFile ?? path.join(path.dirname(entry), "kvisl.lock.json"));
    this.updateLock = options.updateLock ?? false;
    this.offline = options.offline ?? false;
    this.maximumRemoteBytes = options.maximumRemoteBytes ?? 4 * 1024 * 1024;
    this.records = new Map();
    this.edges = new Map();
    this.canonicalUrls = new Map();
    this.lock = { schema: LOCK_SCHEMA, version: LOCK_VERSION, dependencies: {} };
  }

  async initialize() {
    if (await exists(this.lockFile)) {
      const parsed = JSON.parse(await readFile(this.lockFile, "utf8"));
      if (parsed.schema !== LOCK_SCHEMA || parsed.version !== LOCK_VERSION || typeof parsed.dependencies !== "object") {
        throw new Error(`unsupported dependency lock format in ${this.lockFile}`);
      }
      this.lock = parsed;
    }
  }

  rememberEdge(importer, requested) {
    if (!importer) return;
    if (!this.edges.has(importer)) this.edges.set(importer, new Set());
    this.edges.get(importer).add(requested);
  }

  async loadRemote(requested) {
    await mkdir(path.join(this.cacheDirectory, "sha256"), { recursive: true });
    const locked = this.lock.dependencies[requested];
    if (this.offline) {
      if (!locked) throw new Error(`offline dependency is not locked: ${requested}`);
      const cacheFile = path.join(this.cacheDirectory, "sha256", locked.sha256);
      if (!await exists(cacheFile)) throw new Error(`offline dependency is not cached: ${requested}`);
      const contents = await readFile(cacheFile);
      this.canonicalUrls.set(requested, locked.resolved);
      this.records.set(requested, { ...locked, requested });
      return { contents, finalUrl: locked.resolved, type: locked.mediaType };
    }

    const { response, finalUrl } = await fetchBounded(requested);
    const contents = Buffer.from(await response.arrayBuffer());
    if (contents.byteLength > this.maximumRemoteBytes) {
      throw new Error(`remote dependency exceeds ${this.maximumRemoteBytes} bytes: ${requested}`);
    }
    const digest = hash(contents);
    const type = mediaType(finalUrl, response.headers.get("content-type"));
    this.canonicalUrls.set(requested, finalUrl);
    if (locked && !this.updateLock && (locked.sha256 !== digest || locked.resolved !== finalUrl)) {
      throw new Error(`locked dependency changed: ${requested}; run with --update-lock to accept it`);
    }
    await writeFile(path.join(this.cacheDirectory, "sha256", digest), contents);
    const record = {
      role: finalUrl.endsWith(".kvisl.css") || type === "text/css" ? "stylesheet" : "module",
      requested,
      resolved: finalUrl,
      mediaType: type,
      sha256: digest,
      dependencies: [],
    };
    this.records.set(requested, record);
    return { contents, finalUrl, type };
  }

  async finalize(metafile) {
    for (const [input, details] of Object.entries(metafile.inputs)) {
      if (input.startsWith("https://") || input.startsWith("kvisl-")) continue;
      const absolute = path.isAbsolute(input) ? input : path.resolve(input);
      if (!await exists(absolute)) continue;
      const contents = await readFile(absolute);
      this.records.set(pathToFileURL(absolute).href, {
        role: absolute.endsWith(".kvisl.css") ? "stylesheet" : "module",
        requested: pathToFileURL(absolute).href,
        resolved: pathToFileURL(absolute).href,
        mediaType: mediaType(absolute),
        sha256: hash(contents),
        dependencies: details.imports.map((item) => item.path).sort(),
      });
    }

    for (const [requested, record] of this.records) {
      record.dependencies = [...new Set([...(record.dependencies ?? []), ...(this.edges.get(requested) ?? [])])].sort();
    }
    const dependencies = [...this.records.values()].sort((left, right) => left.requested.localeCompare(right.requested));
    if (this.updateLock) {
      const locked = Object.fromEntries(dependencies
        .filter((record) => record.resolved.startsWith("https://"))
        .map((record) => [record.requested, record]));
      const document = `${JSON.stringify({ schema: LOCK_SCHEMA, version: LOCK_VERSION, dependencies: locked }, null, 2)}\n`;
      await writeFile(this.lockFile, document, "utf8");
    }
    return dependencies;
  }

  plugin() {
    return {
      name: "kvisl-dependencies",
      setup: (builder) => {
        builder.onResolve({ filter: /^@kvisl\/core\/jsx-runtime$/ }, () => ({ path: jsxRuntime }));
        builder.onResolve({ filter: /^@kvisl\/core$/ }, () => ({ path: authoring }));
        builder.onResolve({ filter: /^jsr:/ }, (args) => {
          const resolved = jsrUrl(args.path);
          this.rememberEdge(args.importer, resolved);
          return { path: resolved, namespace: "kvisl-remote" };
        });
        builder.onResolve({ filter: /^npm:/ }, async (args) => {
          const specifier = npmSpecifier(args.path);
          const resolved = await builder.resolve(specifier.bare, {
            importer: args.importer,
            kind: args.kind,
            resolveDir: args.resolveDir || path.dirname(this.entry),
          });
          if (resolved.errors.length) return { errors: resolved.errors };
          const contents = await readFile(resolved.path);
          const metadata = await packageMetadata(resolved.path, specifier.packageName);
          if (specifier.version && metadata?.version !== specifier.version) {
            return { errors: [{ text: `${args.path} requires ${specifier.packageName}@${specifier.version}, but Node resolved ${metadata?.version ?? "an unknown version"}` }] };
          }
          this.records.set(args.path, {
            role: "module",
            requested: args.path,
            resolved: resolved.path,
            mediaType: mediaType(resolved.path),
            sha256: hash(contents),
            dependencies: [],
            package: specifier.packageName,
            requestedVersion: specifier.version,
            resolvedVersion: metadata?.version,
          });
          return { path: resolved.path, external: resolved.external };
        });
        builder.onResolve({ filter: /^http:\/\// }, (args) => ({
          errors: [{ text: `remote dependencies require HTTPS: ${args.path}` }],
        }));
        builder.onResolve({ filter: /^https:\/\// }, (args) => {
          this.rememberEdge(args.importer, args.path);
          return { path: args.path, namespace: "kvisl-remote" };
        });
        builder.onResolve({ filter: /.*/, namespace: "kvisl-remote" }, (args) => {
          const resolved = new URL(args.path, this.canonicalUrls.get(args.importer) ?? args.importer).href;
          this.rememberEdge(args.importer, resolved);
          return { path: resolved, namespace: "kvisl-remote" };
        });
        builder.onLoad({ filter: /\.kvisl\.css$/, namespace: "file" }, async (args) => {
          const contents = await readFile(args.path, "utf8");
          const source = pathToFileURL(args.path).href;
          return {
            contents: `export default Object.freeze({ $$kvislStylesheet: true, source: ${JSON.stringify(source)}, text: ${JSON.stringify(contents)} });`,
            loader: "js",
          };
        });
        builder.onLoad({ filter: /.*/, namespace: "kvisl-remote" }, async (args) => {
          const loaded = await this.loadRemote(args.path);
          if (loaded.type === "text/css" || loaded.finalUrl.endsWith(".kvisl.css")) {
            const source = JSON.stringify(loaded.contents.toString("utf8"));
            return {
              contents: `export default Object.freeze({ $$kvislStylesheet: true, source: ${JSON.stringify(loaded.finalUrl)}, text: ${source} });`,
              loader: "js",
            };
          }
          return {
            contents: loaded.contents,
            loader: loaderFor(loaded.finalUrl, loaded.type),
          };
        });
      },
    };
  }
}

export async function evaluateFile(entry, options = {}) {
  const absoluteEntry = path.resolve(entry);
  const resolver = new DependencyResolver(absoluteEntry, options);
  await resolver.initialize();
  const result = await build({
    entryPoints: [absoluteEntry],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    target: "es2022",
    jsx: "automatic",
    jsxImportSource: "@kvisl/core",
    plugins: [resolver.plugin()],
    banner: {
      js: `import { createRequire as __kvislCreateRequire } from "node:module"; const require = __kvislCreateRequire(${JSON.stringify(pathToFileURL(absoluteEntry).href)});`,
    },
    sourcemap: "inline",
    metafile: true,
  });
  const code = result.outputFiles[0].text;
  const source = `${pathToFileURL(absoluteEntry).href}?prototype=${hash(code).slice(0, 16)}`;
  const url = `data:text/javascript;base64,${Buffer.from(`${code}\n//# sourceURL=${source}`).toString("base64")}`;
  const module = await import(url);
  const diagnostics = [];
  const expanded = expandValue(module.default, diagnostics);
  if (module.default === undefined) {
    diagnostics.push({ severity: "error", code: "module-root", message: "diagram module must have a default export" });
  }
  diagnoseAttachedStylesheets(expanded, diagnostics);
  const dependencies = await resolver.finalize(result.metafile);
  return { expanded, diagnostics, dependencies };
}
