import assert from "node:assert/strict";
import test from "node:test";

import {
  comparePassword,
  getPasswordHashAlgorithm,
  hashPassword,
} from "../../src/utils/password.js";

const PASSWORD = "Mat khau thu nghiem 2026";

test("hashPassword writes Argon2id PHC hashes with bounded parameters", async () => {
  const hash = await hashPassword(PASSWORD);

  assert.equal(getPasswordHashAlgorithm(hash), "argon2id");
  assert.match(hash, /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  assert.equal(await comparePassword(PASSWORD, hash), true);
  assert.equal(await comparePassword("sai-mat-khau", hash), false);
});

test("legacy bcrypt hashes are no longer accepted", async () => {
  const bcryptHash = "$2b$04$0123456789012345678901uM0vZ1i2y5m6S1H0n3Qbq3K5t8uGxW6";
  assert.equal(getPasswordHashAlgorithm(bcryptHash), "unsupported");
  assert.equal(await comparePassword(PASSWORD, bcryptHash), false);
});

test("password utility rejects unsupported stored hash formats", async () => {
  assert.equal(getPasswordHashAlgorithm("plain-text"), "unsupported");
  assert.equal(await comparePassword(PASSWORD, "plain-text"), false);
});
