import assert from "node:assert/strict";
import test from "node:test";
import {
  getRequiredPathParam,
  parseBooleanQuery,
  parseEnumQuery,
  parseNumberQuery,
  parseStringQuery,
} from "../../src/shared/http/requestParsers.js";
import { AppError } from "../../src/utils/appError.js";

test("getRequiredPathParam keeps the first Express path value", () => {
  assert.equal(getRequiredPathParam("appointment-1"), "appointment-1");
  assert.equal(
    getRequiredPathParam(["appointment-1", "appointment-2"]),
    "appointment-1",
  );
});

test("getRequiredPathParam preserves the Vietnamese validation contract", () => {
  assert.throws(
    () => getRequiredPathParam(undefined, "appointmentId"),
    (error) =>
      error instanceof AppError &&
      error.statusCode === 400 &&
      error.message === "Thiếu appointmentId",
  );
});

test("parseBooleanQuery only accepts the existing true and false values", () => {
  assert.equal(parseBooleanQuery("true"), true);
  assert.equal(parseBooleanQuery("false"), false);
  assert.equal(parseBooleanQuery("1"), undefined);
  assert.equal(parseBooleanQuery(true), undefined);
});

test("parseNumberQuery reads optional numbers and treats blank as missing", () => {
  assert.equal(parseNumberQuery("20"), 20);
  assert.equal(parseNumberQuery(""), undefined);
  assert.equal(parseNumberQuery("  "), undefined);
  assert.equal(parseNumberQuery("Infinity"), undefined);
  assert.equal(parseNumberQuery(20), undefined);
});

test("parseStringQuery keeps a single string value only", () => {
  assert.equal(parseStringQuery("tim mach"), "tim mach");
  assert.equal(parseStringQuery(["a", "b"]), undefined);
  assert.equal(parseStringQuery(undefined), undefined);
});

test("parseEnumQuery accepts known values and rejects the rest with 400", () => {
  const Status = { OPEN: "OPEN", CLOSED: "CLOSED" } as const;
  assert.equal(parseEnumQuery("OPEN", Status, "status"), "OPEN");
  assert.equal(parseEnumQuery("CLOSED", ["OPEN", "CLOSED"] as const, "status"), "CLOSED");
  assert.equal(parseEnumQuery(undefined, Status, "status"), undefined);
  assert.equal(parseEnumQuery("", Status, "status"), undefined);
  assert.throws(
    () => parseEnumQuery("DROP TABLE", Status, "status"),
    (error: unknown) => error instanceof AppError && error.statusCode === 400 && error.code === "INVALID_FILTER",
  );
});
