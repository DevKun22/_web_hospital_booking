import "dotenv/config";

import { spawnSync } from "node:child_process";
import path from "node:path";

import { buildIntegrationEnvironment } from "./support/testDatabase.js";

const environment = buildIntegrationEnvironment();
const cliEntry = (name: "prisma" | "tsx") =>
  path.resolve(
    process.cwd(),
    "node_modules",
    name,
    "build",
    name === "prisma" ? "index.js" : "../dist/cli.mjs",
  );

const run = (command: string, args: string[]) => {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: environment,
    stdio: "inherit",
    shell: false,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

console.log("[phase0-test] Applying migrations to the dedicated test database...");
run(process.execPath, [cliEntry("prisma"), "migrate", "deploy"]);

console.log("[phase0-test] Running baseline integration contracts...");
run(process.execPath, [
  cliEntry("tsx"),
  "--test",
  "test/integration/baseline.test.ts",
]);
