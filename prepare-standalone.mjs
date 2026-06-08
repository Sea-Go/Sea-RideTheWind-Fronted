import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const nextDir = path.join(rootDir, ".next");
const standaloneDir = path.join(nextDir, "standalone");

if (!existsSync(standaloneDir)) {
  console.log("skip prepare-standalone: .next/standalone not found");
  process.exit(0);
}

const copyTargets = [
  {
    label: ".next/static",
    source: path.join(nextDir, "static"),
    destination: path.join(standaloneDir, ".next", "static"),
  },
  {
    label: "public",
    source: path.join(rootDir, "public"),
    destination: path.join(standaloneDir, "public"),
  },
];

for (const target of copyTargets) {
  if (!existsSync(target.source)) {
    console.log(`skip prepare-standalone: ${target.label} not found`);
    continue;
  }

  rmSync(target.destination, { force: true, recursive: true });
  mkdirSync(path.dirname(target.destination), { recursive: true });
  cpSync(target.source, target.destination, { recursive: true });
  console.log(`prepared standalone asset: ${target.label}`);
}
