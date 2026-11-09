import assert from "node:assert/strict";
import test from "node:test";
import { maskContact, maskEmail, maskPhone } from "../../src/utils/maskContact.js";

test("emails keep two leading characters and the domain, nothing else", () => {
  assert.equal(maskEmail("nqlit2109@gmail.com"), "nq*******@gmail.com");
  assert.equal(maskEmail("ab@x.vn"), "a***@x.vn");
  assert.equal(maskEmail("a@x.vn"), "a***@x.vn");
  assert.equal(maskEmail("khong-co-a-cong"), "***");
});

test("phone numbers keep three leading and two trailing digits", () => {
  assert.equal(maskPhone("0901234567"), "090*****67");
  assert.equal(maskPhone("12345"), "*****");
});

test("maskContact picks the right masking and never returns the original value", () => {
  for (const value of ["nqlit2109@gmail.com", "0901234567", "a@b.c"]) {
    const masked = maskContact(value);
    assert.notEqual(masked, value);
    assert.ok(masked.includes("*"));
  }
});
