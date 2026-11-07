import assert from "node:assert/strict";
import test from "node:test";
import {
  PERMISSIONS,
  PERMISSION_CODES,
  getDefaultGrants,
  normalizeGrants,
  permissionsForRole,
} from "../../src/config/permissions.js";

test("default grants keep clinical data away from admin editing and staff", () => {
  const grants = getDefaultGrants();

  assert.deepEqual(grants["record.edit"], ["DOCTOR"]);
  assert.deepEqual(grants["prescription.write"], ["DOCTOR"]);
  assert.ok(!grants["record.view"].includes("STAFF"));
  assert.ok(!grants["prescription.view"].includes("STAFF"));
  assert.deepEqual(grants["invoice.refund"], ["ADMIN"]);
  assert.ok(grants["invoice.collect"].includes("STAFF"));
  assert.deepEqual(grants["pharmacy.dispense"], ["PHARMACIST"]);
});

test("a stored matrix cannot grant a role outside eligibleRoles", () => {
  const grants = normalizeGrants({
    "record.edit": ["STAFF", "ADMIN", "DOCTOR"],
    "prescription.write": ["ADMIN"],
    "pharmacy.adjust": ["ADMIN", "STAFF"],
    "invoice.refund": ["STAFF"],
  });

  assert.deepEqual(grants["record.edit"], ["DOCTOR"]);
  assert.deepEqual(grants["prescription.write"], ["DOCTOR"]);
  assert.deepEqual(grants["pharmacy.adjust"], ["PHARMACIST"]);
  assert.deepEqual(grants["invoice.refund"], ["ADMIN"]);
});

test("fixed roles cannot be removed and unknown codes are dropped", () => {
  const grants = normalizeGrants({
    "rbac.manage": [],
    "user.manage": [],
    "record.view": [],
    "not.a.permission": ["ADMIN"],
  });

  assert.deepEqual(grants["rbac.manage"], ["ADMIN"]);
  assert.deepEqual(grants["user.manage"], ["ADMIN"]);
  assert.deepEqual(grants["record.view"], ["DOCTOR"]);
  assert.equal(Object.keys(grants).length, PERMISSION_CODES.length);
});

test("optional permissions can be toggled within the eligible set", () => {
  const grants = normalizeGrants({
    "appointment.exam": ["DOCTOR"],
    "record.view": ["DOCTOR", "ADMIN"],
    "invoice.collect": ["ADMIN"],
  });

  assert.deepEqual(grants["appointment.exam"], ["DOCTOR"]);
  assert.deepEqual(grants["invoice.collect"], ["ADMIN"]);
  assert.ok(permissionsForRole(grants, "ADMIN").includes("record.view"));
  assert.ok(!permissionsForRole(grants, "STAFF").includes("invoice.collect"));
});

test("malformed stored values fall back to defaults", () => {
  for (const stored of [null, undefined, "x", 5, [], { "record.view": "ADMIN" }]) {
    assert.deepEqual(normalizeGrants(stored), getDefaultGrants());
  }
});

test("every permission has an eligible role and fixed roles are eligible", () => {
  for (const code of PERMISSION_CODES) {
    const definition = PERMISSIONS[code] as {
      eligibleRoles: readonly string[];
      fixedRoles: readonly string[];
      defaultRoles: readonly string[];
    };
    assert.ok(definition.eligibleRoles.length > 0, code);
    for (const role of [...definition.fixedRoles, ...definition.defaultRoles]) {
      assert.ok(definition.eligibleRoles.includes(role), `${code}: ${role}`);
    }
  }
});
