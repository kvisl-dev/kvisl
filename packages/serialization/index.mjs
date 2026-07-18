import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";

export function parseArtifact(source, format) {
  return format === "yaml" ? YAML.parse(source) : JSON.parse(source);
}

export function serializeArtifact(value, format) {
  if (format === "yaml") return YAML.stringify(value, { sortMapEntries: true });
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function artifactFormat(file, fallback = "json") {
  if (!file) return fallback;
  const extension = path.extname(file).toLowerCase();
  return extension === ".yaml" || extension === ".yml" ? "yaml" : "json";
}

export async function readArtifact(file) {
  return parseArtifact(await readFile(path.resolve(file), "utf8"), artifactFormat(file));
}

export async function writeArtifact(file, value, format = artifactFormat(file)) {
  const serialized = serializeArtifact(value, format);
  if (!file || file === "-") return serialized;
  await writeFile(path.resolve(file), serialized, "utf8");
  return serialized;
}
