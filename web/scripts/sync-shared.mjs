#!/usr/bin/env node
// Copies repo-level shared artifacts (deployments/testnet.json, shared/classes.json) into
// web/lib/shared so the app builds even when deployed with `web/` as the root dir.
// Runs on predev/prebuild. If the sources aren't there (e.g. Vercel without outside
// files), the committed copies are used as-is.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const web = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repo = resolve(web, "..");
const out = resolve(web, "lib/shared");
mkdirSync(out, { recursive: true });

const copies = [
  [resolve(repo, "deployments/testnet.json"), resolve(out, "deployments.json")],
  [resolve(repo, "shared/classes.json"), resolve(out, "classes.json")],
];

let n = 0;
for (const [from, to] of copies) {
  if (!existsSync(from)) continue;
  copyFileSync(from, to);
  n++;
}
console.log(n ? `sync-shared: copied ${n} files into lib/shared` : "sync-shared: sources not found, using committed copies");
