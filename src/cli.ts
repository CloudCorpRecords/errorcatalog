#!/usr/bin/env node
/**
 * errorcatalog CLI.
 *
 *   errorcatalog catalog --sources <sources.json> [--docs <docs.json>]
 *   errorcatalog mcp
 *
 * The sources and docs files each contain a JSON array of
 * {path, content} objects. Pure local text analysis: no
 * network, no configuration. Argument validation happens
 * before any file is read.
 * Exit codes: 0 success, 1 runtime error (including an
 * unreadable or invalid JSON file), 2 usage error.
 */
import { readFileSync } from "node:fs";
import { catalogErrors, formatPayload, VERSION } from "./errorcatalog.js";

function usage(): never {
  console.error(`Usage:
  errorcatalog catalog --sources <sources.json> [--docs <docs.json>]
  errorcatalog mcp
  errorcatalog --version`);
  process.exit(2);
}

function flag(rest: string[], name: string): string | undefined {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : undefined;
}

function readJsonArray(path: string, label: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    console.error(
      `error: cannot read or parse ${label} file '${path}': ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "--version" || cmd === "-v") {
    console.log(VERSION);
    return;
  }
  if (cmd === "mcp") {
    await import("./mcp.js");
    return;
  }
  if (cmd !== "catalog") usage();

  // ---- Argument validation (before any file is read) ----
  const flags = ["--sources", "--docs"];
  if (rest.some((a) => a.startsWith("--") && !flags.includes(a))) usage();
  const sourcesPath = flag(rest, "--sources");
  if (sourcesPath === undefined) usage();
  const docsPath = flag(rest, "--docs");
  if (rest.includes("--docs") && docsPath === undefined) usage();

  const sources = readJsonArray(sourcesPath, "sources");
  const docs = docsPath === undefined ? undefined : readJsonArray(docsPath, "docs");

  try {
    const out = catalogErrors(sources, docs);
    console.log(formatPayload(out));
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

void main();
