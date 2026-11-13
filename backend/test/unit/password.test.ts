import assert from "node:assert/strict";
import test from "node:test";

import bcrypt from "bcrypt";

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

test("password utility still verifies legacy bcrypt hashes", async () => {
  const hash = await bcrypt.hash(PASSWORD, 4);

  assert.equal(getPasswordHashAlgorithm(hash), "bcrypt");
  assert.equal(await comparePassword(PASSWORD, hash), true);
  assert.equal(await comparePassword("sai-mat-khau", hash), false);
});

test("password utility rejects unsupported stored hash formats", async () => {
  assert.equal(getPasswordHashAlgorithm("plain-text"), "unsupported");
  assert.equal(await comparePassword(PASSWORD, "plain-text"), false);
});
