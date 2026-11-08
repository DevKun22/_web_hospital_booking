import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { PERMISSION_CODES } from "../../src/config/permissions.js";

// Giữ ma trận quyền luôn đúng khi thêm tính năng: mọi tuyến dashboard phải qua
// `authDashboard` và có `requirePermission` (gắn thẳng vào tuyến hoặc ở `router.use` đứng
// trước nó), và mọi mã quyền được dùng phải tồn tại trong `permissions.ts`.
// Đọc mã nguồn thay vì chạy ứng dụng để không cần cơ sở dữ liệu.

const routesDir = path.resolve(process.cwd(), "src/routes");
const read = (file: string) => readFileSync(path.join(routesDir, file), "utf8");

type Mount = { prefix: string; file: string; routerVar: string };

const dashboardMounts = (): Mount[] => {
  const index = read("index.ts");
  const imports = new Map<string, { file: string; named: boolean }>();
  const importRegex = /import\s+(?:(\w+)|\{([^}]*)\})\s+from\s+"\.\/([\w.]+)\.js"/g;
  for (const match of index.matchAll(importRegex)) {
    const [, defaultName, named, file] = match;
    if (defaultName) imports.set(defaultName, { file: `${file}.ts`, named: false });
    for (const name of (named ?? "").split(",").map((part) => part.trim()).filter(Boolean)) {
      imports.set(name, { file: `${file}.ts`, named: true });
    }
  }

  const mounts: Mount[] = [];
  for (const match of index.matchAll(/router\.use\("(\/dashboard\/[^"]+)",\s*(\w+)\)/g)) {
    const [, prefix, name] = match;
    const imported = imports.get(name);
    assert.ok(imported, `router ${name} mounted at ${prefix} must be imported in routes/index.ts`);
    mounts.push({ prefix, file: imported.file, routerVar: imported.named ? name : "router" });
  }
  return mounts;
};

test("every dashboard route is authenticated and guarded by a known permission", () => {
  const mounts = dashboardMounts();
  assert.ok(mounts.length >= 20, `expected the dashboard mounts, found ${mounts.length}`);

  const known = new Set<string>(PERMISSION_CODES);
  const problems: string[] = [];

  for (const mount of mounts) {
    const source = read(mount.file);
    const v = mount.routerVar;
    const statementRegex = new RegExp(
      `${v}\\.(get|post|put|patch|delete|use)\\(([\\s\\S]*?)\\);`,
      "g",
    );

    let authenticated = false;
    let covered = false;
    for (const match of source.matchAll(statementRegex)) {
      const [, method, args] = match;
      if (args.includes("authDashboard")) authenticated = true;
      const guarded = args.includes("requirePermission(");
      if (method === "use") {
        if (guarded) covered = true;
        continue;
      }
      if (!guarded && !covered) {
        problems.push(`${mount.prefix} ${method.toUpperCase()} ${args.trim().split(/[,\s]/)[0]}: no requirePermission`);
      }
    }
    if (!authenticated) problems.push(`${mount.prefix} (${mount.file}): authDashboard is never applied`);

    for (const code of source.matchAll(/requirePermission\(([^)]*)\)/g)) {
      for (const raw of code[1].split(",")) {
        const name = raw.trim().replace(/^"|"$/g, "");
        if (name && !known.has(name)) problems.push(`${mount.file}: unknown permission "${name}"`);
      }
    }
  }

  assert.deepEqual(problems, []);
});

test("every permission code protects at least one route or is documented as service-level", () => {
  const used = new Set<string>();
  for (const mount of dashboardMounts()) {
    for (const code of read(mount.file).matchAll(/requirePermission\(([^)]*)\)/g)) {
      for (const raw of code[1].split(",")) used.add(raw.trim().replace(/^"|"$/g, ""));
    }
  }
  // Mã nào không gắn vào tuyến nào phải được nêu ở đây kèm lý do, nếu không là mã chết.
  const serviceLevelOnly: string[] = [];
  const unused = PERMISSION_CODES.filter(
    (code) => !used.has(code) && !serviceLevelOnly.includes(code),
  );
  assert.deepEqual(unused, []);
});
